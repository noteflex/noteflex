import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoteGame from "./NoteGame";

/**
 * NoteGame 신규 정책 테스트 (오답 시 같은 자리 유지 정책)
 *
 * 정책 요약:
 *  - 오답 시 → 같은 음표 그대로 유지 + lives -1 + retry queue에 마커 등록
 *    · currentIndex 진행 X, turn 증가 X, batch 진행 X
 *    · queue 등록은 "한 번 틀린 적 있다"는 마커. 등록 자체로 출제되지 않음.
 *  - 정답 시 → 다음 음표로 진행 + 큐에 마커가 있던 경우만 N+2 후 재출제로 갱신
 *    · 마커 없던 음표(=오답 이력 없음)는 큐에 등록 안 함 (해석 11=X)
 *  - 재출제(retryOverride)된 음표를 정답하면 → 큐에서 영구 제거 (해석 12=P)
 *  - 재출제된 음표를 또 오답하면 → 같은 자리 유지 + lives -1 + 마커 갱신
 *  - 타이머 만료 = 오답과 동일 처리
 *  - mastery 기록(recordNote)은 정답/오답 매 시도마다 호출
 */

// ────────────────────────────────────────────────
// Mocks (기존 NoteGame.test.tsx 패턴 그대로)
// ────────────────────────────────────────────────
const mockRecordNote = vi.fn();
const mockLogNote = vi.fn();
const mockRecordAttempt = vi.fn().mockResolvedValue(null);

vi.mock("@/hooks/useNoteLogger", () => ({
  useNoteLogger: () => ({ logNote: mockLogNote }),
}));

vi.mock("@/hooks/useSessionRecorder", () => ({
  useSessionRecorder: () => ({
    isRecording: false,
    startSession: vi.fn(),
    endSession: vi.fn().mockResolvedValue(null),
    cancelSession: vi.fn(),
    recordNote: mockRecordNote,
  }),
}));

