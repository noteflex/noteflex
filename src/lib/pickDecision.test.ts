import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PICK_DECISION_ENABLED,
  recordPickDecision,
  getPickDecisions,
  clearPickDecisions,
  buildReasonText,
  _setPickDecisionEnabled,
  _resetPickDecisionEnabled,
  type PickDecision,
  type PickSource,
} from "./pickDecision";

function makeDecision(overrides: Partial<PickDecision> = {}): PickDecision {
  const base: PickDecision = {
    turn: 1,
    pickedNote: {
      key: "F",
      octave: 4,
      clef: "treble",
      accidental: "#",
      noteId: "treble:F#4",
    },
    source: "general" as PickSource,
    context: {
      accuracyBeforePick: 0.7,
      adaptiveMode: "normal",
      weakSlotRatio: 0.6,
      queueState: [],
      previousNotes: ["treble:B4", "treble:C4", "treble:D4"],
      keySignature: "G major (F#)",
      sublevelPoolSize: 8,
      keySignatureNotesInPool: 1,
    },
    candidates: [
      {
        noteId: "treble:F#4",
        baseWeight: 1.0,
        isKeySignatureNote: true,
        keySignatureMultiplier: 1.2,
        accuracyScore: 0.5,
        responseTimeScore: 0.4,
        combinedWeakScore: 0.45,
        weakMultiplier: 1.9,
        masteryFlag: "normal",
        masteryMultiplier: 1.0,
        streakMastered: false,
        streakMultiplier: 1.0,
        softAvoidMultiplier: 1.0,
        finalWeight: 2.28,
        pickProbability: 0.4,
      },
    ],
    randomValue: 0.5,
    cumulativeProbabilityHit: "treble:F#4",
    reasonText: "stub",
    timestamp: Date.now(),
  };
  return { ...base, ...overrides };
}

describe("PICK_DECISION_ENABLED", () => {
  it("vitest 환경에서 true (DEV=true)", () => {
    // 현재 vitest 실행에서는 import.meta.env.DEV=true이므로 활성.
    expect(PICK_DECISION_ENABLED).toBe(true);
  });
});

describe("recordPickDecision / getPickDecisions / clearPickDecisions", () => {
  beforeEach(() => {
    clearPickDecisions();
    _resetPickDecisionEnabled();
  });

  afterEach(() => {
    _resetPickDecisionEnabled();
    clearPickDecisions();
  });

  it("활성 상태에서 1건 기록 → getPickDecisions에 1건", () => {
    recordPickDecision(makeDecision({ turn: 1 }));
    expect(getPickDecisions()).toHaveLength(1);
    expect(getPickDecisions()[0].turn).toBe(1);
  });

  it("여러 건 기록 시 순서 보존", () => {
    for (let i = 1; i <= 5; i++) {
      recordPickDecision(makeDecision({ turn: i }));
    }
    const decisions = getPickDecisions();
    expect(decisions).toHaveLength(5);
    expect(decisions.map((d) => d.turn)).toEqual([1, 2, 3, 4, 5]);
  });

  it("PICK_DECISION_ENABLED override=false → no-op", () => {
    _setPickDecisionEnabled(false);
    recordPickDecision(makeDecision());
    recordPickDecision(makeDecision());
    expect(getPickDecisions()).toHaveLength(0);
  });

  it("ring buffer 1000 초과 시 가장 오래된 것부터 제거", () => {
    for (let i = 1; i <= 1005; i++) {
      recordPickDecision(makeDecision({ turn: i }));
    }
    const decisions = getPickDecisions();
    expect(decisions).toHaveLength(1000);
    // 가장 오래된 turn 1~5는 제거, turn 6부터 시작.
    expect(decisions[0].turn).toBe(6);
    expect(decisions[999].turn).toBe(1005);
  });

  it("clearPickDecisions → 빈 배열", () => {
    recordPickDecision(makeDecision());
    recordPickDecision(makeDecision());
    expect(getPickDecisions()).toHaveLength(2);
    clearPickDecisions();
    expect(getPickDecisions()).toHaveLength(0);
  });

  it("getPickDecisions는 방어 복사 반환 (내부 buffer 직접 변형 방지)", () => {
    recordPickDecision(makeDecision({ turn: 1 }));
    const snapshot = getPickDecisions();
    snapshot.length = 0; // 외부에서 변형
    expect(getPickDecisions()).toHaveLength(1); // 내부는 영향 없음
  });

  it("window.__pickDecisions에 buffer 노출 (브라우저 환경)", () => {
    recordPickDecision(makeDecision({ turn: 42 }));
    const exposed = (window as unknown as { __pickDecisions?: PickDecision[] })
      .__pickDecisions;
    expect(exposed).toBeDefined();
    expect(exposed?.[0].turn).toBe(42);
  });
});

