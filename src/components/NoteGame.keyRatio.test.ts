import { describe, it, expect } from "vitest";
import { generateKeyBatch } from "./NoteGame";

/**
 * §0.2 Lv5+ 조표 비율 + treble/bass 혼합 검증
 *
 * 목표 비율 (batchSize별):
 *   batchSize=1 → 자연:조표 = 7:3  (조표 30%)
 *   batchSize=3 → 자연:조표 = 6:4  (조표 40%)
 *   batchSize=5 → 자연:조표 = 4:6  (조표 60%)
 *   batchSize=7 → 자연:조표 = 3:7  (조표 70%)
 *
 * treble/bass:
 *   batchSize=1  → 50% 랜덤 (set 단위 coin flip)
 *   batchSize>1  → 50% 랜덤 + 한 batch 내 두 자리표 모두 등장 보장
 *
 * fuzz 횟수: 10,000 — 허용 편차 ±5% (통계적 안전 마진 충분)
 */

// G major (sharps: F) — 1♯, treble·bass 모두 풀에 F가 여러 옥타브 있음
const G_MAJOR = { key: "G", abcKey: "G", sharps: ["F"] };
// D major (sharps: F, C) — 2♯, 조표 음표 풀이 더 넓음
const D_MAJOR = { key: "D", abcKey: "D", sharps: ["F", "C"] };
// C major — 조표 없음
const C_MAJOR = { key: "C", abcKey: "C" };

const ITERS = 10_000;
const TOL   = 0.05; // ±5%

function countAccidentals(notes: ReturnType<typeof generateKeyBatch>["notes"]): number {
  return notes.filter(n => n.accidental !== undefined).length;
}

// ─────────────────────────────────────────────
// 조표 비율
// ─────────────────────────────────────────────

