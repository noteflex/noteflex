import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── env mock ───────────────────────────────────────────────
vi.mock("./adsense", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./adsense")>();
  return mod;
});

describe("isAdsEnabled", () => {
  it("VITE_ADS_ENABLED=false → false", async () => {
    vi.stubEnv("VITE_ADS_ENABLED", "false");
    const { isAdsEnabled } = await import("./adsense");
    expect(isAdsEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("VITE_ADS_ENABLED=true → true", async () => {
    vi.stubEnv("VITE_ADS_ENABLED", "true");
    const { isAdsEnabled } = await import("./adsense");
    expect(isAdsEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("getSlot", () => {
  it("PLAY_BOTTOM 슬롯 기본값 반환", async () => {
    const { getSlot } = await import("./adsense");
    expect(typeof getSlot("PLAY_BOTTOM")).toBe("string");
  });

  it("BLOG_LIST_LEFT·BLOG_POST_RIGHT·DASH_BOTTOM 등 10개 키 영역 반환", async () => {
    const { getSlot } = await import("./adsense");
    const keys = [
      "PLAY_BOTTOM",
      "BLOG_LIST_LEFT",
      "BLOG_LIST_RIGHT",
      "BLOG_LIST_INFEED",
      "BLOG_LIST_MOBILE",
      "BLOG_POST_LEFT",
      "BLOG_POST_RIGHT",
      "BLOG_POST_MOBILE",
      "DASH_INFEED",
      "DASH_BOTTOM",
    ] as const;
    for (const k of keys) {
      expect(typeof getSlot(k)).toBe("string");
    }
  });
});
