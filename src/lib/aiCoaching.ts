/** Rule-based coaching comments (no API). */

export interface CoachingInput {
  outcome: "passed" | "game_over";
  /** 이번 세션 정답률 (0~1) */
  accuracy: number;
  /** 이번 세션 최고 연속 정답 수 */
  bestStreak: number;
  /** 이번 세션 평균 반응속도 비율 (미기록 시 undefined) */
  avgReactionRatio?: number;
  /** 누적 플레이 횟수 */
  playCount: number;
  /** 패스트트랙 통과 (true → 전용 메시지 반환) */
  fastTrack?: boolean;
  /** 이전 누적 정답률 (이번 세션 제외, 0~1). 적용된 영역 = 비교 분기 완료. */
  historicalAccuracy?: number;
}

interface CoachingStrings {
  /** passed 3 branches: 상승 / 안정 / 낮은 상승. 기존 임계값(top / great / borderline) 그대로 매핑. */
  passed: readonly [string, string, string];
  /** game_over 3 branches: 첫 시도(playCount≤1) / 평소보다 약함(delta<-5%p) / 평소 수준. */
  game_over: readonly [string, string, string];
  fast_track: string;
}

const STRINGS: Record<"ko" | "en", CoachingStrings> = {
  ko: {
    passed: [
      // branch 0: accuracy ≥ 0.95 + reaction ≤ 0.25 — 상승 (top)
      "이 흐름을 멈추지 마세요.",
      // branch 1: accuracy ≥ 0.90 — 안정 (great)
      "한 단계 더 가까워졌습니다.",
      // branch 2: else — 낮은 상승 (borderline pass)
      "한 끗 차이입니다. 다음도 갑니다.",
    ],
    game_over: [
      // branch 0: playCount ≤ 1 — 첫 시도
      "첫 시작입니다. 매일 한 판.",
      // branch 1: historicalAccuracy 있고 current - historical < -0.05 — 평소보다 약함
      "다시 잡을 수 있습니다.",
      // branch 2: else — 평소 수준
      "같은 자리에서 다시.",
    ],
    fast_track: "이미 충분합니다. 다음 단계로.",
  },
  en: {
    passed: [
      // branch 0: top — 상승
      "Don't stop this streak.",
      // branch 1: great — 안정
      "One step closer.",
      // branch 2: borderline — 낮은 상승
      "So close. Next round.",
    ],
    game_over: [
      // branch 0: 첫 시도
      "Just the beginning. One round a day.",
      // branch 1: 평소보다 약함
      "You can catch this back.",
      // branch 2: 평소 수준
      "Try again from here.",
    ],
    fast_track: "Already enough. Onto the next.",
  },
};

function baseComment(input: CoachingInput, s: CoachingStrings): string {
  if (input.outcome === "passed") {
    // 기존 임계값 그대로: top (acc≥95% + reaction≤25%) → 상승
    if (
      input.accuracy >= 0.95 &&
      input.avgReactionRatio !== undefined &&
      input.avgReactionRatio <= 0.25
    ) {
      return s.passed[0];
    }
    // 기존 great (acc≥90%) → 안정
    if (input.accuracy >= 0.90) {
      return s.passed[1];
    }
    // borderline → 낮은 상승
    return s.passed[2];
  }

  // game_over — 새 3분기 (playCount + historicalAccuracy delta 기반)
  if (input.playCount <= 1) {
    return s.game_over[0]; // 첫 시도
  }
  if (
    input.historicalAccuracy !== undefined &&
    input.accuracy - input.historicalAccuracy < -0.05
  ) {
    return s.game_over[1]; // 평소보다 약함
  }
  return s.game_over[2]; // 평소 수준
}

export function generateCoachingComment(
  input: CoachingInput,
  lang: "ko" | "en"
): string {
  const s = STRINGS[lang];

  if (input.fastTrack) {
    return s.fast_track;
  }

  // 비교 prefix는 디자인 리뉴얼(5/31)에서 제거 — 트렌드 정보는 다이얼로그 Hero 배지로 분리.
  // 한 줄 메시지는 짧은 동기부여 미니멀 톤만 유지.
  return baseComment(input, s);
}
