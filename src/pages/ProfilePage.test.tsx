import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "./ProfilePage";
import { useNicknameAvailability } from "@/hooks/useNicknameAvailability";

// ─────────────────────────────────────────────────────────
// Mock
// ─────────────────────────────────────────────────────────

const mockSignOut        = vi.fn();
const mockRefreshProfile = vi.fn().mockResolvedValue(undefined);
const mockNavigate       = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSupabaseUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockSupabaseUpdate   = vi.fn().mockReturnValue({ eq: mockSupabaseUpdateEq });
const mockSignInWithOtp    = vi.fn().mockResolvedValue({ error: null });
const mockRpc              = vi.fn().mockResolvedValue({ data: true, error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: any[]) => mockSignInWithOtp(...args),
    },
    from: () => ({ update: mockSupabaseUpdate }),
    rpc:  (...args: any[]) => mockRpc(...args),
  },
}));

vi.mock("@/hooks/useNicknameAvailability", () => ({
  useNicknameAvailability: vi.fn(() => ({ state: "idle" })),
}));

vi.mock("@/lib/profile", () => ({
  COUNTRY_OPTIONS:        [{ code: "KR", flag: "🇰🇷", name: "대한민국" }],
  detectCountryCodeSmart: vi.fn().mockReturnValue("KR"),
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
  country_code: "KR",
  birth_year: null,
  birth_month: null,
  birth_day: null,
  marketing_agreed_at: null,
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
// 기본 렌더링
// ─────────────────────────────────────────────────────────

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("noteflex.solfege_system", "en");
    mockUseNicknameAvailability.mockReturnValue({ state: "idle" });
  });

  it("닉네임 필드가 기존 값으로 렌더링됨", () => {
    renderProfilePage();
    const input = screen.getByPlaceholderText("3~20자, 영문 소문자/숫자/밑줄") as HTMLInputElement;
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
      expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    });
  });

  it("저장 버튼 클릭 시 Supabase update 호출됨", async () => {
    mockUseNicknameAvailability.mockReturnValue({ state: "available" });
    const user = userEvent.setup();
    renderProfilePage();
    const input = screen.getByPlaceholderText("3~20자, 영문 소문자/숫자/밑줄");
    await user.clear(input);
    await user.type(input, "newuser01");
    await waitFor(() => expect(screen.getByRole("button", { name: "저장" })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => {
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ nickname: "newuser01" })
      );
    });
  });

  it("비밀번호 변경 카드 없음 (매직링크 only)", () => {
    renderProfilePage();
    expect(screen.queryByText("비밀번호 변경")).not.toBeInTheDocument();
  });

  it("계정 이메일이 읽기전용으로 표시됨", () => {
    renderProfilePage();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("계이름 라디오 선택 시 localStorage에 즉시 반영됨", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByLabelText(/한국어 계이름/));
    expect(localStorage.getItem("noteflex.solfege_system")).toBe("ko");
  });

  it("로그아웃 버튼 클릭 시 signOut 호출됨", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });

  it("생년월일 입력 필드 렌더링됨", () => {
    renderProfilePage();
    expect(screen.getByTestId("birth-year-input")).toBeInTheDocument();
    expect(screen.getByTestId("birth-month-input")).toBeInTheDocument();
    expect(screen.getByTestId("birth-day-input")).toBeInTheDocument();
  });

  it("마케팅 동의 토글 렌더링됨", () => {
    renderProfilePage();
    expect(screen.getByTestId("marketing-toggle")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────
// 회원 탈퇴 (OTP 재인증)
// ─────────────────────────────────────────────────────────

describe("회원 탈퇴 (매직링크 재인증)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ error: null });
  });

  it("탈퇴 버튼이 렌더링됨", () => {
    renderProfilePage();
    expect(screen.getByTestId("open-delete-modal-button")).toBeInTheDocument();
  });

  it("탈퇴 버튼 클릭 시 확인 모달 열림", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByTestId("open-delete-modal-button"));
    expect(screen.getByTestId("delete-modal")).toBeInTheDocument();
  });

  it("취소 클릭 시 모달 닫힘", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByTestId("open-delete-modal-button"));
    await user.click(screen.getByTestId("cancel-delete-button"));
    expect(screen.queryByTestId("delete-modal")).not.toBeInTheDocument();
  });

  it("'탈퇴 확인 메일 보내기' 클릭 시 signInWithOtp shouldCreateUser:false + ?action=confirm_deletion", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByTestId("open-delete-modal-button"));
    await user.click(screen.getByTestId("send-delete-otp-button"));
    await waitFor(() =>
      expect(mockSignInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "test@example.com",
          options: expect.objectContaining({
            shouldCreateUser: false,
            emailRedirectTo: expect.stringContaining("action=confirm_deletion"),
          }),
        })
      )
    );
  });

  it("탈퇴 메일 발송 후 이메일 전송 완료 화면 표시됨", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByTestId("open-delete-modal-button"));
    await user.click(screen.getByTestId("send-delete-otp-button"));
    await waitFor(() =>
      expect(screen.getByTestId("delete-email-sent-screen")).toBeInTheDocument()
    );
  });

  it("탈퇴 모달 재오픈 시 이메일 발송 화면 초기화", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByTestId("open-delete-modal-button"));
    await user.click(screen.getByTestId("send-delete-otp-button"));
    await waitFor(() => expect(screen.getByTestId("delete-email-sent-screen")).toBeInTheDocument());
    await user.click(screen.getByTestId("cancel-delete-button"));
    await user.click(screen.getByTestId("open-delete-modal-button"));
    expect(screen.queryByTestId("delete-email-sent-screen")).not.toBeInTheDocument();
    expect(screen.getByTestId("send-delete-otp-button")).toBeInTheDocument();
  });

  it("모달에 OTP 코드 입력 필드 없음", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByTestId("open-delete-modal-button"));
    expect(screen.queryByTestId("delete-otp-input")).not.toBeInTheDocument();
  });

  it("모달에 비밀번호 입력 필드 없음", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByTestId("open-delete-modal-button"));
    expect(screen.queryByTestId("delete-password-input")).not.toBeInTheDocument();
  });
});
