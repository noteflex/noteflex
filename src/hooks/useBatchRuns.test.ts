import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useBatchRuns } from "./useBatchRuns";

const { mockSelect, mockGte, mockOrder, mockRpc } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockGte: vi.fn(),
  mockOrder: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnValue({
        gte: mockGte.mockReturnValue({
          order: mockOrder,
        }),
      }),
    })),
    rpc: mockRpc,
  },
}));

describe("useBatchRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로드 성공 시 runs 업데이트", async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: "run-1",
          run_date: "2026-04-22",
          users_analyzed: 10,
          weakness_flagged: 5,
          mastery_flagged: 2,
          weakness_released: 1,
          premium_expired: 0,
          duration_ms: 500,
          status: "success",
          error_message: null,
          created_at: "2026-04-22T15:00:00Z",
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useBatchRuns());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.runs).toHaveLength(1);
    expect(result.current.runs[0].status).toBe("success");
    expect(result.current.error).toBeNull();
  });

  it("DB 에러 시 error 상태 업데이트", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    const { result } = renderHook(() => useBatchRuns());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("permission denied");
    expect(result.current.runs).toEqual([]);
  });

  it("summary: 성공/실패 카운트", async () => {
    mockOrder.mockResolvedValue({
      data: [
        { id: "1", run_date: "2026-04-22", status: "success", duration_ms: 100, users_analyzed: 5, weakness_flagged: 1, mastery_flagged: 0, weakness_released: 0, premium_expired: 0, error_message: null, created_at: "2026-04-22T15:00:00Z" },
        { id: "2", run_date: "2026-04-21", status: "success", duration_ms: 200, users_analyzed: 5, weakness_flagged: 1, mastery_flagged: 0, weakness_released: 0, premium_expired: 1, error_message: null, created_at: "2026-04-21T15:00:00Z" },
        { id: "3", run_date: "2026-04-20", status: "failed", duration_ms: 0, users_analyzed: 0, weakness_flagged: 0, mastery_flagged: 0, weakness_released: 0, premium_expired: 0, error_message: "timeout", created_at: "2026-04-20T15:00:00Z" },
      ],
      error: null,
    });

    const { result } = renderHook(() => useBatchRuns());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.summary.totalRuns).toBe(3);
    expect(result.current.summary.successCount).toBe(2);
    expect(result.current.summary.failedCount).toBe(1);
    expect(result.current.summary.last7DaysAvgDurationMs).toBe(150);
    expect(result.current.summary.lastRunStatus).toBe("success");
    expect(result.current.summary.lastRunDate).toBe("2026-04-22");
  });

  it("triggerManualRun 성공", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: "new-run-id", error: null });

    const { result } = renderHook(() => useBatchRuns());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const res = await result.current.triggerManualRun();
    expect(res.success).toBe(true);
    expect(res.message).toContain("new-run-id");
  });

  it("triggerManualRun: 오늘 이미 실행된 경우 (data=null)", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useBatchRuns());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const res = await result.current.triggerManualRun();
    expect(res.success).toBe(false);
    expect(res.message).toContain("이미");
  });

  it("triggerManualRun 에러", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "function not found" },
    });

    const { result } = renderHook(() => useBatchRuns());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const res = await result.current.triggerManualRun();
    expect(res.success).toBe(false);
    expect(res.message).toBe("function not found");
  });

  it("빈 배열일 때 summary 안전", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useBatchRuns());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.summary.totalRuns).toBe(0);
    expect(result.current.summary.successCount).toBe(0);
    expect(result.current.summary.last7DaysAvgDurationMs).toBe(0);
    expect(result.current.summary.lastRunStatus).toBeNull();
  });
});
