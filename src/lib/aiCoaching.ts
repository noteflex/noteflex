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
  /** 이전 누적 정답률 (이번 세션 제외, 0~1). 박힌 영역 = 비교 분기 박음. */
  historicalAccuracy?: number;
}

interface CoachingStrings {
  passed: readonly [string, string, string];    // 3 branches
  game_over: readonly [string, string, string, string]; // 4 branches
  fast_track: string; // fastTrack 전용
  /** "{delta}%p" placeholder 박힘. {direction} = "↑/→/↓" 박힘 */
  comparisonPrefix: {
    up: string;       // "이전 대비 정확도 +{delta}%p ↑"
    flat: string;     // "이전 대비 정확도 유지"
    down: string;     // "이전 대비 정확도 -{delta}%p ↓"
  };
}

const STRINGS: Record<"ko" | "en", CoachingStrings> = {
  ko: {
    passed: [
      // branch 0: accuracy ≥ 0.95 + reaction ≤ 0.25  (top)
      "완벽에 가까운 클리어! 정확도도, 반응속도도 모두 최상이에요.",
      // branch 1: accuracy ≥ 0.90  (great)
      "훌륭해요! 꾸준한 연습이 빛을 발하고 있어요.",
      // branch 2: else — passed but borderline  (encouraging)
      "통과! 아슬아슬하게 통과했지만 충분히 잘하고 있어요. 계속 도전해봐요.",
    ],
    game_over: [
      // branch 0: accuracy < 0.70  (focus accuracy)
      "정확도가 조금 낮아요. 노트를 천천히 확인하면서 연습해봐요.",
      // branch 1: bestStreak < 3  (concentration)
      "연속 정답이 아직 부족해요. 리듬을 유지하는 데 집중해봐요.",
      // branch 2: avgReactionRatio > 0.50  (too slow)
      "반응이 조금 느려요. 노트를 미리 예측하는 습관을 들여봐요.",
      // branch 3: else — general encouragement
      "조금만 더 하면 돼요! 플레이할수록 기준에 가까워지고 있어요.",
    ],
    fast_track: "이미 충분합니다. 다음 단계로.",
    comparisonPrefix: {
      up: "이전 대비 정확도 +{delta}%p ↑ — ",
      flat: "이전 대비 정확도 유지 → ",
      down: "이전 대비 정확도 -{delta}%p ↓ — ",
    },
  },
  en: {
    passed: [
      // branch 0: top
      "Near-perfect clear! Your accuracy and speed are both outstanding.",
      // branch 1: great
      "Great work! Consistent practice is really paying off.",
      // branch 2: encouraging
      "You passed! It was close, but you made it. Keep pushing!",
    ],
    game_over: [
      // branch 0: focus accuracy
      "Your accuracy is a bit low. Try reading notes carefully before tapping.",
      // branch 1: concentration
      "Still working on those consecutive answers. Focus on keeping a steady rhythm.",
      // branch 2: too slow
      "Reaction time is a bit slow. Practice anticipating the next note.",
      // branch 3: general
      "Almost there! Every play brings you closer to passing.",
    ],
    fast_track: "Already enough. Onto the next.",
    comparisonPrefix: {
      up: "Accuracy +{delta}%p ↑ vs your average — ",
      flat: "Accuracy steady vs your average → ",
      down: "Accuracy -{delta}%p ↓ vs your average — ",
    },
  },
};

function baseComment(input: CoachingInput, s: CoachingStrings): string {
  if (input.outcome === "passed") {
    if (
      input.accuracy >= 0.95 &&
      input.avgReactionRatio !== undefined &&
      input.avgReactionRatio <= 0.25
    ) {
      return s.passed[0];
    }
    if (input.accuracy >= 0.90) {
      return s.passed[1];
    }
    return s.passed[2];
  }

  // game_over — find primary blocker
  if (input.accuracy < 0.70) {
    return s.game_over[0];
  }
  if (input.bestStreak < 3) {
    return s.game_over[1];
  }
  if (input.avgReactionRatio !== undefined && input.avgReactionRatio > 0.50) {
    return s.game_over[2];
  }
  return s.game_over[3];
}

function comparisonPrefix(
  current: number,
  historical: number,
  prefixes: CoachingStrings["comparisonPrefix"]
): string {
  const deltaPct = Math.round((current - historical) * 100);
  // ±2%p 이내는 유지로 박음 (노이즈 회피)
  if (deltaPct >= -2 && deltaPct <= 2) return prefixes.flat;
  if (deltaPct > 2) {
    return prefixes.up.replace("{delta}", String(deltaPct));
  }
  return prefixes.down.replace("{delta}", String(Math.abs(deltaPct)));
}

export function generateCoachingComment(
  input: CoachingInput,
  lang: "ko" | "en"
): string {
  const s = STRINGS[lang];

  if (input.fastTrack) {
    return s.fast_track;
  }

  const base = baseComment(input, s);

  // 비교 분기: historicalAccuracy 박힌 영역만 prefix 박음 (Guest = X)
  if (input.historicalAccuracy !== undefined) {
    return comparisonPrefix(input.accuracy, input.historicalAccuracy, s.comparisonPrefix) + base;
  }

  return base;
}
