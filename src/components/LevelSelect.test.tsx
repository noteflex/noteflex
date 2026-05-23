import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { SublevelProgress, Sublevel } from "@/lib/levelSystem";

// ─────────────────────────────────────────────────────────
// hoisted mocks
// ─────────────────────────────────────────────────────────
const { mockUseAuth, mockUseLevelProgress, mockNavigate } = vi.hoisted(() => ({
  mockUseAuth:          vi.fn(),
  mockUseLevelProgress: vi.fn(),
  mockNavigate:         vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/hooks/useLevelProgress", () => ({
  useLevelProgress: mockUseLevelProgress,
}));

// 기본: 한도 미도달 (useDailyLimit 영향 X 영역). dailyLimit 테스트 파일은 따로 박음.
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

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import LevelSelect from "./LevelSelect";

// ─────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────
function makeProgress(overrides: Partial<SublevelProgress> = {}): SublevelProgress {
  return {
    level: 1, sublevel: 1 as Sublevel,
    play_count: 0, best_streak: 0,
    total_attempts: 0, total_correct: 0,
    passed: false,
    ...overrides,
  };
}

function allPassedProgress(): SublevelProgress[] {
  const all: SublevelProgress[] = [];
  for (let l = 1; l <= 7; l++) {
    for (let s = 1; s <= 3; s++) {
      all.push(makeProgress({ level: l, sublevel: s as Sublevel, passed: true, play_count: 5 }));
    }
  }
  return all;
}

function mockProgressHook(progressList: SublevelProgress[]) {
  return {
    progress: progressList,
    loading:  false,
    getProgressFor: (level: number, sublevel: number) =>
      progressList.find((p) => p.level === level && p.sublevel === sublevel) ?? null,
    fetchProgress:  vi.fn(),
    recordAttempt:  vi.fn().mockResolvedValue(null),
  };
}

function renderLevelSelect(
  props: {
    onSelectSublevel?: (level: number, sublevel: Sublevel) => void;
    onLoginRequest?: () => void;
  } = {}
) {
  return render(
    <MemoryRouter>
      <LevelSelect
        onSelectSublevel={props.onSelectSublevel ?? vi.fn()}
        onLoginRequest={props.onLoginRequest}
      />
    </MemoryRouter>
  );
}

// ─────────────────────────────────────────────────────────
// 셀 카운트 헬퍼
// ─────────────────────────────────────────────────────────
function countSublevelCells() {
  return screen
    .getAllByRole("button")
    .filter((b) => /^Lv \d-\d/.test(b.getAttribute("aria-label") ?? "")).length;
}

