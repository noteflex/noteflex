/**
 * 5-A: 4-F 출제 결정 검증용 시뮬레이터 — 한 세션 실행.
 *
 * NoteGame.tsx의 `composeBatch + generateBatch/generateKeyBatch` 흐름을
 * React-free로 재현하되, weightingContext 빌드와 PickDecision trace에 집중.
 *
 * 정책 parity 대상:
 *   - sessionStreak / adaptive recordAttempt 순서 (NoteGame handleAnswer와 동일)
 *   - prevNotes FIFO cap 3 (직전음 큐)
 *   - composeBatch baseCtx 1회 구성 + n_plus_2_recovery trace
 *   - generateNewBatch에 enriched ctx 전달
 *
 * 의도적 차이 (시뮬레이터 목적상):
 *   - 라이브 시스템 미모델 — 항상 maxTurns 또는 all-stages-complete까지 진행
 *   - final-retry phase 미지원 — regular phase 출제 결정에만 집중
 *   - 오답 시 NoteGame은 같은 자리 유지(타이머만 리셋)이나, 시뮬레이터도 동일하게 같은 자리 유지
 *     (단 lives gameover 없음 → 무한 루프 방지 위해 turn 카운터는 그대로지만 maxTurns로 cap)
 *
 * useState 분리 X — 모두 로컬 변수로 처리.
 */

import {
  generateBatch,
  generateKeyBatch,
  getNotesForLevel,
  getClefForLevel,
  buildNoteId,
  keySignatureNotesOf,
  keySignatureLabelOf,
  getRandomKeySignature,
  type NoteType,
  type KeySignatureType,
  type WeightingContext,
} from "@/components/NoteGame";
import { getStagesFor, type Sublevel } from "@/lib/levelSystem";
import type { AdaptiveMode } from "@/lib/noteWeighting";
import type { WeakScoreMap } from "@/hooks/useUserWeakScores";
import {
  _setPickDecisionEnabled,
  _resetPickDecisionEnabled,
  clearPickDecisions,
  getPickDecisions,
  recordPickDecision,
  buildReasonText,
  type PickDecision,
} from "@/lib/pickDecision";
import { SimRetryQueue, type RetryNoteKey } from "@/lib/simulator/retryQueue";
import { SimUser, type SimUserModel } from "./simUser";
import { SimSessionStreak } from "./simSessionStreak";
import { SimAdaptive } from "./simAdaptive";

// ─────────────────────────────────────────────────────────────
// RNG (seeded — SimUser의 정답/오답 결정용. generateBatch는 Math.random 사용.)
// ─────────────────────────────────────────────────────────────

