/**
 * 5-B: 시나리오 5종 re-export + 배열.
 *
 * 5-E (notegen.test.ts)에서 ALL_SCENARIOS를 순회하며 검증.
 */

import { scenarioA } from "./scenarioA";
import { scenarioB } from "./scenarioB";
import { scenarioC } from "./scenarioC";
import { scenarioD } from "./scenarioD";
import { scenarioE } from "./scenarioE";
import type { Scenario } from "./types";

export { scenarioA, scenarioB, scenarioC, scenarioD, scenarioE };
export type { Scenario, ScenarioExpectedMetric, ScenarioPredicate } from "./types";

export const ALL_SCENARIOS: readonly Scenario[] = [
  scenarioA,
  scenarioB,
  scenarioC,
  scenarioD,
  scenarioE,
];
