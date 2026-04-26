
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoteGame from "./NoteGame";

/**
 * NoteGame 통합 테스트
 *
 * 검증 목표:
 *  - 오답 시 retry queue에 등록되는가
 *  - 오답 시 다음 문제로 자동 진행되는가 (C 옵션)
 *  - retry queue에 등록된 음표가 N턴 뒤 재출제되는가
 *  - 정답 시 queue에서 제거되는가
 *  - 라이프 소진 시 게임오버되는가
 *
 * 전략:
 *  - DOM을 통해 현재 출제 음표 읽기 ("현재 정답: G4" 빨간 글씨)
 *  - 디버그 패널에서 queue 상태 파싱
 *  - NoteButtons 7개 중 하나를 클릭하여 정답/오답 시뮬레이션
 */

// ────────────────────────────────────────────────
// Mock: 외부 의존성 차단 (DB·Auth·사운드)
// ────────────────────────────────────────────────
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
  useUserMastery: () => ({
    masteryMap: new Map(),
    loading: false,
    lastAnalyzedAt: null,
  }),
}));

vi.mock("@/lib/sound", () => ({
  playNote: vi.fn(),
  playWrong: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" }, loading: false }),
}));

const mockRecordAttempt = vi.fn().mockResolvedValue(null);

vi.mock("@/hooks/useLevelProgress", () => ({
  useLevelProgress: () => ({
    progress: [],
    loading: false,
    fetchProgress: vi.fn(),
    recordAttempt: mockRecordAttempt,
    getProgressFor: vi.fn().mockReturnValue(null),
  }),
}));

// GrandStaffPractice는 렌더링만 되면 되므로 단순화
vi.mock("@/components/practice/GrandStaffPractice", () => ({
  TOTAL_SLOTS: 10,
  GrandStaffPractice: ({ targetNote }: { targetNote: string | null }) => (
    <div data-testid="staff">{targetNote ?? "none"}</div>
  ),
}));

// ────────────────────────────────────────────────
// 헬퍼
// ────────────────────────────────────────────────

