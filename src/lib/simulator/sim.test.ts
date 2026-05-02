import { describe, it, expect } from "vitest";
import { simulateGame, runMany } from "./game";

/**
 * §0.1 Simulator 검증 (1만 게임 fuzz).
 *
 * 검증 invariant:
 *   - totalConsecutiveViolations === 0 (어떤 시나리오에서도)
 *
 * 정량 측정:
 *   - 1턴 지연 fallback 비율 (사용자 정책 ~5% 허용 — 실측 확인용)
 *   - retry 등장 간격 분포 (N+2 우세 여부)
 *
 * Lv1~4 단일 clef만 — Lv5+ keySig는 추후 simulator 확장 시 추가.
 */

describe("§0.1 Simulator — single game smoke", () => {
  it("Lv1 sub1 all-correct → success, violation 0", () => {
    const r = simulateGame({
      level: 1,
      sublevel: 1,
      scenario: "all-correct",
      seed: 42,
    });
    expect(r.endReason).toBe("success");
    expect(r.consecutiveViolations).toBe(0);
    expect(r.correctCount).toBe(33);
    expect(r.missCount).toBe(0);
  });

  it("Lv2 sub1 all-wrong → gameover within 5 turns", () => {
    const r = simulateGame({
      level: 2,
      sublevel: 1,
      scenario: "all-wrong",
      seed: 7,
    });
    expect(r.endReason).toBe("gameover");
    expect(r.missCount).toBeLessThanOrEqual(5);
    expect(r.consecutiveViolations).toBe(0);
  });

  it("Lv3 sub2 random → 안전 종료", () => {
    const r = simulateGame({
      level: 3,
      sublevel: 2,
      scenario: "random",
      correctRate: 0.7,
      seed: 99,
    });
    expect(r.endReason).not.toBe("max-turns");
    expect(r.consecutiveViolations).toBe(0);
  });
});

describe("§0.1 Simulator — 1만 게임 fuzz invariant", () => {
  // Lv1~4 × sub1~3 × random 다양한 정답률.
  // 각 1000 games × seed 가변 → 합 ~1만 게임 분량.

  it("Lv1 sub1 random 70% × 1000 games — violation 0", () => {
    const { stats, firstViolations } = runMany(
      { level: 1, sublevel: 1, scenario: "random", correctRate: 0.7 },
      1000,
      1,
    );
    if (stats.totalConsecutiveViolations > 0) {
      const sample = firstViolations[0];
      const v = sample.events.find((e) => e.consecutiveViolation);
      throw new Error(
        `${stats.totalConsecutiveViolations} violations across ${stats.gameCount} games. First: seed=${sample.config.seed} turn=${v?.turn}`,
      );
    }
    expect(stats.totalConsecutiveViolations).toBe(0);
    expect(stats.gameCount).toBe(1000);
  });

  it("Lv2 sub2 random 60% × 1000 games — violation 0", () => {
    const { stats } = runMany(
      { level: 2, sublevel: 2, scenario: "random", correctRate: 0.6 },
      1000,
      10001,
    );
    expect(stats.totalConsecutiveViolations).toBe(0);
  });

  it("Lv3 sub3 random 80% × 1000 games — violation 0", () => {
    const { stats } = runMany(
      { level: 3, sublevel: 3, scenario: "random", correctRate: 0.8 },
      1000,
      20001,
    );
    expect(stats.totalConsecutiveViolations).toBe(0);
  });

  it("Lv4 sub2 random 50% × 1000 games — violation 0 (가장 retry 많은 시나리오)", () => {
    const { stats } = runMany(
      { level: 4, sublevel: 2, scenario: "random", correctRate: 0.5 },
      1000,
      30001,
    );
    expect(stats.totalConsecutiveViolations).toBe(0);
  });

  it("Lv1 sub1 mastery-bias × 500 games — violation 0", () => {
    // 특정 음표 (treble:E4) 항상 오답
    const biased = new Set(["treble:E4"]);
    const { stats } = runMany(
      {
        level: 1,
        sublevel: 1,
        scenario: "mastery-bias",
        correctRate: 0.7,
        biasedAgainst: biased,
      },
      500,
      40001,
    );
    expect(stats.totalConsecutiveViolations).toBe(0);
  });
});

