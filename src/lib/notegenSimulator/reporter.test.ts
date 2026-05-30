/**
 * 5-D 단위 테스트: formatScenarioReport + writeScenarioJson.
 *
 * mock scenario·simResult·evaluation 으로 출력 구조·슬라이싱·JSON 직렬화 검증.
 * 파일 I/O 테스트는 OS tmpdir 사용 + 종료 후 정리.
 */

import { describe, it, expect, afterAll } from "vitest";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PickDecision, PickCandidate } from "@/lib/pickDecision";
import { formatScenarioReport, writeScenarioJson } from "./reporter";
import type { Scenario } from "./scenarios/types";
import type { SimEvent, SimResult } from "./core/simSession";
import type { ScenarioEvaluation } from "./metrics";

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

function mockDecision(turn: number, source: PickDecision["source"], noteId: string): PickDecision {
  const cand = mockCandidate({ noteId, pickProbability: 0.07 });
  return {
    turn,
    pickedNote: { key: "C", octave: 4, clef: "treble", noteId },
    source,
    context: {
      accuracyBeforePick: 0.5,
      adaptiveMode: "normal",
      weakSlotRatio: 0.6,
      queueState: [],
      previousNotes: [],
      keySignature: "C major (none)",
      sublevelPoolSize: 14,
      keySignatureNotesInPool: 0,
    },
    candidates: [cand],
    randomValue: null,
    cumulativeProbabilityHit: noteId,
    reasonText: "mock",
    timestamp: 0,
  };
}

function mockEvent(turn: number, attemptIndex: number, shownId: string, correct = true): SimEvent {
  return {
    turn,
    attemptIndex,
    batchIndex: 0,
    batchSize: 1,
    shown: { name: "도", key: "C", y: 0, octave: "4" },
    shownId,
    isRetry: false,
    correct,
    responseTimeSec: 0.8,
    accuracyBeforePick: 0.5,
    adaptiveModeAtPick: "normal",
    weakSlotRatioAtPick: 0.6,
    queueSizeAfter: 0,
  };
}

function mockScenario(): Scenario {
  return {
    name: "TEST",
    description: "테스트 시나리오 — 단위 테스트용",
    simConfig: {
      level: 1,
      sublevel: 1,
      userModel: { kind: "perfect" },
      isPremium: true,
      maxTurns: 30,
      seed: 42,
    },
    expectedMetrics: [],
  };
}

function mockEvaluation(over: Partial<ScenarioEvaluation> = {}): ScenarioEvaluation {
  return {
    scenarioName: "TEST",
    metrics: [
      {
        id: "softAvoidViolationRate",
        label: "soft 회피 위반 비율",
        value: 0.023,
        expected: "< 0.05",
        passed: true,
      },
      {
        id: "n2RecoveryCount",
        label: "N+2 회복 건수",
        value: 0,
        expected: "= 0",
        passed: true,
      },
    ],
    suspiciousCases: [],
    allPassed: true,
    noteDistribution: { "treble:C4": 5, "treble:D4": 3 },
    adaptiveModeHistogram: { free: 0, warmup: 5, normal: 25, boost_weak: 0, reduce_weak: 0 },
    ...over,
  };
}

function mockSimResult(events: SimEvent[], decisions: PickDecision[]): SimResult {
  return {
    config: mockScenario().simConfig,
    endReason: "all-stages-complete",
    totalAttempts: events.length,
    correctCount: events.filter((e) => e.correct).length,
    missCount: events.filter((e) => !e.correct).length,
    retryAppearances: 0,
    finalQueueSize: 0,
    events,
    decisions,
    adaptiveModeHistogram: { free: 0, warmup: 5, normal: 25, boost_weak: 0, reduce_weak: 0 },
    keySig: { key: "C", abcKey: "C" },
  };
}

// ─────────────────────────────────────────────────────────────
// formatScenarioReport
// ─────────────────────────────────────────────────────────────

