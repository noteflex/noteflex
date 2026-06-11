// Daily Challenge — 자체 점수 가중치 + 합산 함수.
// 가중치는 본 파일 상단 상수로 관리. 기존 levelSystem과 무관.

import type {
  DailyQuestionResult,
  DailyResultStatus,
} from "./dailyTypes";

// ── 점수 가중치 (조정 후보) ─────────────────────────────────────
export const DAILY_SCORE = {
  /** 정답 기본 점수 (정확도 축). */
  CORRECT_BASE: 50,
  /** 빠른 정답 추가 보너스. */
  SPEED_FAST_BONUS: 50,
  /** 중간 속도 정답 추가 보너스. */
  SPEED_MID_BONUS: 25,
  /** 빠른 정답 임계(ms). */
  SPEED_FAST_MS: 1000,
  /** 중간 정답 임계(ms). 이 값 이상은 속도 보너스 0. */
  SPEED_MID_MS: 3000,
  /** 연속 정답마다 가산 폭. */
  COMBO_INCREMENT: 10,
  /** 한 문제에 적용되는 콤보 가산 상한. */
  COMBO_CAP: 100,
  /** 조표 문제 정답 추가 보너스. */
  KEYSIG_BONUS: 30,
  /** 종료 시 생명 1개당 가산. */
  LIFE_END_BONUS: 100,
} as const;

/** 정답을 빠름/느림으로 분류. */
export function classifyCorrect(responseTimeMs: number): DailyResultStatus {
  return responseTimeMs < DAILY_SCORE.SPEED_FAST_MS
    ? "correct_fast"
    : "correct_slow";
}

/**
 * 점수 합산. results는 questionIndex 오름차순(생성 순서) 가정.
 *   score = Σ(문제별 점수) + livesRemaining × LIFE_END_BONUS
 *   문제별 점수 = base + 속도 보너스 + 콤보 가산 + (조표 문제이면) KEYSIG_BONUS
 */
export function computeDailyScore(
  results: DailyQuestionResult[],
  livesRemaining: number,
): number {
  let score = 0;
  let streak = 0;

  for (const r of results) {
    const isCorrect = r.status === "correct_fast" || r.status === "correct_slow";
    if (!isCorrect) {
      streak = 0;
      continue;
    }

    score += DAILY_SCORE.CORRECT_BASE;

    if (r.status === "correct_fast") {
      score += DAILY_SCORE.SPEED_FAST_BONUS;
    } else if (
      r.responseTimeMs !== null &&
      r.responseTimeMs < DAILY_SCORE.SPEED_MID_MS
    ) {
      score += DAILY_SCORE.SPEED_MID_BONUS;
    }

    streak += 1;
    const comboGain = Math.min(
      streak * DAILY_SCORE.COMBO_INCREMENT,
      DAILY_SCORE.COMBO_CAP,
    );
    score += comboGain;

    if (r.wasKeySig) score += DAILY_SCORE.KEYSIG_BONUS;
  }

  score += Math.max(0, livesRemaining) * DAILY_SCORE.LIFE_END_BONUS;
  return score;
}
