import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import MasteryHeroCard, { type MasteryHeroCardProps } from "./MasteryHeroCard";

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

// recharts uses ResizeObserver — stub it
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const baseProps: MasteryHeroCardProps = {
  tier: "free",
  bestScore: 72,
  level: 2,
  sublevel: 1,
};

function renderCard(props: Partial<MasteryHeroCardProps> = {}) {
  return render(
    <MemoryRouter>
      <MasteryHeroCard {...baseProps} {...props} />
    </MemoryRouter>
  );
}

describe("MasteryHeroCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("score 숫자 표시", () => {
    renderCard();
    expect(screen.getByTestId("hero-score")).toHaveTextContent("72");
  });

  it("free — 업그레이드 CTA 표시", () => {
    renderCard({ tier: "free" });
    expect(screen.getByTestId("free-cta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Premium 시작하기" })).toBeInTheDocument();
  });

  it("guest — 업그레이드 CTA 표시", () => {
    renderCard({ tier: "guest" });
    expect(screen.getByTestId("free-cta")).toBeInTheDocument();
  });

  it("pro — CTA 없음, premium-metrics 표시", () => {
    renderCard({
      tier: "pro",
      accuracy: 0.90,
      avgReactionRatio: 0.28,
      playCount: 15,
      bestStreak: 8,
    });
    expect(screen.queryByTestId("free-cta")).not.toBeInTheDocument();
    expect(screen.getByTestId("premium-metrics")).toBeInTheDocument();
    expect(screen.getAllByTestId("metric-tile")).toHaveLength(4);
  });

  it("premium — 4 metric-tile 표시", () => {
    renderCard({
      tier: "premium",
      accuracy: 0.88,
      avgReactionRatio: 0.31,
      playCount: 10,
      bestStreak: 6,
    });
    expect(screen.getAllByTestId("metric-tile")).toHaveLength(4);
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("coachingLine prop 있으면 표시", () => {
    renderCard({ coachingLine: "훌륭해요! 꾸준한 연습이 빛을 발하고 있어요." });
    expect(screen.getByTestId("coaching-line")).toHaveTextContent("훌륭해요!");
  });

  it("premium + chartData → trend-chart 표시", () => {
    const chartData = [
      { date: "05/03", score: 60 },
      { date: "05/04", score: 68 },
      { date: "05/05", score: 72 },
    ];
    renderCard({ tier: "premium", chartData });
    expect(screen.getByTestId("trend-chart")).toBeInTheDocument();
  });

  it("onUpgrade 미제공 시 CTA 클릭 → /pricing 이동", async () => {
    renderCard({ tier: "free" });
    await userEvent.click(screen.getByRole("button", { name: "Premium 시작하기" }));
    expect(mockNavigate).toHaveBeenCalledWith("/pricing");
  });
});
