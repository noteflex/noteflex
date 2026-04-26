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
    onBack?: () => void;
    onLoginRequest?: () => void;
  } = {}
) {
  return render(
    <MemoryRouter>
      <LevelSelect
        onSelectSublevel={props.onSelectSublevel ?? vi.fn()}
        onBack={props.onBack ?? vi.fn()}
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

  it("7개 레벨 헤더가 표시됨 (Lv 1 ~ Lv 7)", () => {
    renderLevelSelect();
    for (let l = 1; l <= 7; l++) {
      expect(screen.getByText(new RegExp(`Lv ${l} —`))).toBeInTheDocument();
    }
  });

  it("'내 진도: 0 / 21' 표시", () => {
    renderLevelSelect();
    expect(screen.getByText(/내 진도:/)).toBeInTheDocument();
    expect(screen.getByText(/0/)).toBeInTheDocument();
  });

  it("로그인 유도 버튼 표시 (guest + onLoginRequest 있을 때)", () => {
    const onLoginRequest = vi.fn();
    renderLevelSelect({ onLoginRequest });
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────
describe("LevelSelect - Guest 구독 게이트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, profile: null });
    mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
  });

  it("Lv 1-1: 미시작 → '선택' 라벨 (클릭 가능)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 1-1 선택")).toBeInTheDocument();
  });

  it("Lv 1-2: 진도 잠금 (1-1 미통과)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 1-2 잠금")).toBeInTheDocument();
  });

  it("Lv 2-1: 구독 잠금 (guest → Pro 전용)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 2-1 Pro 전용")).toBeInTheDocument();
  });

  it("Lv 7-3: 구독 잠금", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 7-3 Pro 전용")).toBeInTheDocument();
  });

  it("Lv 1-1 클릭 → onSelectSublevel(1, 1) 호출", async () => {
    const onSelectSublevel = vi.fn();
    renderLevelSelect({ onSelectSublevel });

    await userEvent.click(screen.getByLabelText("Lv 1-1 선택"));

    expect(onSelectSublevel).toHaveBeenCalledWith(1, 1);
  });

  it("Lv 2-1 클릭 → UpgradeModal 열림", async () => {
    renderLevelSelect();

    await userEvent.click(screen.getByLabelText("Lv 2-1 Pro 전용"));

    expect(screen.getByText(/Pro 구독으로 전체 단계 해제/)).toBeInTheDocument();
  });

  it("Lv 1-2 클릭 → 진도 잠금 메시지 표시", async () => {
    renderLevelSelect();

    await userEvent.click(screen.getByLabelText("Lv 1-2 잠금"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/Lv 1-1 먼저 통과해주세요/);
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
    expect(screen.getByLabelText("Lv 1-1 통과 (재플레이 가능)")).toBeInTheDocument();
  });

  it("Lv 1-2: 구독 OK + 이전 통과 → 선택 가능", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 1-2 선택")).toBeInTheDocument();
  });

  it("Lv 1-3: 진도 잠금 (1-2 미통과)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 1-3 잠금")).toBeInTheDocument();
  });

  it("Lv 3-1: 구독 OK (free 접근 가능) + 진도 잠금 (2-3 미통과)", () => {
    renderLevelSelect();
    // Lv 3-1 needs Lv 2-3 passed → progress locked
    expect(screen.getByLabelText("Lv 3-1 잠금")).toBeInTheDocument();
  });

  it("Lv 3-2: 구독 잠금 (free는 3-2 이용 불가)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 3-2 Pro 전용")).toBeInTheDocument();
  });

  it("Lv 5-1: 구독 잠금 (free는 Lv 5 이용 불가)", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 5-1 Pro 전용")).toBeInTheDocument();
  });

  it("Lv 1-2 클릭 → onSelectSublevel(1, 2) 호출", async () => {
    const onSelectSublevel = vi.fn();
    renderLevelSelect({ onSelectSublevel });

    await userEvent.click(screen.getByLabelText("Lv 1-2 선택"));

    expect(onSelectSublevel).toHaveBeenCalledWith(1, 2);
  });

  it("Lv 3-2 클릭 → UpgradeModal 열림", async () => {
    renderLevelSelect();

    await userEvent.click(screen.getByLabelText("Lv 3-2 Pro 전용"));

    expect(screen.getByText(/Pro 구독으로 전체 단계 해제/)).toBeInTheDocument();
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

  it("'Pro — 전 단계 이용 중' 뱃지 표시", () => {
    renderLevelSelect();
    expect(screen.getByText(/Pro — 전 단계 이용 중/)).toBeInTheDocument();
  });

  it("21개 통과 → 내 진도 21 표시", () => {
    renderLevelSelect();
    // "내 진도: 21 / 21 통과" 텍스트가 존재하는지 확인
    const progressEl = screen.getByText(/내 진도:/);
    expect(progressEl).toBeInTheDocument();
    // totalPassed = 21 이 근처에 표시됨
    const passedCells = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.includes("통과 (재플레이 가능)"));
    expect(passedCells).toHaveLength(21);
  });

  it("모든 셀 '통과 (재플레이 가능)' 라벨", () => {
    renderLevelSelect();
    const passedCells = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.includes("통과 (재플레이 가능)"));
    expect(passedCells).toHaveLength(21);
  });

  it("Lv 7-3 통과 셀 클릭 → onSelectSublevel(7, 3)", async () => {
    const onSelectSublevel = vi.fn();
    renderLevelSelect({ onSelectSublevel });

    await userEvent.click(screen.getByLabelText("Lv 7-3 통과 (재플레이 가능)"));

    expect(onSelectSublevel).toHaveBeenCalledWith(7, 3);
  });
});

