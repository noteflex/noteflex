/**
 * 5-A: notegenSimulator core re-exports.
 *
 * 4-F 출제 결정 검증용 React-free 시뮬레이터.
 * 시나리오·메트릭·리포터는 5-B/C/D에서 추가.
 */

export { runSimSession } from "./core/simSession";
export type { SimConfig, SimEvent, SimResult } from "./core/simSession";

export { SimUser } from "./core/simUser";
export type { SimUserModel, SimUserAnswer } from "./core/simUser";

export { SimSessionStreak } from "./core/simSessionStreak";
export { SimAdaptive } from "./core/simAdaptive";

export { seedWeakScores } from "./core/seedWeakScores";
export type { WeakScoreSeed } from "./core/seedWeakScores";

// 5-B: 시나리오 5종.
export {
  scenarioA, scenarioB, scenarioC, scenarioD, scenarioE,
  ALL_SCENARIOS,
} from "./scenarios";
export type { Scenario, ScenarioExpectedMetric, ScenarioPredicate } from "./scenarios";

// 5-C: 메트릭 + pass/fail + 의심 케이스.
export {
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
  evaluateScenario,
} from "./metrics";
export type {
  MetricResult, EvaluatedMetric, SuspiciousCase, ScenarioEvaluation,
} from "./metrics";
