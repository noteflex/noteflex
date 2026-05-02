import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoteGame from "./NoteGame";

/**
 * NoteGame 스트레스 테스트 (자동 플레이).
 *
 * 각 레벨(1~7) × 시나리오(전정답/전오답/랜덤50%) 조합을 자동으로 플레이하고
 * 흐름이 끝까지 안전하게 진행되는지 검증한다.
 *
 * 검증 포인트:
 *  - 크래시 없이 세션 종료 (success 또는 gameover 도달)
 *  - 점수 = 정답 수
 *  - 오답 5번이면 game over
 *  - recorder 생명주기 정상 (start → recordNote × N → end)
 *
 * 전략:
 *  - 버튼이 사라질 때까지 루프
 *  - 매 턴마다 현재 정답 DOM에서 읽기 → 해당 시나리오에 맞게 답
 *  - skipCountdown=true로 3초 대기 없이 즉시 게임 시작
 *  - 무한루프 방지: MAX_TURNS 초과 시 실패
 */

// ────────────────────────────────────────────────
// Mock: 외부 의존성 (DB·Auth·사운드)
// ────────────────────────────────────────────────
const mockLogNote = vi.fn();
const mockStartSession = vi.fn();
const mockRecordNote = vi.fn();
const mockEndSession = vi.fn().mockResolvedValue(null);
const mockCancelSession = vi.fn();

vi.mock("@/hooks/useNoteLogger", () => ({
  useNoteLogger: () => ({ logNote: mockLogNote }),
}));

