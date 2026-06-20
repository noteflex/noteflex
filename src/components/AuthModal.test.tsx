import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthModal from "./AuthModal";
import { toast } from "@/hooks/use-toast";

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockSignInWithOtp  = vi.fn().mockResolvedValue({ error: null });
const mockSignInOAuth    = vi.fn().mockResolvedValue({ error: null });
const mockRpc            = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: any[]) => mockSignInOAuth(...args),
      signInWithOtp:   (...args: any[]) => mockSignInWithOtp(...args),
    },
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

const mockCheckEmailExists = vi.fn().mockResolvedValue({ exists: false, confirmed: false });

vi.mock("@/lib/profile", () => ({
  checkEmailExists: (...args: any[]) => mockCheckEmailExists(...args),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

// ─── Helpers ──────────────────────────────────────────────────────────────

async function enterSignupMode() {
  const user = userEvent.setup({ delay: null });
  const onClose = vi.fn();
  render(<AuthModal onClose={onClose} />);
  await user.click(screen.getByText("회원가입"));
  return { user, onClose };
}

async function goToMagicLinkStep() {
  const { user, onClose } = await enterSignupMode();
  await user.type(screen.getByPlaceholderText(/사용할 이메일/), "test@example.com");
  await user.click(screen.getByTestId("tos-checkbox"));
  await user.click(screen.getByTestId("signup-submit-button"));
  await waitFor(() => expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument());
  return { user, onClose };
}

async function goToRecoveryPanel(daysLeft = 25) {
  mockCheckEmailExists.mockResolvedValueOnce({
    accountStatus: "deleted_recoverable",
    recoveryDaysLeft: daysLeft,
    exists: true,
    confirmed: true,
  });
  const { user, onClose } = await enterSignupMode();
  await user.type(screen.getByPlaceholderText(/사용할 이메일/), "deleted@example.com");
  await user.click(screen.getByTestId("tos-checkbox"));
  await user.click(screen.getByTestId("signup-submit-button"));
  await waitFor(() => expect(screen.getByTestId("recovery-panel")).toBeInTheDocument());
  return { user, onClose };
}

// ─────────────────────────────────────────────────────────────────────────
// 마운트 초기 상태
// ─────────────────────────────────────────────────────────────────────────

describe("마운트 초기 상태", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("기본 마운트 시 로그인 모드로 렌더링", () => {
    render(<AuthModal onClose={vi.fn()} />);
    expect(screen.getByText("돌아오신 것을 환영해요")).toBeInTheDocument();
  });

  it("unmount→remount 시 이메일 필드 초기화", async () => {
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    const { unmount } = render(<AuthModal onClose={onClose} />);
    await user.click(screen.getByText("회원가입"));
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "typed@example.com");
    expect((screen.getByPlaceholderText(/사용할 이메일/) as HTMLInputElement).value).toBe("typed@example.com");
    unmount();
    render(<AuthModal onClose={onClose} />);
    expect((screen.getByPlaceholderText(/이메일을 입력/) as HTMLInputElement).value).toBe("");
  });

  it("로그인 모드에 비밀번호 필드 없음 (매직링크 only)", () => {
    render(<AuthModal onClose={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/비밀번호/)).not.toBeInTheDocument();
  });

  it("로그인 모드에 '비밀번호를 잊으셨나요?' 링크 없음", () => {
    render(<AuthModal onClose={vi.fn()} />);
    expect(screen.queryByText(/비밀번호를 잊으셨나요/)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 약관 동의 (Step 1 — signup)
// ─────────────────────────────────────────────────────────────────────────

describe("약관 동의", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("TOS 미체크 상태에서 '이메일로 시작' 버튼 비활성화", async () => {
    await enterSignupMode();
    expect(screen.getByTestId("signup-submit-button")).toBeDisabled();
  });

  it("TOS 체크 후 '이메일로 시작' 버튼 활성화", async () => {
    const { user } = await enterSignupMode();
    await user.click(screen.getByTestId("tos-checkbox"));
    expect(screen.getByTestId("signup-submit-button")).not.toBeDisabled();
  });

  it("마케팅 체크박스 단독 체크로는 버튼 활성화 안 됨", async () => {
    const { user } = await enterSignupMode();
    await user.click(screen.getByTestId("marketing-checkbox"));
    expect(screen.getByTestId("signup-submit-button")).toBeDisabled();
  });

  it("TOS 체크 후 signInWithOtp data에 tos_agreed_at·privacy_agreed_at 포함", async () => {
    mockCheckEmailExists.mockResolvedValue({ exists: false, confirmed: false });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "test@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalledTimes(1));
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        options: expect.objectContaining({
          data: expect.objectContaining({
            tos_agreed_at: expect.any(String),
            privacy_agreed_at: expect.any(String),
          }),
        }),
      })
    );
  });

  it("마케팅 미동의 시 marketing_agreed_at = null", async () => {
    mockCheckEmailExists.mockResolvedValue({ exists: false, confirmed: false });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "test@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalledTimes(1));
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ marketing_agreed_at: null }),
        }),
      })
    );
  });

  it("마케팅 동의 시 marketing_agreed_at = ISO 문자열", async () => {
    mockCheckEmailExists.mockResolvedValue({ exists: false, confirmed: false });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "test@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("marketing-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalledTimes(1));
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: expect.objectContaining({ marketing_agreed_at: expect.any(String) }),
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 이메일 중복 검증 (Step 1 — signup)
// ─────────────────────────────────────────────────────────────────────────

describe("Email duplicate handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it("이미 가입된 이메일이면 email-exists-error 표시", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({ exists: true, confirmed: true });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "dup@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() =>
      expect(screen.getByTestId("email-exists-error")).toBeInTheDocument()
    );
  });

  it("미인증 이메일이면 magic-link-screen으로 진행", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({ exists: true, confirmed: false });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "pending@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() =>
      expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument()
    );
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "pending@example.com" })
    );
  });

  it("'로그인하기' CTA 클릭 시 login 모드 전환", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({ exists: true, confirmed: true });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "dup@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() => screen.getByTestId("goto-login-button"));
    await user.click(screen.getByTestId("goto-login-button"));
    expect(screen.getByText("돌아오신 것을 환영해요")).toBeInTheDocument();
  });

  it("이메일 변경 시 error 초기화", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({ exists: true, confirmed: true });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "dup@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() => screen.getByTestId("email-exists-error"));
    const emailInput = screen.getByPlaceholderText(/사용할 이메일/);
    await user.clear(emailInput);
    await user.type(emailInput, "new@example.com");
    expect(screen.queryByTestId("email-exists-error")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Magic Link Step 2
// ─────────────────────────────────────────────────────────────────────────

describe("Magic Link step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckEmailExists.mockResolvedValue({ exists: false, confirmed: false });
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("signInWithOtp 호출 시 emailRedirectTo /auth/callback 포함", async () => {
    await goToMagicLinkStep();
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining("/auth/callback"),
        }),
      })
    );
  });

  it("이메일 제출 후 magic-link-screen 표시", async () => {
    await goToMagicLinkStep();
    expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument();
    expect(screen.getByText("메일을 확인해주세요")).toBeInTheDocument();
  });

  it("magic link 안내 화면에 입력한 이메일 주소 표시", async () => {
    await goToMagicLinkStep();
    expect(screen.getByTestId("magic-link-email").textContent).toBe("test@example.com");
  });

  it("resend 버튼 cooldown 직후 비활성화", async () => {
    await goToMagicLinkStep();
    await waitFor(() => screen.getByTestId("resend-button"));
    expect(screen.getByTestId("resend-button")).toBeDisabled();
    expect(screen.getByTestId("resend-button").textContent).toMatch(/초 후 재전송/);
  });

  it("재전송 시 signInWithOtp 재호출 + emailRedirectTo 포함", async () => {
    vi.useFakeTimers();
    render(<AuthModal onClose={vi.fn()} />);

    await act(async () => { fireEvent.click(screen.getByText("회원가입")); });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/사용할 이메일/), {
        target: { value: "test@example.com" },
      });
    });
    await act(async () => { fireEvent.click(screen.getByTestId("tos-checkbox")); });
    await act(async () => {
      fireEvent.submit(screen.getByTestId("signup-submit-button").closest("form")!);
    });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument();

    await act(async () => { vi.advanceTimersByTime(61_000); });
    expect(screen.getByTestId("resend-button")).not.toBeDisabled();

    await act(async () => { fireEvent.click(screen.getByTestId("resend-button")); });
    await act(async () => { await Promise.resolve(); });

    expect(mockSignInWithOtp).toHaveBeenCalledTimes(2);
    expect(mockSignInWithOtp).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining("/auth/callback"),
        }),
      })
    );
  });

  it("'이메일 다시 입력하기' 클릭 시 step 1으로 복귀", async () => {
    const { user } = await goToMagicLinkStep();
    await user.click(screen.getByTestId("magic-link-back"));
    expect(screen.getByPlaceholderText(/사용할 이메일/)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 로그인 모드 (매직링크)
// ─────────────────────────────────────────────────────────────────────────

describe("로그인 모드 (매직링크)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockCheckEmailExists.mockResolvedValue({
      accountStatus: "active",
      exists: true,
      confirmed: true,
    });
  });

  it("로그인 제출 시 shouldCreateUser=false + emailRedirectTo 포함", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AuthModal onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/이메일을 입력/), "exist@example.com");
    await user.click(screen.getByRole("button", { name: "이메일로 로그인" }));
    await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalledTimes(1));
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "exist@example.com",
        options: expect.objectContaining({
          shouldCreateUser: false,
          emailRedirectTo: expect.stringContaining("/auth/callback"),
        }),
      })
    );
  });

  it("로그인 성공 시 magic-link-screen 표시", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AuthModal onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/이메일을 입력/), "exist@example.com");
    await user.click(screen.getByRole("button", { name: "이메일로 로그인" }));
    await waitFor(() => expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument());
  });

  it("signInWithOtp 실패 시 login-email-error 표시", async () => {
    mockSignInWithOtp.mockRejectedValueOnce(new Error("Email not found"));
    const user = userEvent.setup({ delay: null });
    render(<AuthModal onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/이메일을 입력/), "nouser@example.com");
    await user.click(screen.getByRole("button", { name: "이메일로 로그인" }));
    await waitFor(() => expect(screen.getByTestId("login-email-error")).toBeInTheDocument());
  });

  it("미가입 이메일은 사전 차단(signInWithOtp 미호출) + login-email-error 표시", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({
      accountStatus: "new",
      exists: false,
      confirmed: false,
    });
    const user = userEvent.setup({ delay: null });
    render(<AuthModal onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/이메일을 입력/), "newuser@example.com");
    await user.click(screen.getByRole("button", { name: "이메일로 로그인" }));
    await waitFor(() => expect(screen.getByTestId("login-email-error")).toBeInTheDocument());
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it("탈퇴 30일 이내 이메일은 복구 패널로 라우팅(signInWithOtp 미호출)", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({
      accountStatus: "deleted_recoverable",
      recoveryDaysLeft: 12,
      exists: true,
      confirmed: true,
    });
    const user = userEvent.setup({ delay: null });
    render(<AuthModal onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/이메일을 입력/), "deleted@example.com");
    await user.click(screen.getByRole("button", { name: "이메일로 로그인" }));
    await waitFor(() => expect(screen.getByTestId("recovery-panel")).toBeInTheDocument());
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 계정 복구 (30일 이내 탈퇴)
// ─────────────────────────────────────────────────────────────────────────

