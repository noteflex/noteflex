import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoteGame from "./NoteGame";

/**
 * §0.4.1 batchSize=1 history 누적 + 7개 도달 시 화면 리셋.
 *
 * 사용자 결정:
 *  - batchSize=1 stage (Sub 1 stage 1·2, Sub 2 stage 1):
 *      답한 음표를 회색으로 누적, 7개 누적 시 화면 리셋
 *  - batchSize>1 stage:
 *      batch mode로 작동, set 전환 시 history 클리어 (회귀 검증)
 *  - stage 전환 시: 무조건 history 클리어
 */

const { capturedProps } = vi.hoisted(() => ({
  capturedProps: {
    current: { noteHistory: [], batchNotes: [], targetNote: null } as {
      noteHistory: { id: number; note: string }[];
      batchNotes: { note: string }[];
      targetNote: string | null;
    },
  },
}));

vi.mock("@/components/practice/GrandStaffPractice", () => ({
  TOTAL_SLOTS: 8,
  GrandStaffPractice: (props: {
    noteHistory?: { id: number; note: string }[];
    batchNotes?: { note: string }[];
    targetNote?: string | null;
  }) => {
    capturedProps.current = {
      noteHistory: props.noteHistory ?? [],
      batchNotes: props.batchNotes ?? [],
      targetNote: props.targetNote ?? null,
    };
    return <div data-testid="staff">{props.targetNote ?? "none"}</div>;
  },
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
  ensureAudioReady: vi.fn().mockResolvedValue(undefined),
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

vi.mock("@/hooks/useUserEnvOffset", () => ({
  useUserEnvOffset: () => ({
    offsetMs: 0,
    isCalibrated: true,
    needsCalibration: false,
    isLoading: false,
    canSkip: true,
    deviceChanged: false,
    setOffset: vi.fn().mockResolvedValue(undefined),
    clearOffset: vi.fn().mockResolvedValue(undefined),
    skipCalibration: vi.fn(),
    resetDeviceChanged: vi.fn(),
  }),
}));

vi.mock("@/hooks/useDailyLimit", () => ({
  useDailyLimit: () => ({
    todayCount: 0,
    limit: 7,
    hasReached: false,
    timeUntilResetMs: 12 * 60 * 60 * 1000,
    recordSession: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

// CUSTOM_SCORE_STAGES(level=0) 사용 시 필요한 최소 노트 풀.
// stage1 batchSize=1 → history 모드 커버리지 유지에 사용.
const HISTORY_TEST_NOTES = [
  { name: "도", key: "C", y: 0, octave: "4" },
  { name: "레", key: "D", y: 0, octave: "4" },
  { name: "미", key: "E", y: 0, octave: "4" },
  { name: "파", key: "F", y: 0, octave: "4" },
  { name: "솔", key: "G", y: 0, octave: "4" },
  { name: "라", key: "A", y: 0, octave: "4" },
  { name: "시", key: "B", y: 0, octave: "4" },
];

interface CurrentQuestion {
  key: string;
  octave: string;
  accidental?: "#" | "b";
}

function getCurrentQuestion(): CurrentQuestion | null {
  const el = screen.queryByText(/현재 정답:/);
  if (!el) return null;
  const text = el.textContent ?? "";
  const m = text.match(/현재 정답:\s*([A-G])([#b]?)(\d+)\s*([#b])?/);
  if (!m) return null;
  return {
    key: m[1],
    accidental: ((m[2] || m[4]) as "#" | "b" | undefined) || undefined,
    octave: m[3],
  };
}

function makePointerEvent(
  type: string,
  init: PointerEventInit & { clientX: number; clientY: number },
): Event {
  try {
    return new PointerEvent(type, { ...init, bubbles: true, cancelable: true });
  } catch {
    const e = new MouseEvent(type, { ...init, bubbles: true, cancelable: true });
    Object.defineProperty(e, "pointerId", { value: init.pointerId ?? 1 });
    return e;
  }
}

async function swipeAccidental(btn: HTMLElement, accidental: "#" | "b") {
  const dy = accidental === "#" ? -80 : 80;
  await act(async () => {
    btn.dispatchEvent(
      makePointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 50, clientY: 100 }),
    );
    btn.dispatchEvent(
      makePointerEvent("pointermove", { pointerId: 1, clientX: 50, clientY: 100 + dy }),
    );
    btn.dispatchEvent(
      makePointerEvent("pointerup", { pointerId: 1, clientX: 50, clientY: 100 + dy }),
    );
  });
}

async function answerCorrect(
  user: ReturnType<typeof userEvent.setup>,
  q: CurrentQuestion,
): Promise<boolean> {
  const naturalBtn = screen.queryByLabelText(`${q.key} 선택`);
  if (naturalBtn && !(naturalBtn as HTMLButtonElement).disabled) {
    if (q.accidental === "#" || q.accidental === "b") {
      await swipeAccidental(naturalBtn, q.accidental);
    } else {
      await user.click(naturalBtn);
    }
    return true;
  }
  if (q.accidental) {
    const labelled = screen.queryByLabelText(
      `${q.key}${q.accidental === "#" ? "♯" : "♭"} 선택`,
    );
    if (labelled && !(labelled as HTMLButtonElement).disabled) {
      await user.click(labelled);
      return true;
    }
  }
  return false;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("§0.4.1 batchSize=1 history 누적 + 화면 리셋", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("noteflex.solfege_system", "en");
    capturedProps.current = { noteHistory: [], batchNotes: [], targetNote: null };
  });

  it("CUSTOM stage1 (batchSize=1): 정답 4개 답 후 noteHistory 길이 4", async () => {
    const user = userEvent.setup();
    // CUSTOM_SCORE_STAGES stage1: batchSize=1 → history 모드
    render(<NoteGame level={0} customNotes={HISTORY_TEST_NOTES} sublevel={1} skipCountdown />);
    await settle();

    for (let i = 1; i <= 4; i++) {
      const q = getCurrentQuestion();
      expect(q, `${i}번째 음표 표시 안 됨`).not.toBeNull();
      const ok = await answerCorrect(user, q!);
      expect(ok, `${i}번째 답 입력 실패`).toBe(true);
      await settle();
    }

    expect(capturedProps.current.noteHistory.length).toBe(4);
    // batchSize=1이므로 batchNotes prop 미사용
    expect(capturedProps.current.batchNotes.length).toBe(0);
  });

  it("CUSTOM stage1 (batchSize=1): set 전환 후 history 유지 (클리어 X)", async () => {
    const user = userEvent.setup();
    // CUSTOM_SCORE_STAGES stage1: notesPerSet=3, 3번째 정답 시 set 2 시작
    render(<NoteGame level={0} customNotes={HISTORY_TEST_NOTES} sublevel={1} skipCountdown />);
    await settle();

    const q1 = getCurrentQuestion();
    expect(q1).not.toBeNull();
    await answerCorrect(user, q1!);
    await settle();
    expect(capturedProps.current.noteHistory.length).toBe(1);

    const q2 = getCurrentQuestion();
    expect(q2).not.toBeNull();
    await answerCorrect(user, q2!);
    await settle();
    expect(capturedProps.current.noteHistory.length).toBe(2);

    // 3번째 정답 → set 1 완료, set 2 시작. history 유지돼야 함.
    const q3 = getCurrentQuestion();
    expect(q3).not.toBeNull();
    await answerCorrect(user, q3!);
    await settle();
    expect(capturedProps.current.noteHistory.length).toBe(3);
  });

  it("Lv1 Sub1: stage 전환 시 history 클리어", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);
    await settle();

    // stage1 = 5 sets × 1 note = 5 답. 5번째 답 시 stage 전환.
    for (let i = 0; i < 5; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await answerCorrect(user, q!);
      await settle();
    }

    // stage 전환 후 noteHistory는 클리어돼야 함
    expect(capturedProps.current.noteHistory.length).toBe(0);
  });

  it("Lv1 Sub1 stage3 (batchSize=3): batch mode 작동 (batchNotes 사용)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);
    await settle();

    // stage1 (5) + stage2 (6) + stage3 (7) = 18개 답 후 stage4 진입.
    for (let i = 0; i < 18; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await answerCorrect(user, q!);
      await settle();
    }

    // stage4 = batchSize=3 → batchNotes 사용
    expect(capturedProps.current.batchNotes.length).toBe(3);
  });
});

describe("§0.4.1 visibleNoteCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("noteflex.solfege_system", "en");
    capturedProps.current = { noteHistory: [], batchNotes: [], targetNote: null };
  });

  function getVisibleCount(): number {
    const el = screen.queryByTestId("game-debug-state");
    const m = el?.textContent?.match(/visible:\s*(\d+)/);
    return m ? parseInt(m[1], 10) : -1;
  }

  it("history 모드 초기: visibleNoteCount=1 (history 0 + target 1)", async () => {
    // CUSTOM_SCORE_STAGES stage1 (batchSize=1) → history 모드
    render(<NoteGame level={0} customNotes={HISTORY_TEST_NOTES} sublevel={1} skipCountdown />);
    await settle();
    expect(getVisibleCount()).toBe(1);
  });

  it("history 모드 3개 정답 후: visibleNoteCount=4", async () => {
    const user = userEvent.setup();
    // CUSTOM_SCORE_STAGES stage1 (batchSize=1) → history 모드
    render(<NoteGame level={0} customNotes={HISTORY_TEST_NOTES} sublevel={1} skipCountdown />);
    await settle();

    for (let i = 0; i < 3; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await answerCorrect(user, q!);
      await settle();
    }

    expect(getVisibleCount()).toBe(4);
  });

  it("batch 모드 진입 후: visibleNoteCount = batchSize (answeredNotes 누적 안 함)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);
    await settle();

    // stage1(5) + stage2(6) + stage3(7) = 18 answers to reach stage4 (batchSize=3)
    for (let i = 0; i < 18; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await answerCorrect(user, q!);
      await settle();
    }

    // stage4 = batchSize=3 → visibleNoteCount=3
    expect(getVisibleCount()).toBe(3);
  });

  it("batch 모드에서 1개 정답 후: visibleNoteCount 여전히 batchSize (answeredNotes 0 유지)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);
    await settle();

    for (let i = 0; i < 18; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await answerCorrect(user, q!);
      await settle();
    }

    // stage4 batchSize=3 진입, 1개 정답
    const q = getCurrentQuestion();
    if (q) {
      await answerCorrect(user, q);
      await settle();
    }

    // answeredNotes는 0 유지 → visibleNoteCount = 0 + 3 = 3
    expect(getVisibleCount()).toBe(3);
  });
});