vi.mock("@/hooks/useUserMastery", () => ({
  useUserMastery: () => ({
    masteryMap: new Map(),
    loading: false,
    lastAnalyzedAt: null,
  }),
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
    recordAttempt: mockRecordAttempt,
    getProgressFor: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("@/components/practice/GrandStaffPractice", () => ({
  TOTAL_SLOTS: 10,
  GrandStaffPractice: ({ targetNote }: { targetNote: string | null }) => (
    <div data-testid="staff">{targetNote ?? "none"}</div>
  ),
}));

// ────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────
function getCurrentQuestion(): { key: string; octave: string; accidental?: string } | null {
  const el = screen.queryByText(/현재 정답:/);
  if (!el) return null;
  const text = el.textContent ?? "";
  const m = text.match(/현재 정답:\s*([A-G])(\d+)\s*([#b])?/);
  if (!m) return null;
  return { key: m[1], octave: m[2], accidental: m[3] };
}

function getCorrectButton(question: { key: string; accidental?: string }): HTMLElement {
  const label = question.accidental
    ? `${question.key}${question.accidental === "#" ? "♯" : "♭"} 선택`
    : `${question.key} 선택`;
  return screen.getByLabelText(label);
}

function getWrongButton(question: { key: string }): HTMLElement {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const wrongLetter = letters.find((l) => l !== question.key)!;
  const btn = screen.queryByLabelText(`${wrongLetter} 선택`);
  if (btn) return btn;
  const btns = screen.getAllByRole("button");
  return btns.find((b) => b.getAttribute("aria-label")?.startsWith(wrongLetter))!;
}

function getDebugQueueSize(): number {
  const text = screen.getByText(/size:\s*\d+/).textContent ?? "";
  const m = text.match(/size:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function getDebugTurn(): number {
  const text = screen.getByText(/turn:\s*\d+/).textContent ?? "";
  const m = text.match(/turn:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// ────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockRecordAttempt.mockResolvedValue(null);
  localStorage.setItem("noteflex.solfege_system", "en");
});

// ────────────────────────────────────────────────
// A. 초기 상태
// ────────────────────────────────────────────────
describe("NoteGame 신규 정책 - 초기 상태", () => {
  it("A. 초기: turn=0, queue size=0, 첫 음표 출제됨", () => {
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    expect(getDebugTurn()).toBe(0);
    expect(getDebugQueueSize()).toBe(0);

    const q = getCurrentQuestion();
    expect(q).not.toBeNull();
    expect(q!.key).toMatch(/[A-G]/);
  });
});

// ────────────────────────────────────────────────
// B. 정답 시 진행 (오답 이력 없음)
// ────────────────────────────────────────────────
describe("NoteGame 신규 정책 - 정답 시 진행", () => {
  it("B. 정상 정답 (오답 이력 없음): turn +1, queue 비어있는 상태 유지", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    await user.click(getCorrectButton(q1));

    expect(getDebugTurn()).toBe(1);
    // 11=X: 오답 이력 없으면 큐에 등록 X
    expect(getDebugQueueSize()).toBe(0);
  });
});

// ────────────────────────────────────────────────
// C, D. 오답 시 같은 자리 유지
// ────────────────────────────────────────────────
describe("NoteGame 신규 정책 - 오답 시 같은 자리 유지", () => {
  it("C. 오답 1회: 같은 음표 그대로 + turn 변동 X + queue size=1", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    await user.click(getWrongButton(q1));

    // 같은 음표가 화면에 그대로
    const qAfter = getCurrentQuestion()!;
    expect(qAfter.key).toBe(q1.key);
    expect(qAfter.octave).toBe(q1.octave);

    // turn 증가 X (advanceToNextTurn 호출 X)
    expect(getDebugTurn()).toBe(0);

    // 마커 등록됨 (해석 10=A)
    expect(getDebugQueueSize()).toBe(1);

    // 게임오버 아님 (lives 5 → 4)
    expect(screen.queryByText(/게임 오버/)).toBeNull();
  });

  it("D. 같은 음표 3회 연속 오답: turn 변동 X · queue size=1 유지(덮어쓰기)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    for (let i = 0; i < 3; i++) {
      await user.click(getWrongButton(q1));
      const qAfter = getCurrentQuestion();
      // sublevel=1는 lives=5라 3번 연속 오답 후에도 화면에 q1 그대로
      expect(qAfter).not.toBeNull();
      expect(qAfter!.key).toBe(q1.key);
      expect(qAfter!.octave).toBe(q1.octave);
    }

    expect(getDebugTurn()).toBe(0);
    // 같은 음표는 동일한 id로 Map.set 덮어쓰기 → 큐 크기 1
    expect(getDebugQueueSize()).toBe(1);
  });
});

// ────────────────────────────────────────────────
// E. 오답 → 정답
// ────────────────────────────────────────────────
describe("NoteGame 신규 정책 - 오답 후 정답 처리", () => {
  it("E. 오답 → 정답: 다음 음표 진행 + 큐 마커는 N+2 후 재출제로 갱신(size 유지)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;

    // 오답 1회
    await user.click(getWrongButton(q1));
    expect(getDebugTurn()).toBe(0);
    expect(getDebugQueueSize()).toBe(1);

    // 같은 자리에서 정답
    await user.click(getCorrectButton(q1));

    // 다음 음표로 진행 (turn +1)
    expect(getDebugTurn()).toBe(1);

    // 큐: 마커는 유지하되 due를 N+2 후로 갱신 → size 그대로 1
    expect(getDebugQueueSize()).toBe(1);
  });
});

// ────────────────────────────────────────────────
// F. 재출제 등장
// ────────────────────────────────────────────────
describe("NoteGame 신규 정책 - 재출제 등장 타이밍", () => {
  it("F. 오답 → 정답 → 정답: turn=2 시점에 q1 재출제 — N+2 정책", async () => {
    // 결정적 시퀀스: q1, q2가 서로 다른 letter
    // N+2 정책: q1 정답 시 (advance 전) rescheduleAfterCorrect → due=0+2=2.
    // advance → turn=1 (q2). q2 정답 → advance → turn=2 → popDueOrNull → q1 pop.
    const mockRandom = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)     // q1: index 0
      .mockReturnValueOnce(0.2)   // q2: 다른 letter
      .mockReturnValueOnce(0.4);  // q3 candidate (retry 우선)

    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;

    // 오답 → 정답: rescheduleAfterCorrect(turn=0) → due=2. advance → turn=1.
    await user.click(getWrongButton(q1));
    await user.click(getCorrectButton(q1));
    expect(getDebugTurn()).toBe(1);

    // q2 정답 (turn=2): popDueOrNull(2) → q1 pop
    const q2 = getCurrentQuestion()!;
    expect(q2.key).not.toBe(q1.key); // 다른 letter 보장
    await user.click(getCorrectButton(q2));
    expect(getDebugTurn()).toBe(2);

    // q1과 같은 음표 재출제
    const qRetry = getCurrentQuestion()!;
    expect(qRetry.key).toBe(q1.key);
    expect(qRetry.octave).toBe(q1.octave);

    mockRandom.mockRestore();
  });
});

// ────────────────────────────────────────────────
// G. 재출제 정답 → 영구 제거
// ────────────────────────────────────────────────
describe("NoteGame 신규 정책 - 재출제 음표 정답 시 (12=P)", () => {
  it("G. 재출제된 음표 정답: 큐에서 영구 제거", async () => {
    const mockRandom = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.4);

    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    await user.click(getWrongButton(q1));
    await user.click(getCorrectButton(q1));
    const q2 = getCurrentQuestion()!;
    await user.click(getCorrectButton(q2));

    // q1 재출제 중 (turn=2)
    const qRetry = getCurrentQuestion()!;
    expect(qRetry.key).toBe(q1.key);

    // 재출제 정답 처리
    await user.click(getCorrectButton(qRetry));

    // 큐 영구 제거
    expect(getDebugQueueSize()).toBe(0);

    mockRandom.mockRestore();
  });
});

// ────────────────────────────────────────────────
// H. 재출제 오답 → 같은 자리 유지
// ────────────────────────────────────────────────
describe("NoteGame 신규 정책 - 재출제 음표 오답 시", () => {
  it("H. 재출제된 음표 오답: 같은 자리 유지 + 라이프 -1", async () => {
    const mockRandom = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.4);

    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    await user.click(getWrongButton(q1));
    await user.click(getCorrectButton(q1));
    const q2 = getCurrentQuestion()!;
    await user.click(getCorrectButton(q2));

    const qRetry = getCurrentQuestion()!;
    expect(qRetry.key).toBe(q1.key);
    const turnBeforeWrong = getDebugTurn();

    // 재출제 자리에서 오답
    await user.click(getWrongButton(qRetry));

    // 같은 q1 자리 유지
    const qStill = getCurrentQuestion()!;
    expect(qStill.key).toBe(q1.key);
    expect(qStill.octave).toBe(q1.octave);

    // turn 변동 X (오답 시 advanceToNextTurn 호출 X)
    expect(getDebugTurn()).toBe(turnBeforeWrong);

    // 게임오버 아님
    expect(screen.queryByText(/게임 오버/)).toBeNull();

    mockRandom.mockRestore();
  });
});

