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
 *   [Lv 1~4] 서브레벨 1: 28노트 / 3 stages (정확성 + 흐름 맛보기)
 *   [Lv 1~4] 서브레벨 2: 30노트 / 3 stages (흐름 + 시야 확장)
 *   [Lv 1~4] 서브레벨 3: 45노트 / 3 stages (시야 + 지구력)
 *   [Lv 5~7] 서브레벨 1: 51노트 / 3 stages (batchSize 3·5·7, 조표 본격 도입)
 *   [Lv 5~7] 서브레벨 2: 51노트 / 3 stages (batchSize 3·5·7)
 *   [Lv 5~7] 서브레벨 3: 57노트 / 3 stages (batchSize 5·7·7)
 *
 * 단계 통과 조건 (4개 모두 충족):
 *   - 플레이 횟수 ≥ 10회
 *   - 한 게임에서 연속 정답 ≥ 5개 (한 번이라도)
 *   - 누적 정답률 ≥ 85%
 *   - sublevel 평균 반응속도 ≤ 타이머 × 35% (기록 없으면 통과 처리)
 *
 * 구독 게이트:
 *   - guest:  Lv 1만 (3단계)
 *   - free:   Lv 1·2 + Lv 3-1, Lv 4-1 (8단계)
 *   - pro:    전체 21단계
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
 * 사용자 진도 데이터 (DB user_sublevel_progress 와 1:1 동기화).
 * accuracy 는 derived 이므로 컬럼이 아닌 함수로 계산.
 */
export interface SublevelProgress {
  level: number; // 1~7
  sublevel: Sublevel;
  play_count: number;
  best_streak: number;
  total_attempts: number;
  total_correct: number;
  passed: boolean;
  /** sublevel 누적 평균 반응속도(초). 기록 없으면 undefined → 통과 처리 */
  avg_reaction_time?: number;
}

/** UI 표시용 진행률 정보 */
export interface SublevelCompletion {
  playCount: { current: number; required: number; satisfied: boolean };
  bestStreak: { current: number; required: number; satisfied: boolean };
  accuracy: { current: number; required: number; satisfied: boolean };
  avgReactionTime: { current: number | null; required: number; satisfied: boolean };
  allSatisfied: boolean;
}

// ─────────────────────────────────────────────
// 정책 상수
// ─────────────────────────────────────────────

export const SUBLEVEL_CONFIGS: Record<Sublevel, SublevelConfig> = {
  1: {
    timeLimit: 7,
    lives: 5,
    label: "입문",
    // 28노트 — 정확성 + 흐름 맛보기
    stages: [
      { stage: 1, batchSize: 1, totalSets: 6, notesPerSet: 1 }, //  6
      { stage: 2, batchSize: 1, totalSets: 7, notesPerSet: 1 }, //  7
      { stage: 3, batchSize: 3, totalSets: 5, notesPerSet: 3 }, // 15
    ],
  },
  2: {
    timeLimit: 5,
    lives: 4,
    label: "숙련",
    // 30노트 — 흐름 + 시야 확장
    stages: [
      { stage: 1, batchSize: 1, totalSets: 6, notesPerSet: 1 }, //  6
      { stage: 2, batchSize: 3, totalSets: 3, notesPerSet: 3 }, //  9
      { stage: 3, batchSize: 5, totalSets: 3, notesPerSet: 5 }, // 15
    ],
  },
  3: {
    timeLimit: 3,
    lives: 3,
    label: "마스터",
    // 45노트 — 시야 + 지구력
    stages: [
      { stage: 1, batchSize: 3, totalSets: 3, notesPerSet: 3 }, //  9
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
    { stage: 1, batchSize: 3, totalSets: 5, notesPerSet: 3 }, // 15
    { stage: 2, batchSize: 5, totalSets: 3, notesPerSet: 5 }, // 15
    { stage: 3, batchSize: 7, totalSets: 3, notesPerSet: 7 }, // 21
  ],
  2: [
    { stage: 1, batchSize: 3, totalSets: 5, notesPerSet: 3 }, // 15
    { stage: 2, batchSize: 5, totalSets: 3, notesPerSet: 5 }, // 15
    { stage: 3, batchSize: 7, totalSets: 3, notesPerSet: 7 }, // 21
  ],
  3: [
    { stage: 1, batchSize: 5, totalSets: 3, notesPerSet: 5 }, // 15
    { stage: 2, batchSize: 7, totalSets: 3, notesPerSet: 7 }, // 21
    { stage: 3, batchSize: 7, totalSets: 3, notesPerSet: 7 }, // 21
  ],
};

export const PASS_CRITERIA = {
  MIN_PLAY_COUNT: 10,
  MIN_BEST_STREAK: 5,
  MIN_ACCURACY: 0.85,
  /** sublevel 평균 반응속도 ≤ 타이머 × 이 비율 */
  MIN_AVG_REACTION_RATIO: 0.35,
} as const;

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

/** 누적 정답률 계산 (모든 시도 포함, game over 포함) */
export function calculateAccuracy(progress: SublevelProgress): number {
  if (progress.total_attempts === 0) return 0;
  return progress.total_correct / progress.total_attempts;
}

/** 단계 통과 조건 충족 여부 (4개 모두) */
export function checkPassed(progress: SublevelProgress): boolean {
  const timeLimit = SUBLEVEL_CONFIGS[progress.sublevel].timeLimit;
  const reactionRequired = timeLimit * PASS_CRITERIA.MIN_AVG_REACTION_RATIO;
  const reactionOk =
    progress.avg_reaction_time === undefined ||
    progress.avg_reaction_time <= reactionRequired;
  return (
    progress.play_count >= PASS_CRITERIA.MIN_PLAY_COUNT &&
    progress.best_streak >= PASS_CRITERIA.MIN_BEST_STREAK &&
    calculateAccuracy(progress) >= PASS_CRITERIA.MIN_ACCURACY &&
    reactionOk
  );
}

/** UI 진행률 정보 생성 */
export function getCompletion(progress: SublevelProgress): SublevelCompletion {
  const accuracy = calculateAccuracy(progress);
  const timeLimit = SUBLEVEL_CONFIGS[progress.sublevel].timeLimit;
  const reactionRequired = timeLimit * PASS_CRITERIA.MIN_AVG_REACTION_RATIO;

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
    satisfied: accuracy >= PASS_CRITERIA.MIN_ACCURACY,
  };

  const avgReactionTime = {
    current: progress.avg_reaction_time ?? null,
    required: reactionRequired,
    satisfied:
      progress.avg_reaction_time === undefined ||
      progress.avg_reaction_time <= reactionRequired,
  };

  return {
    playCount,
    bestStreak,
    accuracy: accuracyResult,
    avgReactionTime,
    allSatisfied:
      playCount.satisfied &&
      bestStreak.satisfied &&
      accuracyResult.satisfied &&
      avgReactionTime.satisfied,
  };
}

// ─────────────────────────────────────────────
// 구독 게이트
// ─────────────────────────────────────────────

/** 사용자가 특정 단계에 접근 가능한지 (구독 등급 기준) */
export function canAccessSublevel(
  tier: SubscriptionTier,
  level: number,
  sublevel: Sublevel
): boolean {
  // Pro: 전체 접근
  if (tier === "pro") return true;

  // Guest (미가입): Lv 1만
  if (tier === "guest") {
    return level === 1;
  }

  // Free (일반 가입): Lv 1·2 전체 + Lv 3-1, Lv 4-1
  if (tier === "free") {
    if (level <= 2) return true;
    if ((level === 3 || level === 4) && sublevel === 1) return true;
    return false;
  }

  return false;
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