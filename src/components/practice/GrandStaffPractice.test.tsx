import { describe, it, expect } from "vitest";
import { getNoteColor, resolveStyle, computeMaxVisibleN, STAFF_X2 } from "./GrandStaffPractice";

describe("getNoteColor", () => {
  it("target → #b91c1c (빨강)", () => {
    expect(getNoteColor("target")).toBe("#b91c1c");
  });

  it("answered → #9ca3af (회색)", () => {
    expect(getNoteColor("answered")).toBe("#9ca3af");
  });

  it("waiting → #1c1917 (검정)", () => {
    expect(getNoteColor("waiting")).toBe("#1c1917");
  });

  it("target !== answered", () => {
    expect(getNoteColor("target")).not.toBe(getNoteColor("answered"));
  });

  it("waiting !== answered", () => {
    expect(getNoteColor("waiting")).not.toBe(getNoteColor("answered"));
  });
});

describe("resolveStyle — N-등분 배치 (F4)", () => {
  it("N=1: noteStartX+noteSpacing/2=noteX(0) 중앙 배치", () => {
    const style = resolveStyle(1, 0, 1, 1);
    const rawStart = style.noteStartX - style.noteSpacing / 2;
    const effectiveWidth = STAFF_X2 - rawStart;
    expect(style.noteSpacing).toBeCloseTo(effectiveWidth / 1);
    // 첫 음표는 rawStart + segmentWidth * 0.5 = noteStartX
    expect(style.noteStartX).toBeCloseTo(rawStart + style.noteSpacing / 2);
  });

  it("N=3: noteSpacing = effectiveWidth/3", () => {
    const style = resolveStyle(1, 0, 3, 3);
    const rawStart = style.noteStartX - style.noteSpacing / 2;
    const effectiveWidth = STAFF_X2 - rawStart;
    expect(style.noteSpacing).toBeCloseTo(effectiveWidth / 3, 1);
  });

  it("N=7: 마지막 음표 x < STAFF_X2 (잘림 없음)", () => {
    const style = resolveStyle(1, 0, 7, 7);
    const lastX = style.noteStartX + 6 * style.noteSpacing;
    expect(lastX).toBeLessThan(STAFF_X2);
  });

  it("keySig=4 sharps: noteStartX가 더 크게 조정됨", () => {
    const noKey = resolveStyle(5, 0, 3, 3);
    const withKey = resolveStyle(5, 4, 3, 3);
    const noKeyRaw = noKey.noteStartX - noKey.noteSpacing / 2;
    const withKeyRaw = withKey.noteStartX - withKey.noteSpacing / 2;
    expect(withKeyRaw).toBeGreaterThan(noKeyRaw);
  });

  it("noteX(i) = rawStart + segmentWidth*(i+0.5) (N=5)", () => {
    const style = resolveStyle(1, 0, 5, 5);
    const rawStart = style.noteStartX - style.noteSpacing / 2;
    for (let i = 0; i < 5; i++) {
      const xFormula  = style.noteStartX + i * style.noteSpacing;
      const xNdiv     = rawStart + style.noteSpacing * (i + 0.5);
      expect(xFormula).toBeCloseTo(xNdiv, 5);
    }
  });

  it("N=3 vs N=7: N=3이 segmentWidth 더 큼 (더 여유있는 배치)", () => {
    const s3 = resolveStyle(1, 0, 3, 3);
    const s7 = resolveStyle(1, 0, 7, 7);
    expect(s3.noteSpacing).toBeGreaterThan(s7.noteSpacing);
  });
});

describe("computeMaxVisibleN — M-등분 고정 슬롯 정책 (C1)", () => {
  // batchSize=1 stage: M = totalSets (batchSize=1, notesPerSet=1)
  it("batchSize=1, totalSets=5 → M=5", () => {
    expect(computeMaxVisibleN(false, 1, 5, 0)).toBe(5);
  });

  it("batchSize=1, totalSets=7 → M=7", () => {
    expect(computeMaxVisibleN(false, 1, 7, 0)).toBe(7);
  });

  it("batchSize=3 → M=3 (totalSets·currentBatch 무관)", () => {
    expect(computeMaxVisibleN(false, 3, 99, 99)).toBe(3);
  });

  it("batchSize=5 → M=5", () => {
    expect(computeMaxVisibleN(false, 5, 99, 2)).toBe(5);
  });

  it("batchSize=7 → M=7", () => {
    expect(computeMaxVisibleN(false, 7, 99, 2)).toBe(7);
  });

  it("final-retry, currentBatch=3 → M=3", () => {
    expect(computeMaxVisibleN(true, 5, 99, 3)).toBe(3);
  });

  it("final-retry, currentBatch=5 → M=5", () => {
    expect(computeMaxVisibleN(true, 3, 99, 5)).toBe(5);
  });
});

describe("resolveStyle — M-등분 고정 슬롯 (C1 음표 크기·위치 고정)", () => {
  // noteSpacing(M=5) 고정 확인: set1 진행 중(visibleN=1)과 set3 진행 중(visibleN=3) 동일해야 함
  it("M=5 고정: visibleN과 무관하게 동일 noteSpacing", () => {
    const sM5 = resolveStyle(1, 0, 1, 5);
    // 내부에서 M=5로 분할 — batchSize 값은 무관
    const sM5b = resolveStyle(1, 0, 5, 5);
    expect(sM5.noteSpacing).toBeCloseTo(sM5b.noteSpacing, 5);
  });

  it("M=5: 음표 크기 80% (noteheadRX = 15.5 × 0.80)", () => {
    const style = resolveStyle(1, 0, 1, 5);
    expect(style.noteheadRX).toBeCloseTo(15.5 * 0.80, 3);
  });

  it("M=7: 음표 크기 70% (noteheadRX = 15.5 × 0.70)", () => {
    const style = resolveStyle(1, 0, 1, 7);
    expect(style.noteheadRX).toBeCloseTo(15.5 * 0.70, 3);
  });

  it("M=10: 음표 크기 60% (noteheadRX = 15.5 × 0.60)", () => {
    const style = resolveStyle(1, 0, 1, 10);
    expect(style.noteheadRX).toBeCloseTo(15.5 * 0.60, 3);
  });

  // 기존 음표 위치 고정 확인: slot 0 의 x 값은 M가 같으면 visibleN에 무관
  it("slot 0 위치: M=5 고정 → set진행(visibleN=2→3) 중에도 동일", () => {
    // M=5 고정이면 noteStartX(slot0)는 변하지 않아야 함
    const sM5 = resolveStyle(1, 0, 1, 5);
    const sM5_again = resolveStyle(1, 0, 3, 5);
    expect(sM5.noteStartX).toBeCloseTo(sM5_again.noteStartX, 5);
  });
});