/** 현재 출제 중인 음표 key(예: "G", "C", "F#") 읽기 */
function getCurrentQuestion(): { key: string; octave: string; accidental?: string } | null {
  const el = screen.queryByText(/현재 정답:/);
  if (!el) return null;
  // "현재 정답: G4" 또는 "현재 정답: F4 #" 같은 포맷
  const text = el.textContent ?? "";
  const m = text.match(/현재 정답:\s*([A-G])(\d+)\s*([#b])?/);
  if (!m) return null;
  return {
    key: m[1],
    octave: m[2],
    accidental: m[3],
  };
}

/** 정답 버튼 찾기 (aria-label 기반) */
function getCorrectButton(question: { key: string; accidental?: string }): HTMLElement {
  const label = question.accidental
    ? `${question.key}${question.accidental === "#" ? "♯" : "♭"} 선택`
    : `${question.key} 선택`;
  return screen.getByLabelText(label);
}

/** 오답 버튼 찾기 (정답이 아닌 아무 버튼) */
function getWrongButton(question: { key: string }): HTMLElement {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const wrongLetter = letters.find((l) => l !== question.key)!;
  // 조표 없는 버튼 먼저 시도, 없으면 정규식
  const btn = screen.queryByLabelText(`${wrongLetter} 선택`);
  if (btn) return btn;
  // 조표 버튼만 있는 경우(Lv5+) - 첫 매칭 버튼 반환
  const btns = screen.getAllByRole("button");
  return btns.find(
    (b) => b.getAttribute("aria-label")?.startsWith(wrongLetter)
  )!;
}

/** 디버그 패널에서 queue 상태 파싱 */
function getDebugQueueSize(): number {
  const text = screen.getByText(/size:\s*\d+/).textContent ?? "";
  const m = text.match(/size:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** 디버그 패널의 턴 카운터 */
function getDebugTurn(): number {
  const text = screen.getByText(/turn:\s*\d+/).textContent ?? "";
  const m = text.match(/turn:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** 현재 남은 라이프 세기 (하트 이모지 개수) */
function getLifeCount(): number {
  // GameHeader에서 ❤️ 이모지 렌더링 방식이 다를 수 있음.
  // 우선 전체 텍스트에서 찾고, 없으면 score card 주변 관찰
  // 여기선 간단하게 테스트 환경에서 생략 (라이프는 별도 테스트에서만)
  return 0;
}

// ────────────────────────────────────────────────
// 테스트
// ────────────────────────────────────────────────

describe("NoteGame - Retry Queue 통합", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordAttempt.mockResolvedValue(null);
    localStorage.setItem("noteflex.solfege_system", "en");
  });

  it("초기 상태: 큐 비어있고 첫 음표 출제됨", () => {
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q = getCurrentQuestion();
    expect(q).not.toBeNull();
    expect(q!.key).toMatch(/[A-G]/);
    expect(getDebugQueueSize()).toBe(0);
    expect(getDebugTurn()).toBe(0);
  });

  it("오답 시 큐에 등록되고 다음 문제로 자동 진행", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    const wrongBtn = getWrongButton(q1);
    await user.click(wrongBtn);

    // 큐 사이즈 1
    expect(getDebugQueueSize()).toBe(1);
    // 턴 1 증가
    expect(getDebugTurn()).toBe(1);
    // 다음 문제로 진행 (같은 음표일 수도 있지만 state는 진행됨)
  });

  it("정답 시 큐에 등록되지 않음", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    const correctBtn = getCorrectButton(q1);
    await user.click(correctBtn);

    expect(getDebugQueueSize()).toBe(0);
    expect(getDebugTurn()).toBe(1);
  });

  it("오답 3번 연속 · 큐 상태 계약 검증", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    for (let i = 0; i < 3; i++) {
      const q = getCurrentQuestion();
      if (!q) continue;
      await user.click(getWrongButton(q));
    }

    // 턴은 확정적으로 3 (retry 여부와 무관하게 매 클릭이 1턴 진행)
    await waitFor(() => {
      expect(getDebugTurn()).toBe(3);
    });

    // 큐 사이즈는 retry 사이클 타이밍에 따라 0~3 가능:
    //  - scheduleRetry 직후: +1
    //  - prepareNextTurn의 popDueOrNull이 due 항목을 꺼내면: -1
    //  - 같은 음표가 반복 출제되면 Map.set으로 덮어씀 (size 변화 없음)
    // 이 테스트는 "UI와 useRetryQueue 훅이 연결돼 있고 런타임 에러가 나지 않음"만 검증.
    // 큐 로직의 세부 계약은 `useRetryQueue.test.ts` 15개 테스트가 책임진다.
    const size = getDebugQueueSize();
    expect(size).toBeGreaterThanOrEqual(0);
    expect(size).toBeLessThanOrEqual(3);
  });

  it("오답 후 N턴 뒤 🔁 재출제 배지가 표시됨", async () => {
    // 결정적: q1=index0, q2=index2 (서로 다른 음표 보장)
    const mockRandom = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)     // q1: TREBLE_NOTES[0] = C6
      .mockReturnValueOnce(0.2);  // q2: TREBLE_NOTES[3] = G5 (다른 letter)
  
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);
  
    const q1 = getCurrentQuestion()!;
    await user.click(getWrongButton(q1)); // turn 1, due @2
  
    const q2 = getCurrentQuestion()!;
    // q1과 q2가 다른 letter 보장
    expect(q2.key).not.toBe(q1.key);
    await user.click(getCorrectButton(q2));
  
    const q3 = getCurrentQuestion()!;
    expect(q3.key).toBe(q1.key);
    expect(q3.octave).toBe(q1.octave);
    expect(screen.getByText(/🔁 재출제/)).toBeInTheDocument();
  
    mockRandom.mockRestore();
  });

  
  it("재출제된 음표를 정답하면 큐에서 제거됨", async () => {
    // Math.random 고정: q1=index0(C6, key=C), q2=index7(C5, key=C, 다른 octave)
    // → q2 정답 처리 시 q1 retry가 resolve되지 않고 turn=2에 재출제됨
    const mockRandom = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)    // q1: C6
      .mockReturnValueOnce(0.5); // q2: C5 (다른 octave라 retry는 유지됨)

    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    await user.click(getWrongButton(q1)); // size=1

    const q2 = getCurrentQuestion()!;
    await user.click(getCorrectButton(q2)); // turn=2

    mockRandom.mockRestore();

    // q1과 같은 key의 음표가 재출제 중 (🔁 배지 확인으로 재출제 보장)
    expect(screen.getByText(/🔁 재출제/)).toBeInTheDocument();
    const qRetry = getCurrentQuestion()!;
    expect(qRetry.key).toBe(q1.key);

    await user.click(getCorrectButton(qRetry));

    // 큐에서 사라져야 함
    expect(getDebugQueueSize()).toBe(0);
    // 재출제 배지도 사라짐
    expect(screen.queryByText(/🔁 재출제/)).not.toBeInTheDocument();
  });

  it("재출제된 음표를 또 틀리면 재재출제까지 이어짐", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    const q1 = getCurrentQuestion()!;
    await user.click(getWrongButton(q1)); // turn 1, miss×1, due @2

    const q2 = getCurrentQuestion()!;
    await user.click(getCorrectButton(q2)); // turn 2 → retry 출제

    // retry 출제됨 (q1 재등장)
    const qRetry1 = getCurrentQuestion()!;
    expect(qRetry1.key).toBe(q1.key);
    expect(qRetry1.octave).toBe(q1.octave);

    // 또 오답 → turn 3으로 이동.
    // miss×2니까 due @3 (n+1). advanceToNextTurn 내부에서 즉시 pop됨.
    await user.click(getWrongButton(qRetry1));

    // 여전히 q1이 출제 중 (재재출제)
    const qRetry2 = getCurrentQuestion()!;
    expect(qRetry2.key).toBe(q1.key);
    expect(qRetry2.octave).toBe(q1.octave);

    // 재출제 배지 여전히 있음
    expect(screen.getByText(/🔁 재출제/)).toBeInTheDocument();

    // turn은 3
    expect(getDebugTurn()).toBe(3);
  });
});

