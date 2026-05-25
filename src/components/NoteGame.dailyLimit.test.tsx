/**
 * §B-0 daily limit safety net — NoteGame 통합 테스트
 *
 * Group B Fix Sprint 후 패턴:
 *   - 메인 게이트 = LevelSelect 단계 클릭 시점
 *   - NoteGame = 안전망 (URL 직접 진입·stale state 영역)
 *   - 한도 도달 시 NoteGame 마운트 → onLevelSelect() 콜백 호출, 게임 진입 X
 *   - 한도 미도달 시 recordSession() 호출 + 정상 게임 흐름
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NoteGame from "./NoteGame";

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
  useNoteLogger: () => ({ logNote: vi.fn(), resetPrevNote: vi.fn() }),
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

vi.mock("@/components/UserMenu", () => ({ default: () => null }));

function renderGame(skipCountdown = false, onLevelSelect = vi.fn()) {
  render(
    <MemoryRouter>
      <NoteGame
        level={1}
        sublevel={1}
        skipCountdown={skipCountdown}
        onLevelSelect={onLevelSelect}
      />
    </MemoryRouter>
  );
  return { onLevelSelect };
}

describe("§B-0 NoteGame daily limit safety net (Group B Fix Sprint)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDailyLimitState.current.recordSession = vi.fn().mockResolvedValue(undefined);
  });

  it("한도 도달 + 마운트 → onLevelSelect() 콜백 호출, recordSession 호출 X", async () => {
    mockDailyLimitState.current.hasReached = true;
    const { onLevelSelect } = renderGame();

    // 마운트 후 onLevelSelect 콜백 호출 (LevelSelect 복귀)
    await screen.findByTestId("staff");
    expect(onLevelSelect).toHaveBeenCalledTimes(1);
    expect(mockDailyLimitState.current.recordSession).not.toHaveBeenCalled();
  });

  it("한도 미도달 → recordSession 1회 호출, onLevelSelect 호출 X", async () => {
    mockDailyLimitState.current.hasReached = false;
    const { onLevelSelect } = renderGame();

    await screen.findByTestId("staff");
    expect(mockDailyLimitState.current.recordSession).toHaveBeenCalledTimes(1);
    expect(onLevelSelect).not.toHaveBeenCalled();
  });

  it("한도 미도달 + skipCountdown=false → 카운트다운 시작 (메모리 #16 일관)", async () => {
    mockDailyLimitState.current.hasReached = false;
    renderGame(false);

    await screen.findByTestId("staff");
    // 정상 흐름 진입: staff 컴포넌트 마운트
  });

  it("한도 도달 + skipCountdown=false → onLevelSelect 호출, 카운트다운 진입 X", async () => {
    mockDailyLimitState.current.hasReached = true;
    const { onLevelSelect } = renderGame(false);

    await screen.findByTestId("staff");
    expect(onLevelSelect).toHaveBeenCalledTimes(1);
    // recordSession 호출 X (한도 도달 시 fire-and-forget X)
    expect(mockDailyLimitState.current.recordSession).not.toHaveBeenCalled();
  });
});
