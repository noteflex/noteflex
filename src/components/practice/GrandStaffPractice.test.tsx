import { describe, it, expect } from "vitest";
import { getNoteColor } from "./GrandStaffPractice";

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
