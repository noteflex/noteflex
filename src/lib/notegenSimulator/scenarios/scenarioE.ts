/**
 * 시나리오 E: Lv 5-2 Free random60 500턴.
 *
 * 검증 포인트 (Premium gating):
 *   - isPremium=false → adaptive ratio=0 → weak_weighted 슬롯 0건
 *   - weakScoreMap을 시드하지만 'free' 모드라 weak_weighted source 미발생
 *   - 조표 6:4 비율은 Free·Premium 공통 — 그대로 유지
 *
 * stage 사이클: Lv5-2 = 54 notes / cycle. 500턴 ≈ 9 cycle.
 */

import { Scenario } from "./types";
import { seedWeakScores } from "../core/seedWeakScores";

export const scenarioE: Scenario = {
  name: "E",
  description: "Lv 5-2 Free random60 500턴 — Premium gating 검증 (weak_weighted 0건, 조표 유지)",
  simConfig: {
    level: 5,
    sublevel: 2,
    userModel: { kind: "random", correctRate: 0.6, responseTimeSec: 1.5 },
    isPremium: false,
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
      id: "weakWeightedDecisionCount",
      label: "weak_weighted source 결정 건수 (Free → 0)",
      predicate: { kind: "eq", value: 0 },
    },
    {
      id: "adaptiveModeTurns.free",
      label: "free 모드 누적 턴 (전체 시도)",
      predicate: { kind: "gt", min: 400 },
    },
    {
      id: "accidentalRatioMatchesTarget",
      label: "조표 영향 음 비율 (Free에서도 batchSize별 목표 유지)",
      predicate: { kind: "approx", target: 0.55, tolerance: 0.10 },
    },
  ],
};
