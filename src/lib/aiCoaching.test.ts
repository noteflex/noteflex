import { describe, it, expect } from "vitest";
import { generateCoachingComment, type CoachingInput } from "./aiCoaching";

const base: CoachingInput = {
  outcome: "passed",
  accuracy: 0.88,
  bestStreak: 7,
  avgReactionRatio: 0.30,
  playCount: 12,
};

// ── passed 3 branches ─────────────────────────────────────────

describe("generateCoachingComment — passed (ko)", () => {
  it("branch 0: accuracy ≥ 0.95 + reaction ≤ 0.25 → 최상 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.97, avgReactionRatio: 0.20 },
      "ko"
    );
    expect(comment).toMatch(/완벽/);
  });

  it("branch 1: accuracy ≥ 0.90 (reaction 조건 불충족) → 훌륭해요", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.92, avgReactionRatio: 0.40 },
      "ko"
    );
    expect(comment).toMatch(/훌륭/);
  });

  it("branch 2: accuracy 0.85~0.89 → 통과 격려 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.86, avgReactionRatio: 0.33 },
      "ko"
    );
    expect(comment).toMatch(/통과/);
  });
});

describe("generateCoachingComment — passed (en)", () => {
  it("branch 0 en: Near-perfect 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.96, avgReactionRatio: 0.22 },
      "en"
    );
    expect(comment).toMatch(/Near-perfect/);
  });

  it("branch 1 en: Great work 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.91, avgReactionRatio: 0.40 },
      "en"
    );
    expect(comment).toMatch(/Great work/);
  });

  it("branch 2 en: You passed 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, accuracy: 0.86 },
      "en"
    );
    expect(comment).toMatch(/You passed/);
  });
});

// ── game_over 4 branches ──────────────────────────────────────

describe("generateCoachingComment — game_over (ko)", () => {
  it("branch 0: accuracy < 0.70 → 정확도 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, outcome: "game_over", accuracy: 0.60 },
      "ko"
    );
    expect(comment).toMatch(/정확도/);
  });

  it("branch 1: bestStreak < 3 (accuracy ok) → 연속 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, outcome: "game_over", accuracy: 0.80, bestStreak: 2 },
      "ko"
    );
    expect(comment).toMatch(/연속/);
  });

  it("branch 2: reaction > 0.50 (accuracy/streak ok) → 반응 메시지", () => {
    const comment = generateCoachingComment(
      {
        ...base,
        outcome: "game_over",
        accuracy: 0.80,
        bestStreak: 4,
        avgReactionRatio: 0.60,
      },
      "ko"
    );
    expect(comment).toMatch(/반응/);
  });

  it("branch 3: else → 격려 메시지", () => {
    const comment = generateCoachingComment(
      {
        ...base,
        outcome: "game_over",
        accuracy: 0.80,
        bestStreak: 4,
        avgReactionRatio: 0.40,
      },
      "ko"
    );
    expect(comment).toMatch(/조금만 더/);
  });

  it("branch 3: avgReactionRatio undefined + else → 격려 메시지", () => {
    const comment = generateCoachingComment(
      {
        ...base,
        outcome: "game_over",
        accuracy: 0.82,
        bestStreak: 5,
        avgReactionRatio: undefined,
      },
      "ko"
    );
    expect(comment).toMatch(/조금만 더/);
  });

  it("branch 0 en: accuracy < 0.70 → accuracy 메시지", () => {
    const comment = generateCoachingComment(
      { ...base, outcome: "game_over", accuracy: 0.55 },
      "en"
    );
    expect(comment).toMatch(/accuracy/i);
  });
});