describe("formatScenarioReport", () => {
  it("필수 섹션 모두 포함", () => {
    const events = [mockEvent(0, 0, "treble:C4"), mockEvent(1, 1, "treble:D4")];
    const decisions = [mockDecision(0, "general", "treble:C4"), mockDecision(1, "general", "treble:D4")];
    const out = formatScenarioReport(
      mockScenario(),
      mockSimResult(events, decisions),
      mockEvaluation(),
    );
    expect(out).toContain("시나리오 TEST");
    expect(out).toContain("[메트릭]");
    expect(out).toContain("[adaptive 모드 분포]");
    expect(out).toContain("[음별 출제 분포 — top 2 of 2]");
    expect(out).toContain("[의심 케이스 0건]");
    expect(out).toContain("✓ ALL PASSED");
  });

  it("metrics row에 ✓/✗/⚠️ 심볼 표시", () => {
    const evaluation = mockEvaluation({
      metrics: [
        { id: "ok", label: "통과", value: 0, expected: "< 1", passed: true },
        { id: "fail", label: "실패", value: 10, expected: "< 1", passed: false },
        // approx 경계 근처 fail (target=0.6 tol=0.1, value=0.701 → diff 0.101 ≤ 0.1+epsilon)
        { id: "warn", label: "경계", value: 0.701, expected: "0.6 ± 0.1", passed: false },
      ],
      allPassed: false,
    });
    const out = formatScenarioReport(
      mockScenario(),
      mockSimResult([], []),
      evaluation,
    );
    expect(out).toContain("✓"); // ok row
    expect(out).toContain("✗"); // fail row (10 > 1+epsilon, far fail)
    expect(out).toContain("⚠️"); // warn row (boundary)
    expect(out).toContain("✗ FAILURES");
  });

  it("음별 분포 — ASCII bar 길이 비율 기반 (최대 20)", () => {
    const events = [
      ...Array.from({ length: 100 }, (_, i) => mockEvent(i, i, "treble:C4")),
      ...Array.from({ length: 25 }, (_, i) => mockEvent(100 + i, 100 + i, "treble:D4")),
    ];
    const evaluation = mockEvaluation({
      noteDistribution: { "treble:C4": 100, "treble:D4": 25 },
    });
    const out = formatScenarioReport(
      mockScenario(),
      mockSimResult(events, []),
      evaluation,
    );
    // C4 행: 100/100 → 20 bar
    // D4 행: 25/100 → 5 bar
    const c4Bar = "█".repeat(20);
    const d4Bar = "█".repeat(5);
    expect(out).toContain(c4Bar);
    expect(out).toContain(d4Bar);
    expect(out).not.toContain("█".repeat(21)); // 21 이상 X
  });

  it("디테일 표 — 처음·마지막 20턴 (events > 40)", () => {
    const events = Array.from({ length: 60 }, (_, i) =>
      mockEvent(i, i, `treble:note${i}`),
    );
    const out = formatScenarioReport(
      mockScenario(),
      mockSimResult(events, []),
      mockEvaluation({ noteDistribution: {} }),
    );
    expect(out).toContain("[처음 20턴]");
    expect(out).toContain("[마지막 20턴]");
    expect(out).toContain("treble:note0");
    expect(out).toContain("treble:note19");
    expect(out).toContain("treble:note40");
    expect(out).toContain("treble:note59");
    // 중간 30번대는 표시 안 됨.
    expect(out).not.toContain("treble:note35");
    expect(out).toContain("⋮");
  });

  it("full 옵션 — 전체 turn 출력", () => {
    const events = Array.from({ length: 60 }, (_, i) =>
      mockEvent(i, i, `treble:note${i}`),
    );
    const out = formatScenarioReport(
      mockScenario(),
      mockSimResult(events, []),
      mockEvaluation({ noteDistribution: {} }),
      { full: true },
    );
    expect(out).toContain("[전체 60턴]");
    expect(out).toContain("treble:note35"); // 중간 값도 출력
    expect(out).not.toContain("[처음 20턴]");
  });

  it("디테일 표 — events ≤ 40이면 전체 표시", () => {
    const events = Array.from({ length: 20 }, (_, i) =>
      mockEvent(i, i, `treble:note${i}`),
    );
    const out = formatScenarioReport(
      mockScenario(),
      mockSimResult(events, []),
      mockEvaluation({ noteDistribution: {} }),
    );
    expect(out).toContain("[전체 20턴]");
    expect(out).not.toContain("⋮");
  });

  it("의심 케이스 표시 (turn + type + description)", () => {
    const evaluation = mockEvaluation({
      suspiciousCases: [
        { turn: 42, type: "soft-avoid-low-mult-picked", description: "softAvoidMult=0.20 인데 treble:C4 선택" },
      ],
    });
    const out = formatScenarioReport(
      mockScenario(),
      mockSimResult([], []),
      evaluation,
    );
    expect(out).toContain("턴 42");
    expect(out).toContain("soft-avoid-low-mult-picked");
    expect(out).toContain("softAvoidMult=0.20");
  });
});

// ─────────────────────────────────────────────────────────────
// writeScenarioJson
// ─────────────────────────────────────────────────────────────

const TMP_DIR = join(tmpdir(), `notegen-test-${process.pid}-${Date.now()}`);
afterAll(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("writeScenarioJson", () => {
  it("파일 생성 + JSON 유효 + payload 구조", () => {
    const events = [mockEvent(0, 0, "treble:C4")];
    const decisions = [mockDecision(0, "general", "treble:C4")];
    const path = writeScenarioJson(
      mockScenario(),
      mockSimResult(events, decisions),
      mockEvaluation(),
      TMP_DIR,
    );
    expect(existsSync(path)).toBe(true);
    const raw = readFileSync(path, "utf8");
    const obj = JSON.parse(raw);
    expect(obj.scenario.name).toBe("TEST");
    expect(obj.simResult.totalAttempts).toBe(1);
    expect(obj.simResult.events.length).toBe(1);
    expect(obj.simResult.decisions.length).toBe(1);
    expect(obj.evaluation.allPassed).toBe(true);
  });

  it("weak_on userModel — Set 직렬화 (배열로 변환)", () => {
    const scenario: Scenario = {
      ...mockScenario(),
      simConfig: {
        ...mockScenario().simConfig,
        userModel: {
          kind: "weak_on",
          weakIds: new Set(["treble:F#4", "treble:F#5"]),
        },
      },
    };
    const path = writeScenarioJson(scenario, mockSimResult([], []), mockEvaluation(), TMP_DIR);
    const obj = JSON.parse(readFileSync(path, "utf8"));
    expect(obj.scenario.simConfig.userModel.kind).toBe("weak_on");
    expect(obj.scenario.simConfig.userModel.weakIds).toEqual(["treble:F#4", "treble:F#5"]);
  });

  it("디렉토리 자동 생성 (recursive)", () => {
    const nested = join(TMP_DIR, "deep", "nested");
    const path = writeScenarioJson(
      mockScenario(),
      mockSimResult([], []),
      mockEvaluation(),
      nested,
    );
    expect(existsSync(nested)).toBe(true);
    expect(statSync(path).isFile()).toBe(true);
  });
});
