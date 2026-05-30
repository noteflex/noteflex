/**
 * Noteflex 레벨 세분화 시스템
 *
 * 7개 레벨 × 3개 서브레벨 = 총 21단계 (Lv 1-1 ~ Lv 7-3)
 *
 * 단계별 시간/목숨 (모든 레벨 동일 패턴):
 *   서브레벨 1: 7초 / 목숨 5 (입문)
 *   서브레벨 2: 5초 / 목숨 4 (숙련)
 *   서브레벨 3: 3초 / 목숨 3 (마스터)
 *
 * 단계별 stage 구성 (NoteGame이 사용):
 *   [Lv 1~4] 서브레벨 1: 30노트 / 1 stage (batchSize 3)
 *   [Lv 1~4] 서브레벨 2: 36노트 / 2 stages (batchSize 3·5)
 *   [Lv 1~4] 서브레벨 3: 42노트 / 3 stages (batchSize 3·5·7)
 *   [Lv 5~7] 서브레벨 1: 48노트 / 3 stages (batchSize 3·5·7, 조표 본격 도입)
 *   [Lv 5~7] 서브레벨 2: 54노트 / 3 stages (batchSize 3·5·7)
 *   [Lv 5~7] 서브레벨 3: 60노트 / 3 stages (batchSize 3·5·7)
 *
 * 단계 통과 조건 (4개 모두 충족):
 *   - 플레이 횟수 ≥ 10회
 *   - 한 게임에서 연속 정답 ≥ 5개 (한 번이라도)
 *   - 누적 정답률 ≥ 85%
 *   - sublevel 평균 반응속도 ≤ 타이머 × 35% (기록 없으면 통과 처리)
 *
 * 구독 게이트 (2026-05-09 결정):
 *   - guest:  Lv 1-1만 (1단계, 3회/일)
 *   - free:   Lv 1~5 Sub1 순차 (5단계, 7회/일)
 *   - pro:    전체 21단계 순차 (무제한)
 */

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export type SubscriptionTier = "guest" | "free" | "pro";

export type Sublevel = 1 | 2 | 3;

/**
 * 게임 진행 단위 — 한 sublevel 안의 stage 구성.
 *
 * - batchSize: 한 화면에 동시 표시되는 음표 수 (1=순차, 3·5·7=동시 표시)
 * - totalSets: 이 stage 안에서 반복할 세트 수
 * - notesPerSet: 한 세트당 처리할 노트 수
 *
 * 한 stage의 총 노트 수 = totalSets × notesPerSet
 * (※ batchSize > 1일 때도 한 batch가 끝나면 화면 클리어 후 다음 batch)
 */
export interface GameStageConfig {
  readonly stage: number;
  readonly batchSize: number;
  readonly totalSets: number;
  readonly notesPerSet: number;
}

export interface SublevelConfig {
  /** 음표당 제한 시간(초) */
  timeLimit: number;
  /** 게임 시작 시 목숨 개수 */
  lives: number;
  /** 표시용 라벨 */
  label: string;
  /** 게임 진행 stage 배열 (NoteGame이 사용) */
  stages: readonly GameStageConfig[];
}

/**
 * 최근 N판 윈도우 항목 (DB user_sublevel_progress.recent_plays).
 * `record_sublevel_attempt`가 매 호출 시 prepend, 8번째부터 가장 오래된 항목 제거.
 */
export interface RecentPlay {
  /** ISO timestamp (UTC) */
  at: string;
  attempts: number;
  correct: number;
  /** 반응속도 비율 (avgReactionMs / timerMs). 기록 없으면 null. */
  reaction_ratio: number | null;
}

/**
 * 사용자 진도 데이터 (DB user_sublevel_progress 와 1:1 동기화).
 * accuracy·reaction은 윈도우(recent_plays) 기반 — `calculateAccuracy`·`calculateReactionRatio`.
 */
export interface SublevelProgress {
  level: number; // 1~7
  sublevel: Sublevel;
  play_count: number;
  best_streak: number;
  total_attempts: number;   // 누적 (legacy, 표시용 보조)
  total_correct: number;    // 누적 (legacy)
  passed: boolean;
  /** 누적 평균 반응속도 비율 (legacy). 점수 계산은 윈도우 기반. */
  avg_reaction_ratio?: number;
  /** 최근 7판 윈도우 — 마이그레이션 시점부터 누적. 표본 부족(<3) 시 acc·reaction 평가 보류. */
  recent_plays?: RecentPlay[];
  /** 패스트트랙으로 통과한 경우 true — mastery_score 100 강제 적용 */
  fast_track?: boolean;
}

