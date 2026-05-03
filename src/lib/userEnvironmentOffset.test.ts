import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getUserEnvOffset,
  setUserEnvOffset,
  clearUserEnvOffset,
  hasStoredOffset,
  clampReactionMs,
  getCalibrationSkippedOnce,
  setCalibrationSkippedOnce,
  syncOffsetToProfile,
  loadOffsetFromProfile,
  DEFAULT_OFFSET_MS,
} from "./userEnvironmentOffset";

// ─── Supabase mock ───────────────────────────────────────────

const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// ─── localStorage mock ────────────────────────────────────────

let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(
    (key) => store[key] ?? null
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(
    (key, value) => { store[key] = String(value); }
  );
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(
    (key) => { delete store[key]; }
  );

  // supabase 체인 기본 셋업
  mockEq.mockResolvedValue({ data: null, error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockSelect.mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) });
  mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect });

  vi.clearAllMocks();
  store = {};

  // re-mock after clearAllMocks
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(
    (key) => store[key] ?? null
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(
    (key, value) => { store[key] = String(value); }
  );
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(
    (key) => { delete store[key]; }
  );
  mockEq.mockResolvedValue({ data: null, error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockSelect.mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) });
  mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── localStorage 기본 동작 ───────────────────────────────────

describe("getUserEnvOffset", () => {
  it("저장값 없으면 DEFAULT_OFFSET_MS(0) 반환", () => {
    expect(getUserEnvOffset()).toBe(DEFAULT_OFFSET_MS);
  });

  it("저장된 값 반환", () => {
    setUserEnvOffset(120);
    expect(getUserEnvOffset()).toBe(120);
  });

  it("숫자가 아닌 값 저장 시 DEFAULT_OFFSET_MS 반환", () => {
    store["noteflex.userEnvOffset"] = "not-a-number";
    expect(getUserEnvOffset()).toBe(DEFAULT_OFFSET_MS);
  });
});

describe("setUserEnvOffset + getUserEnvOffset 일관성", () => {
  it("음수 offset 저장·조회", () => {
    setUserEnvOffset(-50);
    expect(getUserEnvOffset()).toBe(-50);
  });

  it("0 저장·조회", () => {
    setUserEnvOffset(0);
    expect(getUserEnvOffset()).toBe(0);
  });

  it("소수점 저장·조회", () => {
    setUserEnvOffset(12.5);
    expect(getUserEnvOffset()).toBe(12.5);
  });
});

describe("clearUserEnvOffset", () => {
  it("clearUserEnvOffset 후 기본값 복귀", () => {
    setUserEnvOffset(200);
    clearUserEnvOffset();
    expect(getUserEnvOffset()).toBe(DEFAULT_OFFSET_MS);
  });

  it("clearUserEnvOffset 후 hasStoredOffset = false", () => {
    setUserEnvOffset(100);
    clearUserEnvOffset();
    expect(hasStoredOffset()).toBe(false);
  });

  it("clearUserEnvOffset 후 skipKey도 제거", () => {
    setCalibrationSkippedOnce();
    clearUserEnvOffset();
    expect(getCalibrationSkippedOnce()).toBe(false);
  });
});

describe("hasStoredOffset", () => {
  it("저장 전 = false", () => {
    expect(hasStoredOffset()).toBe(false);
  });

  it("저장 후 = true", () => {
    setUserEnvOffset(50);
    expect(hasStoredOffset()).toBe(true);
  });
});

// ─── clampReactionMs (Q-K) ────────────────────────────────────

describe("clampReactionMs", () => {
  it("음수 결과 → 0", () => {
    expect(clampReactionMs(100, 200)).toBe(0);
  });

  it("정확히 0 → 0", () => {
    expect(clampReactionMs(100, 100)).toBe(0);
  });

  it("양수 정상 차감", () => {
    expect(clampReactionMs(300, 100)).toBe(200);
  });

  it("offset=0 이면 raw 그대로", () => {
    expect(clampReactionMs(500, 0)).toBe(500);
  });

  it("rawMs=0, offset=0 → 0", () => {
    expect(clampReactionMs(0, 0)).toBe(0);
  });
});

// ─── calibration skip (Q-E) ──────────────────────────────────

describe("calibration skip", () => {
  it("최초 getCalibrationSkippedOnce = false", () => {
    expect(getCalibrationSkippedOnce()).toBe(false);
  });

  it("setCalibrationSkippedOnce 후 = true", () => {
    setCalibrationSkippedOnce();
    expect(getCalibrationSkippedOnce()).toBe(true);
  });
});

// ─── DB sync ─────────────────────────────────────────────────

describe("syncOffsetToProfile", () => {
  it("supabase update 호출 확인", async () => {
    mockEq.mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect });

    await syncOffsetToProfile("user-1", 150);

    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockUpdate).toHaveBeenCalledWith({ user_env_offset_ms: 150 });
    expect(mockEq).toHaveBeenCalledWith("id", "user-1");
  });

  it("supabase error 시 console.error (throw X)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockEq.mockResolvedValue({ data: null, error: { message: "db error" } });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect });

    await expect(syncOffsetToProfile("user-1", 100)).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
  });
});

describe("loadOffsetFromProfile", () => {
  it("DB에 값 있으면 number 반환", async () => {
    const mockEqChain = vi.fn().mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: { user_env_offset_ms: 80 }, error: null });
    mockSelect.mockReturnValue({ eq: mockEqChain });
    mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect });

    const result = await loadOffsetFromProfile("user-1");
    expect(result).toBe(80);
  });

  it("DB에 null 값이면 null 반환", async () => {
    const mockEqChain = vi.fn().mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: { user_env_offset_ms: null }, error: null });
    mockSelect.mockReturnValue({ eq: mockEqChain });
    mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect });

    const result = await loadOffsetFromProfile("user-1");
    expect(result).toBeNull();
  });

  it("supabase error 시 null 반환 (throw X)", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockEqChain = vi.fn().mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: null, error: { message: "db error" } });
    mockSelect.mockReturnValue({ eq: mockEqChain });
    mockFrom.mockReturnValue({ update: mockUpdate, select: mockSelect });

    const result = await loadOffsetFromProfile("user-1");
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
