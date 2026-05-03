import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockGetOffset, capturedInsert } = vi.hoisted(() => ({
  mockGetOffset: vi.fn<[], number>().mockReturnValue(0),
  capturedInsert: { value: null as Record<string, unknown> | null },
}));

vi.mock("@/lib/userEnvironmentOffset", () => ({
  getUserEnvOffset: () => mockGetOffset(),
  clampReactionMs: (rawMs: number, offsetMs: number) => Math.max(0, rawMs - offsetMs),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" }, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (data: Record<string, unknown>) => {
        capturedInsert.value = data;
        return {
          select: () => ({
            single: () =>
              Promise.resolve({ data: { id: "session-1" }, error: null }),
          }),
        };
      },
    }),
  },
}));

import { useSessionRecorder } from "./useSessionRecorder";

const makeAttempt = (reactionMs: number, correct = true) => ({
  note: "C4",
  correct,
  reactionMs,
  clef: "treble" as const,
});

describe("useSessionRecorder - recordNote offset correction (§7.3.4)", () => {
  beforeEach(() => {
    capturedInsert.value = null;
    mockGetOffset.mockReturnValue(0);
  });

  it("offset=0 → corrected == raw", async () => {
    mockGetOffset.mockReturnValue(0);
    const { result } = renderHook(() => useSessionRecorder());

    act(() => result.current.startSession(1));
    act(() => result.current.recordNote(makeAttempt(300)));
    await act(() => result.current.endSession("completed"));

    const attempts = (capturedInsert.value as any)?.note_attempts as any[];
    expect(attempts[0].reaction_ms).toBe(300);
    expect(attempts[0].reaction_ms_raw).toBe(300);
  });

  it("offset=200, raw=300 → corrected=100", async () => {
    mockGetOffset.mockReturnValue(200);
    const { result } = renderHook(() => useSessionRecorder());

    act(() => result.current.startSession(1));
    act(() => result.current.recordNote(makeAttempt(300)));
    await act(() => result.current.endSession("completed"));

    const attempts = (capturedInsert.value as any)?.note_attempts as any[];
    expect(attempts[0].reaction_ms).toBe(100);
    expect(attempts[0].reaction_ms_raw).toBe(300);
  });

  it("offset=200, raw=100 → corrected=0 (clamp)", async () => {
    mockGetOffset.mockReturnValue(200);
    const { result } = renderHook(() => useSessionRecorder());

    act(() => result.current.startSession(1));
    act(() => result.current.recordNote(makeAttempt(100)));
    await act(() => result.current.endSession("completed"));

    const attempts = (capturedInsert.value as any)?.note_attempts as any[];
    expect(attempts[0].reaction_ms).toBe(0);
    expect(attempts[0].reaction_ms_raw).toBe(100);
  });

  it("summary.avg_reaction_ms_raw = raw 평균, offset_ms_applied = 현재 offset", async () => {
    mockGetOffset.mockReturnValue(150);
    const { result } = renderHook(() => useSessionRecorder());

    act(() => result.current.startSession(1));
    act(() => result.current.recordNote(makeAttempt(300)));
    act(() => result.current.recordNote(makeAttempt(500)));
    await act(() => result.current.endSession("completed"));

    const summary = (capturedInsert.value as any)?.summary;
    expect(summary.avg_reaction_ms_raw).toBe(400); // (300+500)/2
    expect(summary.offset_ms_applied).toBe(150);
  });

  it("avg_reaction_ms(DB 컬럼) = corrected 평균", async () => {
    mockGetOffset.mockReturnValue(100);
    const { result } = renderHook(() => useSessionRecorder());

    act(() => result.current.startSession(1));
    act(() => result.current.recordNote(makeAttempt(400))); // corrected=300
    act(() => result.current.recordNote(makeAttempt(600))); // corrected=500
    await act(() => result.current.endSession("completed"));

    const avgReactionMs = (capturedInsert.value as any)?.avg_reaction_ms;
    expect(avgReactionMs).toBe(400); // (300+500)/2
  });

  it("오답 attempt도 offset 차감 적용", async () => {
    mockGetOffset.mockReturnValue(100);
    const { result } = renderHook(() => useSessionRecorder());

    act(() => result.current.startSession(1));
    act(() => result.current.recordNote(makeAttempt(250, false)));
    await act(() => result.current.endSession("gameover"));

    const attempts = (capturedInsert.value as any)?.note_attempts as any[];
    expect(attempts[0].reaction_ms).toBe(150);
    expect(attempts[0].reaction_ms_raw).toBe(250);
  });
});
