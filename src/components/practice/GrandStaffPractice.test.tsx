import { describe, it, expect } from "vitest";
import { getNoteColor, resolveStyle, computeMaxVisibleN, computeScale, STAFF_X2 } from "./GrandStaffPractice";

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

describe("computeScale — S1 Uniform scale 비율", () => {
  it("M=3 → scale=1.0", () => expect(computeScale(3)).toBe(1.0));
  it("M=5 → scale=0.85", () => expect(computeScale(5)).toBe(0.85));
  it("M=7 → scale=0.75", () => expect(computeScale(7)).toBe(0.75));
  it("M=10 → scale=0.65", () => expect(computeScale(10)).toBe(0.65));
  it("M=12 → scale=0.55", () => expect(computeScale(12)).toBe(0.55));
});

describe("resolveStyle — S1 Uniform scale (오선 간격·음자리표·비율)", () => {
  // staffHeight = (staffBot - staffTop) = 4 * LINE_GAP * scale = 96 * scale
  it("M=3 (scale=1.0): staffHeight=96, noteheadRX=15.5, clefFontSize=96", () => {
    const s = resolveStyle(1, 0, 1, 3);
    expect(s.staffBot - s.staffTop).toBeCloseTo(96 * 1.0, 1);
    expect(s.noteheadRX).toBeCloseTo(15.5 * 1.0, 3);
    expect(s.clefFontSize).toBeCloseTo(96 * 1.0, 1);
    expect(s.uniscale).toBe(1.0);
  });

  it("M=5 (scale=0.85): staffHeight=81.6, clefFontSize scaled", () => {
    const s = resolveStyle(1, 0, 1, 5);
    expect(s.staffBot - s.staffTop).toBeCloseTo(96 * 0.85, 1);
    expect(s.clefFontSize).toBeCloseTo(96 * 0.85, 1);
    expect(s.uniscale).toBe(0.85);
  });

  it("M=7 (scale=0.75): staffHeight=72, noteheadRX/staffHeight 비율 일정", () => {
    const s = resolveStyle(1, 0, 1, 7);
    expect(s.staffBot - s.staffTop).toBeCloseTo(72, 1);
    // noteheadRX / (STEP_H * scale) = noteheadRX / ((staffHeight/8))
    const stepH = (s.staffBot - s.staffTop) / 8;
    const ratio = s.noteheadRX / stepH;
    // ratio should be close to 15.5/12 ≈ 1.29 (consistent across scales)
    expect(ratio).toBeCloseTo(15.5 / 12, 2);
  });

  it("M=10 (scale=0.65): staffHeight=62.4", () => {
    const s = resolveStyle(1, 0, 1, 10);
    expect(s.staffBot - s.staffTop).toBeCloseTo(96 * 0.65, 1);
  });

  it("M=12 (scale=0.55): staffHeight=52.8", () => {
    const s = resolveStyle(1, 0, 1, 12);
    expect(s.staffBot - s.staffTop).toBeCloseTo(96 * 0.55, 1);
  });

  it("keySig=4, scale=0.75: effectiveWidth > keySig=4, scale=1.0 (keySig 축소 → 공간 증가)", () => {
    const sScaled = resolveStyle(1, 4, 1, 7);   // scale=0.75
    const sFull   = resolveStyle(1, 4, 1, 1);   // scale=1.0
    // effectiveWidth = STAFF_X2 - rawNoteStartX
    const rawScaled = sScaled.noteStartX - sScaled.noteSpacing / 2;
    const rawFull   = sFull.noteStartX   - sFull.noteSpacing   / 2;
    expect(rawScaled).toBeLessThan(rawFull);     // smaller noteStartX → more room
  });

  it("Lv5 grand staff M=7 (scale=0.75): staffHeight·uniscale 일관", () => {
    const s = resolveStyle(5, 0, 1, 7);
    expect(s.staffBot - s.staffTop).toBeCloseTo(72, 1);
    expect(s.uniscale).toBe(0.75);
  });

  it("M=3 ratio = M=7 ratio (비율 일정성)", () => {
    const s3 = resolveStyle(1, 0, 1, 3);
    const s7 = resolveStyle(1, 0, 1, 7);
    const stepH3 = (s3.staffBot - s3.staffTop) / 8;
    const stepH7 = (s7.staffBot - s7.staffTop) / 8;
    expect(s3.noteheadRX / stepH3).toBeCloseTo(s7.noteheadRX / stepH7, 2);
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

  it("M=5: 음표 크기 85% (noteheadRX = 15.5 × 0.85)", () => {
    const style = resolveStyle(1, 0, 1, 5);
    expect(style.noteheadRX).toBeCloseTo(15.5 * 0.85, 3);
  });

  it("M=7: 음표 크기 75% (noteheadRX = 15.5 × 0.75)", () => {
    const style = resolveStyle(1, 0, 1, 7);
    expect(style.noteheadRX).toBeCloseTo(15.5 * 0.75, 3);
  });

  it("M=10: 음표 크기 65% (noteheadRX = 15.5 × 0.65)", () => {
    const style = resolveStyle(1, 0, 1, 10);
    expect(style.noteheadRX).toBeCloseTo(15.5 * 0.65, 3);
  });

  // 기존 음표 위치 고정 확인: slot 0 의 x 값은 M가 같으면 visibleN에 무관
  it("slot 0 위치: M=5 고정 → set진행(visibleN=2→3) 중에도 동일", () => {
    // M=5 고정이면 noteStartX(slot0)는 변하지 않아야 함
    const sM5 = resolveStyle(1, 0, 1, 5);
    const sM5_again = resolveStyle(1, 0, 3, 5);
    expect(sM5.noteStartX).toBeCloseTo(sM5_again.noteStartX, 5);
  });
});
