import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useLevelProgress } from "./useLevelProgress";

// Supabase 모킹
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// AuthContext 모킹
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useLevelProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // from().select().eq() 체인 셋업
    mockEq.mockResolvedValue({ data: [], error: null });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    // 기본: 로그인된 사용자
    mockUseAuth.mockReturnValue({ user: { id: "user-123" } });
  });

  it("user가 없으면 progress 비어있음", async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useLevelProgress());

    await waitFor(() => {
      expect(result.current.progress).toEqual([]);
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("마운트 시 fetchProgress 자동 호출", async () => {
    const fakeData = [
      {
        level: 1,
        sublevel: 1,
        play_count: 3,
        best_streak: 5,
        total_attempts: 30,
        total_correct: 27,
        passed: false,
      },
    ];
    mockEq.mockResolvedValue({ data: fakeData, error: null });

    const { result } = renderHook(() => useLevelProgress());

    await waitFor(() => {
      expect(result.current.progress).toHaveLength(1);
    });

    expect(mockFrom).toHaveBeenCalledWith("user_sublevel_progress");
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-123");
  });

  it("getProgressFor: 특정 단계 진도 조회", async () => {
    const fakeData = [
      {
        level: 1,
        sublevel: 1,
        play_count: 5,
        best_streak: 5,
        total_attempts: 50,
        total_correct: 45,
        passed: true,
      },
      {
        level: 1,
        sublevel: 2,
        play_count: 0,
        best_streak: 0,
        total_attempts: 0,
        total_correct: 0,
        passed: false,
      },
    ];
    mockEq.mockResolvedValue({ data: fakeData, error: null });

    const { result } = renderHook(() => useLevelProgress());

    await waitFor(() => {
      expect(result.current.progress).toHaveLength(2);
    });

    const lv11 = result.current.getProgressFor(1, 1);
    expect(lv11?.passed).toBe(true);

    const lv12 = result.current.getProgressFor(1, 2);
    expect(lv12?.passed).toBe(false);

    const lv21 = result.current.getProgressFor(2, 1);
    expect(lv21).toBe(null);
  });

  it("recordAttempt: RPC 호출 후 fetch 재실행", async () => {
    const initialData = [
      {
        level: 1,
        sublevel: 1,
        play_count: 4,
        best_streak: 5,
        total_attempts: 40,
        total_correct: 36,
        passed: false,
      },
    ];
    const updatedData = [
      {
        level: 1,
        sublevel: 1,
        play_count: 5,
        best_streak: 5,
        total_attempts: 50,
        total_correct: 45,
        passed: true,
      },
      {
        level: 1,
        sublevel: 2,
        play_count: 0,
        best_streak: 0,
        total_attempts: 0,
        total_correct: 0,
        passed: false,
      },
    ];

    mockEq
      .mockResolvedValueOnce({ data: initialData, error: null }) // 첫 fetch
      .mockResolvedValueOnce({ data: updatedData, error: null }); // recordAttempt 후 refetch

    mockRpc.mockResolvedValue({
      data: {
        level: 1,
        sublevel: 1,
        play_count: 5,
        accuracy: 0.9,
        best_streak: 5,
        passed: true,
        just_passed: true,
      },
      error: null,
    });

    const { result } = renderHook(() => useLevelProgress());

    await waitFor(() => {
      expect(result.current.progress).toHaveLength(1);
    });

    let res;
    await act(async () => {
      res = await result.current.recordAttempt(1, 1, 10, 9, 6, "success");
    });

    expect(mockRpc).toHaveBeenCalledWith("record_sublevel_attempt", {
      p_level: 1,
      p_sublevel: 1,
      p_attempts: 10,
      p_correct: 9,
      p_max_streak: 6,
      p_game_status: "success",
    });

    expect(res).toMatchObject({ passed: true, just_passed: true });

    await waitFor(() => {
      expect(result.current.progress).toHaveLength(2); // refetch 결과
    });
  });

  it("recordAttempt: user 없으면 null 반환", async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useLevelProgress());

    let res;
    await act(async () => {
      res = await result.current.recordAttempt(1, 1, 10, 9, 6, "success");
    });

    expect(res).toBe(null);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fetch 에러 시 error state 설정", async () => {
    mockEq.mockResolvedValue({
      data: null,
      error: { message: "RLS denied" },
    });

    const { result } = renderHook(() => useLevelProgress());

    await waitFor(() => {
      expect(result.current.error).toBe("RLS denied");
    });
  });
});