/** UI 표시용 진행률 정보 */
export interface SublevelCompletion {
  playCount: { current: number; required: number; satisfied: boolean };
  bestStreak: { current: number; required: number; satisfied: boolean };
  accuracy: { current: number; required: number; satisfied: boolean };
  avgReactionRatio: { current: number | null; required: number; satisfied: boolean };
  allSatisfied: boolean;
  /** 최근 N판 윈도우의 현재 표본 수 (0~7) */
  sampleCount: number;
  /** 표본 < MIN_RECENT_SAMPLE — accuracy·reaction 평가 보류 */
  sampleInsufficient: boolean;
}

// ─────────────────────────────────────────────
// 정책 상수
// ─────────────────────────────────────────────

export const SUBLEVEL_CONFIGS: Record<Sublevel, SublevelConfig> = {
  1: {
    timeLimit: 7,
    lives: 5,
    label: "입문",
    // 30노트 — batchSize 3
    stages: [
      { stage: 1, batchSize: 3, totalSets: 10, notesPerSet: 3 }, // 30
    ],
  },
  2: {
    timeLimit: 5,
    lives: 4,
    label: "숙련",
    // 36노트 — batchSize 3·5
    stages: [
      { stage: 1, batchSize: 3, totalSets: 2, notesPerSet: 3 }, //  6
      { stage: 2, batchSize: 5, totalSets: 6, notesPerSet: 5 }, // 30
    ],
  },
  3: {
    timeLimit: 3,
    lives: 3,
    label: "마스터",
    // 42노트 — batchSize 3·5·7
    stages: [
      { stage: 1, batchSize: 3, totalSets: 2, notesPerSet: 3 }, //  6
      { stage: 2, batchSize: 5, totalSets: 3, notesPerSet: 5 }, // 15
      { stage: 3, batchSize: 7, totalSets: 3, notesPerSet: 7 }, // 21
    ],
  },
};

/** 커스텀 악보(level=0)용 기본 stage 흐름 — sublevel 개념 없음 */
export const CUSTOM_SCORE_STAGES: readonly GameStageConfig[] = [
  { stage: 1, batchSize: 1, totalSets: 3, notesPerSet: 3 },
  { stage: 2, batchSize: 1, totalSets: 3, notesPerSet: 5 },
  { stage: 3, batchSize: 3, totalSets: 3, notesPerSet: 3 },
  { stage: 4, batchSize: 5, totalSets: 3, notesPerSet: 5 },
];

/**
 * Lv 5~7 전용 stage 구성 — 조표 시스템 본격 도입.
 * batchSize=1·2 미사용 (조표 음표 혼합 최소 3개 batch부터 유효).
 */
export const LV5_SUBLEVEL_STAGES: Record<Sublevel, readonly GameStageConfig[]> = {
  1: [
    { stage: 1, batchSize: 3, totalSets: 1, notesPerSet: 3 }, //  3
    { stage: 2, batchSize: 5, totalSets: 2, notesPerSet: 5 }, // 10
    { stage: 3, batchSize: 7, totalSets: 5, notesPerSet: 7 }, // 35
  ],
  2: [
    { stage: 1, batchSize: 3, totalSets: 2, notesPerSet: 3 }, //  6
    { stage: 2, batchSize: 5, totalSets: 4, notesPerSet: 5 }, // 20
    { stage: 3, batchSize: 7, totalSets: 4, notesPerSet: 7 }, // 28
  ],
  3: [
    { stage: 1, batchSize: 3, totalSets: 1, notesPerSet: 3 }, //  3
    { stage: 2, batchSize: 5, totalSets: 3, notesPerSet: 5 }, // 15
    { stage: 3, batchSize: 7, totalSets: 6, notesPerSet: 7 }, // 42
  ],
};

export const PASS_CRITERIA = {
  MIN_PLAY_COUNT: 10,
  MIN_BEST_STREAK: 5,
  MIN_ACCURACY: 0.85,
  /** sublevel 평균 반응속도 ≤ 타이머 × 이 비율 */
  MIN_AVG_REACTION_RATIO: 0.35,
} as const;

/** 최근 N판 윈도우 크기 (DB·클라 일관) */
export const RECENT_WINDOW_SIZE = 7;
/** 표본 부족 임계 — N < 이 값이면 accuracy·reaction 평가 보류 (점수 0) */
export const MIN_RECENT_SAMPLE = 3;

export const TOTAL_SUBLEVELS = 21; // 7 × 3
export const MAX_LEVEL = 7;
export const MAX_SUBLEVEL = 3;

// ─────────────────────────────────────────────
// Stage 헬퍼
// ─────────────────────────────────────────────

/**
 * sublevel 또는 커스텀 모드의 stage 배열 반환.
 * isCustom=true면 sublevel 무관 기본 stage 흐름 사용.
 */
