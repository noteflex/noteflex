// src/components/GameOverDialog.test.tsx

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GameOverDialog } from "./GameOverDialog";

describe("GameOverDialog", () => {
  const baseProps = {
    open: true,
    level: 2,
    sublevel: 2 as const,
    totalAttempts: 10,
    totalCorrect: 4,
    bestStreak: 3,
    onReplay: vi.fn(),
    onGoToPreviousSublevel: vi.fn(),
    onClose: vi.fn(),
  };

  it("게임오버 제목 + 단계 라벨 표시", () => {
    render(<GameOverDialog {...baseProps} />);
    // EN default lang — useT() fallback
    expect(screen.getByText(/Game Over/)).toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveTextContent("Lv 2-2");
  });

  it("정답률 계산 정확 (4/10 = 40%)", () => {
    render(<GameOverDialog {...baseProps} />);
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("이전 단계 버튼 클릭 시 onGoToPreviousSublevel 호출", async () => {
    const user = userEvent.setup();
    const onGoToPreviousSublevel = vi.fn();
    render(
      <GameOverDialog {...baseProps} onGoToPreviousSublevel={onGoToPreviousSublevel} />
    );
    // EN: "Back to {label}"
    const button = screen.getByRole("button", { name: /Back to/ });
    await user.click(button);
    expect(onGoToPreviousSublevel).toHaveBeenCalledOnce();
  });

  it("다시 도전 버튼 클릭 시 onReplay 호출", async () => {
    const user = userEvent.setup();
    const onReplay = vi.fn();
    render(<GameOverDialog {...baseProps} onReplay={onReplay} />);
    await user.click(screen.getByRole("button", { name: /Retry this stage/ }));
    expect(onReplay).toHaveBeenCalledOnce();
  });

  it("Lv 1-1에서는 이전 단계 버튼 안 보임", () => {
    render(<GameOverDialog {...baseProps} level={1} sublevel={1} />);
    expect(
      screen.queryByRole("button", { name: /Back to/ })
    ).not.toBeInTheDocument();
  });

  it("시도 0회면 정답률 0% 표시 (NaN 방지)", () => {
    render(
      <GameOverDialog {...baseProps} totalAttempts={0} totalCorrect={0} />
    );
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});