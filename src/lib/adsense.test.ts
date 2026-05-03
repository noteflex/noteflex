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
  it("BANNER 슬롯 기본값 반환", async () => {
    const { getSlot } = await import("./adsense");
    expect(typeof getSlot("BANNER")).toBe("string");
  });

  it("INTERSTITIAL 슬롯 기본값 반환", async () => {
    const { getSlot } = await import("./adsense");
    expect(typeof getSlot("INTERSTITIAL")).toBe("string");
  });
});
