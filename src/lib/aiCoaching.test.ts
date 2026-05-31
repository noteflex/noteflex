import { describe, it, expect } from "vitest";
import { generateCoachingComment, type CoachingInput } from "./aiCoaching";

const base: CoachingInput = {
  outcome: "passed",
  accuracy: 0.88,
  bestStreak: 7,
  avgReactionRatio: 0.30,
  playCount: 12,
};

// ── passed 3 branches (임계값 그대로, 메시지 5/31 리뉴얼) ─────────

describe("generateCoachingComment — passed (ko)", () => {
  it("branch 0: accuracy ≥ 0.95 + reaction ≤ 0.25 → 상승 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.97, avgReactionRatio: 0.20 },
      "ko"
    );
    expect(comment).toBe("이 흐름을 멈추지 마세요.");
  });

  it("branch 1: accuracy ≥ 0.90 (reaction 조건 불충족) → 안정 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.92, avgReactionRatio: 0.40 },
      "ko"
    );
    expect(comment).toBe("한 단계 더 가까워졌습니다.");
  });

  it("branch 2: accuracy 0.85~0.89 → 낮은 상승 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.86, avgReactionRatio: 0.33 },
      "ko"
    );
    expect(comment).toBe("한 끗 차이입니다. 다음도 갑니다.");
  });
});

describe("generateCoachingComment — passed (en)", () => {
  it("branch 0 en: Don't stop this streak", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.96, avgReactionRatio: 0.22 },
      "en"
    );
    expect(comment).toBe("Don't stop this streak.");
  });

  it("branch 1 en: One step closer", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.91, avgReactionRatio: 0.40 },
      "en"
    );
    expect(comment).toBe("One step closer.");
  });

  it("branch 2 en: So close. Next round", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.86 },
      "en"
    );
    expect(comment).toBe("So close. Next round.");
  });
});

// ── game_over 3 branches (5/31 새 분기 — playCount + historicalAccuracy delta 기반) ──

describe("generateCoachingComment — game_over (ko)", () => {
  it("branch 0: playCount ≤ 1 → 첫 시도 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, outcome: "game_over", playCount: 1 },
      "ko"
    );
    expect(comment).toBe("첫 시작입니다. 매일 한 판.");
  });

  it("branch 0: playCount=0 → 첫 시도 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, outcome: "game_over", playCount: 0 },
      "ko"
    );
    expect(comment).toBe("첫 시작입니다. 매일 한 판.");
  });

  it("branch 1: historicalAccuracy 있고 delta < -5%p → 평소보다 약함", () => {
    const comment = generateCoachingComment(
      {
        ...base,
        outcome: "game_over",
        playCount: 10,
        accuracy: 0.65,
        historicalAccuracy: 0.80,
      },
      "ko"
    );
    expect(comment).toBe("다시 잡을 수 있습니다.");
  });

  it("branch 2: historicalAccuracy 없음 + playCount > 1 → 평소 수준", () => {
    const comment = generateCoachingComment(
      { ...base, outcome: "game_over", playCount: 5 },
      "ko"
    );
    expect(comment).toBe("같은 자리에서 다시.");
  });

  it("branch 2: historicalAccuracy 있지만 delta 작음 → 평소 수준", () => {
    const comment = generateCoachingComment(
      {
        ...base,
        outcome: "game_over",
        playCount: 10,
        accuracy: 0.78,
        historicalAccuracy: 0.80,
      },
      "ko"
    );
    expect(comment).toBe("같은 자리에서 다시.");
  });
});

describe("generateCoachingComment — game_over (en)", () => {
  it("branch 0 en: 첫 시도", () => {
    const comment = generateCoachingComment(
      { ...base, outcome: "game_over", playCount: 0 },
      "en"
    );
    expect(comment).toBe("Just the beginning. One round a day.");
  });

  it("branch 1 en: 평소보다 약함", () => {
    const comment = generateCoachingComment(
      {
        ...base,
        outcome: "game_over",
        playCount: 8,
        accuracy: 0.60,
        historicalAccuracy: 0.78,
      },
      "en"
    );
    expect(comment).toBe("You can catch this back.");
  });

  it("branch 2 en: 평소 수준", () => {
    const comment = generateCoachingComment(
      { ...base, outcome: "game_over", playCount: 5 },
      "en"
    );
    expect(comment).toBe("Try again from here.");
  });
});

// ── fastTrack 전용 분기 (그대로 유지) ────────────────────────

describe("generateCoachingComment — fastTrack", () => {
  it("fastTrack=true, ko → '이미 충분합니다' 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, fastTrack: true },
      "ko"
    );
    expect(comment).toBe("이미 충분합니다. 다음 단계로.");
  });

  it("fastTrack=true, en → 'Already enough' 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, fastTrack: true },
      "en"
    );
    expect(comment).toBe("Already enough. Onto the next.");
  });

  it("fastTrack=true → outcome·accuracy 무관하게 fast_track 우선", () => {
    const comment = generateCoachingComment(
      { ...base, outcome: "game_over", accuracy: 0.50, fastTrack: true },
      "ko"
    );
    expect(comment).toBe("이미 충분합니다. 다음 단계로.");
  });

  it("fastTrack=false 명시 → 일반 분기 유지", () => {
    const comment = generateCoachingComment(
      { ...base, fastTrack: false },
      "ko"
    );
    expect(comment).not.toBe("이미 충분합니다. 다음 단계로.");
  });

  it("fastTrack undefined → 일반 분기 유지", () => {
    const comment = generateCoachingComment(base, "ko");
    expect(comment).not.toBe("이미 충분합니다. 다음 단계로.");
  });
});
