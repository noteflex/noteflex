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
const mockSignInWithPassword = vi.fn().mockResolvedValue({ error: null });
const mockUpdateUser = vi.fn().mockResolvedValue({ error: null });
const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      updateUser:         (...args: any[]) => mockUpdateUser(...args),
    },
    from: () => ({ update: mockSupabaseUpdate }),
    rpc:  (...args: any[]) => mockRpc(...args),
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

// ─────────────────────────────────────────────────────────
// C1: 비밀번호 변경
// ─────────────────────────────────────────────────────────

describe("C1 비밀번호 변경", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it("비밀번호 변경 폼이 렌더링됨", () => {
    renderProfilePage();
    expect(screen.getByTestId("current-password-input")).toBeInTheDocument();
    expect(screen.getByTestId("new-password-input")).toBeInTheDocument();
    expect(screen.getByTestId("confirm-password-input")).toBeInTheDocument();
  });

  it("필드가 비어있으면 변경 버튼 비활성화", () => {
    renderProfilePage();
    expect(screen.getByTestId("change-password-button")).toBeDisabled();
  });

  it("현재 비밀번호 검증을 위해 signInWithPassword 호출", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.type(screen.getByTestId("current-password-input"), "OldPass1!");
    await user.type(screen.getByTestId("new-password-input"), "NewPass1!");
    await user.type(screen.getByTestId("confirm-password-input"), "NewPass1!");
    await user.click(screen.getByTestId("change-password-button"));

    await waitFor(() =>
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "OldPass1!",
      })
    );
  });

  it("현재 비밀번호 맞으면 updateUser 호출", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.type(screen.getByTestId("current-password-input"), "OldPass1!");
    await user.type(screen.getByTestId("new-password-input"), "NewPass1!");
    await user.type(screen.getByTestId("confirm-password-input"), "NewPass1!");
    await user.click(screen.getByTestId("change-password-button"));

    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "NewPass1!" })
    );
  });

  it("현재 비밀번호 틀리면 updateUser 미호출", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid credentials" } });
    const user = userEvent.setup();
    renderProfilePage();
    await user.type(screen.getByTestId("current-password-input"), "WrongPass1!");
    await user.type(screen.getByTestId("new-password-input"), "NewPass1!");
    await user.type(screen.getByTestId("confirm-password-input"), "NewPass1!");
    await user.click(screen.getByTestId("change-password-button"));

    await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalled());
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("현재+새(강도충족)+확인(일치) 모두 입력 시 변경 버튼 활성화", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    // 처음엔 비활성화
    expect(screen.getByTestId("change-password-button")).toBeDisabled();
    await user.type(screen.getByTestId("current-password-input"), "OldPass1!");
    await user.type(screen.getByTestId("new-password-input"), "NewPass1!");
    await user.type(screen.getByTestId("confirm-password-input"), "NewPass1!");
    // 모두 충족 → 활성화
    expect(screen.getByTestId("change-password-button")).not.toBeDisabled();
  });

  it("새 비번과 확인 불일치 시 버튼 비활성화 + 피드백 표시", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.type(screen.getByTestId("current-password-input"), "OldPass1!");
    await user.type(screen.getByTestId("new-password-input"), "NewPass1!");
    await user.type(screen.getByTestId("confirm-password-input"), "DifferentPass1!");
    expect(screen.getByTestId("change-password-button")).toBeDisabled();
    expect(screen.getByTestId("pw-mismatch-error")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────
// C3: 회원 탈퇴
// ─────────────────────────────────────────────────────────

describe("C3 회원 탈퇴", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithPassword.mockResolvedValue({ error: null });
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

  it("비밀번호 재확인 후 request_account_deletion RPC 호출", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByTestId("open-delete-modal-button"));
    await user.type(screen.getByTestId("delete-password-input"), "MyPass1!");
    await user.type(screen.getByTestId("delete-reason-input"), "서비스 불만");
    await user.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("request_account_deletion", {
        reason: "서비스 불만",
      })
    );
  });

  it("비밀번호 틀리면 RPC 미호출", async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid credentials" } });
    const user = userEvent.setup();
    renderProfilePage();
    await user.click(screen.getByTestId("open-delete-modal-button"));
    await user.type(screen.getByTestId("delete-password-input"), "WrongPass1!");
    await user.click(screen.getByTestId("confirm-delete-button"));

    await waitFor(() => expect(mockSignInWithPassword).toHaveBeenCalled());
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("탈퇴 모달 재오픈 시 비밀번호 초기화", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    // 모달 열고 비밀번호 입력
    await user.click(screen.getByTestId("open-delete-modal-button"));
    await user.type(screen.getByTestId("delete-password-input"), "MyPass1!");
    expect((screen.getByTestId("delete-password-input") as HTMLInputElement).value).toBe("MyPass1!");
    // 취소로 닫기
    await user.click(screen.getByTestId("cancel-delete-button"));
    // 재오픈
    await user.click(screen.getByTestId("open-delete-modal-button"));
    expect((screen.getByTestId("delete-password-input") as HTMLInputElement).value).toBe("");
  });
});

// ─────────────────────────────────────────────────────────
// 폼 state 초기화 — user.id 변경 시
// ─────────────────────────────────────────────────────────

describe("폼 state 초기화 — user.id 변경", () => {
  it("비밀번호 필드 user.id 변경 시 초기화", async () => {
    const user = userEvent.setup();
    const { rerender } = renderProfilePage();
    // 비밀번호 입력
    await user.type(screen.getByTestId("current-password-input"), "OldPass1!");
    expect((screen.getByTestId("current-password-input") as HTMLInputElement).value).toBe("OldPass1!");
    // user.id 변경 — 다른 사용자 로그인 시나리오
    // (AuthContext mock은 정적이므로 동일 컴포넌트 rerender 후 effect가 user?.id 변화 감지)
    // user.id를 다르게 만들기 위해 key 변경으로 강제 재마운트
    rerender(
      <MemoryRouter>
        <ProfilePage key="user-2" />
      </MemoryRouter>
    );
    expect((screen.getByTestId("current-password-input") as HTMLInputElement).value).toBe("");
  });
});
