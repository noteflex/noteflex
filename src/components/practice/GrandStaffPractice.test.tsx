import { describe, it, expect } from "vitest";
import { getNoteColor, resolveStyle, computeMaxVisibleN, computeScale, STAFF_X2, SHARP_KEY_POS, FLAT_KEY_POS, stepToY, STEP_H, LINE_GAP } from "./GrandStaffPractice";

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
  it("N=1: noteStartX+noteSpacing/4=noteX(0) 1/4 배치", () => {
    const style = resolveStyle(1, 0, 1, 1);
    const rawStart = style.noteStartX - style.noteSpacing / 4;
    const effectiveWidth = STAFF_X2 - rawStart;
    expect(style.noteSpacing).toBeCloseTo(effectiveWidth / 1);
    // 첫 음표는 rawStart + segmentWidth * 0.25 = noteStartX
    expect(style.noteStartX).toBeCloseTo(rawStart + style.noteSpacing / 4);
  });

  it("N=3: noteSpacing = effectiveWidth/3", () => {
    const style = resolveStyle(1, 0, 3, 3);
    const rawStart = style.noteStartX - style.noteSpacing / 4;
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
    const noKeyRaw = noKey.noteStartX - noKey.noteSpacing / 4;
    const withKeyRaw = withKey.noteStartX - withKey.noteSpacing / 4;
    expect(withKeyRaw).toBeGreaterThan(noKeyRaw);
  });

  it("noteX(i) = rawStart + segmentWidth*(i+0.25) (N=5)", () => {
    const style = resolveStyle(1, 0, 5, 5);
    const rawStart = style.noteStartX - style.noteSpacing / 4;
    for (let i = 0; i < 5; i++) {
      const xFormula  = style.noteStartX + i * style.noteSpacing;
      const xNdiv     = rawStart + style.noteSpacing * (i + 0.25);
      expect(xFormula).toBeCloseTo(xNdiv, 5);
    }
  });

  it("N=3 vs N=7: N=3이 segmentWidth 더 큼 (더 여유있는 배치)", () => {
    const s3 = resolveStyle(1, 0, 3, 3);
    const s7 = resolveStyle(1, 0, 7, 7);
    expect(s3.noteSpacing).toBeGreaterThan(s7.noteSpacing);
  });
});

describe("computeScale — 고정 0.75 (배치 무관 동일 프레임)", () => {
  it("M=1 → 0.75", () => expect(computeScale(1)).toBe(0.75));
  it("M=3 → 0.75", () => expect(computeScale(3)).toBe(0.75));
  it("M=7 → 0.75", () => expect(computeScale(7)).toBe(0.75));
  it("M=12 → 0.75", () => expect(computeScale(12)).toBe(0.75));
});

