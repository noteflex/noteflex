import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("just_passed=true: 통과 축하 메시지 표시", () => {
    render(<SublevelPassedDialog {...baseProps} />);
    expect(screen.getByText(/Lv 2-1 통과/)).toBeInTheDocument();
    expect(screen.getByText(/Lv 2-2.*해제/)).toBeInTheDocument();
  });

  it("just_passed=false: 클리어 메시지 (이미 통과한 단계 재플레이)", () => {
    render(<SublevelPassedDialog {...baseProps} justPassed={false} />);
    expect(screen.getByText(/Lv 2-1 클리어/)).toBeInTheDocument();
    expect(screen.queryByText(/해제/)).not.toBeInTheDocument();
  });

  it("정답률 계산 정확 (27/30 = 90%)", () => {
    render(<SublevelPassedDialog {...baseProps} />);
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("다음 단계 버튼은 just_passed=true에서만 보임", () => {
    const { rerender } = render(<SublevelPassedDialog {...baseProps} />);
    expect(screen.getByText(/Lv 2-2로/)).toBeInTheDocument();

    rerender(<SublevelPassedDialog {...baseProps} justPassed={false} />);
    expect(screen.queryByText(/Lv 2-2로/)).not.toBeInTheDocument();
  });

  it("Lv 7-3 통과 시 그랜드마스터 메시지", () => {
    render(<SublevelPassedDialog {...baseProps} level={7} sublevel={3} />);
    expect(screen.getByText(/그랜드마스터/)).toBeInTheDocument();
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
    await user.click(screen.getByText(/단계 선택으로/));
    expect(onBackToSelect).toHaveBeenCalledOnce();
  });

  it("같은 단계 한 번 더 클릭 시 onReplay 호출", async () => {
    const user = userEvent.setup();
    const onReplay = vi.fn();
    render(<SublevelPassedDialog {...baseProps} onReplay={onReplay} />);
    await user.click(screen.getByText(/같은 단계 한 번 더/));
    expect(onReplay).toHaveBeenCalledOnce();
  });

  it("다음 단계 버튼 클릭 시 onGoToNextSublevel 호출", async () => {
    const user = userEvent.setup();
    const onGoToNextSublevel = vi.fn();
    render(
      <SublevelPassedDialog {...baseProps} onGoToNextSublevel={onGoToNextSublevel} />
    );
    await user.click(screen.getByText(/Lv 2-2로/));
    expect(onGoToNextSublevel).toHaveBeenCalledOnce();
  });
});