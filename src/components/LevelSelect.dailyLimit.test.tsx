/**
 * §B-0 LevelSelect daily limit gate — Group B Fix Sprint 통합 테스트
 *
 * 게이트 위치 = 단계 클릭 시점 (subscription/progress 통과 후 hasReached 체크).
 * 한도 도달 시 DailyLimitModal 노출, onSelectSublevel 호출 X.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { SublevelProgress, Sublevel } from "@/lib/levelSystem";

const { mockUseAuth, mockUseLevelProgress, mockNavigate, mockDailyLimitState } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseLevelProgress: vi.fn(),
  mockNavigate: vi.fn(),
  mockDailyLimitState: { current: { hasReached: false } as { hasReached: boolean } },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/hooks/useLevelProgress", () => ({
  useLevelProgress: mockUseLevelProgress,
}));

vi.mock("@/hooks/useDailyLimit", () => ({
  useDailyLimit: () => ({
    todayCount: mockDailyLimitState.current.hasReached ? 7 : 0,
    limit: 7,
    hasReached: mockDailyLimitState.current.hasReached,
    timeUntilResetMs: 12 * 60 * 60 * 1000,
    recordSession: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import LevelSelect from "./LevelSelect";

function makeProgress(overrides: Partial<SublevelProgress> = {}): SublevelProgress {
  return {
    level: 1, sublevel: 1 as Sublevel,
    play_count: 0, best_streak: 0,
    total_attempts: 0, total_correct: 0,
    passed: false,
    ...overrides,
  };
}

function mockProgressHook(progressList: SublevelProgress[]) {
  return {
    progress: progressList,
    loading: false,
    getProgressFor: (level: number, sublevel: number) =>
      progressList.find((p) => p.level === level && p.sublevel === sublevel) ?? null,
    fetchProgress: vi.fn(),
    recordAttempt: vi.fn().mockResolvedValue(null),
  };
}

function renderLevelSelect(onSelectSublevel = vi.fn()) {
  render(
    <MemoryRouter>
      <LevelSelect
        onSelectSublevel={onSelectSublevel}
      />
    </MemoryRouter>
  );
  return { onSelectSublevel };
}

describe("LevelSelect — daily limit gate (Group B Fix Sprint)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDailyLimitState.current.hasReached = false;
  });

  describe("Guest 한도 도달", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: null, profile: null });
      mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
      mockDailyLimitState.current.hasReached = true;
    });

    it("Lv 1-1 클릭 → DailyLimitModal 노출, onSelectSublevel 호출 X", async () => {
      const { onSelectSublevel } = renderLevelSelect();

      await userEvent.click(screen.getByLabelText("Lv 1-1 Select"));

      // Guest 영역 CTA 버튼 (가입하기 / Sign up) — 모달 노출 영역 확인
      expect(await screen.findByRole("button", { name: /가입|sign up/i })).toBeInTheDocument();
      expect(onSelectSublevel).not.toHaveBeenCalled();
    });
  });

  describe("Free 한도 도달", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: "u1" },
        profile: { subscription_tier: "free", is_premium: false },
      });
      mockUseLevelProgress.mockReturnValue(
        mockProgressHook([makeProgress({ level: 1, sublevel: 1, passed: true, play_count: 10 })])
      );
      mockDailyLimitState.current.hasReached = true;
    });

    it("Lv 2-1 클릭 → DailyLimitModal 노출 (free), onSelectSublevel 호출 X", async () => {
      const { onSelectSublevel } = renderLevelSelect();

      await userEvent.click(screen.getByLabelText("Lv 2-1 Select"));

      // Free 영역 닫기 버튼은 "내일 다시 오기" — 모달 노출 영역 확인
      expect(await screen.findByRole("button", { name: /내일|tomorrow/i })).toBeInTheDocument();
      expect(onSelectSublevel).not.toHaveBeenCalled();
    });

    it("모달 onClose → 모달 닫힘, LevelSelect 그대로 (navigate X)", async () => {
      const { onSelectSublevel } = renderLevelSelect();

      await userEvent.click(screen.getByLabelText("Lv 2-1 Select"));
      const closeBtn = await screen.findByRole("button", { name: /내일|tomorrow/i });
      await userEvent.click(closeBtn);

      // 모달 닫힘 후 close 버튼 사라짐
      expect(screen.queryByRole("button", { name: /내일|tomorrow/i })).not.toBeInTheDocument();
      expect(onSelectSublevel).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("Premium / 한도 미도달", () => {
    it("Premium → 한도 체크 X, onSelectSublevel 정상 호출", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "u1" },
        profile: { subscription_tier: "pro", is_premium: true },
      });
      mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
      mockDailyLimitState.current.hasReached = false; // pro = Infinity 무조건 false

      const { onSelectSublevel } = renderLevelSelect();
      await userEvent.click(screen.getByLabelText("Lv 1-1 Select"));

      expect(onSelectSublevel).toHaveBeenCalledWith(1, 1);
      // DailyLimitModal CTA 버튼 (가입/Premium) 노출 X
      expect(screen.queryByRole("button", { name: /가입|sign up|premium 보기|view premium/i })).not.toBeInTheDocument();
    });

    it("Free 한도 미도달 → 모달 X, onSelectSublevel 호출", async () => {
      mockUseAuth.mockReturnValue({
        user: { id: "u1" },
        profile: { subscription_tier: "free", is_premium: false },
      });
      mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
      mockDailyLimitState.current.hasReached = false;

      const { onSelectSublevel } = renderLevelSelect();
      await userEvent.click(screen.getByLabelText("Lv 1-1 Select"));

      expect(onSelectSublevel).toHaveBeenCalledWith(1, 1);
    });

    it("Guest 한도 미도달 → 모달 X, onSelectSublevel 호출", async () => {
      mockUseAuth.mockReturnValue({ user: null, profile: null });
      mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
      mockDailyLimitState.current.hasReached = false;

      const { onSelectSublevel } = renderLevelSelect();
      await userEvent.click(screen.getByLabelText("Lv 1-1 Select"));

      expect(onSelectSublevel).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("Subscription/Progress 잠금 영역과 우선순위", () => {
    it("Subscription 잠금 셀 클릭 → UpgradeModal 우선 (DailyLimit 체크 X)", async () => {
      mockUseAuth.mockReturnValue({ user: null, profile: null }); // guest
      mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
      mockDailyLimitState.current.hasReached = true;

      const { onSelectSublevel } = renderLevelSelect();
      // Lv 1-2 = guest 입장에선 subscription 잠금
      await userEvent.click(screen.getByLabelText("Lv 1-2 Pro only"));

      // UpgradeModal "View Premium Benefits" CTA 노출 (Pro 구독 안내)
      expect(await screen.findByTestId("upgrade-modal-cta")).toBeInTheDocument();
      // DailyLimitModal CTA 노출 X (가입하기·Premium 보기 모두 X)
      expect(screen.queryByRole("button", { name: /^가입하기$|^sign up$/i })).not.toBeInTheDocument();
      expect(onSelectSublevel).not.toHaveBeenCalled();
    });
  });
});
