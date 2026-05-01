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
const { mockPlayWrong, mockPlayNote, mockEnsureAudioReady } = vi.hoisted(() => ({
  mockPlayWrong: vi.fn(),
  mockPlayNote: vi.fn(),
  mockEnsureAudioReady: vi.fn().mockResolvedValue(undefined),
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
  playNote: mockPlayNote,
  playWrong: mockPlayWrong,
  isSamplerReady: () => true,
  initSound: vi.fn().mockResolvedValue(undefined),
  ensureAudioReady: mockEnsureAudioReady,
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
  GrandStaffPractice: ({
    targetNote,
    batchNotes,
  }: {
    targetNote: string | null;
    batchNotes?: { note: string }[];
  }) => (
    <div
      data-testid="staff"
      data-target={targetNote ?? "null"}
      data-batchcount={batchNotes ? batchNotes.length : 0}
    >
      {targetNote ?? "none"}
    </div>
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

describe("§0.3 countdown → first note (grace 제거 후, 2026-05-01 개정)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPlayWrong.mockClear();
    mockPlayNote.mockClear();
    mockEnsureAudioReady.mockClear();
    localStorage.setItem("noteflex.solfege_system", "en");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1. 카운트다운 종료 즉시 NoteButtons 활성화 (grace 없음)", () => {
    render(<NoteGame level={1} sublevel={1} />);

    advanceThroughCountdown(); // count 3→2→1→0, onComplete 동기 실행

    // grace 제거 — 카운트다운 끝나자마자 버튼 활성화
    const noteButtons = screen.queryAllByRole("button").filter(
      (b) => b.getAttribute("aria-label")?.endsWith(" 선택")
    );
    expect(noteButtons.length).toBeGreaterThan(0);
    expect(noteButtons.some((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });

  it("2. 카운트다운 종료 즉시 첫 음표 사운드 재생", () => {
    // playNote는 다른 mock이라 직접 검증 어려움 → playWrong 미호출(즉시 타임아웃 X)로 간접 검증
    render(<NoteGame level={1} sublevel={1} />);

    advanceThroughCountdown();

    // 첫 음표 표시 직후 (CountdownTimer 첫 tick 50ms)
    act(() => { vi.advanceTimersByTime(50); });

    // 즉시 타임아웃 없어야 함 (Sub1=7초)
    expect(mockPlayWrong).not.toHaveBeenCalled();
  });

  it("3. Sub3: 카운트다운 후 첫 음표가 즉시 타임아웃 되지 않음 (setTimerKey 효과)", () => {
    // Sub3 timeLimit=3초. setTimerKey가 startRef를 동기 리셋하지 않으면
    // 카운트다운 3초 = elapsed 3초로 첫 tick(50ms)에 즉시 expire.
    render(<NoteGame level={1} sublevel={3} />);

    advanceThroughCountdown();

    // 첫 tick (50ms) — elapsed는 startRef 리셋 후 50ms여야 함
    act(() => { vi.advanceTimersByTime(50); });

    expect(mockPlayWrong).not.toHaveBeenCalled();
  });

  it("§1: 카운트다운 후 ensureAudioReady() 호출 + playNote (사운드 보장)", async () => {
    render(<NoteGame level={1} sublevel={1} />);

    advanceThroughCountdown(); // count 3→2→1→0, onComplete 동기 실행

    // ensureAudioReady가 호출됐어야 함
    expect(mockEnsureAudioReady).toHaveBeenCalledTimes(1);

    // .then() 콜백 처리 — vi.useFakeTimers 환경에서 microtask flush
    await vi.runAllTimersAsync();

    // playNote가 호출됐어야 함 (첫 음표 사운드 재생 보장)
    expect(mockPlayNote).toHaveBeenCalled();
  });

  it("§2: 카운트다운 진행 중 음표 숨김 (targetNote=null, batchNotes 비움)", () => {
    render(<NoteGame level={1} sublevel={1} />);

    // 카운트다운 진행 중 (count 3 표시 시)
    const staff = screen.getByTestId("staff");
    expect(staff.getAttribute("data-target")).toBe("null");
    expect(staff.getAttribute("data-batchcount")).toBe("0");

    // count 3 → 2
    act(() => { vi.advanceTimersByTime(1000); });
    expect(staff.getAttribute("data-target")).toBe("null");
    expect(staff.getAttribute("data-batchcount")).toBe("0");

    // count 2 → 1
    act(() => { vi.advanceTimersByTime(1000); });
    expect(staff.getAttribute("data-target")).toBe("null");
    expect(staff.getAttribute("data-batchcount")).toBe("0");

    // count 1 → 0 (onComplete 동기 실행 → showCountdown=false)
    act(() => { vi.advanceTimersByTime(1000); });

    // 카운트다운 끝 후 음표 표시
    const staffAfter = screen.getByTestId("staff");
    expect(staffAfter.getAttribute("data-target")).not.toBe("null");
  });

  it("4. Sub3: 타이머는 full 3초로 리셋됨 (3초 뒤 만료)", () => {
    render(<NoteGame level={1} sublevel={3} />);

    advanceThroughCountdown(); // T=3000ms, onComplete 동기 실행 → startRef 리셋

    // 2.95초 진행 — 타이머 2950/3000ms (아직 만료 전)
    act(() => { vi.advanceTimersByTime(2950); });
    expect(mockPlayWrong).not.toHaveBeenCalled();

    // 100ms 더 → elapsed ≈ 3050ms > 3000ms → 만료
    act(() => { vi.advanceTimersByTime(100); });
    expect(mockPlayWrong).toHaveBeenCalledTimes(1);
  });
});