describe("계정 복구 (30일 이내 탈퇴)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ error: null });
  });

  it("deleted_recoverable → 복구 패널 표시", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({
      accountStatus: "deleted_recoverable",
      recoveryDaysLeft: 25,
      exists: true,
      confirmed: true,
    });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "deleted@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() =>
      expect(screen.getByTestId("recovery-panel")).toBeInTheDocument()
    );
  });

  it("복구 패널에 남은 복구 기간(일) 표시", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({
      accountStatus: "deleted_recoverable",
      recoveryDaysLeft: 25,
      exists: true,
      confirmed: true,
    });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "deleted@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() => expect(screen.getByTestId("recovery-panel")).toBeInTheDocument());
    expect(screen.getByText(/25/)).toBeInTheDocument();
  });

  it("'계정 복구하기' 클릭 시 signInWithOtp shouldCreateUser:false + ?action=restore", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({
      accountStatus: "deleted_recoverable",
      recoveryDaysLeft: 25,
      exists: true,
      confirmed: true,
    });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "deleted@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() => expect(screen.getByTestId("recovery-panel")).toBeInTheDocument());
    await user.click(screen.getByTestId("recover-account-button"));
    await waitFor(() =>
      expect(mockSignInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "deleted@example.com",
          options: expect.objectContaining({
            shouldCreateUser: false,
            emailRedirectTo: expect.stringContaining("action=restore"),
          }),
        })
      )
    );
  });

  it("복구 링크 전송 후 magic-link-screen 표시", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({
      accountStatus: "deleted_recoverable",
      recoveryDaysLeft: 25,
      exists: true,
      confirmed: true,
    });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "deleted@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() => expect(screen.getByTestId("recovery-panel")).toBeInTheDocument());
    await user.click(screen.getByTestId("recover-account-button"));
    await waitFor(() =>
      expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument()
    );
  });

  it("deleted_expired → 만료 에러 메시지 표시", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({
      accountStatus: "deleted_expired",
      recoveryDaysLeft: 0,
      exists: true,
      confirmed: true,
    });
    const { user } = await enterSignupMode();
    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "expired@example.com");
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByTestId("signup-submit-button"));
    await waitFor(() =>
      expect(screen.getByTestId("email-exists-error")).toBeInTheDocument()
    );
    expect(screen.getByText(/완전히 삭제/)).toBeInTheDocument();
  });

  // ── 새로 시작 ──────────────────────────────────────────────────────────

  it("복구 패널에 '새로 시작' 버튼 표시", async () => {
    await goToRecoveryPanel();
    expect(screen.getByTestId("fresh-start-button")).toBeInTheDocument();
  });

  it("'새로 시작' 클릭 시 확인 텍스트 노출 + '이전 데이터가 영구 삭제됩니다' 포함", async () => {
    const { user } = await goToRecoveryPanel();
    await user.click(screen.getByTestId("fresh-start-button"));
    await waitFor(() =>
      expect(screen.getByTestId("fresh-start-confirm-text")).toBeInTheDocument()
    );
    expect(screen.getByText(/이전 데이터가 영구 삭제됩니다/)).toBeInTheDocument();
  });

  it("확인 클릭 시 hard_delete_account RPC 호출", async () => {
    const { user } = await goToRecoveryPanel();
    await user.click(screen.getByTestId("fresh-start-button"));
    await waitFor(() => expect(screen.getByTestId("fresh-start-confirm-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("fresh-start-confirm-button"));
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("hard_delete_account", { p_email: "deleted@example.com" })
    );
  });

  it("hard_delete 후 signInWithOtp shouldCreateUser:true 호출 (auth.users 삭제 후 신규 가입)", async () => {
    const { user } = await goToRecoveryPanel();
    await user.click(screen.getByTestId("fresh-start-button"));
    await waitFor(() => expect(screen.getByTestId("fresh-start-confirm-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("fresh-start-confirm-button"));
    await waitFor(() =>
      expect(mockSignInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "deleted@example.com",
          options: expect.objectContaining({ shouldCreateUser: true }),
        })
      )
    );
  });

  it("hard_delete 후 noteflex_consent localStorage에 저장됨 (AuthCallback profiles 동의일시 기록용)", async () => {
    const { user } = await goToRecoveryPanel();
    await user.click(screen.getByTestId("fresh-start-button"));
    await waitFor(() => expect(screen.getByTestId("fresh-start-confirm-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("fresh-start-confirm-button"));
    await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalled());
    const stored = localStorage.getItem("noteflex_consent");
    expect(stored).not.toBeNull();
    const consent = JSON.parse(stored!);
    expect(consent.tos_agreed_at).toBeTruthy();
    expect(consent.privacy_agreed_at).toBeTruthy();
  });

  it("hard_delete 후 magic-link-screen 표시", async () => {
    const { user } = await goToRecoveryPanel();
    await user.click(screen.getByTestId("fresh-start-button"));
    await waitFor(() => expect(screen.getByTestId("fresh-start-confirm-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("fresh-start-confirm-button"));
    await waitFor(() =>
      expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument()
    );
  });

  it("RPC 실패 시 signInWithOtp 미호출", async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: "deletion failed" } });
    const { user } = await goToRecoveryPanel();
    await user.click(screen.getByTestId("fresh-start-button"));
    await waitFor(() => expect(screen.getByTestId("fresh-start-confirm-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("fresh-start-confirm-button"));
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  // ── hard_delete_account 에러 시나리오 (RPC 안전장치 검증) ─────────────

  it("30일 내 탈퇴 계정 → RPC 호출 성공 후 magic-link-screen (정상 경로)", async () => {
    mockRpc.mockResolvedValueOnce({ error: null });
    const { user } = await goToRecoveryPanel();
    await user.click(screen.getByTestId("fresh-start-button"));
    await waitFor(() => expect(screen.getByTestId("fresh-start-confirm-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("fresh-start-confirm-button"));
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith("hard_delete_account", { p_email: "deleted@example.com" })
    );
    await waitFor(() => expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument());
  });

  it("활성 계정 RPC 에러('Account not eligible') → toast 에러 + signInWithOtp 미호출", async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: "Account not eligible for hard delete" } });
    const { user } = await goToRecoveryPanel();
    await user.click(screen.getByTestId("fresh-start-button"));
    await waitFor(() => expect(screen.getByTestId("fresh-start-confirm-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("fresh-start-confirm-button"));
    await waitFor(() => expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    ));
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it("30일 경과 계정 RPC 에러('Account not eligible') → toast 에러 + signInWithOtp 미호출", async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: "Account not eligible for hard delete" } });
    const { user } = await goToRecoveryPanel();
    await user.click(screen.getByTestId("fresh-start-button"));
    await waitFor(() => expect(screen.getByTestId("fresh-start-confirm-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("fresh-start-confirm-button"));
    await waitFor(() => expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    ));
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });

  it("존재하지 않는 이메일 RPC 에러('User not found') → toast 에러 + signInWithOtp 미호출", async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: "User not found" } });
    const { user } = await goToRecoveryPanel();
    await user.click(screen.getByTestId("fresh-start-button"));
    await waitFor(() => expect(screen.getByTestId("fresh-start-confirm-button")).toBeInTheDocument());
    await user.click(screen.getByTestId("fresh-start-confirm-button"));
    await waitFor(() => expect(vi.mocked(toast)).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" })
    ));
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 매직링크 탭 싱크 (Step 2 자동 닫기)
// ─────────────────────────────────────────────────────────────────────────

describe("매직링크 탭 싱크", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckEmailExists.mockResolvedValue({ accountStatus: "new", exists: false, confirmed: false });
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it("Step 2에서 '인증 대기 중...' 표시", async () => {
    await goToMagicLinkStep();
    expect(screen.getByTestId("auth-waiting-indicator")).toBeInTheDocument();
    expect(screen.getByText("인증 대기 중...")).toBeInTheDocument();
  });

  it("Step 2에서 localStorage storage 이벤트 수신 시 onClose 호출", async () => {
    const { onClose } = await goToMagicLinkStep();
    window.dispatchEvent(
      new StorageEvent("storage", { key: "noteflex_auth_complete", newValue: "12345" })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("Step 2에서 BroadcastChannel AUTH_COMPLETE 수신 시 onClose 호출", async () => {
    const { onClose } = await goToMagicLinkStep();
    const channel = new BroadcastChannel("noteflex_auth");
    channel.postMessage({ type: "AUTH_COMPLETE" });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    channel.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Google OAuth
// ─────────────────────────────────────────────────────────────────────────

describe("Google OAuth", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("로그인 모드 Google 클릭 → TOS 미체크여도 즉시 OAuth 진행", async () => {
    const user = userEvent.setup({ delay: null });
    render(<AuthModal onClose={vi.fn()} />);
    await user.click(screen.getByText("Google로 계속하기"));
    await waitFor(() =>
      expect(mockSignInOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          options: expect.objectContaining({
            redirectTo: expect.stringContaining("/auth/callback"),
          }),
        })
      )
    );
  });

  it("가입 모드 Google 클릭 → TOS 미체크 시 OAuth 미호출", async () => {
    const { user } = await enterSignupMode();
    await user.click(screen.getByText("Google로 계속하기"));
    expect(mockSignInOAuth).not.toHaveBeenCalled();
  });

  it("가입 모드 Google 클릭 → TOS 체크 후 OAuth 호출", async () => {
    const { user } = await enterSignupMode();
    await user.click(screen.getByTestId("tos-checkbox"));
    await user.click(screen.getByText("Google로 계속하기"));
    await waitFor(() =>
      expect(mockSignInOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "google" })
      )
    );
  });
});
