import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import MasteryScoreCard, { computeMasteryScore } from "./MasteryScoreCard";
import type { SublevelProgress } from "@/lib/levelSystem";

const { mockNavigate, mockUseLang } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseLang: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/contexts/LanguageContext", () => ({
  useLang: () => mockUseLang(),
}));

const baseProg: SublevelProgress = {
  level: 1,
  sublevel: 1,
  play_count: 10,
  best_streak: 5,
  total_attempts: 100,
  total_correct: 85,
  passed: false,
  avg_reaction_ratio: 0.30,
};

function renderCard(
  tier: "guest" | "free" | "pro" | "premium" | "admin",
  progress: SublevelProgress | null = baseProg,
  extra: Partial<React.ComponentProps<typeof MasteryScoreCard>> = {}
) {
  return render(
    <MemoryRouter>
      <MasteryScoreCard
        tier={tier}
        progress={progress}
        level={1}
        sublevel={1}
        {...extra}
      />
    </MemoryRouter>
  );
}

describe("computeMasteryScore", () => {
  it("pass criteria 달성 → 100", () => {
    expect(computeMasteryScore(baseProg)).toBe(100);
  });

  it("null progress → 0", () => {
    expect(computeMasteryScore(null)).toBe(0);
  });

  it("play_count=5, best_streak=5, accuracy=0.85, reaction=0.30 → 50 + 25 + 25 = ...", () => {
    const prog: SublevelProgress = {
      ...baseProg,
      play_count: 5,
    };
    // count_score = min(5/10,1)*25 = 12.5; others unchanged
    const score = computeMasteryScore(prog);
    expect(score).toBe(Math.round(25 + 25 + 12.5 + 25)); // = 88
  });

  it("avg_reaction_ratio undefined → reaction 점수 0", () => {
    const prog: SublevelProgress = {
      ...baseProg,
      avg_reaction_ratio: undefined,
      play_count: 10,
      best_streak: 5,
      total_attempts: 100,
      total_correct: 85,
    };
    // reaction=99 → LEAST(0.35/99,1)*25 ≈ 0; others: acc=25, count=25, streak=25
    const score = computeMasteryScore(prog);
    expect(score).toBe(Math.round(25 + 0.09 + 25 + 25)); // ≈ 75
  });
});

describe("MasteryScoreCard — 렌더", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("score 숫자 표시", () => {
    renderCard("free");
    expect(screen.getByTestId("score-number")).toHaveTextContent("100");
  });

  it("progress bar 표시", () => {
    renderCard("free");
    expect(screen.getByTestId("score-progress-bar")).toBeInTheDocument();
  });

  it("progress null → '아직 기록 없음', progress bar 없음", () => {
    renderCard("free", null);
    expect(screen.getByText("아직 기록 없음")).toBeInTheDocument();
    expect(screen.queryByTestId("score-progress-bar")).not.toBeInTheDocument();
  });

  it("expand toggle 클릭 → metrics-layer 표시", async () => {
    renderCard("free");
    expect(screen.queryByTestId("metrics-layer")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("metrics-layer")).toBeInTheDocument();
  });

  it("collapse 클릭 → metrics-layer 숨김", async () => {
    renderCard("free");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("metrics-layer")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.queryByTestId("metrics-layer")).not.toBeInTheDocument();
  });
});

describe("MasteryScoreCard — tier blur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("free → expand 시 PremiumBlurCard blur-layer 표시", async () => {
    renderCard("free");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("blur-layer")).toBeInTheDocument();
    expect(screen.getByTestId("upgrade-overlay")).toBeInTheDocument();
  });

  it("guest → expand 시 PremiumBlurCard blur-layer 표시", async () => {
    renderCard("guest");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("blur-layer")).toBeInTheDocument();
  });

  it("pro → expand 시 blur 없음, 4개 metric-row 노출", async () => {
    renderCard("pro");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.queryByTestId("blur-layer")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("metric-row")).toHaveLength(4);
  });

  it("premium → expand 시 blur 없음", async () => {
    renderCard("premium");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.queryByTestId("blur-layer")).not.toBeInTheDocument();
  });

  it("admin → expand 시 blur 없음", async () => {
    renderCard("admin");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.queryByTestId("blur-layer")).not.toBeInTheDocument();
  });
});
