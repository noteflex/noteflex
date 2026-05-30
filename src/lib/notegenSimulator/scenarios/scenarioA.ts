/**
 * 시나리오 A: Lv 1-1 perfect 1000턴.
 *
 * 검증 포인트:
 *   - soft 회피 multiplier로 직전 동일 음명 출제율이 낮은지
 *   - 오답 없으므로 N+2 회복 0건 — 큐 비어있음
 *   - 첫 5턴 warmup 이후 perfect → boost_weak 모드 진입
 *
 * stage 사이클: Lv1-1 = 30 notes / cycle. 1000턴 ≈ 33 cycle.
 */

import { Scenario } from "./types";

export const scenarioA: Scenario = {
  name: "A",
  description: "Lv 1-1 perfect 1000턴 — soft 회피 검증, 큐 미사용, warmup→boost 흐름",
  simConfig: {
    level: 1,
    sublevel: 1,
    userModel: { kind: "perfect", responseTimeSec: 0.8 },
    isPremium: true,
    maxTurns: 1000,
    seed: 42,
    cyclic: true,
  },
  expectedMetrics: [
    {
      id: "softAvoidViolationRate",
      label: "soft 회피 위반 비율 (직전 음명과 같은 음명 출제)",
      predicate: { kind: "lt", max: 0.05 },
    },
    {
      id: "n2RecoveryCount",
      label: "N+2 회복 출제 건수 (perfect → 0 기대)",
      predicate: { kind: "eq", value: 0 },
    },
    {
      id: "adaptiveModeTurns.boost_weak",
      label: "boost_weak 모드 누적 턴 (≥ warmup 종료 후 대부분)",
      predicate: { kind: "gt", min: 500 },
    },
  ],
};
