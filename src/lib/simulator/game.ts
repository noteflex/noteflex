/**
 * NoteGame logic의 React-free 시뮬레이터.
 *
 * 목적: §0.1 정책 (같은 음표 절대 연속 안 나오게) + retry 알고리즘을 1만 게임 fuzz로 검증.
 *
 * 주의: NoteGame.tsx의 advanceToNextTurn / handleSetComplete / prepareNextTurn 흐름을
 * 그대로 복제. production 코드 변경 시 simulator도 같이 갱신해야 한다.
 *
 * 미지원 (현 버전):
 *  - Lv5+ keySig (generateKeyBatch). 첫 검증은 Lv1~4 단일 clef에 집중.
 *  - 타이머 만료. 오답 답변으로 충분히 검증됨.
 */

import {
  generateBatch,
  getNotesForLevel,
  getClefForLevel,
} from "@/components/NoteGame";
import type { NoteType } from "@/lib/noteTypes";
import { getStagesFor, type Sublevel } from "@/lib/levelSystem";
import { SimRetryQueue, type RetryNoteKey } from "./retryQueue";

export type Scenario = "all-correct" | "all-wrong" | "random" | "mastery-bias";

export interface SimConfig {
  level: number;
  sublevel: Sublevel;
  scenario: Scenario;
  /** random 시 정답률 (0..1). default 0.7 */
  correctRate?: number;
  /** mastery-bias 시 항상 오답할 음표 ID set */
  biasedAgainst?: Set<string>;
  /** 재현 가능한 RNG seed. 같은 seed = 같은 결과. */
  seed: number;
  /** 무한 루프 안전장치. default 5000. */
  maxTurns?: number;
}

export interface SimEvent {
  turn: number;
  /** 답한 음표 (currentTarget) */
  shown: NoteType;
  /** retry 음표 여부 (§4 신규: idx<retryCount 기반) */
  isRetry: boolean;
  correct: boolean;
  /**
   * 직전 화면 음표와 같은 음표가 다음 화면에 등장했는지 — invariant 위반 카운트.
   * 정답 시도 직후의 transition만 검사 (오답은 같은 자리 유지이므로 자명).
   */
  consecutiveViolation: boolean;
  /**
   * retry 음표일 때, 그것의 등장 간격 (markedTurn ~ shownTurn).
   * 정책 N+2 검증용. -1이면 retry 아님.
   */
  retryAppearedAt: number;
  // §4 (2026-05-01) 신규 — 옵셔널 (기존 호환).
  /** "playing" | "final-retry" */
  phase?: "playing" | "final-retry";
  /** 현재 batch 내 retry 음표 개수 (batch[0..retryCount-1]) */
  retryCount?: number;
  /** 현재 missedNotes 크기 */
  missedSize?: number;
  /** 현재 batch 내 인덱스 */
  batchIndex?: number;
  /** 현재 batch 크기 */
  batchSize?: number;
}

export interface SimResult {
  config: SimConfig;
  endReason: "success" | "gameover" | "max-turns";
  totalTurns: number;
  correctCount: number;
  missCount: number;
  retryAppearances: number;
  consecutiveViolations: number;
  /** retry 음표 등장 간격 분포: key = "N+x", value = count */
  retryIntervalDist: Record<string, number>;
  /** 음표별 출제 빈도 (composeId 기준) */
  noteShownFreq: Record<string, number>;
  /** 음표별 오답 빈도 */
  noteMissFreq: Record<string, number>;
  /** 1턴 지연 fallback 발생 횟수 (popDueOrNull이 lastShown skip으로 null 반환한 case 추정) */
  delayedRetryFallbacks: number;
  events: SimEvent[];
  // §4 (2026-05-01) 신규 — 옵셔널.
  /** final-retry phase 진입 여부 */
  finalRetryEntered?: boolean;
  /** final-retry phase 진입 시 missedNotes 크기 */
  finalRetryStartCount?: number;
  /** final-retry phase 진입 시점 turn */
  finalRetryStartTurn?: number;
}

// ─────────────────────────────────────────────
// RNG
// ─────────────────────────────────────────────

