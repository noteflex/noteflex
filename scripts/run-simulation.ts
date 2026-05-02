/**
 * §4 Step B (2026-05-02) — 시뮬레이션 fuzz runner.
 *
 * 사용법:
 *   npm run sim:run                 # 기본 매트릭스 (1만 게임)
 *   npm run sim:run -- --games 5000 # 게임 수 지정
 *
 * 출력:
 *   tmp/sim-logs/{YYYYMMDD-HHmmss}.jsonl
 *
 * 동작:
 *  - Lv1~4 × Sub1~3 × correctRate {0.3, 0.5, 0.7, 0.9} 매트릭스.
 *  - 각 조합당 (totalGames / |매트릭스|) 게임.
 *  - FileSimLogger로 JSONL append.
 */
import "./_polyfills";
import { simulateGame } from "@/lib/simulator/game";
import { FileSimLogger } from "@/lib/simulator/simLogger";
import type { Sublevel } from "@/lib/levelSystem";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TMP_DIR = resolve(process.cwd(), "tmp/sim-logs");

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function timestampSuffix(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function parseArgs(): { games: number; outPath: string } {
  const args = process.argv.slice(2);
  let games = 10000;
  let outPath = resolve(TMP_DIR, `${timestampSuffix()}.jsonl`);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--games" && args[i + 1]) {
      games = parseInt(args[++i], 10);
    } else if (args[i] === "--out" && args[i + 1]) {
      outPath = resolve(args[++i]);
    }
  }
  return { games, outPath };
}

function main(): void {
  const { games, outPath } = parseArgs();

  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

  const levels = [1, 2, 3, 4] as const;
  const subs = [1, 2, 3] as const satisfies readonly Sublevel[];
  const correctRates = [0.3, 0.5, 0.7, 0.9];
  const matrixSize = levels.length * subs.length * correctRates.length;
  const perCell = Math.max(1, Math.floor(games / matrixSize));
  const totalGames = perCell * matrixSize;

  console.log(`[sim:run] start: ${totalGames} games (matrix ${matrixSize}, per-cell ${perCell})`);
  console.log(`[sim:run] output: ${outPath}`);

  const logger = new FileSimLogger(outPath, 500);
  let session = 0;
  let seed = 1;
  const t0 = Date.now();

  for (const level of levels) {
    for (const sub of subs) {
      for (const rate of correctRates) {
        for (let i = 0; i < perCell; i++) {
          simulateGame({
            level,
            sublevel: sub as Sublevel,
            scenario: "random",
            correctRate: rate,
            seed: seed++,
            session: session++,
            logger,
          });
        }
      }
    }
  }

  logger.flush();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[sim:run] done: ${session} games in ${elapsed}s → ${outPath}`);
}

main();
