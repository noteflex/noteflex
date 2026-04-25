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
 * 단계 통과 조건 (3개 모두 충족):
 *   - 플레이 횟수 ≥ 5회
 *   - 한 게임에서 연속 정답 ≥ 5개 (한 번이라도)
 *   - 누적 정답률 ≥ 80%
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

export interface SublevelConfig {
  /** 음표당 제한 시간(초) */
  timeLimit: number;
  /** 게임 시작 시 목숨 개수 */
  lives: number;
  /** 표시용 라벨 */
  label: string;
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
}

/** UI 표시용 진행률 정보 */
export interface SublevelCompletion {
  playCount: { current: number; required: number; satisfied: boolean };
  bestStreak: { current: number; required: number; satisfied: boolean };
  accuracy: { current: number; required: number; satisfied: boolean };
  allSatisfied: boolean;
}

// ─────────────────────────────────────────────
// 정책 상수
// ─────────────────────────────────────────────

export const SUBLEVEL_CONFIGS: Record<Sublevel, SublevelConfig> = {
  1: { timeLimit: 7, lives: 5, label: "입문" },
  2: { timeLimit: 5, lives: 4, label: "숙련" },
  3: { timeLimit: 3, lives: 3, label: "마스터" },
};

export const PASS_CRITERIA = {
  MIN_PLAY_COUNT: 5,
  MIN_BEST_STREAK: 5,
  MIN_ACCURACY: 0.8,
} as const;

export const TOTAL_SUBLEVELS = 21; // 7 × 3
export const MAX_LEVEL = 7;
export const MAX_SUBLEVEL = 3;

// ─────────────────────────────────────────────
// 계산 함수
// ─────────────────────────────────────────────

/** 누적 정답률 계산 (모든 시도 포함, game over 포함) */
export function calculateAccuracy(progress: SublevelProgress): number {
  if (progress.total_attempts === 0) return 0;
  return progress.total_correct / progress.total_attempts;
}

/** 단계 통과 조건 충족 여부 (3개 모두) */
export function checkPassed(progress: SublevelProgress): boolean {
  return (
    progress.play_count >= PASS_CRITERIA.MIN_PLAY_COUNT &&
    progress.best_streak >= PASS_CRITERIA.MIN_BEST_STREAK &&
    calculateAccuracy(progress) >= PASS_CRITERIA.MIN_ACCURACY
  );
}

/** UI 진행률 정보 생성 */
export function getCompletion(progress: SublevelProgress): SublevelCompletion {
  const accuracy = calculateAccuracy(progress);

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

  return {
    playCount,
    bestStreak,
    accuracy: accuracyResult,
    allSatisfied:
      playCount.satisfied && bestStreak.satisfied && accuracyResult.satisfied,
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