class SeededRng {
  private state: number;
  constructor(seed: number) {
    this.state = (seed | 0) || 1;
  }
  next(): number {
    // mulberry32
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// ─────────────────────────────────────────────────────────────
// 입출력 타입
// ─────────────────────────────────────────────────────────────

export interface SimConfig {
  /** 1..7 */
  level: number;
  sublevel: Sublevel;
  userModel: SimUserModel;
  /** Premium 사용자 여부. false면 adaptive ratio=0. */
  isPremium: boolean;
  /** WeakScoreMap 시드 (선택). 미지정 시 빈 맵. */
  weakScoreMap?: WeakScoreMap;
  /** 최대 턴 수 (safety cap). */
  maxTurns: number;
  /** SimUser의 결정 시드 (재현용). */
  seed: number;
  /** Lv5+에서 keySig 강제 지정. 미지정 시 getRandomKeySignature(level). */
  forcedKeySig?: KeySignatureType;
  /**
   * true면 all-stages-complete 도달 시 stage 상태만 reset(stageIdx=0, currentSet=1, setProgress=0)
   * 하고 maxTurns까지 계속 루프. adaptive/sessionStreak/queue/prevNotes는 누적 유지.
   * (NoteGame의 replay와 다름 — replay는 모든 상태 reset)
   * 시나리오 통계 수집용. default false.
   */
  cyclic?: boolean;
}

/** 한 턴(= 한 시도)의 이벤트. 오답으로 같은 자리 재시도하면 turn은 같아도 attemptIndex가 증가. */
export interface SimEvent {
  /** NoteGame parity: 정답 후 advance에서만 +1. 오답 같은 자리 유지 시 turn 동일. */
  turn: number;
  /** 시도 일련 번호 (events 배열 인덱스와 동일). */
  attemptIndex: number;
  /** 현재 batch 내 인덱스. */
  batchIndex: number;
  /** 현재 batch 크기. */
  batchSize: number;
  shown: NoteType;
  shownId: string;
  /** batch[0..retryCount-1]에 속한 음표인지. */
  isRetry: boolean;
  correct: boolean;
  responseTimeSec: number;
  /** 이 결정 직전까지의 누적 정답률. */
  accuracyBeforePick: number;
  adaptiveModeAtPick: AdaptiveMode;
  weakSlotRatioAtPick: number;
  /** 시도 직후 큐 크기. */
  queueSizeAfter: number;
}

export interface SimResult {
  config: SimConfig;
  endReason: "max-turns" | "all-stages-complete" | "empty-batch";
  /** 마지막 events.length. */
  totalAttempts: number;
  correctCount: number;
  missCount: number;
  retryAppearances: number;
  finalQueueSize: number;
  events: SimEvent[];
  /** 출제 결정 trace 전체 (n_plus_2_recovery + weak_weighted + general). */
  decisions: PickDecision[];
  /** adaptive 모드별 누적 결정 횟수 (시도 단위). */
  adaptiveModeHistogram: Record<AdaptiveMode, number>;
  /** 사용된 keySig (Lv5+ 검증용). */
  keySig: KeySignatureType;
}

// ─────────────────────────────────────────────────────────────
// 실행 엔트리포인트
// ─────────────────────────────────────────────────────────────

export function runSimSession(cfg: SimConfig): SimResult {
  // PickDecision 활성화 (글로벌 플래그 — 세션 종료 시 복원).
  _setPickDecisionEnabled(true);
  clearPickDecisions();
  try {
    return runSimSessionInner(cfg);
  } finally {
    _resetPickDecisionEnabled();
  }
}

function runSimSessionInner(cfg: SimConfig): SimResult {
  const rng = new SeededRng(cfg.seed);
  const user = new SimUser(cfg.userModel, () => rng.next());
  const weakScoreMap: WeakScoreMap = cfg.weakScoreMap ?? new Map();
  const sessionStreak = new SimSessionStreak();
  const adaptive = new SimAdaptive(cfg.isPremium);
  const queue = new SimRetryQueue();

  const stages = getStagesFor(cfg.sublevel, false, cfg.level);

  // Pool · keySig · clef 설정.
  let keySig: KeySignatureType;
  let pool: NoteType[] | null;
  let lvClef: "treble" | "bass";
  if (cfg.level >= 5) {
    keySig = cfg.forcedKeySig ?? getRandomKeySignature(cfg.level);
    pool = null;
    lvClef = "treble"; // Lv5+는 batch별로 결정 — 이 값 미사용.
  } else {
    keySig = { key: "C", abcKey: "C" };
    pool = getNotesForLevel(cfg.level);
    lvClef = getClefForLevel(cfg.level);
  }

  // 세션 상태.
  let turn = 0;
  let totalAttempts = 0;
  let totalCorrect = 0;
  let stageIdx = 0;
  let currentSet = 1;
  let setProgress = 0;
  const prevNotes: string[] = [];
  let lastShownNote: NoteType | null = null;

  const events: SimEvent[] = [];
  const allDecisions: PickDecision[] = [];
  const adaptiveModeHistogram: Record<AdaptiveMode, number> = {
    free: 0, warmup: 0, boost_weak: 0, reduce_weak: 0, normal: 0,
  };

  // ── composeBatch: NoteGame.tsx 미러링 ─────────────────────────
  function composeBatchSim(batchSize: number, lastShown: NoteType | null): {
    batch: NoteType[];
    retryCount: number;
  } {
    const accuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
    const baseCtx: Omit<WeightingContext, "keySignatureNotes" | "keySignatureLabel"> = {
      weakScoreMap,
      getStreakMultiplier: sessionStreak.getMasteryMultiplier,
      isStreakMastered: sessionStreak.isMastered,
      prevNotes: prevNotes.slice(),
      turn,
      accuracyBeforePick: accuracy,
      weakSlotRatio: adaptive.getWeakSlotRatio(),
      adaptiveMode: adaptive.getAdaptiveMode(),
      queueState: queue.getIds(),
    };

    const retryNotes: NoteType[] = [];
    let prev: NoteType | null = lastShown;

    while (retryNotes.length < batchSize) {
      const lastShownKey: RetryNoteKey | null = prev
        ? {
            key: prev.key,
            octave: prev.octave,
            accidental: prev.accidental,
            clef: prev.clef ?? lvClef,
          }
        : null;
      const due = queue.popDueOrNull(turn, lastShownKey);
      if (!due) break;

      const retryNote: NoteType = {
        name: due.key,
        key: due.key,
        y: 0,
        octave: due.octave,
        accidental: due.accidental,
        clef: due.clef,
      };
      retryNotes.push(retryNote);

      // n_plus_2_recovery trace.
      const retryNoteId = buildNoteId(due.clef, due.key, due.octave, due.accidental);
      const decisionPartial: Omit<PickDecision, "reasonText"> = {
        turn: baseCtx.turn,
        pickedNote: {
          key: due.key,
          octave: parseInt(due.octave, 10),
          clef: due.clef,
          accidental: due.accidental,
          noteId: retryNoteId,
        },
        source: "n_plus_2_recovery",
        context: {
          accuracyBeforePick: baseCtx.accuracyBeforePick,
          adaptiveMode: baseCtx.adaptiveMode,
          weakSlotRatio: baseCtx.weakSlotRatio,
          queueState: baseCtx.queueState,
          previousNotes: baseCtx.prevNotes,
          keySignature: keySignatureLabelOf(keySig),
          sublevelPoolSize: 0,
          keySignatureNotesInPool: 0,
        },
        candidates: [],
        randomValue: null,
        cumulativeProbabilityHit: null,
        timestamp: Date.now(),
      };
      recordPickDecision({
        ...decisionPartial,
        reasonText: buildReasonText(decisionPartial),
      });

      prev = retryNote;
    }

    const newCount = batchSize - retryNotes.length;
    let newNotes: NoteType[] = [];
    if (newCount > 0) {
      const enrichedCtx: WeightingContext = {
        ...baseCtx,
        keySignatureNotes: keySignatureNotesOf(keySig),
        keySignatureLabel: keySignatureLabelOf(keySig),
      };
      if (cfg.level >= 5) {
        newNotes = generateKeyBatch(
          cfg.level, newCount, keySig, new Map(), prev, enrichedCtx,
        ).notes;
      } else {
        newNotes = generateBatch(
          pool!, newCount, lvClef, new Map(), prev, enrichedCtx,
        );
      }
    }

    // Drain: 5-A는 PickDecision 글로벌 버퍼(ring=1000)를 매 composeBatch마다 회수.
    // 장기 세션에서 ring 오버플로로 결정 누락 방지.
    const drained = getPickDecisions();
    allDecisions.push(...drained);
    clearPickDecisions();

    return { batch: [...retryNotes, ...newNotes], retryCount: retryNotes.length };
  }

  // ── 초기 batch ───────────────────────────────────────────────
  let composed = composeBatchSim(stages[0].batchSize, null);
  let currentBatch = composed.batch;
  let currentRetryCount = composed.retryCount;
  let currentIndex = 0;

  if (currentBatch.length === 0) {
    return {
      config: cfg,
      endReason: "empty-batch",
      totalAttempts: 0,
      correctCount: 0,
      missCount: 0,
      retryAppearances: 0,
      finalQueueSize: 0,
      events,
      decisions: allDecisions,
      adaptiveModeHistogram,
      keySig,
    };
  }

  let endReason: SimResult["endReason"] = "max-turns";

  // ── 메인 루프 ────────────────────────────────────────────────
  for (let safety = 0; safety < cfg.maxTurns; safety++) {
    const target = currentBatch[currentIndex];
    if (!target) {
      endReason = "all-stages-complete";
      break;
    }

    const clefForTarget = target.clef ?? lvClef;
    const targetId = buildNoteId(
      clefForTarget, target.key, target.octave, target.accidental,
    );
    const isRetryTurn = currentIndex < currentRetryCount;

    const accuracyAtPick = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
    const adaptiveModeAtPick = adaptive.getAdaptiveMode();
    const weakSlotRatioAtPick = adaptive.getWeakSlotRatio();

    const ans = user.answer(targetId);

    // NoteGame parity: recordAttempt × 2 + prevNotes FIFO.
    sessionStreak.recordAttempt(targetId, ans.correct, ans.responseTimeSec);
    adaptive.recordAttempt(ans.correct);
    prevNotes.unshift(targetId);
    while (prevNotes.length > 3) prevNotes.pop();

    totalAttempts += 1;
    if (ans.correct) totalCorrect += 1;
    adaptiveModeHistogram[adaptiveModeAtPick] += 1;

    const retryKey: RetryNoteKey = {
      key: target.key,
      octave: target.octave,
      accidental: target.accidental,
      clef: clefForTarget,
    };

    if (ans.correct) {
      queue.markJustAnswered(retryKey, turn);
      if (isRetryTurn) {
        queue.resolve(retryKey, turn);
      } else {
        queue.rescheduleAfterCorrect(retryKey, turn);
      }
    } else {
      queue.markMissed(retryKey, turn);
    }

    events.push({
      turn,
      attemptIndex: events.length,
      batchIndex: currentIndex,
      batchSize: currentBatch.length,
      shown: target,
      shownId: targetId,
      isRetry: isRetryTurn,
      correct: ans.correct,
      responseTimeSec: ans.responseTimeSec,
      accuracyBeforePick: accuracyAtPick,
      adaptiveModeAtPick,
      weakSlotRatioAtPick,
      queueSizeAfter: queue.size,
    });

    lastShownNote = target;

    if (!ans.correct) {
      // NoteGame parity: 같은 자리 유지 (turn·currentIndex 변경 X). 다음 시도에서 재출제.
      continue;
    }

    // 정답 → advance.
    const nextIndex = currentIndex + 1;
    if (nextIndex < currentBatch.length) {
      currentIndex = nextIndex;
      turn += 1;
      continue;
    }

    // Batch 끝 — set/stage 전환 또는 새 batch.
    const stageConfig = stages[stageIdx];
    const newProgress = setProgress + currentBatch.length;
    if (newProgress >= stageConfig.notesPerSet) {
      // Set 완료.
      const nextSet = currentSet + 1;
      if (nextSet > stageConfig.totalSets) {
        // Stage 완료.
        const nextStageIdx = stageIdx + 1;
        if (nextStageIdx >= stages.length) {
          if (cfg.cyclic) {
            // 통계 수집용 cyclic 모드: stage 상태만 reset, adaptive/streak/queue/prevNotes 유지.
            stageIdx = 0;
            currentSet = 1;
            setProgress = 0;
          } else {
            endReason = "all-stages-complete";
            break;
          }
        } else {
          stageIdx = nextStageIdx;
          currentSet = 1;
          setProgress = 0;
        }
      } else {
        currentSet = nextSet;
        setProgress = 0;
      }
    } else {
      setProgress = newProgress;
    }

    turn += 1;
    composed = composeBatchSim(stages[stageIdx].batchSize, lastShownNote);
    currentBatch = composed.batch;
    currentRetryCount = composed.retryCount;
    currentIndex = 0;

    if (currentBatch.length === 0) {
      endReason = "empty-batch";
      break;
    }
  }

  return {
    config: cfg,
    endReason,
    totalAttempts: events.length,
    correctCount: totalCorrect,
    missCount: totalAttempts - totalCorrect,
    retryAppearances: events.filter((e) => e.isRetry).length,
    finalQueueSize: queue.size,
    events,
    decisions: allDecisions,
    adaptiveModeHistogram,
    keySig,
  };
}
