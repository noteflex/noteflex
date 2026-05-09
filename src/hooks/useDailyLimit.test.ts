import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useDailyLimit } from "./useDailyLimit";

// Supabase 모킹
const mockRpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// AuthContext 모킹
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function getUtcToday(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

describe("useDailyLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("Premium (pro)", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: "u-premium" },
        profile: { is_premium: true },
      });
    });

    it("limit = Infinity, hasReached = false 무조건", async () => {
      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.limit).toBe(Infinity);
      expect(result.current.hasReached).toBe(false);
      expect(result.current.todayCount).toBe(0);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("recordSession() = no-op (RPC 호출 X)", async () => {
      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.recordSession();
      });

      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("Free", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: "u-free" },
        profile: { subscription_tier: "free", is_premium: false },
      });
    });

    it("초기 todayCount = get_today_session_count RPC 결과", async () => {
      mockRpc.mockResolvedValue({ data: 3, error: null });

      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.todayCount).toBe(3);
      expect(result.current.limit).toBe(7);
      expect(result.current.hasReached).toBe(false);
      expect(mockRpc).toHaveBeenCalledWith("get_today_session_count");
    });

    it("todayCount = 7 → hasReached true", async () => {
      mockRpc.mockResolvedValue({ data: 7, error: null });

      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.todayCount).toBe(7));

      expect(result.current.hasReached).toBe(true);
    });

    it("recordSession() → increment_daily_session RPC 호출 + todayCount 갱신", async () => {
      mockRpc
        .mockResolvedValueOnce({ data: 4, error: null }) // 초기 fetch
        .mockResolvedValueOnce({ data: 5, error: null }); // increment

      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.todayCount).toBe(4));

      await act(async () => {
        await result.current.recordSession();
      });

      expect(mockRpc).toHaveBeenNthCalledWith(2, "increment_daily_session");
      expect(result.current.todayCount).toBe(5);
    });
  });

  describe("Guest (비로그인)", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: null, profile: null });
    });

    it("localStorage 비어있음 → todayCount = 0", async () => {
      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.todayCount).toBe(0);
      expect(result.current.limit).toBe(3);
      expect(result.current.hasReached).toBe(false);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("localStorage 'noteflex.guest_daily.{utcToday}' = 2 → todayCount = 2", async () => {
      const today = getUtcToday();
      localStorage.setItem(`noteflex.guest_daily.${today}`, "2");

      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.todayCount).toBe(2);
      expect(result.current.hasReached).toBe(false);
    });

    it("3회 도달 → hasReached true", async () => {
      const today = getUtcToday();
      localStorage.setItem(`noteflex.guest_daily.${today}`, "3");

      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.todayCount).toBe(3));

      expect(result.current.hasReached).toBe(true);
    });

    it("recordSession() → localStorage count +1 + todayCount 갱신", async () => {
      const today = getUtcToday();
      localStorage.setItem(`noteflex.guest_daily.${today}`, "1");

      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.todayCount).toBe(1));

      await act(async () => {
        await result.current.recordSession();
      });

      expect(result.current.todayCount).toBe(2);
      expect(localStorage.getItem(`noteflex.guest_daily.${today}`)).toBe("2");
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("다른 날짜 키 cleanup", async () => {
      const today = getUtcToday();
      localStorage.setItem("noteflex.guest_daily.2020-01-01", "999");
      localStorage.setItem(`noteflex.guest_daily.${today}`, "1");

      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.todayCount).toBe(1));

      expect(localStorage.getItem("noteflex.guest_daily.2020-01-01")).toBeNull();
      expect(localStorage.getItem(`noteflex.guest_daily.${today}`)).toBe("1");
    });
  });

  describe("timeUntilResetMs", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: null, profile: null });
    });

    it("UTC 자정까지 남은 시간 (양수, 24시간 이내)", async () => {
      const { result } = renderHook(() => useDailyLimit());
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.timeUntilResetMs).toBeGreaterThan(0);
      expect(result.current.timeUntilResetMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });
  });
});
