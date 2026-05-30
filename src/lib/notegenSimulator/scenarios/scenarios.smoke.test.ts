/**
 * 5-B smoke test: 시나리오 5종이 짧게 돌려도 런타임 에러 없이 events·decisions를 산출하는지.
 *
 * 본 메트릭·pass-fail 판정은 5-C·5-E. 여기는 scenario simConfig가 runSimSession에
 * 전달 가능한지(타입+런타임)만 검증.
 */

import { describe, it, expect } from "vitest";
import { runSimSession } from "../core/simSession";
import { ALL_SCENARIOS } from "./index";

describe("5-B scenarios — smoke (maxTurns=30)", () => {
  for (const sc of ALL_SCENARIOS) {
    it(`${sc.name}: ${sc.description.split(" — ")[0]} runs`, () => {
      const result = runSimSession({ ...sc.simConfig, maxTurns: 30 });
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.totalAttempts).toBe(result.events.length);
      // 시드 음표를 사용하지 않는 시나리오는 decisions가 weak_weighted/general/n_plus_2_recovery 중 일부.
      // Free 시나리오 E라도 general source 결정이 있어야 함.
      expect(result.decisions.length).toBeGreaterThan(0);
      expect(["max-turns", "all-stages-complete", "empty-batch"]).toContain(result.endReason);
    });
  }
});
