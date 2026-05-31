import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SublevelPassedDialog } from "./SublevelPassedDialog";

describe("SublevelPassedDialog", () => {
  const baseProps = {
    open: true,
    level: 2,
    sublevel: 1 as const,
    totalAttempts: 30,
    totalCorrect: 27,
    bestStreak: 8,
    justPassed: true,
    onReplay: vi.fn(),
    onGoToNextSublevel: vi.fn(),
    onBackToSelect: vi.fn(),
    onClose: vi.fn(),
  };

  it("just_passed=true: Passed 배지 + 단계 라벨 + 다음 단계 버튼 (5/31 리뉴얼 후)", () => {
    render(<SublevelPassedDialog {...baseProps} />);
    // 5/31 리뉴얼: 큰 축하 타이틀 → 컴팩트 배지 + 단계 라벨
    expect(screen.getByTestId("coaching-variant-badge")).toHaveTextContent(/Passed/);
    expect(screen.getByText("Lv 2-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Lv 2-2/ })).toBeInTheDocument();
  });

  it("just_passed=false: 단계 라벨 표시 + 다음 단계 버튼 없음 (이미 통과한 단계 재플레이)", () => {
    render(<SublevelPassedDialog {...baseProps} justPassed={false} />);
    expect(screen.getByTestId("coaching-variant-badge")).toHaveTextContent(/Passed/);
    expect(screen.getByText("Lv 2-1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lv 2-2/ })).not.toBeInTheDocument();
  });

  it("정답률 계산 정확 (27/30 = 90%)", () => {
    render(<SublevelPassedDialog {...baseProps} />);
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("다음 단계 버튼은 just_passed=true에서만 보임", () => {
    const { rerender } = render(<SublevelPassedDialog {...baseProps} />);
    // EN: "{nextLabel} →"
    expect(screen.getByRole("button", { name: /Lv 2-2/ })).toBeInTheDocument();

    rerender(<SublevelPassedDialog {...baseProps} justPassed={false} />);
    expect(screen.queryByRole("button", { name: /Lv 2-2/ })).not.toBeInTheDocument();
  });

  it("Lv 7-3 통과 시 단계 라벨·Passed 배지 표시 (그랜드마스터 텍스트는 5/31 리뉴얼에서 제거 — 컴팩트 디자인)", () => {
    render(<SublevelPassedDialog {...baseProps} level={7} sublevel={3} />);
    expect(screen.getByTestId("coaching-variant-badge")).toHaveTextContent(/Passed/);
    expect(screen.getByText("Lv 7-3")).toBeInTheDocument();
  });

  it("Lv 7-3에서 다음 단계 버튼 안 보임", () => {
    render(<SublevelPassedDialog {...baseProps} level={7} sublevel={3} />);
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it("단계 선택으로 버튼 클릭 시 onBackToSelect 호출", async () => {
    const user = userEvent.setup();
    const onBackToSelect = vi.fn();
    render(
      <SublevelPassedDialog {...baseProps} onBackToSelect={onBackToSelect} />
    );
    await user.click(screen.getByText(/Back to level select/));
    expect(onBackToSelect).toHaveBeenCalledOnce();
  });

  it("같은 단계 한 번 더 클릭 시 onReplay 호출", async () => {
    const user = userEvent.setup();
    const onReplay = vi.fn();
    render(<SublevelPassedDialog {...baseProps} onReplay={onReplay} />);
    await user.click(screen.getByText(/Play this stage again/));
    expect(onReplay).toHaveBeenCalledOnce();
  });

  it("다음 단계 버튼 클릭 시 onGoToNextSublevel 호출", async () => {
    const user = userEvent.setup();
    const onGoToNextSublevel = vi.fn();
    render(
      <SublevelPassedDialog {...baseProps} onGoToNextSublevel={onGoToNextSublevel} />
    );
    await user.click(screen.getByRole("button", { name: /Lv 2-2/ }));
    expect(onGoToNextSublevel).toHaveBeenCalledOnce();
  });
});

// ── fastTrack 분기 테스트 (lang default = "en") ───────────────────

describe("SublevelPassedDialog — fastTrack=true", () => {
  const ftProps = {
    open: true,
    level: 2,
    sublevel: 2 as const,
    totalAttempts: 20,
    totalCorrect: 20,
    bestStreak: 10,
    justPassed: true,
    fastTrack: true,
    onReplay: vi.fn(),
    onGoToNextSublevel: vi.fn(),
    onBackToSelect: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fastTrack=true → '🚀 Fast Track' 배지 노출", () => {
    render(<SublevelPassedDialog {...ftProps} />);
    expect(screen.getByTestId("fast-track-badge")).toHaveTextContent("🚀 Fast Track");
  });

  it("fastTrack=true → 'Already enough' 메시지 노출", () => {
    render(<SublevelPassedDialog {...ftProps} />);
    expect(screen.getByTestId("fast-track-message")).toHaveTextContent(
      "Already enough. Onto the next."
    );
  });

  it("fastTrack=true → 'Auto-advance in 5s' 라벨 노출", () => {
    render(<SublevelPassedDialog {...ftProps} />);
    expect(screen.getByTestId("auto-advance-label")).toHaveTextContent(
      "Auto-advance in 5s"
    );
  });

  it("fastTrack=true → 5초 후 onGoToNextSublevel 자동 호출", () => {
    const onGoToNextSublevel = vi.fn();
    render(<SublevelPassedDialog {...ftProps} onGoToNextSublevel={onGoToNextSublevel} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(onGoToNextSublevel).toHaveBeenCalledOnce();
  });

  it("fastTrack=true → 'Next stage now' 클릭 시 즉시 onGoToNextSublevel", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onGoToNextSublevel = vi.fn();
    render(<SublevelPassedDialog {...ftProps} onGoToNextSublevel={onGoToNextSublevel} />);
    await user.click(screen.getByTestId("fast-track-go-now-btn"));
    expect(onGoToNextSublevel).toHaveBeenCalledOnce();
  });

  it("fastTrack=true → 'Level select' 클릭 시 onBackToSelect 호출", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onBackToSelect = vi.fn();
    render(<SublevelPassedDialog {...ftProps} onBackToSelect={onBackToSelect} />);
    await user.click(screen.getByTestId("fast-track-level-select-btn"));
    expect(onBackToSelect).toHaveBeenCalledOnce();
  });

  it("fastTrack=true + Lv7-3 (no next) → 카운트다운·go-now 버튼 없음", () => {
    render(<SublevelPassedDialog {...ftProps} level={7} sublevel={3} />);
    expect(screen.queryByTestId("auto-advance-label")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fast-track-go-now-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("fast-track-level-select-btn")).toBeInTheDocument();
  });

  it("fastTrack=false → 일반 stats grid 노출 (회귀 X)", () => {
    render(<SublevelPassedDialog {...ftProps} fastTrack={false} />);
    expect(screen.queryByTestId("fast-track-badge")).not.toBeInTheDocument();
    expect(screen.getByTestId("coaching-comment")).toBeInTheDocument();
  });
});