// ─────────────────────────────────────────────────────────
describe("LevelSelect - 진행 중 셀", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const progress = [
      // 1-1 passed (to unlock 1-2)
      makeProgress({ level: 1, sublevel: 1, passed: true, play_count: 5 }),
      // 1-2 in progress: 2/3 criteria met (play_count≥5 ✅, best_streak=3 ❌, accuracy 90% ✅)
      makeProgress({
        level: 1, sublevel: 2,
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

  it("Lv 1-2: '진행 중' 라벨 표시", () => {
    renderLevelSelect();
    expect(screen.getByLabelText("Lv 1-2 진행 중")).toBeInTheDocument();
  });

  it("Lv 1-2 셀에 달성 조건 수 표시 (2/3 달성)", () => {
    renderLevelSelect();
    const cell = screen.getByLabelText("Lv 1-2 진행 중");
    expect(cell).toHaveTextContent("2/3 달성");
  });

  it("진행 중 셀 클릭 → onSelectSublevel(1, 2) 호출", async () => {
    const onSelectSublevel = vi.fn();
    renderLevelSelect({ onSelectSublevel });

    await userEvent.click(screen.getByLabelText("Lv 1-2 진행 중"));

    expect(onSelectSublevel).toHaveBeenCalledWith(1, 2);
  });
});

// ─────────────────────────────────────────────────────────
describe("LevelSelect - UpgradeModal → Pricing 이동", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, profile: null });
    mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
  });

  it("UpgradeModal에서 'Pricing 보기' 클릭 → /pricing 이동", async () => {
    renderLevelSelect();

    // 구독 잠금 셀 클릭 → 모달 오픈
    await userEvent.click(screen.getByLabelText("Lv 2-1 Pro 전용"));
    expect(screen.getByText(/Pro 구독으로 전체 단계 해제/)).toBeInTheDocument();

    // Pricing 보기 클릭
    await userEvent.click(screen.getByRole("button", { name: /Pricing 보기/ }));

    expect(mockNavigate).toHaveBeenCalledWith("/pricing");
  });

  it("UpgradeModal 닫기 → 모달 닫힘", async () => {
    renderLevelSelect();

    await userEvent.click(screen.getByLabelText("Lv 2-1 Pro 전용"));
    expect(screen.getByText(/Pro 구독으로 전체 단계 해제/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "닫기" }));

    await waitFor(() => {
      expect(screen.queryByText(/Pro 구독으로 전체 단계 해제/)).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────
describe("LevelSelect - 뒤로가기", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null, profile: null });
    mockUseLevelProgress.mockReturnValue(mockProgressHook([]));
  });

  it("'메인으로 돌아가기' 버튼 클릭 → onBack 호출", async () => {
    const onBack = vi.fn();
    renderLevelSelect({ onBack });

    await userEvent.click(screen.getByText(/메인으로 돌아가기/));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
