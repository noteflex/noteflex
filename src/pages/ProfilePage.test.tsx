import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "./ProfilePage";
import { useNicknameAvailability } from "@/hooks/useNicknameAvailability";

// ─────────────────────────────────────────────────────────
// Mock
// ─────────────────────────────────────────────────────────

const mockSignOut = vi.fn();
const mockRefreshProfile = vi.fn().mockResolvedValue(undefined);
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSupabaseUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockSupabaseUpdate = vi.fn().mockReturnValue({ eq: mockSupabaseUpdateEq });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ update: mockSupabaseUpdate }),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  },
}));

// useNicknameAvailability mock — 각 테스트에서 mockReturnValue로 상태 제어
vi.mock("@/hooks/useNicknameAvailability", () => ({
  useNicknameAvailability: vi.fn(() => ({ state: "idle" })),
}));

const mockProfile = {
  id: "user-1",
  email: "test@example.com",
  display_name: null,
  nickname: "tester01",
  avatar_url: null,
  is_premium: false,
  premium_until: null,
  locale: "ko",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  role: null,
  current_streak: 0,
  longest_streak: 0,
  total_xp: 0,
  current_league: null,
  last_practice_date: null,
  is_minor: null,
  profile_completed: true,
  onboarding_completed: true,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "test@example.com" },
    profile: mockProfile,
    signOut: mockSignOut,
    refreshProfile: mockRefreshProfile,
    loading: false,
    profileLoading: false,
  }),
}));

// ─────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────

const mockUseNicknameAvailability = vi.mocked(useNicknameAvailability);

function renderProfilePage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );
}

// ─────────────────────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────────────────────

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("noteflex.solfege_system", "en");
    mockUseNicknameAvailability.mockReturnValue({ state: "idle" });
  });

  it("닉네임 필드가 기존 값으로 렌더링됨", () => {
    renderProfilePage();
    const input = screen.getByPlaceholderText(
      "3~20자, 영문 소문자/숫자/밑줄"
    ) as HTMLInputElement;
    expect(input.value).toBe("tester01");
  });

  it("변경 사항 없으면 저장 버튼 비활성화", () => {
    renderProfilePage();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("닉네임 변경 시 '변경 사항이 있습니다' 메시지 표시", async () => {
    mockUseNicknameAvailability.mockReturnValue({ state: "available" });

    const user = userEvent.setup();
    renderProfilePage();

    const input = screen.getByPlaceholderText("3~20자, 영문 소문자/숫자/밑줄");
    await user.clear(input);
    await user.type(input, "newuser01");

    await waitFor(() => {
      expect(screen.getByText(/변경 사항이 있습니다/)).toBeInTheDocument();
    });
  });

  it("닉네임 available → 저장 버튼 활성화", async () => {
    mockUseNicknameAvailability.mockReturnValue({ state: "available" });

    const user = userEvent.setup();
    renderProfilePage();

    const input = screen.getByPlaceholderText("3~20자, 영문 소문자/숫자/밑줄");
    await user.clear(input);
    await user.type(input, "newuser01");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "저장" })).not.toBeDisabled();
    });
  });

  it("닉네임 invalid_format → 저장 버튼 비활성화", async () => {
    mockUseNicknameAvailability.mockReturnValue({
      state: "invalid_format",
      reason: "영문 소문자로 시작해야 합니다",
    });

    const user = userEvent.setup();
    renderProfilePage();

    const input = screen.getByPlaceholderText("3~20자, 영문 소문자/숫자/밑줄");
    await user.clear(input);
    await user.type(input, "1badnick");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    });
  });

  it("닉네임 taken → 저장 버튼 비활성화 + 추천 표시", async () => {
    mockUseNicknameAvailability.mockReturnValue({
      state: "taken",
      suggestions: ["admin2", "admin3", "admin4"],
    });

    const user = userEvent.setup();
    renderProfilePage();

    const input = screen.getByPlaceholderText("3~20자, 영문 소문자/숫자/밑줄");
    await user.clear(input);
    await user.type(input, "admin");

    await waitFor(() => {
      expect(screen.getByText("이미 사용 중인 닉네임입니다")).toBeInTheDocument();
      expect(screen.getByText("admin2")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    });
  });

  it("추천 닉네임 클릭 시 자동 입력됨", async () => {
    mockUseNicknameAvailability.mockReturnValue({
      state: "taken",
      suggestions: ["admin2", "admin3", "admin4"],
    });

    const user = userEvent.setup();
    renderProfilePage();

    const input = screen.getByPlaceholderText(
      "3~20자, 영문 소문자/숫자/밑줄"
    ) as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "admin");

    await waitFor(() => expect(screen.getByText("admin2")).toBeInTheDocument());
    await user.click(screen.getByText("admin2"));
    expect(input.value).toBe("admin2");
  });

  it("저장 버튼 클릭 시 Supabase update 호출됨", async () => {
    mockUseNicknameAvailability.mockReturnValue({ state: "available" });

    const user = userEvent.setup();
    renderProfilePage();

    const input = screen.getByPlaceholderText("3~20자, 영문 소문자/숫자/밑줄");
    await user.clear(input);
    await user.type(input, "newuser01");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "저장" })).not.toBeDisabled();
    });
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ nickname: "newuser01" })
      );
    });
  });

  it("계이름 라디오 선택 시 localStorage에 즉시 반영됨", async () => {
    const user = userEvent.setup();
    renderProfilePage();

    await user.click(screen.getByLabelText(/한국어 계이름/));
    expect(localStorage.getItem("noteflex.solfege_system")).toBe("ko");
  });

  it("라틴 계이름 선택 시 localStorage에 latin 저장됨", async () => {
    const user = userEvent.setup();
    renderProfilePage();

    await user.click(screen.getByLabelText(/라틴 계이름/));
    expect(localStorage.getItem("noteflex.solfege_system")).toBe("latin");
  });

  it("로그아웃 버튼 클릭 시 signOut 호출됨", async () => {
    const user = userEvent.setup();
    renderProfilePage();

    await user.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  it("계정 이메일이 읽기전용으로 표시됨", () => {
    renderProfilePage();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });
});
