/**
 * 시나리오 D: Lv 4-1 perfect 500턴 (응답 0.5s 고정).
 *
 * 검증 포인트:
 *   - perfect → 5턴 warmup 이후 adaptive boost_weak 모드 진입 (>100턴 누적)
 *   - resp=0.5s + 5연속 정답 → streak 마스터 multiplier 0.3 발동
 *   - 음표별로 5연속 같은 음표 정답이 통계적으로 발생 (500턴 ≈ 16 cycle × 30 notes)
 *
 * stage 사이클: Lv4-1 = 30 notes / cycle. 500턴 ≈ 16 cycle.
 */

import { Scenario } from "./types";

export const scenarioD: Scenario = {
  name: "D",
  description: "Lv 4-1 perfect 500턴 (resp=0.5s) — boost_weak + streak 마스터 발동 검증",
  simConfig: {
    level: 4,
    sublevel: 1,
    userModel: { kind: "perfect", responseTimeSec: 0.5 },
    isPremium: true,
    maxTurns: 500,
    seed: 42,
    cyclic: true,
  },
  expectedMetrics: [
    {
      id: "adaptiveModeTurns.boost_weak",
      label: "boost_weak 모드 누적 턴",
      predicate: { kind: "gt", min: 100 },
    },
    {
      id: "streakMasteredNoteCount",
      label: "streak 마스터 상태 도달한 음표 수 (≥1)",
      predicate: { kind: "gte", min: 1 },
    },
    {
      id: "softAvoidViolationRate",
      label: "soft 회피 위반 비율 (perfect → 큐 미사용 환경에서도 낮아야)",
      predicate: { kind: "lt", max: 0.05 },
    },
  ],
};
