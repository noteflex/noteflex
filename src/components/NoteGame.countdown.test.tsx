/**
 * §0.3 — 카운트다운 후 첫 음표 버퍼링 + Sub3 즉시 타임아웃 버그 수정
 *
 * 검증 목표:
 *  1. 카운트다운 완료 후 300ms 동안 오버레이 유지
 *  2. 300ms 후 오버레이 사라짐 (게임 시작)
 *  3. Sub3 (3초 타이머): 첫 음표가 즉시 타임아웃 되지 않음
 *  4. 타이머가 300ms 후 full timeLimit에서 시작함
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import NoteGame from "./NoteGame";

// ──────────────────────────────────────────────────
// vi.hoisted — vi.mock 호이스트에 안전한 참조
// ──────────────────────────────────────────────────
const { mockPlayWrong } = vi.hoisted(() => ({
  mockPlayWrong: vi.fn(),
}));

// ──────────────────────────────────────────────────
// 표준 외부 의존성 모킹
// ──────────────────────────────────────────────────
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
  playWrong: mockPlayWrong,
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

// ──────────────────────────────────────────────────
// 헬퍼 — 카운트다운 3초 통과
// ──────────────────────────────────────────────────
/**
 * CountdownOverlay의 3-2-1 카운트를 fake timer로 통과시킴.
 * 각 act() 사이에 React 효과가 실행되어야 다음 setTimeout이 예약되므로
 * 1초씩 3번 나누어 진행한다.
 */
function advanceThroughCountdown() {
  act(() => { vi.advanceTimersByTime(1000); }); // count 3 → 2
  act(() => { vi.advanceTimersByTime(1000); }); // count 2 → 1
  act(() => { vi.advanceTimersByTime(1000); }); // count 1 → 0, onComplete() 호출
}

// ──────────────────────────────────────────────────
// 테스트
// ──────────────────────────────────────────────────

describe("§0.3 countdown grace buffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPlayWrong.mockClear();
    localStorage.setItem("noteflex.solfege_system", "en");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1. 카운트다운 완료 직후에도 오버레이가 유지됨 (0ms)", () => {
    render(<NoteGame level={1} sublevel={1} />);

    // 카운트다운 3초 진행 (count 3→2→1→0, onComplete 호출됨)
    advanceThroughCountdown();

    // onComplete 직후 — 아직 300ms 버퍼 중, 오버레이 유지
    // NoteButtons는 여전히 disabled (showCountdown=true)
    const noteButtons = screen.queryAllByRole("button").filter(
      (b) => b.getAttribute("aria-label")?.endsWith(" 선택")
    );
    expect(noteButtons.length).toBeGreaterThan(0);
    expect(noteButtons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it("2. 299ms 시점에도 버튼 disabled, 300ms에 활성화됨", () => {
    render(<NoteGame level={1} sublevel={1} />);

    advanceThroughCountdown();

    // 299ms: 아직 버퍼 중
    act(() => { vi.advanceTimersByTime(299); });
    const buttonsAt299 = screen.queryAllByRole("button").filter(
      (b) => b.getAttribute("aria-label")?.endsWith(" 선택")
    );
    expect(buttonsAt299.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);

    // +1ms = 300ms: 게임 시작, 버튼 활성화
    act(() => { vi.advanceTimersByTime(1); });
    const buttonsAt300 = screen.queryAllByRole("button").filter(
      (b) => b.getAttribute("aria-label")?.endsWith(" 선택")
    );
    expect(buttonsAt300.some((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });

  it("3. Sub3: 카운트다운 후 첫 음표가 즉시 타임아웃 되지 않음", () => {
    // Sub3 timeLimit=3초. 버그: setTimerKey 없으면 카운트다운 3초 후
    // startRef=T0인 상태에서 unpaused → 첫 tick(50ms)에 elapsed≥3000 → 즉시 expire
    render(<NoteGame level={1} sublevel={3} />);

    advanceThroughCountdown();

    // 300ms grace + 50ms (CountdownTimer 첫 tick interval)
    act(() => { vi.advanceTimersByTime(350); });

    // 즉시 타임아웃 없어야 함 — playWrong 미호출
    expect(mockPlayWrong).not.toHaveBeenCalled();
  });

  it("4. Sub3: grace 후 타이머는 full 3초로 리셋됨 (3초 뒤 만료)", () => {
    render(<NoteGame level={1} sublevel={3} />);

    advanceThroughCountdown(); // T=3000ms, grace setTimeout 예약됨

    // grace 300ms — 별도 act()로 실행해야 React effects가 T=3300ms에서 flush됨
    // (=startRef.current = 3300ms로 올바르게 리셋)
    act(() => { vi.advanceTimersByTime(300); });

    // 2.9초 진행 — 타이머 2900/3000ms (아직 만료 전)
    act(() => { vi.advanceTimersByTime(2900); });
    expect(mockPlayWrong).not.toHaveBeenCalled();

    // 150ms 더 → elapsed ≈ 3050ms > 3000ms → 만료
    act(() => { vi.advanceTimersByTime(150); });
    expect(mockPlayWrong).toHaveBeenCalledTimes(1);
  });
});