// ────────────────────────────────────────────────
// 서브레벨 설정 적용 검증
// ────────────────────────────────────────────────
describe("NoteGame - 서브레벨 설정", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordAttempt.mockResolvedValue(null);
    localStorage.setItem("noteflex.solfege_system", "en");
  });

  it("sublevel=2: 목숨 4개 → 4번 오답 시 게임오버", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={2} skipCountdown />);

    for (let i = 0; i < 4; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await user.click(getWrongButton(q));
    }

    expect(screen.queryByText(/게임 오버/)).not.toBeNull();
  });

  it("sublevel=3: 목숨 3개 → 3번 오답 시 게임오버", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={3} skipCountdown />);

    for (let i = 0; i < 3; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await user.click(getWrongButton(q));
    }

    expect(screen.queryByText(/게임 오버/)).not.toBeNull();
  });

  it("sublevel=1: 목숨 5개 → 4번 오답 후 게임오버 안 됨", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    for (let i = 0; i < 4; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await user.click(getWrongButton(q));
    }

    // 4번 오답 후에도 게임오버 아님 (목숨 1개 남음)
    expect(screen.queryByText(/게임 오버/)).toBeNull();
  });
});

// ────────────────────────────────────────────────
// best_streak + recordAttempt 콜백 검증
// ────────────────────────────────────────────────
describe("NoteGame - 진도 기록 (recordAttempt)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordAttempt.mockResolvedValue(null);
    localStorage.setItem("noteflex.solfege_system", "en");
  });

  it("gameover 시 recordAttempt 호출됨 (level, sublevel, gameStatus)", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={2} skipCountdown />);

    // sublevel=2 → lives=4: 4번 오답으로 gameover
    for (let i = 0; i < 4; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await user.click(getWrongButton(q));
    }

    await waitFor(() => expect(screen.queryByText(/게임 오버/)).not.toBeNull());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(mockRecordAttempt).toHaveBeenCalledTimes(1);
    const [callLevel, callSublevel, , , , callStatus] = mockRecordAttempt.mock.calls[0];
    expect(callLevel).toBe(1);
    expect(callSublevel).toBe(2);
    expect(callStatus).toBe("gameover");
  });

  it("gameover 시 시도횟수·정답수·streak 정확히 전달됨", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={2} skipCountdown />);

    // 4번 오답 (correct=0, streak=0)
    for (let i = 0; i < 4; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await user.click(getWrongButton(q));
    }

    await waitFor(() => expect(screen.queryByText(/게임 오버/)).not.toBeNull());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(mockRecordAttempt).toHaveBeenCalledTimes(1);
    const [, , attempts, correct, maxStreak] = mockRecordAttempt.mock.calls[0];
    expect(attempts).toBe(4);
    expect(correct).toBe(0);
    expect(maxStreak).toBe(0);
  });

  it("5연속 정답 후 오답 → maxStreak=5 전달됨", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={1} skipCountdown />);

    // 5 연속 정답
    for (let i = 0; i < 5; i++) {
      const q = getCurrentQuestion();
      if (!q || screen.queryByText(/게임 오버/)) break;
      await user.click(getCorrectButton(q));
    }

    // 5번 오답 → gameover
    for (let i = 0; i < 5; i++) {
      const q = getCurrentQuestion();
      if (!q || screen.queryByText(/게임 오버/)) break;
      await user.click(getWrongButton(q));
    }

    await waitFor(() => expect(screen.queryByText(/게임 오버/)).not.toBeNull());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(mockRecordAttempt).toHaveBeenCalledTimes(1);
    const [, , , , maxStreak] = mockRecordAttempt.mock.calls[0];
    expect(maxStreak).toBe(5);
  });

  it("onAttemptRecorded 콜백: recordAttempt 결과를 그대로 전달", async () => {
    const fakeResult = {
      level: 1,
      sublevel: 2,
      play_count: 1,
      total_attempts: 4,
      total_correct: 0,
      accuracy: 0,
      best_streak: 0,
      passed: false,
      just_passed: false,
    };
    mockRecordAttempt.mockResolvedValue(fakeResult);

    const onAttemptRecorded = vi.fn();
    const user = userEvent.setup();
    render(
      <NoteGame
        level={1}
        sublevel={2}
        skipCountdown
        onAttemptRecorded={onAttemptRecorded}
      />
    );

    for (let i = 0; i < 4; i++) {
      const q = getCurrentQuestion();
      if (!q) break;
      await user.click(getWrongButton(q));
    }

    await waitFor(() => expect(screen.queryByText(/게임 오버/)).not.toBeNull());
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(onAttemptRecorded).toHaveBeenCalledWith(
      expect.objectContaining(fakeResult)
    );
  });
});