class SeededRng {
  private state: number;
  constructor(seed: number) {
    // 음수도 허용
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

// generateBatch가 Math.random을 내부적으로 사용하므로 RNG 격리는 못 함.
// 시뮬레이터의 의사난수는 시나리오 결정 (정답/오답)만 결정.
// 같은 seed에서도 generateBatch 결과는 약간 달라질 수 있음 (Math.random 의존).

function noteToRetryKey(n: NoteType, fallbackClef: "treble" | "bass"): RetryNoteKey {
  return {
    key: n.key,
    octave: n.octave,
    accidental: n.accidental,
    clef: n.clef ?? fallbackClef,
  };
}

function noteId(n: NoteType, fallbackClef: "treble" | "bass"): string {
  const acc = n.accidental ?? "";
  return `${n.clef ?? fallbackClef}:${n.key}${acc}${n.octave}`;
}

// ─────────────────────────────────────────────
// §4 (2026-05-01) — final-retry phase 헬퍼
// ─────────────────────────────────────────────

/**
 * §4 final-retry phase 배치 크기 동적 결정 (NoteGame.tsx와 parity).
 *  - missedCount 1~2 → batchSize 3
 *  - missedCount 3~4 → batchSize 5
 *  - missedCount 5+  → batchSize 7
 */
function getFinalRetryBatchSize(missedCount: number): number {
  if (missedCount <= 2) return 3;
  if (missedCount <= 4) return 5;
  return 7;
}

function dueToNote(due: RetryNoteKey): NoteType {
  return {
    name: due.key,
    key: due.key,
    y: 0,
    octave: due.octave,
    accidental: due.accidental,
    clef: due.clef,
  } as NoteType;
}

/**
 * §4 — Batch 구성: (batchSize) - (큐 pop 수) = 새 음표 수.
 * popDueOrNull(turn, prev)로 §0.1 인접 dedup 보장.
 */
function composeBatch(
  batchSize: number,
  queue: SimRetryQueue,
  pool: NoteType[],
  clef: "treble" | "bass",
  turn: number,
  lastShown: NoteType | null,
): { batch: NoteType[]; retryCount: number; fallbackHits: number } {
  const retryNotes: NoteType[] = [];
  let prev: NoteType | null = lastShown;
  let fallbackHits = 0;
  while (retryNotes.length < batchSize) {
    const lastShownKey = prev ? noteToRetryKey(prev, clef) : null;
    const queueSizeBefore = queue.size;
    const due = queue.popDueOrNull(turn, lastShownKey);
    if (!due) {
      // 큐가 비어있지 않은데 due null이면 lastShown skip 또는 due 미달.
      if (queueSizeBefore > 0 && lastShownKey) fallbackHits += 1;
      break;
    }
    retryNotes.push(dueToNote(due));
    prev = retryNotes[retryNotes.length - 1];
  }
  const newCount = batchSize - retryNotes.length;
  const newNotes =
    newCount > 0 ? generateBatch(pool, newCount, clef, new Map(), prev) : [];
  return {
    batch: [...retryNotes, ...newNotes],
    retryCount: retryNotes.length,
    fallbackHits,
  };
}

/**
 * §4 final-retry batch 구성: missedNotes에서 retry + generateBatch 새 음표.
 * 큐(SimRetryQueue) 사용 X — final-retry는 N+2 알고리즘 외부.
 *
 * §0.1 dedup (2026-05-01 박힘):
 *  - 옵션 5: lastShown과 다른 ID retry 우선 (batch[0] dedup)
 *  - 옵션 7: missedArray 모두 lastShown인 케이스 → retry skip + 새 음표만 batch
 */
function composeFinalRetryBatch(
  missedMap: Map<string, NoteType>,
  pool: NoteType[],
  clef: "treble" | "bass",
  lastShown: NoteType | null,
): { batch: NoteType[]; retryCount: number } | null {
  const missedArray = Array.from(missedMap.values());
  if (missedArray.length === 0) return null;

  const targetBatchSize = getFinalRetryBatchSize(missedArray.length);

  // §0.1 dedup (옵션 5): lastShown과 다른 ID retry 우선.
  const lastShownId = lastShown ? noteId(lastShown, clef) : null;
  const sortedMissed = lastShownId
    ? [
        ...missedArray.filter(n => noteId(n, clef) !== lastShownId),
        ...missedArray.filter(n => noteId(n, clef) === lastShownId),
      ]
    : missedArray;

  const retryCount = Math.min(sortedMissed.length, targetBatchSize);
  const retryNotes = sortedMissed.slice(0, retryCount);

  // §0.1 dedup (옵션 7): retry[0]이 lastShown과 같으면 (missedArray 모두 lastShown) retry skip.
  if (
    retryCount > 0 &&
    lastShownId &&
    noteId(retryNotes[0], clef) === lastShownId
  ) {
    const newNotes = generateBatch(pool, targetBatchSize, clef, new Map(), lastShown);
    return { batch: newNotes, retryCount: 0 };
  }

  const newCount = targetBatchSize - retryCount;
  if (newCount === 0) {
    return { batch: retryNotes, retryCount };
  }
  const lastShownForNew =
    retryNotes[retryNotes.length - 1] ?? lastShown ?? null;
  const newNotes = generateBatch(pool, newCount, clef, new Map(), lastShownForNew);
  return {
    batch: [...retryNotes, ...newNotes],
    retryCount,
  };
}

// ─────────────────────────────────────────────
// 게임 한 판 시뮬레이션
// ─────────────────────────────────────────────

export function simulateGame(cfg: SimConfig): SimResult {
  const maxTurns = cfg.maxTurns ?? 5000;
  const correctRate = cfg.correctRate ?? 0.7;
  const rng = new SeededRng(cfg.seed);

  if (cfg.level >= 5) {
    throw new Error(
      "simulator는 현재 Lv1~4만 지원 (keySig 미구현). simulateGame.config.level를 1~4로.",
    );
  }
  const pool = getNotesForLevel(cfg.level);
  const clef = getClefForLevel(cfg.level);
  const stages = getStagesFor(cfg.sublevel, false, cfg.level);

  // ────── 라이프 (§0-1 정책: sub1=5, sub2=4, sub3=3) ──────
  const sublevelLives = (() => {
    if (cfg.sublevel === 1) return 5;
    if (cfg.sublevel === 2) return 4;
    return 3;
  })();
  const MAX_LIVES = sublevelLives;
  let lives = sublevelLives;
  let individualStreak = 0; // §4-Q3 lives 회복용 (3연속 정답 시 +1)

  const queue = new SimRetryQueue();
  let stageIdx = 0;
  let currentSet = 1;
  let setProgress = 0;
  let turn = 0;

  // §4 — 첫 batch는 큐 비어있음 → composeBatch = 새 음표만, retryCount=0.
  const initial = composeBatch(stages[0].batchSize, queue, pool, clef, turn, null);
  let currentBatch: NoteType[] = initial.batch;
  let currentRetryCount = initial.retryCount;
  let currentIndex = 0;
  let lastShownNote: NoteType | null = null;
  let phase: "playing" | "final-retry" = "playing";
  let delayedRetryFallbacks = initial.fallbackHits;

  // §4 — sublevel 전체에서 끝까지 못 푼 음표 (markMissed → add, retry 정답 → delete).
  const missedNotes = new Map<string, NoteType>();
  // markedTurn 추적: retry 음표가 미스된 turn → 다음 등장까지 간격 계산용.
  const missedTurnMap = new Map<string, number>();

  const events: SimEvent[] = [];
  const noteShownFreq: Record<string, number> = {};
  const noteMissFreq: Record<string, number> = {};
  const retryIntervalDist: Record<string, number> = {};
  let correctCount = 0;
  let missCount = 0;
  let retryAppearances = 0;
  let consecutiveViolations = 0;

  // §4 final-retry 통계.
  let finalRetryEntered = false;
  let finalRetryStartCount = 0;
  let finalRetryStartTurn = -1;

  // ────── helper: prepareNextTurn 단순화 (§4: turn += 1만, popDueOrNull은 composeBatch가 담당). ──────
  const prepareNextTurn = (): void => {
    turn += 1;
  };

  // ────── helper: shouldAnswerCorrect ──────
  const shouldAnswerCorrect = (target: NoteType): boolean => {
    if (cfg.scenario === "all-correct") return true;
    if (cfg.scenario === "all-wrong") return false;
    if (cfg.scenario === "mastery-bias") {
      const id = noteId(target, clef);
      if (cfg.biasedAgainst?.has(id)) return false;
      return rng.next() < correctRate;
    }
    return rng.next() < correctRate;
  };

  let endReason: SimResult["endReason"] = "max-turns";

  for (let safety = 0; safety < maxTurns; safety++) {
    const currentTarget = currentBatch[currentIndex] ?? null;
    if (!currentTarget) break;

    // §4 wasRetry = batch 안 retry 자리(idx<retryCount)에 있는 음표인지.
    const isRetryTurn = currentIndex < currentRetryCount;
    const targetId = noteId(currentTarget, clef);
    noteShownFreq[targetId] = (noteShownFreq[targetId] ?? 0) + 1;
    if (isRetryTurn) {
      retryAppearances += 1;
      const markedAt = missedTurnMap.get(targetId);
      if (markedAt !== undefined) {
        const diff = turn - markedAt;
        const bucket = `N+${diff}`;
        retryIntervalDist[bucket] = (retryIntervalDist[bucket] ?? 0) + 1;
      }
    }

    const correct = shouldAnswerCorrect(currentTarget);
    const retryKey = noteToRetryKey(currentTarget, clef);
    const missedId = noteId(currentTarget, clef);

    // invariant: 직전 정답 음표 → 다음 표시 음표 같은가?
    const prevId = lastShownNote ? noteId(lastShownNote, clef) : null;
    const violation = prevId !== null && prevId === targetId;
    if (violation) consecutiveViolations += 1;

    events.push({
      turn,
      shown: currentTarget,
      isRetry: isRetryTurn,
      correct,
      consecutiveViolation: violation,
      retryAppearedAt: isRetryTurn ? turn - (missedTurnMap.get(targetId) ?? turn) : -1,
      phase,
      retryCount: currentRetryCount,
      missedSize: missedNotes.size,
      batchIndex: currentIndex,
      batchSize: currentBatch.length,
    });

    if (correct) {
      correctCount += 1;
      individualStreak += 1;

      // §4-Q3 (B): 3연속 정답 시 lives +1 (NoteGame.tsx parity).
      if (individualStreak >= 3) {
        if (lives < MAX_LIVES) {
          lives += 1;
        }
        individualStreak = 0;
      }

      queue.markJustAnswered(retryKey, turn);

      if (phase === "playing") {
        if (isRetryTurn) {
          queue.resolve(retryKey);
          missedNotes.delete(missedId);
        } else {
          queue.rescheduleAfterCorrect(retryKey, turn);
        }
      } else {
        // final-retry phase: 큐 무관. retry 음표만 missedNotes에서 제거.
        if (isRetryTurn) missedNotes.delete(missedId);
      }

      lastShownNote = currentTarget;
      advance();
    } else {
      // 오답
      missCount += 1;
      noteMissFreq[targetId] = (noteMissFreq[targetId] ?? 0) + 1;
      individualStreak = 0;

      if (phase === "playing") {
        // 메인 phase: markMissed + missedNotes.add + lives -1 + 같은 자리 유지.
        queue.markMissed(retryKey);
        missedNotes.set(missedId, currentTarget);
        if (!missedTurnMap.has(targetId)) missedTurnMap.set(targetId, turn);
        lives -= 1;
        if (lives <= 0) {
          endReason = "gameover";
          break;
        }
        // 같은 자리 유지 (lastShownNote 갱신 X)
      } else {
        // final-retry phase: 큐·missedNotes 추가 X. retry 음표면 missedNotes에서 제거.
        lives -= 1;
        if (lives <= 0) {
          endReason = "gameover";
          break;
        }
        if (isRetryTurn) missedNotes.delete(missedId);
        lastShownNote = currentTarget;
        advance();
      }
    }

    if (endReason !== "max-turns") break;
  }

  function advance(): void {
    if (phase === "playing") {
      advancePlaying();
    } else {
      advanceFinalRetry();
    }
  }

  function advancePlaying(): void {
    const stageConfig = stages[stageIdx];
    const nextIndex = currentIndex + 1;
    const lastShown = currentBatch[currentIndex] ?? null;

    if (nextIndex >= currentBatch.length) {
      const newProgress = setProgress + currentBatch.length;
      if (newProgress >= stageConfig.notesPerSet) {
        handleSetComplete(stageIdx, currentSet, lastShown);
      } else {
        setProgress = newProgress;
        prepareNextTurn();
        const result = composeBatch(stageConfig.batchSize, queue, pool, clef, turn, lastShown);
        currentBatch = result.batch;
        currentRetryCount = result.retryCount;
        delayedRetryFallbacks += result.fallbackHits;
        currentIndex = 0;
      }
    } else {
      currentIndex = nextIndex;
      prepareNextTurn();
    }
  }

  function advanceFinalRetry(): void {
    const nextIndex = currentIndex + 1;
    const lastShown = currentBatch[currentIndex] ?? null;

    if (nextIndex < currentBatch.length) {
      currentIndex = nextIndex;
      prepareNextTurn();
      return;
    }

    // batch 끝 — missedNotes 비면 success, 아니면 다음 final-retry batch (batchSize 동적).
    if (missedNotes.size === 0) {
      endReason = "success";
      return;
    }
    const result = composeFinalRetryBatch(missedNotes, pool, clef, lastShown);
    if (!result) {
      endReason = "success";
      return;
    }
    prepareNextTurn();
    currentBatch = result.batch;
    currentRetryCount = result.retryCount;
    currentIndex = 0;
  }

  function handleSetComplete(
    curStageIdx: number,
    curSetNum: number,
    lastShown: NoteType | null,
  ): void {
    const stageConfig = stages[curStageIdx];
    if (curSetNum >= stageConfig.totalSets) {
      const nextStageIdx = curStageIdx + 1;
      if (nextStageIdx >= stages.length) {
        // §4: 모든 stage 끝 — missedNotes 남으면 final-retry phase 진입.
        if (missedNotes.size > 0) {
          const result = composeFinalRetryBatch(missedNotes, pool, clef, lastShown);
          if (result) {
            phase = "final-retry";
            finalRetryEntered = true;
            finalRetryStartCount = missedNotes.size;
            finalRetryStartTurn = turn;
            prepareNextTurn();
            currentBatch = result.batch;
            currentRetryCount = result.retryCount;
            currentIndex = 0;
            return;
          }
        }
        endReason = "success";
        return;
      }
      const nextStage = stages[nextStageIdx];
      stageIdx = nextStageIdx;
      currentSet = 1;
      setProgress = 0;
      prepareNextTurn();
      const result = composeBatch(nextStage.batchSize, queue, pool, clef, turn, lastShown);
      currentBatch = result.batch;
      currentRetryCount = result.retryCount;
      delayedRetryFallbacks += result.fallbackHits;
      currentIndex = 0;
    } else {
      currentSet = curSetNum + 1;
      setProgress = 0;
      prepareNextTurn();
      const result = composeBatch(stageConfig.batchSize, queue, pool, clef, turn, lastShown);
      currentBatch = result.batch;
      currentRetryCount = result.retryCount;
      delayedRetryFallbacks += result.fallbackHits;
      currentIndex = 0;
    }
  }

  return {
    config: cfg,
    endReason,
    totalTurns: turn,
    correctCount,
    missCount,
    retryAppearances,
    consecutiveViolations,
    retryIntervalDist,
    noteShownFreq,
    noteMissFreq,
    delayedRetryFallbacks,
    events,
    finalRetryEntered,
    finalRetryStartCount,
    finalRetryStartTurn,
  };
}

// ─────────────────────────────────────────────
// 다중 게임 fuzz
// ─────────────────────────────────────────────

export interface AggregateStats {
  gameCount: number;
  totalTurns: number;
  totalCorrect: number;
  totalMiss: number;
  totalRetryAppearances: number;
  totalConsecutiveViolations: number;
  totalDelayedRetryFallbacks: number;
  endReasons: Record<SimResult["endReason"], number>;
  retryIntervalDist: Record<string, number>;
  /** 1턴 지연 비율 = delayedRetryFallbacks / totalTurns */
  delayedFallbackRate: number;
  /** invariant 위반 비율 — 0이어야 함 */
  consecutiveRate: number;
}

export function runMany(
  baseCfg: Omit<SimConfig, "seed">,
  count: number,
  seedStart: number = 1,
): { stats: AggregateStats; firstViolations: SimResult[] } {
  const stats: AggregateStats = {
    gameCount: 0,
    totalTurns: 0,
    totalCorrect: 0,
    totalMiss: 0,
    totalRetryAppearances: 0,
    totalConsecutiveViolations: 0,
    totalDelayedRetryFallbacks: 0,
    endReasons: { success: 0, gameover: 0, "max-turns": 0 },
    retryIntervalDist: {},
    delayedFallbackRate: 0,
    consecutiveRate: 0,
  };
  const firstViolations: SimResult[] = [];

  for (let i = 0; i < count; i++) {
    const result = simulateGame({ ...baseCfg, seed: seedStart + i });
    stats.gameCount += 1;
    stats.totalTurns += result.totalTurns;
    stats.totalCorrect += result.correctCount;
    stats.totalMiss += result.missCount;
    stats.totalRetryAppearances += result.retryAppearances;
    stats.totalConsecutiveViolations += result.consecutiveViolations;
    stats.totalDelayedRetryFallbacks += result.delayedRetryFallbacks;
    stats.endReasons[result.endReason] += 1;
    for (const [k, v] of Object.entries(result.retryIntervalDist)) {
      stats.retryIntervalDist[k] = (stats.retryIntervalDist[k] ?? 0) + v;
    }
    if (result.consecutiveViolations > 0 && firstViolations.length < 5) {
      firstViolations.push(result);
    }
  }

  stats.delayedFallbackRate = stats.totalTurns > 0 ? stats.totalDelayedRetryFallbacks / stats.totalTurns : 0;
  stats.consecutiveRate = stats.totalTurns > 0 ? stats.totalConsecutiveViolations / stats.totalTurns : 0;
  return { stats, firstViolations };
}
