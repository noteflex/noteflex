/**
 * 5-C 단위 테스트: 메트릭 함수 + predicate + evaluateScenario.
 *
 * mock PickDecision·SimEvent를 직접 구성해 generic 메트릭 로직을 검증.
 */

import { describe, it, expect } from "vitest";
import type { PickDecision, PickCandidate } from "@/lib/pickDecision";
import {
  metricSoftAvoidViolationRate,
  metricN2RecoveryCount,
  metricN2RecoveryHitRate,
  metricWeakWeightedCount,
  metricQueueMaxViolations,
  metricStreakMasteredNoteCount,
  metricAccidentalRatio,
  metricWeakSlotPickRateOnIds,
  metricNoteDistribution,
  detectSuspiciousCases,
  applyPredicate,
} from "./metrics";
import type { SimEvent } from "./core/simSession";

// ─────────────────────────────────────────────────────────────
// mock 빌더
// ─────────────────────────────────────────────────────────────

function mockCandidate(over: Partial<PickCandidate> = {}): PickCandidate {
  return {
    noteId: "treble:C4",
    baseWeight: 1.0,
    isKeySignatureNote: false,
    keySignatureMultiplier: 1.0,
    accuracyScore: null,
    responseTimeScore: null,
    combinedWeakScore: null,
    weakMultiplier: 1.0,
    masteryFlag: "normal",
    masteryMultiplier: 1.0,
    streakMastered: false,
    streakMultiplier: 1.0,
    softAvoidMultiplier: 1.0,
    finalWeight: 1.0,
    pickProbability: 0.1,
    ...over,
  };
}

function mockDecision(over: Partial<PickDecision> = {}): PickDecision {
  const base: PickDecision = {
    turn: 0,
    pickedNote: {
      key: "C", octave: 4, clef: "treble", accidental: undefined, noteId: "treble:C4",
    },
    source: "general",
    context: {
      accuracyBeforePick: 0,
      adaptiveMode: "warmup",
      weakSlotRatio: 0.6,
      queueState: [],
      previousNotes: [],
      keySignature: "C major (none)",
      sublevelPoolSize: 14,
      keySignatureNotesInPool: 0,
    },
    candidates: [mockCandidate()],
    randomValue: null,
    cumulativeProbabilityHit: "treble:C4",
    reasonText: "mock",
    timestamp: 0,
  };
  return { ...base, ...over };
}