// ─────────────────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────────────────
describe("LevelSelect - 렌더링", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, profile: null });
    mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
  });

  it("21개 서브레벨 셀 모두 렌더링됨", () => {
    renderLevelSelect();
    expect(countSublevelCells()).toBe(21);
  });

  it("7개 레벨 이름이 표시됨 (Beginner×2, Elementary×2, Intermediate, Advanced, Master)", () => {
    renderLevelSelect();
    // en 기본 언어 — strings.ts의 en.levelSelect.levels 이름
    const names = ["Beginner", "Beginner", "Elementary", "Elementary", "Intermediate", "Advanced", "Master"];
    for (const name of names) {
      expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─────────────────────────────────────────────────────────
describe("LevelSelect - Guest 구독 게이트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, profile: null });
    mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
  });

  it("Lv 1-1: 미시작 → 'Select' 라벨 (클릭 가능)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 1-1 Select")).toBeInTheDocument();
  });

  it("Lv 1-2: 구독 잠금 (guest → Sub2 접근 불가)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 1-2 Pro only")).toBeInTheDocument();
  });

  it("Lv 2-1: 구독 잠금 (guest → Pro 전용)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 2-1 Pro only")).toBeInTheDocument();
  });

  it("Lv 7-3: 구독 잠금", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 7-3 Pro only")).toBeInTheDocument();
  });

  it("Lv 1-1 클릭 → onSelectSublevel(1, 1) 호출", async () => {
    const onSelectSublevel = vi.fn();
    renderLevelSelect({ onSelectSublevel });

    await userEvent.click(screen.getByLabelText("Lv 1-1 Select"));

    expect(onSelectSublevel).toHaveBeenCalledWith(1, 1);
  });

  it("Lv 2-1 클릭 → UpgradeModal 열림", async () => {
    renderLevelSelect();

    await userEvent.click(screen.getByLabelText("Lv 2-1 Pro only"));

    expect(screen.getByText(/Unlock All Levels with Pro/)).toBeInTheDocument();
  });

  it("Lv 1-2 클릭 → UpgradeModal 열림 (guest → Sub2 구독 잠금)", async () => {
    renderLevelSelect();

    await userEvent.click(screen.getByLabelText("Lv 1-2 Pro only"));

    expect(screen.getByText(/Unlock All Levels with Pro/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────
describe("LevelSelect - Free 구독 게이트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Free user with Lv 1-1 passed → Lv 1-2 available
    const progress = [makeProgress({ level: 1, sublevel: 1, passed: true, play_count: 5 })];
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { subscription_tier: "free", is_premium: false },
    });
    mockUseLevelProgress.mockReturnValue(mockProgressHook(progress));
  });

  it("Lv 1-1: 통과 셀", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 1-1 Passed (replay available)")).toBeInTheDocument();
  });

  it("Lv 1-2: 구독 잠금 (free → Sub2 Premium 전용)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 1-2 Pro only")).toBeInTheDocument();
  });

  it("Lv 1-3: 구독 잠금 (free → Sub3 Premium 전용)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 1-3 Pro only")).toBeInTheDocument();
  });

  it("Lv 2-1: 구독 OK + 진도 잠금 (1-1 통과 확인 후 2-1 접근 가능, 진행 X)", () => {
    renderLevelSelect();
    // Lv 2-1 → free에서 canAccessSublevel=true, getProgressGatePrev("free", 2, 1) = Lv1-1 (passed)
    // 따라서 선택 가능 (진행 없음 → 'Select' 라벨)
    expect(screen.getByLabelText("Lv 2-1 Select")).toBeInTheDocument();
  });

  it("Lv 3-1: 구독 OK + 진도 잠금 (2-1 미통과)", () => {
    renderLevelSelect();
    // getProgressGatePrev("free", 3, 1) = {level:2, sublevel:1} → 2-1 미통과 → 잠금
    expect(screen.getByLabelText("Lv 3-1 Locked")).toBeInTheDocument();
  });

  it("Lv 3-2: 구독 잠금 (free → Sub2 Premium 전용)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 3-2 Pro only")).toBeInTheDocument();
  });

  it("Lv 5-1: 구독 OK + 진도 잠금 (4-1 미통과)", () => {
    renderLevelSelect();
    // canAccessSublevel("free", 5, 1) = true (5/9 결정: Lv1~5 Sub1 접근 가능)
    // getProgressGatePrev("free", 5, 1) = {level:4, sublevel:1} → 4-1 미통과 → 잠금
    expect(screen.getByLabelText("Lv 5-1 Locked")).toBeInTheDocument();
  });

  it("Lv 6-1: 구독 잠금 (free → Lv6 Premium 전용)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 6-1 Pro only")).toBeInTheDocument();
  });

  it("Lv 2-1 클릭 → onSelectSublevel(2, 1) 호출 (1-1 통과 후 접근 가능)", async () => {
    const onSelectSublevel = vi.fn();
    renderLevelSelect({ onSelectSublevel });

    await userEvent.click(screen.getByLabelText("Lv 2-1 Select"));

    expect(onSelectSublevel).toHaveBeenCalledWith(2, 1);
  });

  it("Lv 1-2 클릭 → UpgradeModal 열림 (Sub2 구독 잠금)", async () => {
    renderLevelSelect();

    await userEvent.click(screen.getByLabelText("Lv 1-2 Pro only"));

    expect(screen.getByText(/Unlock All Levels with Pro/)).toBeInTheDocument();
  });

  it("Lv 3-2 클릭 → UpgradeModal 열림", async () => {
    renderLevelSelect();

    await userEvent.click(screen.getByLabelText("Lv 3-2 Pro only"));

    expect(screen.getByText(/Unlock All Levels with Pro/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────
describe("LevelSelect - Pro 구독 (전 단계 통과)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { subscription_tier: "pro", is_premium: true },
    });
    mockUseLevelProgress.mockReturnValue(mockProgressHook(allPassedProgress()));
  });

  it("Pro 구독 상태 뱃지 삭제됨 (Header 영역 중복 제거)", () => {
    renderLevelSelect();
    expect(screen.queryByText(/Pro — 전 단계 이용 중/)).not.toBeInTheDocument();
  });

  it("21개 통과 → 모든 셀 통과 라벨", () => {
    renderLevelSelect();
    const passedCells = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.includes("Passed (replay available)"));
    expect(passedCells).toHaveLength(21);
  });

  it("모든 셀 'Passed (replay available)' 라벨", () => {
    renderLevelSelect();
    const passedCells = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.includes("Passed (replay available)"));
    expect(passedCells).toHaveLength(21);
  });

  it("Lv 7-3 통과 셀 클릭 → onSelectSublevel(7, 3)", async () => {
    const onSelectSublevel = vi.fn();
    renderLevelSelect({ onSelectSublevel });

    await userEvent.click(screen.getByLabelText("Lv 7-3 Passed (replay available)"));

    expect(onSelectSublevel).toHaveBeenCalledWith(7, 3);
  });
});