// ────────────────────────────────────────────────
// I. 같은 음표 5번 오답 → 게임오버
// ────────────────────────────────────────────────
describe("NoteGame 신규 정책 - 라이프 소진", () => {
  it("I. 같은 음표 5번 연속 오답 → 게임오버 (sublevel=1, lives=5)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;

    // 같은 음표 5번 연속 오답
    for (let i = 0; i < 5; i++) {
      const exists = getCurrentQuestion();
      if (!exists) break;
      await user.click(getWrongButton(q1));
    }

    await waitFor(() => {
      expect(screen.queryByText(/게임 오버/)).not.toBeNull();
    });
  });

  it("I-2. 같은 음표 4번 오답: 아직 게임오버 아님 (sublevel=1)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    for (let i = 0; i < 4; i++) {
      await user.click(getWrongButton(q1));
    }

    expect(screen.queryByText(/게임 오버/)).toBeNull();
    // 화면에 q1 그대로
    const qAfter = getCurrentQuestion()!;
    expect(qAfter.key).toBe(q1.key);
  });
});

// ────────────────────────────────────────────────
// J, K, L. mastery 기록 (recordNote)
// ────────────────────────────────────────────────
describe("NoteGame 신규 정책 - mastery 기록 (매 시도마다)", () => {
  it("J. 정답 시 recorder.recordNote 호출됨 (correct=true)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    await user.click(getCorrectButton(q1));

    expect(mockRecordNote).toHaveBeenCalled();
    const lastCall = mockRecordNote.mock.calls.at(-1)![0];
    expect(lastCall.correct).toBe(true);
  });

  it("K. 오답 시 recorder.recordNote 호출됨 (correct=false)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    await user.click(getWrongButton(q1));

    expect(mockRecordNote).toHaveBeenCalledTimes(1);
    const call = mockRecordNote.mock.calls[0][0];
    expect(call.correct).toBe(false);
  });

  it("L. 같은 음표 오답 3 + 정답 1 = recordNote 4번 호출", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    for (let i = 0; i < 3; i++) {
      await user.click(getWrongButton(q1));
    }
    await user.click(getCorrectButton(q1));

    expect(mockRecordNote).toHaveBeenCalledTimes(4);
    expect(mockRecordNote.mock.calls[0][0].correct).toBe(false);
    expect(mockRecordNote.mock.calls[1][0].correct).toBe(false);
    expect(mockRecordNote.mock.calls[2][0].correct).toBe(false);
    expect(mockRecordNote.mock.calls[3][0].correct).toBe(true);
  });
});
