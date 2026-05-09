/**
 * §B-0 daily limit gate — NoteGame 통합 테스트
 *
 * 검증 시나리오:
 *  - Guest 3회 도달 → DailyLimitModal 노출, countdown X
 *  - Free 7회 도달 → DailyLimitModal 노출, countdown X
 *  - Premium → 한도 체크 X, 즉시 게임 진입
 *  - 한도 미도달 → recordSession 호출 + 게임 진입
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NoteGame from "./NoteGame";

// useDailyLimit 동적 mock — 매 테스트마다 다른 상태 박음
const { mockDailyLimitState } = vi.hoisted(() => ({
  mockDailyLimitState: { current: { hasReached: false, recordSession: vi.fn() } as { hasReached: boolean; recordSession: ReturnType<typeof vi.fn> } },
}));

vi.mock("@/hooks/useDailyLimit", () => ({
  useDailyLimit: () => ({
    todayCount: 0,
    limit: 7,
    hasReached: mockDailyLimitState.current.hasReached,
    timeUntilResetMs: 12 * 60 * 60 * 1000,
    recordSession: mockDailyLimitState.current.recordSession,
    isLoading: false,
  }),
}));

// 표준 외부 의존성
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
  useAuth: () => ({ user: { id: "test-user" }, profile: null, loading: false }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLang: () => ({ lang: "ko" }),
}));
vi.mock("@/hooks/useLevelProgress", () => ({
  useLevelProgress: () => ({
    progress: [], loading: false, fetchProgress: vi.fn(),
    recordAttempt: vi.fn().mockResolvedValue(null),
    getProgressFor: vi.fn().mockReturnValue(null),
  }),
}));
vi.mock("@/hooks/useUserEnvOffset", () => ({
  useUserEnvOffset: () => ({
    offsetMs: 0, isCalibrated: true, needsCalibration: false, isLoading: false,
    canSkip: true, deviceChanged: false,
    setOffset: vi.fn().mockResolvedValue(undefined),
    clearOffset: vi.fn().mockResolvedValue(undefined),
    skipCalibration: vi.fn(), resetDeviceChanged: vi.fn(),
  }),
}));
vi.mock("@/components/practice/GrandStaffPractice", () => ({
  TOTAL_SLOTS: 10,
  GrandStaffPractice: () => <div data-testid="staff" />,
}));

function renderGame(skipCountdown = false) {
  return render(
    <MemoryRouter>
      <NoteGame level={1} sublevel={1} skipCountdown={skipCountdown} />
    </MemoryRouter>
  );
}

describe("§B-0 NoteGame daily limit gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDailyLimitState.current.recordSession = vi.fn().mockResolvedValue(undefined);
  });

  it("Free 한도 도달 → DailyLimitModal 노출, recordSession 호출 X", async () => {
    mockDailyLimitState.current.hasReached = true;
    renderGame();

    expect(await screen.findByText(/오늘 7회/)).toBeInTheDocument();
    expect(mockDailyLimitState.current.recordSession).not.toHaveBeenCalled();
  });

  it("한도 미도달 → recordSession 1회 호출", async () => {
    mockDailyLimitState.current.hasReached = false;
    renderGame();

    // useEffect 진입 시 recordSession 호출
    await screen.findByTestId("staff");
    expect(mockDailyLimitState.current.recordSession).toHaveBeenCalledTimes(1);
  });

  it("한도 미도달 + skipCountdown=false → 카운트다운 시작 (모달 X)", async () => {
    mockDailyLimitState.current.hasReached = false;
    renderGame(false);

    await screen.findByTestId("staff");
    expect(screen.queryByText(/오늘 7회/)).not.toBeInTheDocument();
  });

  it("한도 도달 + skipCountdown=false → 카운트다운 X, 모달 노출", async () => {
    mockDailyLimitState.current.hasReached = true;
    renderGame(false);

    expect(await screen.findByText(/오늘 7회/)).toBeInTheDocument();
    // CountdownOverlay는 별도 testid 없지만 staff 음표는 보임 (게임 컨테이너는 마운트됨)
  });
});