describe("§0.2 generateKeyBatch — 조표 비율 (batchSize별)", () => {
  it("batchSize=1: 조표 ~30% (허용 ±5%)", () => {
    let accCount = 0;
    for (let i = 0; i < ITERS; i++) {
      const { notes } = generateKeyBatch(5, 1, G_MAJOR, new Map());
      accCount += countAccidentals(notes);
    }
    const ratio = accCount / ITERS;
    expect(ratio).toBeGreaterThanOrEqual(0.25);
    expect(ratio).toBeLessThanOrEqual(0.35);
  });

  it("batchSize=3: 조표 ~40% (허용 ±5%)", () => {
    let accCount = 0;
    const totalNotes = ITERS * 3;
    for (let i = 0; i < ITERS; i++) {
      const { notes } = generateKeyBatch(5, 3, D_MAJOR, new Map());
      accCount += countAccidentals(notes);
    }
    const ratio = accCount / totalNotes;
    expect(ratio).toBeGreaterThanOrEqual(0.35);
    expect(ratio).toBeLessThanOrEqual(0.45);
  });

  it("batchSize=5: 조표 ~60% (허용 ±5%)", () => {
    let accCount = 0;
    const totalNotes = ITERS * 5;
    for (let i = 0; i < ITERS; i++) {
      const { notes } = generateKeyBatch(5, 5, D_MAJOR, new Map());
      accCount += countAccidentals(notes);
    }
    const ratio = accCount / totalNotes;
    expect(ratio).toBeGreaterThanOrEqual(0.55);
    expect(ratio).toBeLessThanOrEqual(0.65);
  });

  it("batchSize=7: 조표 ~70% (허용 ±5%)", () => {
    let accCount = 0;
    const totalNotes = ITERS * 7;
    for (let i = 0; i < ITERS; i++) {
      const { notes } = generateKeyBatch(5, 7, D_MAJOR, new Map());
      accCount += countAccidentals(notes);
    }
    const ratio = accCount / totalNotes;
    expect(ratio).toBeGreaterThanOrEqual(0.65);
    expect(ratio).toBeLessThanOrEqual(0.75);
  });

  it("C major (조표 없음): batchSize 무관 조표 0%", () => {
    for (const size of [1, 3, 5, 7] as const) {
      let accCount = 0;
      const total = 500 * size;
      for (let i = 0; i < 500; i++) {
        const { notes } = generateKeyBatch(5, size, C_MAJOR, new Map());
        accCount += countAccidentals(notes);
      }
      expect(accCount).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────
// treble / bass 비율
// ─────────────────────────────────────────────

describe("§0.2 generateKeyBatch — treble/bass 비율", () => {
  it("batchSize=1: treble ~50% (허용 ±5%, 10000 set)", () => {
    let trebleCount = 0;
    for (let i = 0; i < ITERS; i++) {
      const { notes } = generateKeyBatch(5, 1, G_MAJOR, new Map());
      if (notes[0].clef === "treble") trebleCount++;
    }
    const ratio = trebleCount / ITERS;
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.55);
  });

  it("batchSize=3: treble ~50% 전체 평균 (허용 ±5%)", () => {
    let trebleCount = 0;
    const totalNotes = ITERS * 3;
    for (let i = 0; i < ITERS; i++) {
      const { notes } = generateKeyBatch(5, 3, G_MAJOR, new Map());
      trebleCount += notes.filter(n => n.clef === "treble").length;
    }
    const ratio = trebleCount / totalNotes;
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.55);
  });

  it("batchSize=5: treble ~50% 전체 평균 (허용 ±5%)", () => {
    let trebleCount = 0;
    const totalNotes = ITERS * 5;
    for (let i = 0; i < ITERS; i++) {
      const { notes } = generateKeyBatch(5, 5, G_MAJOR, new Map());
      trebleCount += notes.filter(n => n.clef === "treble").length;
    }
    const ratio = trebleCount / totalNotes;
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.55);
  });

  it("batchSize=7: treble ~50% 전체 평균 (허용 ±5%)", () => {
    let trebleCount = 0;
    const totalNotes = ITERS * 7;
    for (let i = 0; i < ITERS; i++) {
      const { notes } = generateKeyBatch(5, 7, G_MAJOR, new Map());
      trebleCount += notes.filter(n => n.clef === "treble").length;
    }
    const ratio = trebleCount / totalNotes;
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.55);
  });
});

// ─────────────────────────────────────────────
// batchSize>1: 한 batch 내 두 자리표 모두 등장 보장
// ─────────────────────────────────────────────

describe("§0.2 generateKeyBatch — 한 batch 내 두 자리표 모두 등장", () => {
  const BATCH_ITERS = 5_000;

  it("batchSize=3: 모든 batch에 treble·bass 각 ≥1", () => {
    for (let i = 0; i < BATCH_ITERS; i++) {
      const { notes } = generateKeyBatch(5, 3, G_MAJOR, new Map());
      const hasTreble = notes.some(n => n.clef === "treble");
      const hasBass   = notes.some(n => n.clef === "bass");
      expect(hasTreble).toBe(true);
      expect(hasBass).toBe(true);
    }
  });

  it("batchSize=5: 모든 batch에 treble·bass 각 ≥1", () => {
    for (let i = 0; i < BATCH_ITERS; i++) {
      const { notes } = generateKeyBatch(5, 5, G_MAJOR, new Map());
      const hasTreble = notes.some(n => n.clef === "treble");
      const hasBass   = notes.some(n => n.clef === "bass");
      expect(hasTreble).toBe(true);
      expect(hasBass).toBe(true);
    }
  });

  it("batchSize=7: 모든 batch에 treble·bass 각 ≥1", () => {
    for (let i = 0; i < BATCH_ITERS; i++) {
      const { notes } = generateKeyBatch(5, 7, G_MAJOR, new Map());
      const hasTreble = notes.some(n => n.clef === "treble");
      const hasBass   = notes.some(n => n.clef === "bass");
      expect(hasTreble).toBe(true);
      expect(hasBass).toBe(true);
    }
  });

  it("batchSize=1: 두 자리표 보장 없음 (단일 음표이므로 OK)", () => {
    // batchSize=1은 보장 대상 아님 — 단순히 통과 확인
    const { notes } = generateKeyBatch(5, 1, G_MAJOR, new Map());
    expect(notes).toHaveLength(1);
    expect(["treble", "bass"]).toContain(notes[0].clef);
  });
});

// ─────────────────────────────────────────────
// 통계 보고서 (정량 확인용 stdout 출력)
// ─────────────────────────────────────────────

describe("§0.2 통계 보고서 — batchSize별 비율 실측", () => {
  it("자연:조표 / treble:bass 실측 비율 출력 (D major, 10,000 iter)", () => {
    const configs: Array<{ size: number; targetAcc: number }> = [
      { size: 1, targetAcc: 0.30 },
      { size: 3, targetAcc: 0.40 },
      { size: 5, targetAcc: 0.60 },
      { size: 7, targetAcc: 0.70 },
    ];

    console.log("\n=== §0.2 비율 실측 보고서 (D major, 10,000 iter/batchSize) ===");
    console.log("  batchSize | 자연:조표(실측)  | 목표    | treble:bass | 두자리표100%");

    let allValid = true;

    for (const { size, targetAcc } of configs) {
      let accTotal = 0, trebleTotal = 0, totalNotes = 0;
      let dualClefFail = 0;

      for (let i = 0; i < ITERS; i++) {
        const { notes } = generateKeyBatch(5, size, D_MAJOR, new Map());
        accTotal   += notes.filter(n => n.accidental !== undefined).length;
        trebleTotal += notes.filter(n => n.clef === "treble").length;
        totalNotes += notes.length;

        if (size > 1) {
          const hasTreble = notes.some(n => n.clef === "treble");
          const hasBass   = notes.some(n => n.clef === "bass");
          if (!hasTreble || !hasBass) dualClefFail++;
        }
      }

      const accRatio    = accTotal / totalNotes;
      const trebleRatio = trebleTotal / totalNotes;
      const dualOk      = size === 1 ? "N/A" : dualClefFail === 0 ? "✅ 100%" : `❌ ${dualClefFail}실패`;
      const withinTol   = Math.abs(accRatio - targetAcc) <= TOL;
      if (!withinTol) allValid = false;

      console.log(
        `  size=${size}     | ` +
        `${(1 - accRatio).toFixed(3)}:${accRatio.toFixed(3)} | ` +
        `${(1 - targetAcc).toFixed(1)}:${targetAcc.toFixed(1)} | ` +
        `${trebleRatio.toFixed(3)}:${(1-trebleRatio).toFixed(3)} | ` +
        dualOk
      );
    }

    console.log("=======================================================\n");
    expect(allValid).toBe(true);
  });
});
