/**
 * 시나리오 B: Lv 5-2 weak_on=F#4·F#5 500턴 + weakScores 시드.
 *
 * 검증 포인트:
 *   - G major (sharps=["F"]) → 영향 음명 = F#
 *   - weak_weighted 슬롯 F# 비중 ↑ (시드 combinedScore=0.8로 baseWeight=2.6)
 *   - F# 오답 → N+2 회복 큐 적중률 ↑
 *
 * keySig 고정 (forcedKeySig=G major) — 재현성·검증 단순화.
 *
 * stage 사이클: Lv5-2 = 54 notes / cycle. 500턴 ≈ 9.3 cycle (with 재시도 포함).
 */

import { Scenario } from "./types";
import { seedWeakScores } from "../core/seedWeakScores";

export const scenarioB: Scenario = {
  name: "B",
  description: "Lv 5-2 weak_on=F#4·F#5 + weakScores 시드 — 조표·약점 가중·N+2 회복 검증",
  simConfig: {
    level: 5,
    sublevel: 2,
    userModel: {
      kind: "weak_on",
      weakIds: new Set(["treble:F#4", "treble:F#5"]),
      weakCorrectRate: 0.3,
      baseCorrectRate: 0.95,
      responseTimeSec: 1.2,
    },
    isPremium: true,
    weakScoreMap: seedWeakScores([
      { noteId: "treble:F#4", combinedScore: 0.8 },
      { noteId: "treble:F#5", combinedScore: 0.8 },
    ]),
    maxTurns: 500,
    seed: 42,
    forcedKeySig: { key: "G", abcKey: "G", sharps: ["F"] },
    cyclic: true,
  },
  expectedMetrics: [
    {
      id: "weakSlotPickRateOnWeakIds",
      label: "weak_weighted 슬롯에서 F#4·F#5 출제 비중",
      predicate: { kind: "gt", min: 0.20 },
    },
    {
      id: "n2RecoveryHitRate",
      label: "N+2 회복 출제 비율 (오답 → 재출제)",
      predicate: { kind: "gt", min: 0.10 },
    },
    {
      id: "accidentalRatioMatchesTarget",
      label: "조표 영향 음 비율이 batchSize별 목표(0.4·0.6·0.7) 평균 부합",
      predicate: { kind: "approx", target: 0.55, tolerance: 0.10 },
    },
    {
      id: "queueMaxViolations",
      label: "N+2 큐 상한 3 위반 횟수",
      predicate: { kind: "eq", value: 0 },
    },
  ],
};