export function getStagesFor(
  sublevel: Sublevel,
  isCustom: boolean = false,
  level: number = 1,
): readonly GameStageConfig[] {
  if (isCustom) return CUSTOM_SCORE_STAGES;
  if (level >= 5) return LV5_SUBLEVEL_STAGES[sublevel];
  return SUBLEVEL_CONFIGS[sublevel].stages;
}

/** stage 배열의 총 노트 수 (검증·테스트용) */
export function totalNotesInStages(
  stages: readonly GameStageConfig[]
): number {
  return stages.reduce(
    (sum, s) => sum + s.totalSets * s.notesPerSet,
    0
  );
}

// ─────────────────────────────────────────────
// 계산 함수
// ─────────────────────────────────────────────

/**
 * 최근 7판 윈도우 기반 정확도 — SUM(correct) / SUM(attempts).
 * 표본 < MIN_RECENT_SAMPLE이면 0 반환 (UI는 sampleInsufficient로 별도 분기).
 */
export function calculateAccuracy(progress: SublevelProgress): number {
  const window = progress.recent_plays ?? [];
  if (window.length < MIN_RECENT_SAMPLE) return 0;
  const totalAttempts = window.reduce((s, p) => s + p.attempts, 0);
  const totalCorrect = window.reduce((s, p) => s + p.correct, 0);
  return totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
}

/**
 * 최근 7판 윈도우 기반 반응속도 비율 — 유효 항목 평균.
 * 표본 < MIN_RECENT_SAMPLE 또는 유효 reaction_ratio 없으면 null.
 */
export function calculateReactionRatio(progress: SublevelProgress): number | null {
  const window = progress.recent_plays ?? [];
  if (window.length < MIN_RECENT_SAMPLE) return null;
  const valid = window.filter(
    (p) => p.reaction_ratio != null && p.reaction_ratio > 0,
  );
  if (valid.length === 0) return null;
  return valid.reduce((s, p) => s + (p.reaction_ratio ?? 0), 0) / valid.length;
}

/** 단계 통과 조건 충족 여부 (윈도우 기반 acc·reaction + 누적 play·streak). 표본 부족 시 false. */
export function checkPassed(progress: SublevelProgress): boolean {
  const sampleCount = (progress.recent_plays ?? []).length;
  if (sampleCount < MIN_RECENT_SAMPLE) return false;

  const accuracy = calculateAccuracy(progress);
  const reaction = calculateReactionRatio(progress);
  const reactionOk =
    reaction == null || reaction <= PASS_CRITERIA.MIN_AVG_REACTION_RATIO;

  return (
    progress.play_count >= PASS_CRITERIA.MIN_PLAY_COUNT &&
    progress.best_streak >= PASS_CRITERIA.MIN_BEST_STREAK &&
    accuracy >= PASS_CRITERIA.MIN_ACCURACY &&
    reactionOk
  );
}

/** UI 진행률 정보 생성 (윈도우 기반 acc·reaction + 표본 안내) */
export function getCompletion(progress: SublevelProgress): SublevelCompletion {
  const sampleCount = (progress.recent_plays ?? []).length;
  const sampleInsufficient = sampleCount < MIN_RECENT_SAMPLE;

  const accuracy = sampleInsufficient ? 0 : calculateAccuracy(progress);
  const reaction = sampleInsufficient ? null : calculateReactionRatio(progress);

  const playCount = {
    current: progress.play_count,
    required: PASS_CRITERIA.MIN_PLAY_COUNT,
    satisfied: progress.play_count >= PASS_CRITERIA.MIN_PLAY_COUNT,
  };

  const bestStreak = {
    current: progress.best_streak,
    required: PASS_CRITERIA.MIN_BEST_STREAK,
    satisfied: progress.best_streak >= PASS_CRITERIA.MIN_BEST_STREAK,
  };

  const accuracyResult = {
    current: accuracy,
    required: PASS_CRITERIA.MIN_ACCURACY,
    satisfied: !sampleInsufficient && accuracy >= PASS_CRITERIA.MIN_ACCURACY,
  };

  const avgReactionRatio = {
    current: reaction,
    required: PASS_CRITERIA.MIN_AVG_REACTION_RATIO,
    satisfied:
      !sampleInsufficient &&
      (reaction == null || reaction <= PASS_CRITERIA.MIN_AVG_REACTION_RATIO),
  };

  return {
    playCount,
    bestStreak,
    accuracy: accuracyResult,
    avgReactionRatio,
    sampleCount,
    sampleInsufficient,
    allSatisfied:
      !sampleInsufficient &&
      playCount.satisfied &&
      bestStreak.satisfied &&
      accuracyResult.satisfied &&
      avgReactionRatio.satisfied,
  };
}

// ─────────────────────────────────────────────
// 구독 게이트
// ─────────────────────────────────────────────

