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

  it("play_count=5, 나머지 동일 → count 점수 반영", () => {
    const prog: SublevelProgress = { ...baseProg, play_count: 5 };
    expect(computeMasteryScore(prog)).toBe(Math.round(25 + 25 + 12.5 + 25));
  });

  it("avg_reaction_ratio undefined → reaction 점수 ≈0", () => {
    const prog: SublevelProgress = { ...baseProg, avg_reaction_ratio: undefined };
    expect(computeMasteryScore(prog)).toBe(Math.round(25 + 0.09 + 25 + 25));
  });

  it("fast_track=true → 100 강제 (메트릭 무관)", () => {
    const prog: SublevelProgress = {
      ...baseProg,
      play_count: 1,
      best_streak: 2,
      fast_track: true,
    };
    expect(computeMasteryScore(prog)).toBe(100);
  });
});

describe("MasteryScoreCard — Layer 1 (score + progress bar)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("progress 있을 때 score 숫자 표시", () => {
    renderCard("free");
    expect(screen.getByTestId("score-number")).toHaveTextContent("100");
  });

  it("progress bar 항상 표시", () => {
    renderCard("free");
    expect(screen.getByTestId("score-progress-bar")).toBeInTheDocument();
  });

  it("progress null → score '—' + '첫 세션을 시작해보세요' + progress bar 0%", () => {
    renderCard("free", null);
    expect(screen.getByTestId("score-number")).toHaveTextContent("—");
    expect(screen.getByTestId("no-data-hint")).toHaveTextContent("첫 세션을 시작해보세요");
    expect(screen.getByTestId("score-progress-bar")).toBeInTheDocument();
  });

  it("progress null 영어 → 'Start your first session'", () => {
    mockUseLang.mockReturnValue({ lang: "en" });
    renderCard("free", null);
    expect(screen.getByTestId("no-data-hint")).toHaveTextContent("Start your first session");
  });
});

describe("MasteryScoreCard — default 펼침 + 토글", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("마운트 시 metrics-layer 이미 노출 (default 펼침)", () => {
    renderCard("free");
    expect(screen.getByTestId("metrics-layer")).toBeInTheDocument();
  });

  it("토글 클릭 → metrics-layer 접힘", async () => {
    renderCard("free");
    expect(screen.getByTestId("metrics-layer")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.queryByTestId("metrics-layer")).not.toBeInTheDocument();
  });

  it("토글 다시 클릭 → metrics-layer 펼침", async () => {
    renderCard("free");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("metrics-layer")).toBeInTheDocument();
  });

  it("progress null 이어도 toggle + metrics-layer 노출", () => {
    renderCard("free", null);
    expect(screen.getByTestId("expand-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("metrics-layer")).toBeInTheDocument();
  });

  it("progress null 4지표 0 값 표시", () => {
    renderCard("pro", null);
    const rows = screen.getAllByTestId("metric-row");
    expect(rows).toHaveLength(4);
    // accuracy = 0%, playCount = 0, bestStreak = 0
    expect(rows[0]).toHaveTextContent("0%");
    expect(rows[2]).toHaveTextContent("0");
    expect(rows[3]).toHaveTextContent("0");
  });
});

describe("MasteryScoreCard — tier blur (default 펼침)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("free — 마운트 시 즉시 blur-layer 인지 (클릭 불필요)", () => {
    renderCard("free");
    expect(screen.getByTestId("blur-layer")).toBeInTheDocument();
    expect(screen.getByTestId("upgrade-overlay")).toBeInTheDocument();
  });

  it("guest — 마운트 시 즉시 blur-layer 인지", () => {
    renderCard("guest");
    expect(screen.getByTestId("blur-layer")).toBeInTheDocument();
  });

  it("free null progress — blur 여전히 표시", () => {
    renderCard("free", null);
    expect(screen.getByTestId("blur-layer")).toBeInTheDocument();
  });

  it("pro — blur 없음, 4개 metric-row 즉시 노출", () => {
    renderCard("pro");
    expect(screen.queryByTestId("blur-layer")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("metric-row")).toHaveLength(4);
  });

  it("premium — blur 없음", () => {
    renderCard("premium");
    expect(screen.queryByTestId("blur-layer")).not.toBeInTheDocument();
  });

  it("admin — blur 없음", () => {
    renderCard("admin");
    expect(screen.queryByTestId("blur-layer")).not.toBeInTheDocument();
  });
});