vi.mock("@/hooks/useSessionRecorder", () => ({
  useSessionRecorder: () => ({
    isRecording: false,
    startSession: mockStartSession,
    endSession: mockEndSession,
    cancelSession: mockCancelSession,
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

// ────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────

interface CurrentQuestion {
  key: string;
  octave: string;
  accidental?: string;
}

function getCurrentQuestion(): CurrentQuestion | null {
  const el = screen.queryByText(/현재 정답:/);
  if (!el) return null;
  const text = el.textContent ?? "";
  // "현재 정답: G4" 또는 "현재 정답: F#4" 또는 "현재 정답: F4 #"
  const m = text.match(/현재 정답:\s*([A-G])([#b]?)(\d+)\s*([#b])?/);
  if (!m) return null;
  return {
    key: m[1],
    accidental: (m[2] || m[4]) as "#" | "b" | undefined,
    octave: m[3],
  };
}

function getCorrectButton(q: CurrentQuestion): HTMLElement | null {
  const label = q.accidental
    ? `${q.key}${q.accidental === "#" ? "♯" : "♭"} 선택`
    : `${q.key} 선택`;
  return screen.queryByLabelText(label);
}

function getAnyWrongButton(q: CurrentQuestion): HTMLElement | null {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const wrongLetter = letters.find((l) => l !== q.key);
  if (!wrongLetter) return null;
  const btn = screen.queryByLabelText(`${wrongLetter} 선택`);
  if (btn) return btn;
  // 조표 레벨 fallback
  const all = screen.queryAllByRole("button");
  return (
    all.find((b) => {
      const label = b.getAttribute("aria-label") ?? "";
      return label.startsWith(wrongLetter) && label.includes("선택");
    }) ?? null
  );
}

function isGameEnded(): boolean {
  // success 모달 또는 game over 화면
  return (
    screen.queryByText(/Mission Success/) !== null ||
    screen.queryByText(/모든 레벨 완료/) !== null ||
    screen.queryByText(/게임 오버/) !== null
  );
}

type Strategy = "all-correct" | "all-wrong" | "random-50";

/**
 * Lv5+에서 swipe로 ♯/♭를 입력하는 시뮬레이션.
 * NoteButtons swipeEnabled=true 모드의 useSwipeAccidental은 pointermove에서
 * 임계 거리(56px) 도달 시 즉시 commit. dy 음수=위(♯), 양수=아래(♭).
 *
 * fireEvent.pointer*는 jsdom 환경에서 React handler까지 도달하지 못해
 * native PointerEvent를 직접 dispatch. PointerEvent 미지원 시 MouseEvent로 fallback.
 */
function makePointerEvent(type: string, init: PointerEventInit & { clientX: number; clientY: number }): Event {
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
  // act로 wrap해 native event → React state update → re-render 까지 flush.
  await act(async () => {
    btn.dispatchEvent(makePointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 50, clientY: 100 }));
    btn.dispatchEvent(makePointerEvent("pointermove", { pointerId: 1, clientX: 50, clientY: 100 + dy }));
    btn.dispatchEvent(makePointerEvent("pointerup",   { pointerId: 1, clientX: 50, clientY: 100 + dy }));
  });
}

/** 정답 시도. 자연음=클릭, ♯/♭=swipe. 답할 수 없으면 false. */
async function answerCorrectFor(
  user: ReturnType<typeof userEvent.setup>,
  q: CurrentQuestion
): Promise<boolean> {
  // swipe 모드(Lv5+): letter 자연음 라벨로 검색
  const naturalBtn = screen.queryByLabelText(`${q.key} 선택`);
  if (naturalBtn && !(naturalBtn as HTMLButtonElement).disabled) {
    if (q.accidental === "#" || q.accidental === "b") {
      await swipeAccidental(naturalBtn, q.accidental);
    } else {
      await user.click(naturalBtn);
    }
    return true;
  }
  // legacy 라벨(Lv1-4 keySig 적용 케이스 — 현재 코드에는 없지만 fallback): "F♯ 선택"
  if (q.accidental) {
    const labelled = screen.queryByLabelText(
      `${q.key}${q.accidental === "#" ? "♯" : "♭"} 선택`
    );
    if (labelled && !(labelled as HTMLButtonElement).disabled) {
      await user.click(labelled);
      return true;
    }
  }
  return false;
}

/** 오답 시도: 다른 letter를 자연음 클릭. */
async function answerWrongFor(
  user: ReturnType<typeof userEvent.setup>,
  q: CurrentQuestion
): Promise<boolean> {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const wrongLetter = letters.find((l) => l !== q.key);
  if (!wrongLetter) return false;
  const btn = screen.queryByLabelText(`${wrongLetter} 선택`);
  if (!btn || (btn as HTMLButtonElement).disabled) {
    // legacy 라벨 fallback
    const all = screen.queryAllByRole("button");
    const fallback = all.find((b) => {
      const label = b.getAttribute("aria-label") ?? "";
      return label.startsWith(wrongLetter) && label.includes("선택");
    });
    if (!fallback || (fallback as HTMLButtonElement).disabled) return false;
    await user.click(fallback);
    return true;
  }
  await user.click(btn);
  return true;
}

/** 시나리오에 맞춰 한 턴 답하기. 성공 시 true, 답할 버튼 없으면 false. */
async function answerOnce(
  user: ReturnType<typeof userEvent.setup>,
  strategy: Strategy,
  seed: number
): Promise<boolean> {
  const q = getCurrentQuestion();
  if (!q) return false;

  let shouldAnswerCorrect: boolean;
  if (strategy === "all-correct") shouldAnswerCorrect = true;
  else if (strategy === "all-wrong") shouldAnswerCorrect = false;
  else {
    // 결정적 random (seed 기반)
    const x = Math.sin(seed) * 10000;
    shouldAnswerCorrect = x - Math.floor(x) >= 0.3;  // 70% 정답 (retry queue 누적 방지)
  }

  return shouldAnswerCorrect
    ? answerCorrectFor(user, q)
    : answerWrongFor(user, q);
}

const MAX_TURNS = 2000; // 안전 상한 (sublevel별 27/40/66노트 + retry 폭증 여유)

/** 게임이 끝날 때까지 자동 플레이 */
async function playUntilEnd(
  user: ReturnType<typeof userEvent.setup>,
  strategy: Strategy
): Promise<{ turns: number; ended: boolean }> {
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (isGameEnded()) {
      return { turns: turn, ended: true };
    }
    const answered = await answerOnce(user, strategy, turn);
    if (!answered) {
      return { turns: turn, ended: isGameEnded() };
    }
  }
  return { turns: MAX_TURNS, ended: isGameEnded() };
}
// ────────────────────────────────────────────────
// 테스트
// ────────────────────────────────────────────────

const BASIC_LEVELS = [1, 2, 3, 4] as const;
const ADVANCED_LEVELS = [5, 6, 7] as const;
const ALL_LEVELS = [...BASIC_LEVELS, ...ADVANCED_LEVELS] as const;

describe("NoteGame Stress Test - 각 레벨 자동 플레이", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("noteflex.solfege_system", "en");
    // §swipe-modal-perf (2026-05-02): Lv5+ 자동 플레이는 swipe 모달이 막으므로 미리 본 것으로 처리.
    for (let lv = 5; lv <= 7; lv++) {
      localStorage.setItem(`noteflex.swipe_tutorial_seen.lv${lv}`, "true");
    }
  });

  describe.each(ALL_LEVELS)("Level %d", (level) => {
    it(`전부 정답 → success 도달`, async () => {
      const user = userEvent.setup();
      render(<NoteGame level={level} sublevel={1} skipCountdown />);

      const result = await playUntilEnd(user, "all-correct");

      expect(result.ended).toBe(true);
      // 전부 정답이면 반드시 success (게임오버 X)
      expect(screen.queryByText(/게임 오버/)).toBeNull();
      // 세션 시작은 1번 호출
      expect(mockStartSession).toHaveBeenCalledTimes(1);
      // recordNote는 턴 수만큼 호출 (정답만)
      expect(mockRecordNote.mock.calls.length).toBeGreaterThan(0);
      // 모든 호출이 correct=true
      const allCorrect = mockRecordNote.mock.calls.every(
        (call) => call[0].correct === true
      );
      expect(allCorrect).toBe(true);
      // 턴이 너무 적지도 많지도 않게 (레벨당 대략 9~49턴)
      expect(result.turns).toBeGreaterThan(0);
      expect(result.turns).toBeLessThan(MAX_TURNS);
    });

    it(`전부 오답 → 5번 안에 game over`, async () => {
      const user = userEvent.setup();
      render(<NoteGame level={level} sublevel={1} skipCountdown />);

      const result = await playUntilEnd(user, "all-wrong");

      expect(result.ended).toBe(true);
      // 전부 오답이면 5번 만에 게임오버여야 함 (라이프 5개)
      expect(screen.queryByText(/게임 오버/)).not.toBeNull();
      // 정확히 5번 답하고 게임오버
      expect(result.turns).toBe(5);
      // recordNote는 5번 호출, 전부 correct=false
      expect(mockRecordNote).toHaveBeenCalledTimes(5);
      const allWrong = mockRecordNote.mock.calls.every(
        (call) => call[0].correct === false
      );
      expect(allWrong).toBe(true);
    });

    it(`랜덤 50% → 안전하게 종료 (success OR gameover)`, async () => {
      const user = userEvent.setup();
      render(<NoteGame level={level} sublevel={1} skipCountdown />);

      const result = await playUntilEnd(user, "random-50");

      expect(result.ended).toBe(true);
      // 무한루프 없이 안전하게 끝남
      expect(result.turns).toBeLessThan(MAX_TURNS);
      // 세션 시작 정상
      expect(mockStartSession).toHaveBeenCalledTimes(1);
      // recordNote 호출 있음
      expect(mockRecordNote.mock.calls.length).toBeGreaterThan(0);
    });
  });
});

describe("NoteGame Stress Test - 데이터 일관성", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("noteflex.solfege_system", "en");
    // §swipe-modal-perf (2026-05-02): Lv5+ 자동 플레이는 swipe 모달이 막으므로 미리 본 것으로 처리.
    for (let lv = 5; lv <= 7; lv++) {
      localStorage.setItem(`noteflex.swipe_tutorial_seen.lv${lv}`, "true");
    }
  });

  it("정답 수와 recordNote(correct=true) 호출 수 일치", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    await playUntilEnd(user, "all-correct");

    const correctCalls = mockRecordNote.mock.calls.filter(
      (call) => call[0].correct === true
    ).length;

    // 점수 표시와 recordNote 호출 수가 일치해야 함
    // (DOM에서 score 읽기 - GameHeader에 SCORE 표시)
    const scoreEl = screen.queryByText(/SCORE/)?.parentElement;
    const scoreText = scoreEl?.textContent ?? "";
    const scoreMatch = scoreText.match(/(\d+)/);
    if (scoreMatch) {
      const displayedScore = parseInt(scoreMatch[1], 10);
      expect(correctCalls).toBe(displayedScore);
    }
  });

  it("오답 5회 시 recordNote 호출 5회, game over", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    await playUntilEnd(user, "all-wrong");

    expect(mockRecordNote).toHaveBeenCalledTimes(5);
    const wrongCalls = mockRecordNote.mock.calls.filter(
      (call) => call[0].correct === false
    ).length;
    expect(wrongCalls).toBe(5);
    expect(screen.queryByText(/게임 오버/)).not.toBeNull();
  });

  it("세션 endSession이 정확히 1번 호출됨", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    await playUntilEnd(user, "all-correct");

    // endSession은 phase 변경 후 useEffect에서 호출됨
    // act() 안에서 resolve 완료 기다리기
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockEndSession).toHaveBeenCalledTimes(1);
    expect(mockEndSession).toHaveBeenCalledWith("completed");
  });

  it("게임오버 시 endSession('gameover') 호출됨", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    await playUntilEnd(user, "all-wrong");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockEndSession).toHaveBeenCalledTimes(1);
    expect(mockEndSession).toHaveBeenCalledWith("gameover");
  });
});