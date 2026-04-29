import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoteGame from "./NoteGame";

/**
 * §0.1 호출 횟수 invariant — handleAnswer 한 번에 retry queue 메서드가 정확히 N번 호출됨.
 *
 * 회귀 방지: 코드 리팩토링이나 useEffect 추가 시 같은 메서드가 중복 호출되어
 * 상태 일관성이 깨지는 일을 막는다.
 *
 * 검증:
 *  - 정답 1번 → markJustAnswered 1회. wasRetry=false면 rescheduleAfterCorrect 1회 (resolve 0).
 *  - 오답 1번 → markMissed 1회 (markJustAnswered/rescheduleAfterCorrect 0).
 *  - 같은 자리 또 클릭 → 추가 호출 (정답 click 수만큼).
 */

const mockMarkMissed = vi.fn();
const mockMarkJustAnswered = vi.fn();
const mockRescheduleAfterCorrect = vi.fn();
const mockResolve = vi.fn();
const mockPopDueOrNull = vi.fn();
const mockReset = vi.fn();
const mockHas = vi.fn();
const mockScheduleRetry = vi.fn();

vi.mock("@/hooks/useRetryQueue", () => ({
  useRetryQueue: () => ({
    size: 0,
    snapshot: [],
    scheduleRetry: mockScheduleRetry,
    markMissed: mockMarkMissed,
    markJustAnswered: mockMarkJustAnswered,
    rescheduleAfterCorrect: mockRescheduleAfterCorrect,
    resolve: mockResolve,
    popDueOrNull: mockPopDueOrNull,
    reset: mockReset,
    has: mockHas,
  }),
}));

vi.mock("@/hooks/useNoteLogger", () => ({
  useNoteLogger: () => ({ logNote: vi.fn() }),
}));

vi.mock("@/hooks/useSessionRecorder", () => ({
  useSessionRecorder: () => ({
    isRecording: false,
    startSession: vi.fn(),
    endSession: vi.fn().mockResolvedValue(null),
    cancelSession: vi.fn(),
    recordNote: vi.fn(),
  }),
}));

vi.mock("@/hooks/useUserMastery", () => ({
  useUserMastery: () => ({ masteryMap: new Map(), loading: false, lastAnalyzedAt: null }),
}));

vi.mock("@/lib/sound", () => ({
  playNote: vi.fn(),
  playWrong: vi.fn(),
  isSamplerReady: () => true,
  initSound: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" }, loading: false }),
}));

vi.mock("@/hooks/useLevelProgress", () => ({
  useLevelProgress: () => ({
    progress: [],
    loading: false,
    fetchProgress: vi.fn(),
    recordAttempt: vi.fn().mockResolvedValue(null),
    getProgressFor: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("@/components/practice/GrandStaffPractice", () => ({
  TOTAL_SLOTS: 10,
  GrandStaffPractice: ({ targetNote }: { targetNote: string | null }) => (
    <div data-testid="staff">{targetNote ?? "none"}</div>
  ),
}));

function getCurrentQuestion(): { key: string; octave: string; accidental?: string } | null {
  const el = screen.queryByText(/현재 정답:/);
  if (!el) return null;
  const text = el.textContent ?? "";
  const m = text.match(/현재 정답:\s*([A-G])([#b]?)(\d+)\s*([#b])?/);
  if (!m) return null;
  return { key: m[1], octave: m[3], accidental: (m[2] || m[4]) || undefined };
}

function getCorrectButton(q: { key: string }): HTMLElement {
  return screen.getByLabelText(`${q.key} 선택`);
}

function getWrongButton(q: { key: string }): HTMLElement {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const wrong = letters.find((l) => l !== q.key)!;
  return screen.getByLabelText(`${wrong} 선택`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPopDueOrNull.mockReturnValue(null); // retry 큐 항상 비어있다고 가정 → 일반 batch만
  mockHas.mockReturnValue(false);
  localStorage.setItem("noteflex.solfege_system", "en");
});

describe("§0.1 호출 횟수 invariant", () => {
  it("정답 1번 click → markJustAnswered 1회 + rescheduleAfterCorrect 1회", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q = getCurrentQuestion()!;
    await user.click(getCorrectButton(q));

    expect(mockMarkJustAnswered).toHaveBeenCalledTimes(1);
    expect(mockRescheduleAfterCorrect).toHaveBeenCalledTimes(1);
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockMarkMissed).not.toHaveBeenCalled();
  });

  it("오답 1번 click → markMissed 1회 (다른 메서드 0회)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q = getCurrentQuestion()!;
    await user.click(getWrongButton(q));

    expect(mockMarkMissed).toHaveBeenCalledTimes(1);
    expect(mockMarkJustAnswered).not.toHaveBeenCalled();
    expect(mockRescheduleAfterCorrect).not.toHaveBeenCalled();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("오답 → 같은 자리 정답: markMissed 1회 + markJustAnswered 1회 + rescheduleAfterCorrect 1회", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q = getCurrentQuestion()!;
    await user.click(getWrongButton(q));
    await user.click(getCorrectButton(q));

    expect(mockMarkMissed).toHaveBeenCalledTimes(1);
    expect(mockMarkJustAnswered).toHaveBeenCalledTimes(1);
    expect(mockRescheduleAfterCorrect).toHaveBeenCalledTimes(1);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("정답 3번 연속 click → markJustAnswered 3회, rescheduleAfterCorrect 3회 (각각 정확히 click 수만큼)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    for (let i = 0; i < 3; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await user.click(getCorrectButton(q));
    }

    expect(mockMarkJustAnswered).toHaveBeenCalledTimes(3);
    expect(mockRescheduleAfterCorrect).toHaveBeenCalledTimes(3);
    expect(mockMarkMissed).not.toHaveBeenCalled();
  });

  it("같은 오답 2번 연속 click → markMissed 2회 (각각 정확히 1회씩 누적)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q = getCurrentQuestion()!;
    await user.click(getWrongButton(q));
    await user.click(getWrongButton(q));

    expect(mockMarkMissed).toHaveBeenCalledTimes(2);
  });
});