/** 구독 등급 기준 접근 가능 여부 (순수 tier 체크, progression 무관) */
export function canAccessSublevel(
  tier: SubscriptionTier,
  level: number,
  sublevel: Sublevel
): boolean {
  if (tier === "pro") return true;
  // Guest (미가입): Lv 1-1만 (2026-05-09)
  if (tier === "guest") return level === 1 && sublevel === 1;
  // Free: Lv 1~5 Sub1만 (2026-05-09)
  if (tier === "free") return level <= 5 && sublevel === 1;
  return false;
}

/**
 * 진도 게이트 — tier 인식 선행 단계 계산.
 *
 * canAccessSublevel 의 subscription gate 와 분리.
 * LevelSelect 의 "이전 단계 통과 여부" 체크에 사용.
 *
 *   - guest:  Lv 1-1 만 접근, 선행 없음 → null
 *   - free:   Lv(n)-Sub1 의 선행 = Lv(n-1)-Sub1 (Sub2·Sub3 는 subscription gate 에서 차단)
 *   - pro:    표준 21단계 순서 (getPreviousSublevel 과 동일)
 */
export function getProgressGatePrev(
  tier: SubscriptionTier,
  level: number,
  sublevel: Sublevel
): { level: number; sublevel: Sublevel } | null {
  if (tier === "guest") return null;
  if (tier === "free") {
    if (level === 1) return null;
    return { level: level - 1, sublevel: 1 };
  }
  return getPreviousSublevel(level, sublevel);
}

// ─────────────────────────────────────────────
// 21단계 그리드 / 라벨 / 다음·이전 단계
// ─────────────────────────────────────────────

export interface SublevelInfo {
  level: number;
  sublevel: Sublevel;
  config: SublevelConfig;
}

/** 21단계 전체 리스트 (UI 그리드 렌더링용) */
export function getAllSublevels(): SublevelInfo[] {
  const result: SublevelInfo[] = [];
  for (let level = 1; level <= MAX_LEVEL; level++) {
    for (const sublevel of [1, 2, 3] as Sublevel[]) {
      result.push({
        level,
        sublevel,
        config: SUBLEVEL_CONFIGS[sublevel],
      });
    }
  }
  return result;
}

/** 단계 표시 라벨 (예: "Lv 2-3") */
export function formatSublevel(level: number, sublevel: Sublevel): string {
  return `Lv ${level}-${sublevel}`;
}

/**
 * 사용자 티어 영역 내에서 가장 빠른 미통과 단계 반환.
 *
 *   - Guest: Lv1-1만 영역. 미통과면 Lv1-1 반환.
 *   - Free:  Lv1-1 → Lv2-1 → ... → Lv5-1 순서.
 *   - Pro:   Lv1-1 → Lv1-2 → Lv1-3 → Lv2-1 → ... → Lv7-3 순서.
 *
 * 모든 단계 통과 상태면 null 반환.
 * isPassed(level, sublevel) = 해당 단계가 통과 적용되어 있는지 확인하는 콜백.
 */
export function findFirstUnpassedAccessibleSublevel(
  tier: SubscriptionTier,
  isPassed: (level: number, sublevel: Sublevel) => boolean,
): { level: number; sublevel: Sublevel } | null {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    for (const sublevel of [1, 2, 3] as Sublevel[]) {
      if (!canAccessSublevel(tier, level, sublevel)) continue;
      if (!isPassed(level, sublevel)) return { level, sublevel };
    }
  }
  return null;
}

/**
 * 다음 단계 계산
 * Lv 1-3 → Lv 2-1
 * Lv 7-3 → null (최종)
 */
export function getNextSublevel(
  level: number,
  sublevel: Sublevel
): { level: number; sublevel: Sublevel } | null {
  if (sublevel < MAX_SUBLEVEL) {
    return { level, sublevel: (sublevel + 1) as Sublevel };
  }
  if (level < MAX_LEVEL) {
    return { level: level + 1, sublevel: 1 };
  }
  return null;
}

/**
 * 이전 단계 계산
 * Lv 2-1 → Lv 1-3
 * Lv 1-1 → null (최초)
 */
export function getPreviousSublevel(
  level: number,
  sublevel: Sublevel
): { level: number; sublevel: Sublevel } | null {
  if (sublevel > 1) {
    return { level, sublevel: (sublevel - 1) as Sublevel };
  }
  if (level > 1) {
    return { level: level - 1, sublevel: MAX_SUBLEVEL };
  }
  return null;
}

/** 입력값이 유효한 단계인지 검증 */
export function isValidSublevel(level: number, sublevel: number): boolean {
  return (
    Number.isInteger(level) &&
    Number.isInteger(sublevel) &&
    level >= 1 &&
    level <= MAX_LEVEL &&
    sublevel >= 1 &&
    sublevel <= MAX_SUBLEVEL
  );
}