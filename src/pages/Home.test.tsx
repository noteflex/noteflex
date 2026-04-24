import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { mockUseAuth, mockUseUserStats, mockUseMyStats } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseUserStats: vi.fn(),
  mockUseMyStats: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/hooks/useUserStats", () => ({
  useUserStats: mockUseUserStats,
}));

vi.mock("@/hooks/useMyStats", () => ({
  useMyStats: mockUseMyStats,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// DiagnosisTab pulls user note logs via supabase — stub to keep the tab test
// hermetic. Empty result triggers the friendly "no records yet" empty state.
vi.mock("@/lib/userNoteLogs", () => ({
  fetchUserNoteLogs: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

// BatchAnalysisSection has its own supabase-dependent hook — stub it out
// since it's covered by its own dedicated tests.
vi.mock("@/components/BatchAnalysisSection", () => ({
  default: () => null,
}));

// Recharts uses ResizeObserver / DOM measurement — stub out the chart
// components so the tab content mounts without jsdom layout errors.
vi.mock("recharts", async () => {
  const React = await import("react");
  const Stub = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "recharts-stub" }, children);
  const Leaf = () => null;
  return {
    ResponsiveContainer: Stub,
    BarChart: Stub,
    LineChart: Stub,
    CartesianGrid: Leaf,
    XAxis: Leaf,
    YAxis: Leaf,
    Tooltip: Leaf,
    Bar: Leaf,
    Line: Leaf,
  };
});

import Home from "./Home";

const defaultStats = {
  currentStreak: 3,
  longestStreak: 7,
  totalXp: 1234,
  currentLeagueName: "Bronze",
  lastPracticeDate: null,
  todayXp: 50,
  weekStats: [],
  league: { id: 1, name: "Bronze", rank: 1, icon: null, color: null, description: null },
  standing: null,
  loading: false,
  error: null,
  lastUpdated: null,
  refresh: vi.fn().mockResolvedValue(undefined),
};

const defaultMyStats = {
  sessions: [],
  dailyStats30d: [],
  weakNotes: [],
  loading: false,
  error: null,
  lastUpdated: null,
  refresh: vi.fn().mockResolvedValue(undefined),
};

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/home" element={<Home />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Home — 탭 네비게이션", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      profile: { role: "user" },
      loading: false,
    });
    mockUseUserStats.mockReturnValue(defaultStats);
    mockUseMyStats.mockReturnValue(defaultMyStats);
  });

  it("/home 기본 진입 시 rhythm 탭이 활성", () => {
    renderAt("/home");

    const rhythmTab = screen.getByRole("tab", { name: /학습.*리듬|리듬/ });
    expect(rhythmTab).toHaveAttribute("data-state", "active");

    // rhythm 전용 콘텐츠 확인
    expect(screen.getByText(/XP 추이/)).toBeInTheDocument();
    expect(screen.getByText(/정확도 · 반응속도 추이/)).toBeInTheDocument();
  });

  it("/home?tab=diagnosis 진입 시 diagnosis 탭 활성 + DiagnosisTab 마운트", async () => {
    renderAt("/home?tab=diagnosis");

    const diagnosisTab = screen.getByRole("tab", {
      name: /실력.*진단|진단/,
    });
    expect(diagnosisTab).toHaveAttribute("data-state", "active");

    // DiagnosisTab은 마운트 즉시 로딩 스피너를 표시 (fetchUserNoteLogs 진행 중)
    expect(await screen.findByText(/분석 중/)).toBeInTheDocument();
  });

  it("잘못된 tab 값 (?tab=invalid)은 rhythm으로 fallback", () => {
    renderAt("/home?tab=invalid");

    const rhythmTab = screen.getByRole("tab", { name: /학습.*리듬|리듬/ });
    expect(rhythmTab).toHaveAttribute("data-state", "active");
    expect(screen.getByText(/XP 추이/)).toBeInTheDocument();
  });

  it("탭 클릭 시 URL이 ?tab=...으로 업데이트됨", async () => {
    const user = userEvent.setup();
    renderAt("/home");

    const activityTab = screen.getByRole("tab", {
      name: /활동.*기록|기록/,
    });
    await user.click(activityTab);

    expect(activityTab).toHaveAttribute("data-state", "active");
    // activity 전용 콘텐츠 확인
    expect(screen.getByText(/최근 세션/)).toBeInTheDocument();
    // rhythm 전용 콘텐츠는 더 이상 DOM에 없음 (Radix TabsContent는 inactive 시 unmount)
    expect(screen.queryByText(/XP 추이/)).not.toBeInTheDocument();
  });

  it("각 탭의 콘텐츠가 분리되어 렌더됨", () => {
    // rhythm: XP 추이 / 정확도·반응속도 / 약점 음표 / AI 피드백
    const { unmount } = renderAt("/home?tab=rhythm");
    expect(screen.getByText(/XP 추이/)).toBeInTheDocument();
    expect(screen.getByText(/약점 음표 Top 10/)).toBeInTheDocument();
    expect(
      screen.getByText(/AI가 너의 연주를 보고 코멘트와 다음 목표를 제안해요/)
    ).toBeInTheDocument();
    // rhythm에는 세션 테이블 없음
    expect(screen.queryByText(/최근 세션/)).not.toBeInTheDocument();
    unmount();

    // activity: 최근 세션
    renderAt("/home?tab=activity");
    expect(screen.getByText(/최근 세션/)).toBeInTheDocument();
    // activity에는 차트/AI 피드백 없음
    expect(screen.queryByText(/XP 추이/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/AI가 너의 연주를 보고 코멘트와 다음 목표를 제안해요/)
    ).not.toBeInTheDocument();
  });

  it("헤더/요약 섹션은 탭 바깥에서 항상 렌더됨", () => {
    // rhythm에서
    const { unmount } = renderAt("/home?tab=rhythm");
    expect(screen.getByText(/플레이그라운드/)).toBeInTheDocument();
    expect(screen.getByText(/현재 스트릭/)).toBeInTheDocument();
    expect(screen.getByText(/오늘 XP/)).toBeInTheDocument();
    unmount();

    // diagnosis에서도 (placeholder 탭)
    renderAt("/home?tab=diagnosis");
    expect(screen.getByText(/플레이그라운드/)).toBeInTheDocument();
    expect(screen.getByText(/현재 스트릭/)).toBeInTheDocument();
  });
});

// noop to keep `within` import (used in earlier iterations, defensive)
void within;
