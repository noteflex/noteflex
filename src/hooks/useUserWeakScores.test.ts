import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { mockFrom, mockSelect, mockEqUser, mockEqLevel, mockEqSublevel, mockUseAuth } =
  vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockSelect: vi.fn(),
    mockEqUser: vi.fn(),
    mockEqLevel: vi.fn(),
    mockEqSublevel: vi.fn(),
    mockUseAuth: vi.fn(),
  }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mockFrom.mockImplementation(() => ({
      select: mockSelect.mockReturnValue({
        eq: mockEqUser.mockReturnValue({
          eq: mockEqLevel.mockReturnValue({
            eq: mockEqSublevel,
          }),
        }),
      }),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

import { useUserWeakScores, getWeakScore } from "./useUserWeakScores";

describe("useUserWeakScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본은 로그인 + Premium
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      profile: { is_premium: true },
    });
  });

  it("level=0 (custom 모드) → 빈 Map, fetch 안 함", async () => {
    const { result } = renderHook(() => useUserWeakScores(0, 0));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.weakScoreMap.size).toBe(0);
    expect(result.current.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("비로그인 → 빈 Map, fetch 안 함", async () => {
    mockUseAuth.mockReturnValue({ user: null, profile: null });

    const { result } = renderHook(() => useUserWeakScores(1, 1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.weakScoreMap.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("Free 사용자 → 빈 Map, fetch 안 함 (비용 절약)", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      profile: { is_premium: false, subscription_tier: "free", role: null },
    });

    const { result } = renderHook(() => useUserWeakScores(1, 1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.weakScoreMap.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("Premium 사용자 → SELECT 결과를 Map으로 변환", async () => {
    mockEqSublevel.mockResolvedValue({
      data: [
        {
          note_id: "treble:F#4",
          accuracy_score: 0.4,
          response_time_score: 0.6,
          combined_score: 0.5,
          sample_size: 12,
        },
        {
          note_id: "bass:C3",
          accuracy_score: 0.2,
          response_time_score: 0.3,
          combined_score: 0.25,
          sample_size: 8,
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useUserWeakScores(2, 3));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith("user_note_weak_scores");
    expect(mockEqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockEqLevel).toHaveBeenCalledWith("level", 2);
    expect(mockEqSublevel).toHaveBeenCalledWith("sublevel", 3);

    expect(result.current.weakScoreMap.size).toBe(2);
    expect(result.current.weakScoreMap.get("treble:F#4")).toEqual({
      accuracy_score: 0.4,
      response_time_score: 0.6,
      combined_score: 0.5,
      sample_size: 12,
    });
    expect(result.current.weakScoreMap.get("bass:C3")?.combined_score).toBe(0.25);
    expect(result.current.error).toBeNull();
  });

  it("admin 사용자 (role=admin) → Premium처럼 fetch 수행", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "admin-1" },
      profile: { is_premium: false, role: "admin" },
    });
    mockEqSublevel.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useUserWeakScores(1, 1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith("user_note_weak_scores");
    expect(result.current.weakScoreMap.size).toBe(0);
  });

  it("error 케이스 → 빈 Map + error 메시지, 게임 차단 X", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockEqSublevel.mockResolvedValue({
      data: null,
      error: { message: "RLS policy violation", code: "42501" },
    });

    const { result } = renderHook(() => useUserWeakScores(1, 1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.weakScoreMap.size).toBe(0);
    expect(result.current.error).toBe("RLS policy violation");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

describe("getWeakScore", () => {
  it("키 매칭되면 entry 반환", () => {
    const map = new Map([
      [
        "treble:F#4",
        {
          accuracy_score: 0.4,
          response_time_score: 0.6,
          combined_score: 0.5,
          sample_size: 12,
        },
      ],
    ]);

    const entry = getWeakScore(map, "treble", "F#4");
    expect(entry?.combined_score).toBe(0.5);
  });

  it("키 없으면 undefined", () => {
    const map = new Map();
    expect(getWeakScore(map, "bass", "C3")).toBeUndefined();
  });
});
