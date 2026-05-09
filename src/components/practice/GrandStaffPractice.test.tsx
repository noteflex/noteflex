import { describe, it, expect } from "vitest";
import { getNoteColor, resolveStyle, STAFF_X2 } from "./GrandStaffPractice";

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
