/**
 * 5-E: notegen-sim 통합 — 시나리오 5종 실행 + evaluateScenario allPassed 검증.
 *
 * 실행:
 *   - npm run notegen          (5종 전부, 처음/마지막 20턴 디테일)
 *   - npm run notegen:full     (5종 전부, 전체 turn 디테일)
 *   - NOTEGEN_SCENARIO=B npm run notegen  (시나리오 B만)
 *
 * 출력: test-results/notegen-{scenario}-{timestamp}.json (gitignore됨)
 *
 * Vitest 콘솔로 printScenarioReport 결과 그대로 출력 — 사람이 보고 디버깅.
 */

import { describe, it, expect } from "vitest";
import { runSimSession } from "./core/simSession";
import { ALL_SCENARIOS } from "./scenarios";
import { evaluateScenario } from "./metrics";
import { printScenarioReport, writeScenarioJson } from "./reporter";

const requestedScenario = process.env.NOTEGEN_SCENARIO;
const full = process.env.NOTEGEN_FULL === "1";

const scenarios = requestedScenario
  ? ALL_SCENARIOS.filter((s) => s.name === requestedScenario.toUpperCase())
  : ALL_SCENARIOS;

if (requestedScenario && scenarios.length === 0) {
  // eslint-disable-next-line no-console
  console.warn(
    `[notegen] NOTEGEN_SCENARIO='${requestedScenario}' 매칭 시나리오 없음. ` +
      `사용 가능: ${ALL_SCENARIOS.map((s) => s.name).join(", ")}`,
  );
}

describe("5-E notegen-sim 통합 — 시나리오 5종 allPassed", () => {
  for (const scenario of scenarios) {
    it(`시나리오 ${scenario.name} — ${scenario.description}`, () => {
      const result = runSimSession(scenario.simConfig);
      const evaluation = evaluateScenario(scenario, result);
      printScenarioReport(scenario, result, evaluation, { full });
      const path = writeScenarioJson(scenario, result, evaluation);
      // eslint-disable-next-line no-console
      console.log(`[notegen] JSON saved: ${path}`);
      expect(evaluation.allPassed, `시나리오 ${scenario.name} 실패`).toBe(true);
    });
  }
});
