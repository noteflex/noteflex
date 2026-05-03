import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── VITE_ADS_ENABLED 환경변수 mock ─────────────────────────
vi.mock("./adsense", () => ({
  isAdsEnabled: () => true,
}));

import { onAdGameEnd, resetAdGameCount } from "./adInterstitial";

// ─── localStorage mock ───────────────────────────────────────
let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => store[key] ?? null);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
    store[key] = String(value);
  });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => {
    delete store[key];
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("onAdGameEnd — 3게임 카운트", () => {
  it("1게임 → false, 카운트 1", () => {
    expect(onAdGameEnd(false)).toBe(false);
    expect(store["noteflex.adGameCount"]).toBe("1");
  });

  it("2게임 → false, 카운트 2", () => {
    onAdGameEnd(false);
    expect(onAdGameEnd(false)).toBe(false);
    expect(store["noteflex.adGameCount"]).toBe("2");
  });

  it("3게임 → true, 카운트 리셋 0", () => {
    onAdGameEnd(false);
    onAdGameEnd(false);
    expect(onAdGameEnd(false)).toBe(true);
    expect(store["noteflex.adGameCount"]).toBe("0");
  });

  it("리셋 후 다시 3게임 → true", () => {
    onAdGameEnd(false); onAdGameEnd(false); onAdGameEnd(false); // reset
    onAdGameEnd(false); onAdGameEnd(false);
    expect(onAdGameEnd(false)).toBe(true);
    expect(store["noteflex.adGameCount"]).toBe("0");
  });
});

describe("onAdGameEnd — justPassed (잠금 해제)", () => {
  it("justPassed=true → 즉시 true, 카운트 리셋", () => {
    expect(onAdGameEnd(true)).toBe(true);
    expect(store["noteflex.adGameCount"]).toBe("0");
  });

  it("카운트 2 + justPassed=true → true 1번만 (중복 방지)", () => {
    onAdGameEnd(false); onAdGameEnd(false);
    expect(onAdGameEnd(true)).toBe(true);
    expect(store["noteflex.adGameCount"]).toBe("0");
  });

  it("카운트 3 + justPassed=true → true 1번만 (중복 방지)", () => {
    onAdGameEnd(false); onAdGameEnd(false);
    // 3번째이자 justPassed=true → 1번 트리거, 카운트 0
    expect(onAdGameEnd(true)).toBe(true);
    expect(store["noteflex.adGameCount"]).toBe("0");
  });
});

describe("resetAdGameCount", () => {
  it("카운트 2 상태에서 리셋 → 0", () => {
    onAdGameEnd(false); onAdGameEnd(false);
    resetAdGameCount();
    expect(store["noteflex.adGameCount"]).toBe("0");
  });
});
