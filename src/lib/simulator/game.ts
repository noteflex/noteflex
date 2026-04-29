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
  /** retry override 여부 */
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
  const stages = getStagesFor(cfg.sublevel, false);

  const queue = new SimRetryQueue();
  let stageIdx = 0;
  let currentSet = 1;
  let setProgress = 0;
  let currentBatch: NoteType[] = generateBatch(
    pool,
    stages[0].batchSize,
    clef,
    new Map(),
    null,
  );
  let currentIndex = 0;
  let retryOverride: NoteType | null = null;
  let turn = 0;
  let lastShownNote: NoteType | null = null;
  // markedTurn 추적: retry 음표가 미스된 turn → 다음 등장까지 간격 계산용
  const missedTurnMap = new Map<string, number>();

  const events: SimEvent[] = [];
  const noteShownFreq: Record<string, number> = {};
  const noteMissFreq: Record<string, number> = {};
  const retryIntervalDist: Record<string, number> = {};
  let correctCount = 0;
  let missCount = 0;
  let retryAppearances = 0;
  let consecutiveViolations = 0;
  let delayedRetryFallbacks = 0;
  // 라이프
  const sublevelLives = (() => {
    if (cfg.sublevel === 1) return 5;
    if (cfg.sublevel === 2) return 4;
    return 3;
  })();
  let lives = sublevelLives;

  // ────── helper: prepareNextTurn 동등 ──────
  const prepareNextTurn = (lastShown: NoteType | null): NoteType | null => {
    turn += 1;
    const lastShownKey = lastShown ? noteToRetryKey(lastShown, clef) : null;
    const queueSizeBefore = queue.size;
    const due = queue.popDueOrNull(turn, lastShownKey);
    if (due) {
      retryOverride = {
        name: due.key,
        key: due.key,
        y: 0,
        octave: due.octave,
        accidental: due.accidental,
        clef: due.clef,
      } as NoteType;
      return retryOverride;
    }
    // queue에 due 후보가 있었으나 lastShown skip으로 null이면 1턴 지연 fallback
    if (queueSizeBefore > 0 && lastShownKey) {
      // 큐에 lastShownKey와 동일 ID due가 있었는지 정확히 알려면 별도 검사 필요.
      // 근사: 큐가 비어있지 않은데 due null이면 fallback 가능성.
      // 정밀도는 낮지만 추세 추정용.
      delayedRetryFallbacks += 1;
    }
    retryOverride = null;
    return null;
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

  // 첫 음표 + 첫 prepareNextTurn (NoteGame은 첫 음표는 batch[0]으로 바로 시작 — turn=0).
  // simulator는 prepareNextTurn을 첫 turn에서 호출하지 않음 (NoteGame 동등).
  let endReason: SimResult["endReason"] = "max-turns";

  for (let safety = 0; safety < maxTurns; safety++) {
    const currentTarget = retryOverride ?? currentBatch[currentIndex] ?? null;
    if (!currentTarget) break;

    const isRetryTurn = retryOverride !== null;
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

    // invariant 검사: 직전 정답 음표 → 다음 표시 음표 같음?
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
    });

    if (correct) {
      correctCount += 1;
      // markJustAnswered
      queue.markJustAnswered(retryKey, turn);
      if (isRetryTurn) {
        queue.resolve(retryKey);
        // §0.1 사각지대 fix: retry == currentBatch[currentIndex]면 일반 advance.
        const cur = currentBatch[currentIndex];
        const sameAsBatchCurrent =
          cur != null &&
          cur.key === retryKey.key &&
          cur.octave === retryKey.octave &&
          (cur.accidental ?? null) === (retryKey.accidental ?? null) &&
          (cur.clef ?? clef) === retryKey.clef;
        retryOverride = null;
        // 정답 시에만 lastShownNote 갱신 (오답은 같은 자리 유지 → invariant 검사 의미 X).
        lastShownNote = currentTarget;
        if (sameAsBatchCurrent) {
          advance(false);
        } else {
          advance(true);
        }
      } else {
        retryOverride = null;
        lastShownNote = currentTarget;
        // §0.1 N+2: advance 전 rescheduleAfterCorrect (due=정답turn+2).
        queue.rescheduleAfterCorrect(retryKey, turn);
        advance(false);
      }
    } else {
      // 오답: 같은 자리 유지. lastShownNote 갱신 X (의도된 same-note이므로).
      missCount += 1;
      noteMissFreq[targetId] = (noteMissFreq[targetId] ?? 0) + 1;
      queue.markMissed(retryKey);
      if (!missedTurnMap.has(targetId)) missedTurnMap.set(targetId, turn);
      lives -= 1;
      if (lives <= 0) {
        endReason = "gameover";
        break;
      }
    }

    if (endReason !== "max-turns") break;
  }

  function advance(wasRetry: boolean): void {
    const stageConfig = stages[stageIdx];
    if (wasRetry) {
      const next = prepareNextTurn(lastShownNote);
      if (!next) {
        // currentBatch[currentIndex] 그대로
      }
      return;
    }
    const nextIndex = currentIndex + 1;
    const lastShown = currentBatch[currentIndex] ?? null;
    if (nextIndex >= currentBatch.length) {
      const newProgress = setProgress + currentBatch.length;
      if (newProgress >= stageConfig.notesPerSet) {
        handleSetComplete(stageIdx, currentSet, lastShown);
      } else {
        setProgress = newProgress;
        currentBatch = generateBatch(pool, stageConfig.batchSize, clef, new Map(), lastShown);
        currentIndex = 0;
        prepareNextTurn(lastShown);
      }
    } else {
      currentIndex = nextIndex;
      prepareNextTurn(lastShown);
    }
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
        endReason = "success";
        return;
      }
      const nextStage = stages[nextStageIdx];
      stageIdx = nextStageIdx;
      currentSet = 1;
      setProgress = 0;
      currentBatch = generateBatch(pool, nextStage.batchSize, clef, new Map(), lastShown);
      currentIndex = 0;
      prepareNextTurn(lastShown);
    } else {
      currentSet = curSetNum + 1;
      setProgress = 0;
      currentBatch = generateBatch(pool, stageConfig.batchSize, clef, new Map(), lastShown);
      currentIndex = 0;
      prepareNextTurn(lastShown);
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