describe("§0.1 Simulator — 정량 통계 보고서", () => {
  // 이 테스트는 항상 통과 (assertion 없이 console.log로 보고서 출력).
  // 정확한 1턴 지연 fallback 비율과 retry 간격 분포를 사용자가 확인할 수 있게 한다.

  it("Lv1~4 × random 70% × 500 games — 통계 보고서 출력", () => {
    const levels = [1, 2, 3, 4] as const;
    const subs = [1, 2, 3] as const;
    const lines: string[] = [];
    let grandTotalTurns = 0;
    let grandTotalViolations = 0;
    let grandTotalDelayed = 0;

    for (const level of levels) {
      for (const sub of subs) {
        const { stats } = runMany(
          { level, sublevel: sub, scenario: "random", correctRate: 0.7 },
          500,
          level * 100000 + sub * 1000,
        );
        grandTotalTurns += stats.totalTurns;
        grandTotalViolations += stats.totalConsecutiveViolations;
        grandTotalDelayed += stats.totalDelayedRetryFallbacks;
        lines.push(
          `Lv${level} sub${sub}: turns=${stats.totalTurns}, violations=${stats.totalConsecutiveViolations}, retries=${stats.totalRetryAppearances}, delayedFallback%=${(stats.delayedFallbackRate * 100).toFixed(2)}, success=${stats.endReasons.success}/${stats.gameCount}`,
        );
      }
    }
    const overallDelayRate = grandTotalTurns > 0 ? grandTotalDelayed / grandTotalTurns : 0;
    // eslint-disable-next-line no-console
    console.log("\n=== §0.1 Simulator 보고서 (Lv1~4 × sub1~3, random 70%, 500g/each) ===");
    for (const l of lines) console.log("  " + l);
    console.log(
      `  TOTAL: turns=${grandTotalTurns}, violations=${grandTotalViolations}, delayedFallback%=${(overallDelayRate * 100).toFixed(2)}`,
    );

    expect(grandTotalViolations).toBe(0);
  });

  it("retry 간격 분포 — N+2 우세 확인 (random 70% × 1000 games)", () => {
    const { stats } = runMany(
      { level: 3, sublevel: 2, scenario: "random", correctRate: 0.7 },
      1000,
      777,
    );
    const dist = stats.retryIntervalDist;
    const sortedKeys = Object.keys(dist).sort((a, b) => {
      const an = parseInt(a.replace("N+", ""), 10);
      const bn = parseInt(b.replace("N+", ""), 10);
      return an - bn;
    });
    // eslint-disable-next-line no-console
    console.log("\n=== retry 간격 분포 (Lv3 sub2 random 70%, 1000g) ===");
    for (const k of sortedKeys) {
      console.log(`  ${k}: ${dist[k]}`);
    }
    expect(stats.totalConsecutiveViolations).toBe(0);
  });
});

describe("§4 — markMissed due 보존 (timeout heavy 회귀 검증)", () => {
  // §4 fix: markMissed가 reschedule된 due를 덮어쓰지 않음.
  // 회귀 시나리오: 정답률 30% (timeout 70%) — markMissed가 빈번히 호출되는 환경.

  it("Lv1 sub1 random 30% × 1000 games — violation 0, queue 영구 잔존 없음", () => {
    const { stats } = runMany(
      { level: 1, sublevel: 1, scenario: "random", correctRate: 0.3 },
      1000,
      4001,
    );
    expect(stats.totalConsecutiveViolations).toBe(0);
    expect(stats.gameCount).toBe(1000);
  });

  it("Lv2 sub2 random 30% × 1000 games — violation 0", () => {
    const { stats } = runMany(
      { level: 2, sublevel: 2, scenario: "random", correctRate: 0.3 },
      1000,
      4002,
    );
    expect(stats.totalConsecutiveViolations).toBe(0);
  });

  it("Lv3 sub3 random 30% × 1000 games — violation 0 (Sub3=3초 타이트 환경)", () => {
    const { stats } = runMany(
      { level: 3, sublevel: 3, scenario: "random", correctRate: 0.3 },
      1000,
      4003,
    );
    expect(stats.totalConsecutiveViolations).toBe(0);
  });

  it("Lv1 sub1 게임오버율 통계 (random 30% × 1000g) — §4 fix 후 정상 분포", () => {
    const { stats } = runMany(
      { level: 1, sublevel: 1, scenario: "random", correctRate: 0.3 },
      1000,
      4004,
    );
    // eslint-disable-next-line no-console
    console.log(
      `\n=== §4 Lv1 sub1 random 30% × 1000g endReasons ===\n  success: ${stats.endReasons.success}, gameover: ${stats.endReasons.gameover}, max-turns: ${stats.endReasons["max-turns"]}\n  totalCorrect: ${stats.totalCorrect}, totalMiss: ${stats.totalMiss}`,
    );
    // 30% 정답률이면 lives 5에서 대부분 게임오버 예상되지만 max-turns로 빠지면 § 4 버그 회귀 의심.
    expect(stats.endReasons["max-turns"]).toBe(0);
  });
});

describe("§4 — composeFinalRetryBatch dedup 회귀 (옵션 5+7 fix)", () => {
  it("Lv1 sub1 random 70% × 500 games — final-retry phase violation 0", () => {
    let totalViolations = 0;
    let finalRetryViolations = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const r = simulateGame({
        level: 1,
        sublevel: 1,
        scenario: "random",
        correctRate: 0.7,
        seed,
      });
      totalViolations += r.consecutiveViolations;
      // final-retry phase 위반 카운트
      for (const e of r.events) {
        if (e.consecutiveViolation && e.phase === "final-retry") {
          finalRetryViolations += 1;
        }
      }
    }
    expect(totalViolations).toBe(0);
    expect(finalRetryViolations).toBe(0);
  });

  it("Lv2 sub2 random 60% × 300 games — final-retry phase violation 0", () => {
    let finalRetryViolations = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = simulateGame({
        level: 2,
        sublevel: 2,
        scenario: "random",
        correctRate: 0.6,
        seed,
      });
      for (const e of r.events) {
        if (e.consecutiveViolation && e.phase === "final-retry") {
          finalRetryViolations += 1;
        }
      }
    }
    expect(finalRetryViolations).toBe(0);
  });

  it("Lv3 sub3 random 80% × 300 games — final-retry phase violation 0", () => {
    let finalRetryViolations = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = simulateGame({
        level: 3,
        sublevel: 3,
        scenario: "random",
        correctRate: 0.8,
        seed,
      });
      for (const e of r.events) {
        if (e.consecutiveViolation && e.phase === "final-retry") {
          finalRetryViolations += 1;
        }
      }
    }
    expect(finalRetryViolations).toBe(0);
  });
});
