/**
 * 시나리오 C: Lv 3-2 random50 500턴.
 *
 * 검증 포인트:
 *   - accuracy < 0.55 → adaptive reduce_weak 발동
 *   - 잦은 오답 → N+2 큐 적중률 ↑
 *   - 큐 상한 3 절대 위반 X (markMissed 시 skip 검증)
 *
 * stage 사이클: Lv3-2 = 36 notes / cycle.
 * random50은 음표별 평균 2시도 → 500 attempts ≈ 7 cycle.
 */

import { Scenario } from "./types";

export const scenarioC: Scenario = {
  name: "C",
  description: "Lv 3-2 random50 500턴 — reduce_weak 적응 + N+2 적중·큐 상한 검증",
  simConfig: {
    level: 3,
    sublevel: 2,
    userModel: { kind: "random", correctRate: 0.5, responseTimeSec: 2.0 },
    isPremium: true,
    maxTurns: 500,
    seed: 42,
    cyclic: true,
  },
  expectedMetrics: [
    {
      id: "queueMaxViolations",
      label: "N+2 큐 상한 3 위반 횟수",
      predicate: { kind: "eq", value: 0 },
    },
    {
      id: "adaptiveModeTurns.reduce_weak",
      label: "reduce_weak 모드 누적 턴",
      predicate: { kind: "gt", min: 50 },
    },
    {
      id: "n2RecoveryHitRate",
      label: "N+2 회복 출제 비율 (random50 → 오답 많음)",
      predicate: { kind: "gt", min: 0.10 },
    },
  ],
};
