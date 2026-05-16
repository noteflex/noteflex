import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

// useLevelProgress 영역 — async state updates after teardown 방지
vi.mock("@/hooks/useLevelProgress", () => ({
  useLevelProgress: () => ({
    progress: [],
    loading: false,
    getProgressFor: () => null,
    fetchProgress: vi.fn(),
    recordAttempt: vi.fn().mockResolvedValue(null),
  }),
}));

// userNoteLogs 영역 — WeakSlowNotesCards 마운트 시 호출
vi.mock("@/lib/userNoteLogs", () => ({
  fetchUserNoteLogs: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

import Dashboard from "./Dashboard";

const defaultStats = {
  currentStreak: 3,
  longestStreak: 7,
  totalXp: 1234,
  currentLeagueName: "Bronze",
  lastPracticeDate: null,
  todayXp: 50,
  weekStats: [],
  league: null,
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

describe("Dashboard — 미니멀 단일 페이지 (3 상태 분기)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      profile: { role: "user" },
      loading: false,
    });
  });

  it("상태 3 (신규 사용자): 세션 X + lastPracticeDate null → 큰 CTA + AI 카드만", () => {
    mockUseUserStats.mockReturnValue({ ...defaultStats, lastPracticeDate: null });
    mockUseMyStats.mockReturnValue({ ...defaultMyStats, sessions: [] });

    renderAt("/dashboard");

    // 신규 사용자 영역 박힘 (EN default)
    expect(screen.getByText(/Start your first session/)).toBeInTheDocument();
    // AI Feedback 카드 박힘 (Pro 후킹)
    expect(screen.getByTestId("ai-feedback-card")).toBeInTheDocument();
    // KPI 카드는 노출 X (신규 사용자 영역)
    expect(screen.queryByText(/Current Streak/)).not.toBeInTheDocument();
  });

  it("상태 2 (오늘 활동 X): notice + KPI 비활성 + 마지막 활동", () => {
    mockUseUserStats.mockReturnValue({
      ...defaultStats,
      currentStreak: 5,
      lastPracticeDate: "2026-05-13", // 이전 날짜
    });
    mockUseMyStats.mockReturnValue({
      ...defaultMyStats,
      sessions: [
        {
          id: "s1",
          level: 2,
          started_at: "2026-05-13T10:00:00Z",
          total_notes: 20,
          correct_notes: 17,
          accuracy: 0.85,
          avg_reaction_ms: 4500,
          xp_earned: 100,
        },
      ],
    });

    renderAt("/dashboard");

    // notice 박힘 + 스트릭 hint
    expect(screen.getByText(/haven't started today yet/)).toBeInTheDocument();
    // KPI 4 카드 박힘
    expect(screen.getByText(/Current Streak/)).toBeInTheDocument();
    expect(screen.getByText(/Today XP/)).toBeInTheDocument();
    // 마지막 활동 카드 박힘
    expect(screen.getByText(/Last activity/)).toBeInTheDocument();
    // AI Feedback 박힘
    expect(screen.getByTestId("ai-feedback-card")).toBeInTheDocument();
  });

  it("상태 1 (오늘 활동 있음): KPI 정상 + 음표 + AI", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayIso = `${y}-${m}-${day}`;

    mockUseUserStats.mockReturnValue({
      ...defaultStats,
      currentStreak: 3,
      lastPracticeDate: todayIso,
      todayXp: 80,
    });
    mockUseMyStats.mockReturnValue({
      ...defaultMyStats,
      sessions: [
        {
          id: "s-today",
          level: 2,
          started_at: `${todayIso}T10:00:00Z`,
          total_notes: 20,
          correct_notes: 18,
          accuracy: 0.9,
          avg_reaction_ms: 4000,
          xp_earned: 80,
        },
      ],
    });

    renderAt("/dashboard");

    // notice 박지 말 것 (오늘 활동 영역)
    expect(screen.queryByText(/haven't started today yet/)).not.toBeInTheDocument();
    // KPI 박힘
    expect(screen.getByText(/Current Streak/)).toBeInTheDocument();
    expect(screen.getByText(/Today's practice done/)).toBeInTheDocument();
    // AI Feedback 박힘
    expect(screen.getByTestId("ai-feedback-card")).toBeInTheDocument();
  });

  it("AI Feedback 카드는 Free 사용자에서 blur 박힘 (PremiumBlurCard)", () => {
    mockUseUserStats.mockReturnValue({ ...defaultStats, lastPracticeDate: null });
    mockUseMyStats.mockReturnValue({ ...defaultMyStats });

    renderAt("/dashboard");

    // PremiumBlurCard 박힘 (Free 사용자 = blur)
    expect(screen.getByTestId("blur-layer")).toBeInTheDocument();
    expect(screen.getByTestId("upgrade-overlay")).toBeInTheDocument();
  });

  it("admin 사용자는 AI Feedback 풀 노출 (blur 없음)", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "admin-1" },
      profile: { role: "admin" },
      loading: false,
    });
    mockUseUserStats.mockReturnValue({ ...defaultStats, lastPracticeDate: null });
    mockUseMyStats.mockReturnValue({ ...defaultMyStats });

    renderAt("/dashboard");

    // admin = 풀 노출, blur 없음
    expect(screen.queryByTestId("blur-layer")).not.toBeInTheDocument();
  });

  it("reviewer 사용자는 AI Feedback blur 박힘 (Paddle 심사관 결제 흐름 검증)", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "reviewer-1" },
      profile: { role: "reviewer" },
      loading: false,
    });
    mockUseUserStats.mockReturnValue({ ...defaultStats, lastPracticeDate: null });
    mockUseMyStats.mockReturnValue({ ...defaultMyStats });

    renderAt("/dashboard");

    // reviewer = Free 동등 → blur 박힘
    expect(screen.getByTestId("blur-layer")).toBeInTheDocument();
  });
});