describe("buildReasonText", () => {
  it("weak_weighted: 약점 슬롯 + score 기반 multiplier 포함", () => {
    const d = makeDecision({
      source: "weak_weighted",
      context: {
        accuracyBeforePick: 0.7,
        adaptiveMode: "normal",
        weakSlotRatio: 0.6,
        queueState: [],
        previousNotes: ["treble:B4"],
        keySignature: "G major (F#)",
        sublevelPoolSize: 8,
        keySignatureNotesInPool: 1,
      },
      candidates: [
        {
          noteId: "treble:F#4",
          baseWeight: 1.9,
          isKeySignatureNote: true,
          keySignatureMultiplier: 1.2,
          accuracyScore: 0.5,
          responseTimeScore: 0.4,
          combinedWeakScore: 0.72,
          weakMultiplier: 2.44,
          masteryFlag: "normal",
          masteryMultiplier: 1.0,
          streakMastered: false,
          streakMultiplier: 1.0,
          softAvoidMultiplier: 1.0,
          finalWeight: 2.93,
          pickProbability: 0.45,
        },
      ],
    });

    const text = buildReasonText(d);
    expect(text).toContain("약점 슬롯(60%)");
    expect(text).toContain("F#4");
    expect(text).toContain("combinedScore 0.72");
    expect(text).toContain("×2.44");
    expect(text).toContain("B4");
    expect(text).toContain("graduated=normal");
    expect(text).toContain("adaptive=normal");
  });

  it("general: 일반 슬롯 + weak_scores 없음 표기", () => {
    const d = makeDecision({
      source: "general",
      pickedNote: {
        key: "C",
        octave: 4,
        clef: "treble",
        noteId: "treble:C4",
      },
      context: {
        accuracyBeforePick: 0.7,
        adaptiveMode: "normal",
        weakSlotRatio: 0.6,
        queueState: [],
        previousNotes: ["treble:B4"],
        keySignature: "G major (F#)",
        sublevelPoolSize: 8,
        keySignatureNotesInPool: 1,
      },
      candidates: [
        {
          noteId: "treble:C4",
          baseWeight: 1.0,
          isKeySignatureNote: false,
          keySignatureMultiplier: 0.8,
          accuracyScore: null,
          responseTimeScore: null,
          combinedWeakScore: null,
          weakMultiplier: 1.0,
          masteryFlag: "normal",
          masteryMultiplier: 1.0,
          streakMastered: false,
          streakMultiplier: 1.0,
          softAvoidMultiplier: 1.0,
          finalWeight: 0.8,
          pickProbability: 0.15,
        },
      ],
    });

    const text = buildReasonText(d);
    expect(text).toContain("일반 슬롯(40%)");
    expect(text).toContain("C4");
    expect(text).toContain("weak_scores 없음");
    expect(text).toContain("graduated=normal");
  });

  it("n_plus_2_recovery: 큐 회수 메시지", () => {
    const d = makeDecision({
      source: "n_plus_2_recovery",
      candidates: [], // 비랜덤 경로
      context: {
        accuracyBeforePick: 0.7,
        adaptiveMode: "boost_weak",
        weakSlotRatio: 0.8,
        queueState: ["treble:F#4"],
        previousNotes: ["treble:B4"],
        keySignature: "G major (F#)",
        sublevelPoolSize: 8,
        keySignatureNotesInPool: 1,
      },
    });

    const text = buildReasonText(d);
    expect(text).toContain("N+2 회복 큐");
    expect(text).toContain("F#4");
    expect(text).toContain("adaptive=boost_weak");
  });

  it("forced_immediate: 강제 출제 메시지", () => {
    const d = makeDecision({
      source: "forced_immediate",
      candidates: [],
      context: {
        accuracyBeforePick: 0.0,
        adaptiveMode: "warmup",
        weakSlotRatio: 0.6,
        queueState: [],
        previousNotes: [],
        keySignature: "C major (none)",
        sublevelPoolSize: 5,
        keySignatureNotesInPool: 0,
      },
    });

    const text = buildReasonText(d);
    expect(text).toContain("즉시 강제 출제");
    expect(text).toContain("F#4");
    expect(text).toContain("adaptive=warmup");
  });

  it("softAvoid 매치 시 '직전 음과 같음' 표기 + multiplier 노출", () => {
    const d = makeDecision({
      source: "weak_weighted",
      pickedNote: {
        key: "F",
        octave: 4,
        clef: "treble",
        accidental: "#",
        noteId: "treble:F#4",
      },
      context: {
        accuracyBeforePick: 0.7,
        adaptiveMode: "normal",
        weakSlotRatio: 0.6,
        queueState: [],
        previousNotes: ["treble:F#4"], // 직전 음이 같은 F#
        keySignature: "G major (F#)",
        sublevelPoolSize: 8,
        keySignatureNotesInPool: 1,
      },
      candidates: [
        {
          noteId: "treble:F#4",
          baseWeight: 1.9,
          isKeySignatureNote: true,
          keySignatureMultiplier: 1.2,
          accuracyScore: 0.5,
          responseTimeScore: 0.4,
          combinedWeakScore: 0.72,
          weakMultiplier: 2.44,
          masteryFlag: "normal",
          masteryMultiplier: 1.0,
          streakMastered: false,
          streakMultiplier: 1.0,
          softAvoidMultiplier: 0.2, // 직전 매치
          finalWeight: 0.58,
          pickProbability: 0.05,
        },
      ],
    });

    const text = buildReasonText(d);
    expect(text).toContain("같음 (×0.2)");
  });

  it("previousNotes 비어있으면 '없음' 표기", () => {
    const d = makeDecision({
      source: "general",
      context: {
        accuracyBeforePick: 0,
        adaptiveMode: "warmup",
        weakSlotRatio: 0.6,
        queueState: [],
        previousNotes: [],
        keySignature: "C major (none)",
        sublevelPoolSize: 5,
        keySignatureNotesInPool: 0,
      },
      candidates: [
        {
          noteId: "treble:F#4",
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
          pickProbability: 0.2,
        },
      ],
    });

    const text = buildReasonText(d);
    expect(text).toContain("직전 음 없음");
  });
});
