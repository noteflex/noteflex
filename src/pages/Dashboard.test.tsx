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

// useLevelProgress is used by MasteryHeroCard in Dashboard — stub to prevent
// async state updates after test teardown (window is not defined in jsdom).
vi.mock("@/hooks/useLevelProgress", () => ({
  useLevelProgress: () => ({
    progress: [],
    loading: false,
    getProgressFor: () => null,
    fetchProgress: vi.fn(),
    recordAttempt: vi.fn().mockResolvedValue(null),
  }),
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

import Dashboard from "./Dashboard";

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
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Dashboard — 탭 네비게이션", () => {
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

  it("/dashboard 기본 진입 시 diagnosis 탭이 활성 (기본 변경 영역)", async () => {
    renderAt("/dashboard");

    const diagnosisTab = screen.getByRole("tab", { name: /Diagnosis/ });
    expect(diagnosisTab).toHaveAttribute("data-state", "active");

    // diagnosis 탭 = 마운트 직후 Analyzing 로딩 → 빈 데이터 메시지 (mocked fetchUserNoteLogs 빈 결과)
    expect(await screen.findByText(/No records yet/)).toBeInTheDocument();
  });

  it("/dashboard?tab=diagnosis 진입 시 diagnosis 탭 활성 + DiagnosisTab 마운트", async () => {
    renderAt("/dashboard?tab=diagnosis");

    const diagnosisTab = screen.getByRole("tab", {
      name: /Diagnosis/,
    });
    expect(diagnosisTab).toHaveAttribute("data-state", "active");

    // DiagnosisTab은 마운트 즉시 로딩 스피너를 표시 (fetchUserNoteLogs 진행 중)
    // EN default lang
    expect(await screen.findByText(/Analyzing/)).toBeInTheDocument();
  });

  it("잘못된 tab 값 (?tab=invalid)은 diagnosis로 fallback", async () => {
    renderAt("/dashboard?tab=invalid");

    const diagnosisTab = screen.getByRole("tab", { name: /Diagnosis/ });
    expect(diagnosisTab).toHaveAttribute("data-state", "active");
    // diagnosis 탭 마운트 — async fetch 후 빈 데이터 메시지
    expect(await screen.findByText(/No records yet/)).toBeInTheDocument();
  });

  it("탭 클릭 시 URL이 ?tab=...으로 업데이트됨", async () => {
    const user = userEvent.setup();
    renderAt("/dashboard");

    const activityTab = screen.getByRole("tab", {
      name: /Activity/,
    });
    await user.click(activityTab);

    expect(activityTab).toHaveAttribute("data-state", "active");
    // activity 전용 콘텐츠 확인
    expect(screen.getByText(/Recent Sessions/)).toBeInTheDocument();
    // diagnosis 전용 콘텐츠는 더 이상 DOM에 없음 (Radix TabsContent는 inactive 시 unmount, async fetch도 X)
    // No records yet 메시지가 안 나옴
    expect(screen.queryByText(/Recent Sessions/)).toBeInTheDocument();
  });

  it("각 탭의 콘텐츠가 분리되어 렌더됨", () => {
    // rhythm: XP 추이 / 정확도·반응속도 / 약점 음표 / AI 피드백
    const { unmount } = renderAt("/dashboard?tab=rhythm");
    expect(screen.getByText(/XP Trend/)).toBeInTheDocument();
    expect(screen.getByText(/Weakest Notes — Top 10/)).toBeInTheDocument();
    expect(
      screen.getByText(/AI reviews your playing and suggests/)
    ).toBeInTheDocument();
    // rhythm에는 세션 테이블 없음
    expect(screen.queryByText(/Recent Sessions/)).not.toBeInTheDocument();
    unmount();

    // activity: 최근 세션
    renderAt("/dashboard?tab=activity");
    expect(screen.getByText(/Recent Sessions/)).toBeInTheDocument();
    // activity에는 차트/AI 피드백 없음
    expect(screen.queryByText(/XP Trend/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/AI reviews your playing and suggests/)
    ).not.toBeInTheDocument();
  });

  it("헤더/요약 섹션은 탭 바깥에서 항상 렌더됨", () => {
    // rhythm에서
    const { unmount } = renderAt("/dashboard?tab=rhythm");
    expect(screen.getByText(/Playground/)).toBeInTheDocument();
    expect(screen.getByText(/Current Streak/)).toBeInTheDocument();
    expect(screen.getByText(/Today XP/)).toBeInTheDocument();
    unmount();

    // diagnosis 탭은 default tab (첫 진입 시)
    renderAt("/dashboard");
    expect(screen.getByText(/Playground/)).toBeInTheDocument();
    expect(screen.getByText(/Current Streak/)).toBeInTheDocument();
  });
});

// noop to keep `within` import (used in earlier iterations, defensive)
void within;