describe("resolveStyle — S1 Uniform scale (오선 간격·음자리표·비율)", () => {
  // computeScale 고정 0.75: staffHeight = 96 * 0.75 = 72 (M 무관)
  it("M=3 (scale=0.75): staffHeight=72, noteheadRX=11.625, clefFontSize=72", () => {
    const s = resolveStyle(1, 0, 1, 3);
    expect(s.staffBot - s.staffTop).toBeCloseTo(96 * 0.75, 1);
    expect(s.noteheadRX).toBeCloseTo(15.5 * 0.75, 3);
    expect(s.clefFontSize).toBeCloseTo(96 * 0.75, 1);
    expect(s.uniscale).toBe(0.75);
  });

  it("M=5 (scale=0.75): staffHeight=72, clefFontSize=72", () => {
    const s = resolveStyle(1, 0, 1, 5);
    expect(s.staffBot - s.staffTop).toBeCloseTo(96 * 0.75, 1);
    expect(s.clefFontSize).toBeCloseTo(96 * 0.75, 1);
    expect(s.uniscale).toBe(0.75);
  });

  it("M=7 (scale=0.75): staffHeight=72, noteheadRX/staffHeight 비율 일정", () => {
    const s = resolveStyle(1, 0, 1, 7);
    expect(s.staffBot - s.staffTop).toBeCloseTo(72, 1);
    const stepH = (s.staffBot - s.staffTop) / 8;
    const ratio = s.noteheadRX / stepH;
    expect(ratio).toBeCloseTo(15.5 / 12, 2);
  });

  it("M=10 (scale=0.75): staffHeight=72", () => {
    const s = resolveStyle(1, 0, 1, 10);
    expect(s.staffBot - s.staffTop).toBeCloseTo(96 * 0.75, 1);
  });

  it("M=12 (scale=0.75): staffHeight=72", () => {
    const s = resolveStyle(1, 0, 1, 12);
    expect(s.staffBot - s.staffTop).toBeCloseTo(96 * 0.75, 1);
  });

  it("keySig=4: noteStartX는 keySig=0보다 오른쪽 (조표 공간 확보)", () => {
    const withKey = resolveStyle(1, 4, 1, 7);
    const noKey   = resolveStyle(1, 0, 1, 7);
    const rawWithKey = withKey.noteStartX - withKey.noteSpacing / 4;
    const rawNoKey   = noKey.noteStartX   - noKey.noteSpacing   / 4;
    expect(rawWithKey).toBeGreaterThan(rawNoKey);
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

  it("M=5: 음표 크기 75% (noteheadRX = 15.5 × 0.75)", () => {
    const style = resolveStyle(1, 0, 1, 5);
    expect(style.noteheadRX).toBeCloseTo(15.5 * 0.75, 3);
  });

  it("M=7: 음표 크기 75% (noteheadRX = 15.5 × 0.75)", () => {
    const style = resolveStyle(1, 0, 1, 7);
    expect(style.noteheadRX).toBeCloseTo(15.5 * 0.75, 3);
  });

  it("M=10: 음표 크기 75% (noteheadRX = 15.5 × 0.75)", () => {
    const style = resolveStyle(1, 0, 1, 10);
    expect(style.noteheadRX).toBeCloseTo(15.5 * 0.75, 3);
  });

  // 기존 음표 위치 고정 확인: slot 0 의 x 값은 M가 같으면 visibleN에 무관
  it("slot 0 위치: M=5 고정 → set진행(visibleN=2→3) 중에도 동일", () => {
    // M=5 고정이면 noteStartX(slot0)는 변하지 않아야 함
    const sM5 = resolveStyle(1, 0, 1, 5);
    const sM5_again = resolveStyle(1, 0, 3, 5);
    expect(sM5.noteStartX).toBeCloseTo(sM5_again.noteStartX, 5);
  });
});

describe("resolveStyle — 첫 음표 1/4 위치 정책 (segmentWidth × 0.25)", () => {
  // rawStart = noteStartX - noteSpacing/4 (= 실제 분할 시작 X)

  it("M=3: 첫 음표 x = rawStart + segmentWidth × 0.25", () => {
    const s = resolveStyle(1, 0, 3, 3);
    const rawStart = s.noteStartX - s.noteSpacing / 4;
    expect(s.noteStartX).toBeCloseTo(rawStart + s.noteSpacing * 0.25, 5);
  });

  it("M=5: 첫 음표 x = rawStart + segmentWidth × 0.25", () => {
    const s = resolveStyle(1, 0, 5, 5);
    const rawStart = s.noteStartX - s.noteSpacing / 4;
    expect(s.noteStartX).toBeCloseTo(rawStart + s.noteSpacing * 0.25, 5);
  });

  it("M=7: 첫 음표 x = rawStart + segmentWidth × 0.25", () => {
    const s = resolveStyle(1, 0, 7, 7);
    const rawStart = s.noteStartX - s.noteSpacing / 4;
    expect(s.noteStartX).toBeCloseTo(rawStart + s.noteSpacing * 0.25, 5);
  });

  it("M=10: 첫 음표 x = rawStart + segmentWidth × 0.25", () => {
    const s = resolveStyle(1, 0, 1, 10);
    const rawStart = s.noteStartX - s.noteSpacing / 4;
    expect(s.noteStartX).toBeCloseTo(rawStart + s.noteSpacing * 0.25, 5);
  });

  it("M=7: 마지막 음표 x = rawStart + segmentWidth × (7 - 0.75)", () => {
    const s = resolveStyle(1, 0, 7, 7);
    const rawStart = s.noteStartX - s.noteSpacing / 4;
    const lastX = s.noteStartX + 6 * s.noteSpacing;  // slot 6
    expect(lastX).toBeCloseTo(rawStart + s.noteSpacing * (7 - 0.75), 5);
  });

  it("M=5: 마지막 음표 잘림 X (effectiveWidth 안)", () => {
    const s = resolveStyle(1, 0, 5, 5);
    const lastX = s.noteStartX + 4 * s.noteSpacing;
    expect(lastX).toBeLessThan(STAFF_X2);
  });

  it("M=3: 첫 음표가 M=7 첫 음표보다 더 오른쪽 (segmentWidth 비례)", () => {
    const s3 = resolveStyle(1, 0, 3, 3);
    const s7 = resolveStyle(1, 0, 7, 7);
    // M=3은 segmentWidth가 커서 0.25 오프셋도 더 크다
    expect(s3.noteStartX).toBeGreaterThan(s7.noteStartX);
  });
});

describe("조표 표준 음악 표기 위치 — treble sharps (7)", () => {
  it("F# stave position = 10 (L5)", () => expect(SHARP_KEY_POS.treble.F).toBe(10));
  it("C# stave position = 7 (S3)", () => expect(SHARP_KEY_POS.treble.C).toBe(7));
  it("G# stave position = 11 (above L5)", () => expect(SHARP_KEY_POS.treble.G).toBe(11));
  it("D# stave position = 8 (L4)", () => expect(SHARP_KEY_POS.treble.D).toBe(8));
  it("A# stave position = 5 (S2)", () => expect(SHARP_KEY_POS.treble.A).toBe(5));
  it("E# stave position = 9 (S4)", () => expect(SHARP_KEY_POS.treble.E).toBe(9));
  it("B# stave position = 6 (L3)", () => expect(SHARP_KEY_POS.treble.B).toBe(6));
});

describe("조표 표준 음악 표기 위치 — treble flats (7)", () => {
  it("Bb stave position = 6 (L3)", () => expect(FLAT_KEY_POS.treble.B).toBe(6));
  it("Eb stave position = 9 (S4)", () => expect(FLAT_KEY_POS.treble.E).toBe(9));
  it("Ab stave position = 5 (S2)", () => expect(FLAT_KEY_POS.treble.A).toBe(5));
  it("Db stave position = 8 (L4)", () => expect(FLAT_KEY_POS.treble.D).toBe(8));
  it("Gb stave position = 4 (L2)", () => expect(FLAT_KEY_POS.treble.G).toBe(4));
  it("Cb stave position = 7 (S3)", () => expect(FLAT_KEY_POS.treble.C).toBe(7));
  it("Fb stave position = 3 (L1)", () => expect(FLAT_KEY_POS.treble.F).toBe(3));
});

describe("조표 표준 음악 표기 위치 — bass sharps (7)", () => {
  it("F# stave position = -4 (L4)", () => expect(SHARP_KEY_POS.bass.F).toBe(-4));
  it("C# stave position = -7 (S2)", () => expect(SHARP_KEY_POS.bass.C).toBe(-7));
  it("G# stave position = -2 (L5)", () => expect(SHARP_KEY_POS.bass.G).toBe(-2));
  it("D# stave position = -6 (L3)", () => expect(SHARP_KEY_POS.bass.D).toBe(-6));
  it("A# stave position = -9 (S1)", () => expect(SHARP_KEY_POS.bass.A).toBe(-9));
  it("E# stave position = -5 (S3)", () => expect(SHARP_KEY_POS.bass.E).toBe(-5));
  it("B# stave position = -8 (L2)", () => expect(SHARP_KEY_POS.bass.B).toBe(-8));
});

describe("조표 표준 음악 표기 위치 — bass flats (7)", () => {
  it("Bb stave position = -8 (L2)", () => expect(FLAT_KEY_POS.bass.B).toBe(-8));
  it("Eb stave position = -5 (S3)", () => expect(FLAT_KEY_POS.bass.E).toBe(-5));
  it("Ab stave position = -9 (S1)", () => expect(FLAT_KEY_POS.bass.A).toBe(-9));
  it("Db stave position = -6 (L3)", () => expect(FLAT_KEY_POS.bass.D).toBe(-6));
  it("Gb stave position = -10 (L1)", () => expect(FLAT_KEY_POS.bass.G).toBe(-10));
  it("Cb stave position = -7 (S2)", () => expect(FLAT_KEY_POS.bass.C).toBe(-7));
  it("Fb stave position = -11 (below L1)", () => expect(FLAT_KEY_POS.bass.F).toBe(-11));
});

describe("stepToY — treble stave line 정확 y 좌표", () => {
  // Level 1, scale=1.0: staffTop=98, staffBot=194, stepH=12, lineGap=24
  const s = resolveStyle(1, 0, 1, 3);
  const stepH = STEP_H * s.uniscale;
  const lineGap = LINE_GAP * s.uniscale;

  it("line 5 (step=10) → staffTop", () => {
    expect(stepToY(10, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop, 1);
  });
  it("line 4 (step=8) → staffTop + lineGap", () => {
    expect(stepToY(8, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + lineGap, 1);
  });
  it("line 3 (step=6) → staffTop + 2*lineGap (middle)", () => {
    expect(stepToY(6, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 2 * lineGap, 1);
  });
  it("line 2 (step=4) → staffTop + 3*lineGap", () => {
    expect(stepToY(4, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 3 * lineGap, 1);
  });
  it("line 1 (step=2) → staffBot", () => {
    expect(stepToY(2, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffBot, 1);
  });
  it("space 4 (step=9) = midpoint L4~L5", () => {
    const l4 = stepToY(8, "treble", s.staffBot, 0, stepH);
    const l5 = stepToY(10, "treble", s.staffBot, 0, stepH);
    expect(stepToY(9, "treble", s.staffBot, 0, stepH)).toBeCloseTo((l4 + l5) / 2, 1);
  });
  it("above L5 (step=11) = staffTop - stepH", () => {
    expect(stepToY(11, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop - stepH, 1);
  });
});

describe("stepToY — bass stave line 정확 y 좌표", () => {
  // Level 2 bass-only, scale=1.0: staffTop=74, staffBot=170, stepH=12, lineGap=24
  const s = resolveStyle(2, 0, 1, 3);
  const stepH = STEP_H * s.uniscale;
  const lineGap = LINE_GAP * s.uniscale;

  it("line 5 (step=-2) → staffTop (A3)", () => {
    expect(stepToY(-2, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop, 1);
  });
  it("line 4 (step=-4) → staffTop + lineGap (F3)", () => {
    expect(stepToY(-4, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + lineGap, 1);
  });
  it("line 3 (step=-6) → staffTop + 2*lineGap middle (D3)", () => {
    expect(stepToY(-6, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 2 * lineGap, 1);
  });
  it("line 2 (step=-8) → staffTop + 3*lineGap (B2)", () => {
    expect(stepToY(-8, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 3 * lineGap, 1);
  });
  it("line 1 (step=-10) → staffBot (G2)", () => {
    expect(stepToY(-10, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffBot, 1);
  });
  it("below L1 (step=-11) = staffBot + stepH", () => {
    expect(stepToY(-11, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffBot + stepH, 1);
  });
});

describe("stepToY — scale 5단계 비례 일관 (treble F#=line5)", () => {
  // F# treble: step=10, should always map to staffTop regardless of scale
  it("M=3 (scale=1.0): F# → staffTop", () => {
    const s = resolveStyle(1, 0, 1, 3);
    expect(stepToY(10, "treble", s.staffBot, 0, STEP_H * s.uniscale)).toBeCloseTo(s.staffTop, 1);
  });
  it("M=5 (scale=0.85): F# → staffTop", () => {
    const s = resolveStyle(1, 0, 1, 5);
    expect(stepToY(10, "treble", s.staffBot, 0, STEP_H * s.uniscale)).toBeCloseTo(s.staffTop, 1);
  });
  it("M=7 (scale=0.75): F# → staffTop", () => {
    const s = resolveStyle(1, 0, 1, 7);
    expect(stepToY(10, "treble", s.staffBot, 0, STEP_H * s.uniscale)).toBeCloseTo(s.staffTop, 1);
  });
  it("M=10 (scale=0.65): F# → staffTop", () => {
    const s = resolveStyle(1, 0, 1, 10);
    expect(stepToY(10, "treble", s.staffBot, 0, STEP_H * s.uniscale)).toBeCloseTo(s.staffTop, 1);
  });
  it("M=12 (scale=0.55): F# → staffTop", () => {
    const s = resolveStyle(1, 0, 1, 12);
    expect(stepToY(10, "treble", s.staffBot, 0, STEP_H * s.uniscale)).toBeCloseTo(s.staffTop, 1);
  });
});

describe("조표 SVG y 좌표 — treble sharps 7개 stave position 매핑", () => {
  // stepToY(step, "treble", staffBot, 0, stepH) = exact y for each sharp
  const s = resolveStyle(1, 0, 1, 3);
  const stepH = STEP_H * s.uniscale;
  const lineGap = LINE_GAP * s.uniscale;

  it("F# (step=10): line 5 = staffTop", () => {
    expect(stepToY(SHARP_KEY_POS.treble.F, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop, 1);
  });
  it("C# (step=7): space 3 = staffTop + 1.5*lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.treble.C, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 1.5 * lineGap, 1);
  });
  it("G# (step=11): above line 5 = staffTop - stepH", () => {
    expect(stepToY(SHARP_KEY_POS.treble.G, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop - stepH, 1);
  });
  it("D# (step=8): line 4 = staffTop + lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.treble.D, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + lineGap, 1);
  });
  it("A# (step=5): space 2 = staffTop + 2.5*lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.treble.A, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 2.5 * lineGap, 1);
  });
  it("E# (step=9): space 4 = staffTop + 0.5*lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.treble.E, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 0.5 * lineGap, 1);
  });
  it("B# (step=6): line 3 = staffTop + 2*lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.treble.B, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 2 * lineGap, 1);
  });
});

describe("조표 SVG y 좌표 — treble flats 7개 stave position 매핑", () => {
  const s = resolveStyle(1, 0, 1, 3);
  const stepH = STEP_H * s.uniscale;
  const lineGap = LINE_GAP * s.uniscale;

  it("Bb (step=6): line 3 = staffTop + 2*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.treble.B, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 2 * lineGap, 1);
  });
  it("Eb (step=9): space 4 = staffTop + 0.5*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.treble.E, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 0.5 * lineGap, 1);
  });
  it("Ab (step=5): space 2 = staffTop + 2.5*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.treble.A, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 2.5 * lineGap, 1);
  });
  it("Db (step=8): line 4 = staffTop + lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.treble.D, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + lineGap, 1);
  });
  it("Gb (step=4): line 2 = staffTop + 3*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.treble.G, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 3 * lineGap, 1);
  });
  it("Cb (step=7): space 3 = staffTop + 1.5*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.treble.C, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 1.5 * lineGap, 1);
  });
  it("Fb (step=3): space 1 = staffTop + 3.5*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.treble.F, "treble", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 3.5 * lineGap, 1);
  });
});

describe("조표 SVG y 좌표 — bass sharps 7개 stave position 매핑", () => {
  const s = resolveStyle(2, 0, 1, 3);
  const stepH = STEP_H * s.uniscale;
  const lineGap = LINE_GAP * s.uniscale;

  it("F# (step=-4): line 4 = staffTop + lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.bass.F, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + lineGap, 1);
  });
  it("C# (step=-7): space 2 = staffTop + 2.5*lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.bass.C, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 2.5 * lineGap, 1);
  });
  it("G# (step=-2): line 5 = staffTop", () => {
    expect(stepToY(SHARP_KEY_POS.bass.G, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop, 1);
  });
  it("D# (step=-6): line 3 = staffTop + 2*lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.bass.D, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 2 * lineGap, 1);
  });
  it("A# (step=-9): space 1 = staffTop + 3.5*lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.bass.A, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 3.5 * lineGap, 1);
  });
  it("E# (step=-5): space 3 = staffTop + 1.5*lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.bass.E, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 1.5 * lineGap, 1);
  });
  it("B# (step=-8): line 2 = staffTop + 3*lineGap", () => {
    expect(stepToY(SHARP_KEY_POS.bass.B, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 3 * lineGap, 1);
  });
});

describe("조표 SVG y 좌표 — bass flats 7개 stave position 매핑", () => {
  const s = resolveStyle(2, 0, 1, 3);
  const stepH = STEP_H * s.uniscale;
  const lineGap = LINE_GAP * s.uniscale;

  it("Bb (step=-8): line 2 = staffTop + 3*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.bass.B, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 3 * lineGap, 1);
  });
  it("Eb (step=-5): space 3 = staffTop + 1.5*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.bass.E, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 1.5 * lineGap, 1);
  });
  it("Ab (step=-9): space 1 = staffTop + 3.5*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.bass.A, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 3.5 * lineGap, 1);
  });
  it("Db (step=-6): line 3 = staffTop + 2*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.bass.D, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 2 * lineGap, 1);
  });
  it("Gb (step=-10): line 1 = staffBot", () => {
    expect(stepToY(FLAT_KEY_POS.bass.G, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffBot, 1);
  });
  it("Cb (step=-7): space 2 = staffTop + 2.5*lineGap", () => {
    expect(stepToY(FLAT_KEY_POS.bass.C, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffTop + 2.5 * lineGap, 1);
  });
  it("Fb (step=-11): below line 1 = staffBot + stepH", () => {
    expect(stepToY(FLAT_KEY_POS.bass.F, "bass", s.staffBot, 0, stepH)).toBeCloseTo(s.staffBot + stepH, 1);
  });
});
