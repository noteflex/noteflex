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
  useT: () => ({ masteryCard: { clearAt100: "🎯 100점이면 클리어" } }),
}));

// recent_plays: accuracy·reaction 점수는 최근 7판 윈도우 기반 — 모든 기준 충족값으로 설정
const PASSING_PLAY = { at: "2026-01-01T00:00:00Z", attempts: 10, correct: 9, reaction_ratio: 0.25 };
const baseProg: SublevelProgress = {
  level: 1,
  sublevel: 1,
  play_count: 10,
  best_streak: 5,
  total_attempts: 100,
  total_correct: 85,
  passed: false,
  avg_reaction_ratio: 0.30,
  recent_plays: Array(7).fill(PASSING_PLAY), // accuracy 90% > 85%, reaction 0.25 < 0.35
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

  it("recent_plays reaction_ratio null → reaction 점수 0", () => {
    const prog: SublevelProgress = {
      ...baseProg,
      recent_plays: Array(7).fill({ ...PASSING_PLAY, reaction_ratio: null }),
    };
    expect(computeMasteryScore(prog)).toBe(Math.round(25 + 0 + 25 + 25));
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

describe("MasteryScoreCard — default 접힘 + 토글", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("마운트 시 metrics-layer 숨김 (default 접힘)", () => {
    renderCard("free");
    expect(screen.queryByTestId("metrics-layer")).not.toBeInTheDocument();
  });

  it("토글 클릭 → metrics-layer 펼침", async () => {
    renderCard("free");
    expect(screen.queryByTestId("metrics-layer")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("metrics-layer")).toBeInTheDocument();
  });

  it("토글 두 번 → metrics-layer 다시 접힘", async () => {
    renderCard("free");
    await userEvent.click(screen.getByTestId("expand-toggle")); // 펼침
    expect(screen.getByTestId("metrics-layer")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("expand-toggle")); // 접힘
    expect(screen.queryByTestId("metrics-layer")).not.toBeInTheDocument();
  });

  it("progress null 이어도 expand-toggle 노출, 클릭 후 metrics-layer 노출", async () => {
    renderCard("free", null);
    expect(screen.getByTestId("expand-toggle")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("metrics-layer")).toBeInTheDocument();
  });

  it("progress null 4지표 표시 — accuracy sampleInsufficient → '—', count·streak → '0'", async () => {
    renderCard("pro", null);
    await userEvent.click(screen.getByTestId("expand-toggle"));
    const rows = screen.getAllByTestId("metric-row");
    expect(rows).toHaveLength(4);
    // sampleInsufficient=true → accuracy·reaction은 "—"
    expect(rows[0]).toHaveTextContent("—");
    // playCount = 0, bestStreak = 0
    expect(rows[2]).toHaveTextContent("0");
    expect(rows[3]).toHaveTextContent("0");
  });
});

describe("MasteryScoreCard — tier blur (metrics 펼침 후)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLang.mockReturnValue({ lang: "ko" });
  });

  it("free — metrics 펼치면 upgrade-cta 노출", async () => {
    renderCard("free");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("upgrade-cta")).toBeInTheDocument();
  });

  it("guest — metrics 펼치면 upgrade-cta 노출", async () => {
    renderCard("guest");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("upgrade-cta")).toBeInTheDocument();
  });

  it("free null progress — upgrade-cta 표시", async () => {
    renderCard("free", null);
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("upgrade-cta")).toBeInTheDocument();
  });

  it("pro — upgrade-cta 없음, 4개 metric-row 노출", async () => {
    renderCard("pro");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.queryByTestId("upgrade-cta")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("metric-row")).toHaveLength(4);
  });

  it("premium — upgrade-cta 없음", async () => {
    renderCard("premium");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.queryByTestId("upgrade-cta")).not.toBeInTheDocument();
  });

  it("admin — upgrade-cta 없음", async () => {
    renderCard("admin");
    await userEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.queryByTestId("upgrade-cta")).not.toBeInTheDocument();
  });
});