function mockEvent(over: Partial<SimEvent> = {}): SimEvent {
  return {
    turn: 0,
    attemptIndex: 0,
    batchIndex: 0,
    batchSize: 3,
    shown: { name: "도", key: "C", y: 0, octave: "4" },
    shownId: "treble:C4",
    isRetry: false,
    correct: true,
    responseTimeSec: 1.0,
    accuracyBeforePick: 0,
    adaptiveModeAtPick: "warmup",
    weakSlotRatioAtPick: 0.6,
    queueSizeAfter: 0,
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────
// 메트릭 단위 테스트
// ─────────────────────────────────────────────────────────────

describe("metricSoftAvoidViolationRate", () => {
  it("previousNotes 비어있으면 위반 없음", () => {
    const r = metricSoftAvoidViolationRate([
      mockDecision({ pickedNote: { ...mockDecision().pickedNote, noteId: "treble:C4" } }),
    ]);
    expect(r.value).toBe(0);
  });

  it("음명 일치 시 위반 카운트", () => {
    const d1 = mockDecision({
      pickedNote: { key: "C", octave: 4, clef: "treble", noteId: "treble:C4" },
      context: { ...mockDecision().context, previousNotes: ["treble:C5"] },
    });
    const d2 = mockDecision({
      pickedNote: { key: "G", octave: 4, clef: "treble", noteId: "treble:G4" },
      context: { ...mockDecision().context, previousNotes: ["treble:C5"] },
    });
    const r = metricSoftAvoidViolationRate([d1, d2]);
    expect(r.value).toBe(0.5); // 1 violation out of 2
    expect(r.detail).toEqual({ violations: 1, total: 2 });
  });

  it("n_plus_2_recovery는 제외", () => {
    const n2 = mockDecision({
      source: "n_plus_2_recovery",
      pickedNote: { key: "C", octave: 4, clef: "treble", noteId: "treble:C4" },
      context: { ...mockDecision().context, previousNotes: ["treble:C5"] },
    });
    const r = metricSoftAvoidViolationRate([n2]);
    expect(r.value).toBe(0);
    expect(r.detail).toEqual({ violations: 0, total: 0 });
  });
});

describe("metricN2RecoveryCount + HitRate", () => {
  it("source 카운트 정확", () => {
    const ds = [
      mockDecision({ source: "n_plus_2_recovery" }),
      mockDecision({ source: "weak_weighted" }),
      mockDecision({ source: "general" }),
      mockDecision({ source: "n_plus_2_recovery" }),
    ];
    expect(metricN2RecoveryCount(ds).value).toBe(2);
    expect(metricN2RecoveryHitRate(ds).value).toBe(0.5);
  });

  it("빈 배열 → 0", () => {
    expect(metricN2RecoveryHitRate([]).value).toBe(0);
  });
});

describe("metricWeakWeightedCount", () => {
  it("weak_weighted source만 카운트", () => {
    const ds = [
      mockDecision({ source: "weak_weighted" }),
      mockDecision({ source: "general" }),
      mockDecision({ source: "weak_weighted" }),
      mockDecision({ source: "n_plus_2_recovery" }),
    ];
    expect(metricWeakWeightedCount(ds).value).toBe(2);
  });
});

describe("metricQueueMaxViolations", () => {
  it("queueState.length > 3 카운트 (정상은 0)", () => {
    const ds = [
      mockDecision({ context: { ...mockDecision().context, queueState: [] } }),
      mockDecision({ context: { ...mockDecision().context, queueState: ["a", "b", "c"] } }),
      mockDecision({ context: { ...mockDecision().context, queueState: ["a", "b", "c", "d"] } }),
    ];
    expect(metricQueueMaxViolations(ds).value).toBe(1);
  });
});

describe("metricStreakMasteredNoteCount", () => {
  it("candidates에서 streakMastered=true distinct ID 카운트", () => {
    const ds = [
      mockDecision({
        candidates: [
          mockCandidate({ noteId: "treble:C4", streakMastered: true }),
          mockCandidate({ noteId: "treble:D4", streakMastered: false }),
        ],
      }),
      mockDecision({
        candidates: [
          mockCandidate({ noteId: "treble:C4", streakMastered: true }), // 중복
          mockCandidate({ noteId: "treble:E4", streakMastered: true }),
        ],
      }),
    ];
    const r = metricStreakMasteredNoteCount(ds);
    expect(r.value).toBe(2); // C4, E4
  });

  it("아무도 마스터 안 됐으면 0", () => {
    const ds = [
      mockDecision({ candidates: [mockCandidate({ streakMastered: false })] }),
    ];
    expect(metricStreakMasteredNoteCount(ds).value).toBe(0);
  });
});

describe("metricAccidentalRatio", () => {
  it("keySig 비어있으면 0", () => {
    const ds = [mockDecision()];
    const r = metricAccidentalRatio(ds, { key: "C", abcKey: "C" });
    expect(r.value).toBe(0);
    expect(r.detail?.reason).toBe("no accidentals");
  });

  it("G major (sharps=[F]) — 결정 단위 F# 비율 계산", () => {
    const ds = [
      mockDecision({
        pickedNote: { key: "F", octave: 4, clef: "treble", accidental: "#", noteId: "treble:F#4" },
      }),
      mockDecision({
        pickedNote: { key: "C", octave: 4, clef: "treble", noteId: "treble:C4" },
      }),
      mockDecision({
        pickedNote: { key: "F", octave: 5, clef: "treble", accidental: "#", noteId: "treble:F#5" },
      }),
    ];
    const r = metricAccidentalRatio(ds, { key: "G", abcKey: "G", sharps: ["F"] });
    expect(r.value).toBeCloseTo(2 / 3, 5);
    expect(r.detail).toEqual({ withAcc: 2, total: 3 });
  });

  it("n_plus_2_recovery 결정은 제외 (재시도 bias 회피)", () => {
    const ds = [
      // 새 슬롯 결정 — F#
      mockDecision({
        source: "weak_weighted",
        pickedNote: { key: "F", octave: 4, clef: "treble", accidental: "#", noteId: "treble:F#4" },
      }),
      // 새 슬롯 결정 — C
      mockDecision({
        source: "general",
        pickedNote: { key: "C", octave: 4, clef: "treble", noteId: "treble:C4" },
      }),
      // n+2 회복은 카운트 X (F#가 여러 번 재출제돼도 비율 부풀리지 X)
      mockDecision({
        source: "n_plus_2_recovery",
        pickedNote: { key: "F", octave: 4, clef: "treble", accidental: "#", noteId: "treble:F#4" },
      }),
      mockDecision({
        source: "n_plus_2_recovery",
        pickedNote: { key: "F", octave: 4, clef: "treble", accidental: "#", noteId: "treble:F#4" },
      }),
    ];
    const r = metricAccidentalRatio(ds, { key: "G", abcKey: "G", sharps: ["F"] });
    expect(r.value).toBe(0.5); // 1 / 2, n+2 제외
    expect(r.detail).toEqual({ withAcc: 1, total: 2 });
  });
});

describe("metricWeakSlotPickRateOnIds", () => {
  it("weak_weighted 슬롯의 targetIds 출제 비율", () => {
    const target = new Set(["treble:F#4", "treble:F#5"]);
    const ds = [
      mockDecision({ source: "weak_weighted", pickedNote: { key: "F", octave: 4, clef: "treble", accidental: "#", noteId: "treble:F#4" } }),
      mockDecision({ source: "weak_weighted", pickedNote: { key: "C", octave: 5, clef: "treble", noteId: "treble:C5" } }),
      mockDecision({ source: "weak_weighted", pickedNote: { key: "F", octave: 5, clef: "treble", accidental: "#", noteId: "treble:F#5" } }),
      mockDecision({ source: "general", pickedNote: { key: "F", octave: 4, clef: "treble", accidental: "#", noteId: "treble:F#4" } }),
    ];
    const r = metricWeakSlotPickRateOnIds(ds, target);
    expect(r.value).toBeCloseTo(2 / 3, 5);
    expect(r.detail).toEqual({ onTarget: 2, weakSlot: 3 });
  });

  it("weak_weighted 결정 없으면 0 + reason", () => {
    const r = metricWeakSlotPickRateOnIds([mockDecision({ source: "general" })], new Set());
    expect(r.value).toBe(0);
    expect(r.detail?.reason).toBe("no weak_weighted decisions");
  });
});

describe("metricNoteDistribution", () => {
  it("shownId 출제 횟수 집계", () => {
    const events = [
      mockEvent({ shownId: "treble:C4" }),
      mockEvent({ shownId: "treble:C4" }),
      mockEvent({ shownId: "treble:D4" }),
    ];
    const dist = metricNoteDistribution(events);
    expect(dist).toEqual({ "treble:C4": 2, "treble:D4": 1 });
  });
});

// ─────────────────────────────────────────────────────────────
// 의심 케이스
// ─────────────────────────────────────────────────────────────

describe("detectSuspiciousCases", () => {
  it("softAvoidMult < 0.5 인데 picked → 추출", () => {
    const d = mockDecision({
      turn: 7,
      candidates: [mockCandidate({ noteId: "treble:C4", softAvoidMultiplier: 0.2 })],
    });
    const out = detectSuspiciousCases([d], []);
    expect(out.length).toBe(1);
    expect(out[0].type).toBe("soft-avoid-low-mult-picked");
    expect(out[0].turn).toBe(7);
  });

  it("weak_weighted 슬롯이지만 combinedWeakScore null → 추출", () => {
    const d = mockDecision({
      source: "weak_weighted",
      candidates: [mockCandidate({ noteId: "treble:C4", combinedWeakScore: null })],
    });
    const out = detectSuspiciousCases([d], []);
    expect(out[0].type).toBe("weak-slot-no-score");
  });

  it("streakMastered=true picked → 추출", () => {
    const d = mockDecision({
      candidates: [mockCandidate({
        noteId: "treble:C4",
        streakMastered: true,
        streakMultiplier: 0.3,
      })],
    });
    const out = detectSuspiciousCases([d], []);
    expect(out[0].type).toBe("streak-mastered-picked");
  });

  it("consecutive violation (이벤트 기반) 추출", () => {
    const events = [
      mockEvent({ turn: 0, shownId: "treble:C4", correct: true }),
      mockEvent({ turn: 1, shownId: "treble:C4", correct: false }),
    ];
    const out = detectSuspiciousCases([], events);
    expect(out.find((s) => s.type === "consecutive-violation")).toBeDefined();
  });

  it("limit 적용", () => {
    const ds = Array.from({ length: 10 }, () =>
      mockDecision({
        candidates: [mockCandidate({ softAvoidMultiplier: 0.2 })],
      }),
    );
    const out = detectSuspiciousCases(ds, [], 3);
    expect(out.length).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────
// Predicate
// ─────────────────────────────────────────────────────────────

describe("applyPredicate", () => {
  it("lt", () => {
    expect(applyPredicate(0.04, { kind: "lt", max: 0.05 }).passed).toBe(true);
    expect(applyPredicate(0.05, { kind: "lt", max: 0.05 }).passed).toBe(false);
  });
  it("lte", () => {
    expect(applyPredicate(0.05, { kind: "lte", max: 0.05 }).passed).toBe(true);
    expect(applyPredicate(0.06, { kind: "lte", max: 0.05 }).passed).toBe(false);
  });
  it("gt", () => {
    expect(applyPredicate(100, { kind: "gt", min: 50 }).passed).toBe(true);
    expect(applyPredicate(50, { kind: "gt", min: 50 }).passed).toBe(false);
  });
  it("gte", () => {
    expect(applyPredicate(50, { kind: "gte", min: 50 }).passed).toBe(true);
    expect(applyPredicate(49, { kind: "gte", min: 50 }).passed).toBe(false);
  });
  it("approx", () => {
    const p = { kind: "approx" as const, target: 0.6, tolerance: 0.1 };
    expect(applyPredicate(0.6, p).passed).toBe(true);
    expect(applyPredicate(0.65, p).passed).toBe(true);
    expect(applyPredicate(0.71, p).passed).toBe(false);
    expect(applyPredicate(0.55, p).passed).toBe(true);
    expect(applyPredicate(0.49, p).passed).toBe(false);
  });
  it("eq", () => {
    expect(applyPredicate(0, { kind: "eq", value: 0 }).passed).toBe(true);
    expect(applyPredicate(1, { kind: "eq", value: 0 }).passed).toBe(false);
  });
});
