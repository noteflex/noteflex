import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { mockSelect, mockEq, mockOr, mockOrder, mockUseAuth } = vi.hoisted(
  () => ({
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockOr: vi.fn(),
    mockOrder: vi.fn(),
    mockUseAuth: vi.fn(),
  })
);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          or: mockOr.mockReturnValue({
            order: mockOrder,
          }),
        }),
      }),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

import { useMasteryDetails } from "./useMasteryDetails";

const sampleRow = (overrides: Record<string, unknown> = {}) => ({
  note_key: "F4",
  clef: "treble",
  total_attempts: 20,
  correct_count: 10,
  recent_accuracy: 0.5,
  avg_reaction_ms: 3500,
  weakness_flag: false,
  mastery_flag: false,
  weakness_flagged_at: null,
  mastery_flagged_at: null,
  last_batch_analyzed_at: "2026-04-22T15:00:00Z",
  ...overrides,
});

describe("useMasteryDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
  });

  it("user 없으면 빈 배열 반환 (쿼리 안 함)", async () => {
    mockUseAuth.mockReturnValue({ user: null });
    mockOrder.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useMasteryDetails());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weaknesses).toEqual([]);
    expect(result.current.masters).toEqual([]);
    expect(result.current.lastAnalyzedAt).toBeNull();
    expect(result.current.error).toBeNull();
    expect(mockOrder).not.toHaveBeenCalled();
  });

  it("쿼리 성공 시 weakness/master 분류", async () => {
    mockOrder.mockResolvedValue({
      data: [
        sampleRow({
          note_key: "F4",
          clef: "treble",
          weakness_flag: true,
          recent_accuracy: 0.45,
        }),
        sampleRow({
          note_key: "C#5",
          clef: "treble",
          weakness_flag: true,
          recent_accuracy: 0.55,
        }),
        sampleRow({
          note_key: "E4",
          clef: "treble",
          mastery_flag: true,
          recent_accuracy: 0.98,
        }),
        sampleRow({
          note_key: "A4",
          clef: "treble",
          mastery_flag: true,
          recent_accuracy: 0.97,
        }),
      ],
      error: null,
    });

    const { result } = renderHook(() => useMasteryDetails());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.weaknesses).toHaveLength(2);
    expect(result.current.weaknesses[0].note_key).toBe("F4");
    expect(result.current.masters).toHaveLength(2);
    expect(result.current.masters.map((m) => m.note_key).sort()).toEqual([
      "A4",
      "E4",
    ]);
    expect(result.current.error).toBeNull();
  });

  it("lastAnalyzedAt: 여러 row 중 가장 최신 시각 채택", async () => {
    mockOrder.mockResolvedValue({
      data: [
        sampleRow({
          note_key: "F4",
          weakness_flag: true,
          last_batch_analyzed_at: "2026-04-20T15:00:00Z",
        }),
        sampleRow({
          note_key: "G4",
          weakness_flag: true,
          last_batch_analyzed_at: "2026-04-23T15:00:00Z",
        }),
        sampleRow({
          note_key: "A4",
          mastery_flag: true,
          last_batch_analyzed_at: "2026-04-22T15:00:00Z",
        }),
      ],
      error: null,
    });

    const { result } = renderHook(() => useMasteryDetails());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.lastAnalyzedAt).toEqual(
      new Date("2026-04-23T15:00:00Z")
    );
  });

  it("쿼리 실패 시 error 상태", async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    const { result } = renderHook(() => useMasteryDetails());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("permission denied");
    expect(result.current.weaknesses).toEqual([]);
    expect(result.current.masters).toEqual([]);
  });

  it("refresh 호출 시 재쿼리 발생", async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useMasteryDetails());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockOrder).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockOrder).toHaveBeenCalledTimes(2);
  });
});