// ─────────────────────────────────────────────────────────
describe("LevelSelect - 진행 중 셀", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const progress = [
      // 1-1 passed → getProgressGatePrev("free", 2, 1) = {level:1, sublevel:1} → unlocks 2-1
      makeProgress({ level: 1, sublevel: 1, passed: true, play_count: 10 }),
      // 2-1 in progress: 2/4 criteria met (play_count=5 ❌, best_streak=3 ❌, accuracy 90% ✅, reaction 미기록 ✅)
      makeProgress({
        level: 2, sublevel: 1 as Sublevel,
        play_count: 5, best_streak: 3,
        total_attempts: 10, total_correct: 9,
        passed: false,
      }),
    ];
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      profile: { subscription_tier: "free", is_premium: false },
    });
    mockUseLevelProgress.mockReturnValue(mockProgressHook(progress));
  });

  it("Lv 2-1: 'In progress' 라벨 표시", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 2-1 In progress")).toBeInTheDocument();
  });

  it("Lv 2-1 셀에 달성 조건 수 표시 (2/4 done)", () => {
    renderLevelSelect();
    const cell = screen.getByLabelText("Lv 2-1 In progress");
    expect(cell).toHaveTextContent("2/4 done");
  });

  it("진행 중 셀 클릭 → onSelectSublevel(2, 1) 호출", async () => {
    const onSelectSublevel = vi.fn();
    renderLevelSelect({ onSelectSublevel });

    await userEvent.click(screen.getByLabelText("Lv 2-1 In progress"));

    expect(onSelectSublevel).toHaveBeenCalledWith(2, 1);
  });
});

// ─────────────────────────────────────────────────────────
describe("LevelSelect - UpgradeModal → Pricing 이동", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, profile: null });
    mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
  });

  it("UpgradeModal에서 'View Premium Benefits' 클릭 → /pricing 이동", async () => {
    renderLevelSelect();

    // 구독 잠금 셀 클릭 → 모달 오픈
    await userEvent.click(screen.getByLabelText("Lv 2-1 Pro only"));
    expect(screen.getByText(/Unlock All Levels with Pro/)).toBeInTheDocument();

    // View Premium Benefits 클릭
    await userEvent.click(screen.getByTestId("upgrade-modal-cta"));

    expect(mockNavigate).toHaveBeenCalledWith("/pricing");
  });

  it("UpgradeModal 닫기 → 모달 닫힘", async () => {
    renderLevelSelect();

    await userEvent.click(screen.getByLabelText("Lv 2-1 Pro only"));
    expect(screen.getByText(/Unlock All Levels with Pro/)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("upgrade-modal-close"));

    await waitFor(() => {
      expect(screen.queryByText(/Unlock All Levels with Pro/)).not.toBeInTheDocument();
    });
  });
});

