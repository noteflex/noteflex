import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthModal, { analyzePassword } from "./AuthModal";

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockSignInWithOtp         = vi.fn().mockResolvedValue({ error: null });
const mockVerifyOtp             = vi.fn();
const mockResend                = vi.fn();
const mockSignInOAuth           = vi.fn();
const mockSignInPassword        = vi.fn();
const mockUpdateUser            = vi.fn().mockResolvedValue({ data: { user: { id: "uid-1" } }, error: null });
const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOAuth:         (...args: any[]) => mockSignInOAuth(...args),
      signInWithPassword:      (...args: any[]) => mockSignInPassword(...args),
      signInWithOtp:           (...args: any[]) => mockSignInWithOtp(...args),
      verifyOtp:               (...args: any[]) => mockVerifyOtp(...args),
      resend:                  (...args: any[]) => mockResend(...args),
      updateUser:              (...args: any[]) => mockUpdateUser(...args),
      resetPasswordForEmail:   (...args: any[]) => mockResetPasswordForEmail(...args),
    },
  },
}));

const mockCheckEmailExists = vi.fn().mockResolvedValue({ exists: false, confirmed: false });
const mockCompleteProfile  = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/profile", () => ({
  checkEmailExists:       (...args: any[]) => mockCheckEmailExists(...args),
  completeProfile:        (...args: any[]) => mockCompleteProfile(...args),
  detectCountryCodeSmart: vi.fn().mockReturnValue("KR"),
  detectLocale:           vi.fn().mockReturnValue("ko"),
  detectTimezone:         vi.fn().mockReturnValue("Asia/Seoul"),
  validateBirthDate:      vi.fn().mockReturnValue(null),
  calculateAge:           vi.fn().mockReturnValue(25),
  COUNTRY_OPTIONS:        [{ code: "KR", flag: "🇰🇷", name: "대한민국" }],
}));

vi.mock("@/hooks/useNicknameAvailability", () => ({
  useNicknameAvailability: vi.fn().mockReturnValue({ state: "available", suggestions: [] }),
}));

vi.mock("@/lib/nicknameValidation", () => ({
  validateNicknameFormat: vi.fn().mockReturnValue({ valid: true }),
  nicknameErrorMessage:   vi.fn().mockReturnValue(""),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

// ─── Helpers ─────────────────────────────────────────────────────────────

// 회원가입 모드 진입 (Step 1)
async function enterSignupMode() {
  const user = userEvent.setup({ delay: null });
  const onClose = vi.fn();
  render(<AuthModal onClose={onClose} />);
  await user.click(screen.getByText("회원가입"));
  return { user, onClose };
}

// Step 1 이메일 제출 → OTP 화면 (Step 2)
async function goToOtpStep() {
  const { user, onClose } = await enterSignupMode();
  await user.type(screen.getByPlaceholderText(/사용할 이메일/), "test@example.com");
  await user.click(screen.getByRole("button", { name: "다음" }));
  await waitFor(() => expect(screen.getByPlaceholderText("000000")).toBeInTheDocument());
  return { user, onClose };
}

// OTP 인증 → 프로필+비밀번호 폼 (Step 3)
async function goToProfileStep() {
  const { user, onClose } = await goToOtpStep();
  await user.type(screen.getByPlaceholderText("000000"), "123456");
  await user.click(screen.getByRole("button", { name: "인증하기" }));
  await waitFor(() => expect(screen.getByPlaceholderText(/3~20자/)).toBeInTheDocument());
  return { user, onClose };
}

// Step 3 폼 작성 + 제출
async function submitProfileStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/비밀번호.*8자/), "Test1234!");
  await user.type(screen.getByPlaceholderText(/3~20자/), "testuser");
  await user.type(screen.getAllByPlaceholderText(/YYYY/)[0], "1998");
  await user.type(screen.getAllByPlaceholderText(/MM/)[0], "5");
  await user.type(screen.getAllByPlaceholderText(/DD/)[0], "15");
  const checkboxes = screen.getAllByRole("checkbox");
  await user.click(checkboxes[0]);
  await user.click(checkboxes[1]);
  await user.click(screen.getByRole("button", { name: /가입 완료/ }));
}

// ─────────────────────────────────────────────────────────────────────────
// analyzePassword (pure function unit tests)
// ─────────────────────────────────────────────────────────────────────────

describe("analyzePassword", () => {
  it("returns score 0 for empty string", () => {
    const { score } = analyzePassword("");
    expect(score).toBe(0);
  });

  it("counts only length criterion for short letters-only", () => {
    const { score, checks } = analyzePassword("abc");
    expect(checks.length).toBe(false);
    expect(checks.lowercase).toBe(true);
    expect(score).toBe(1);
  });

  it("scores 3 for 8-char lowercase+digit", () => {
    const { score } = analyzePassword("abcdefg1");
    expect(score).toBe(3);
  });

  it("scores 5 for fully valid password", () => {
    const { score, checks } = analyzePassword("Test1234!");
    expect(score).toBe(5);
    expect(Object.values(checks).every(Boolean)).toBe(true);
  });

  it("requires special char for score 5", () => {
    const { score } = analyzePassword("Test1234");
    expect(score).toBe(4);
  });

  it("detects uppercase, digit, special independently", () => {
    const { checks } = analyzePassword("A1!");
    expect(checks.uppercase).toBe(true);
    expect(checks.digit).toBe(true);
    expect(checks.special).toBe(true);
    expect(checks.lowercase).toBe(false);
    expect(checks.length).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Password strength UI (Step 3)
// ─────────────────────────────────────────────────────────────────────────

describe("Password strength UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckEmailExists.mockResolvedValue({ exists: false, confirmed: false });
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: "uid-1" }, session: {} },
      error: null,
    });
  });

  it("does not show strength bar when password is empty", async () => {
    await goToProfileStep();
    expect(screen.queryByTestId("password-strength")).not.toBeInTheDocument();
  });

  it("shows strength section when password has characters", async () => {
    const { user } = await goToProfileStep();
    await user.type(screen.getByPlaceholderText(/비밀번호.*8자/), "a");
    expect(screen.getByTestId("password-strength")).toBeInTheDocument();
  });

  it("disables 가입완료 button when password is weak", async () => {
    const { user } = await goToProfileStep();
    await user.type(screen.getByPlaceholderText(/비밀번호.*8자/), "weak");
    expect(screen.getByRole("button", { name: /가입 완료/ })).toBeDisabled();
  });

  it("enables 가입완료 button when password meets all 5 criteria", async () => {
    const { user } = await goToProfileStep();
    await user.type(screen.getByPlaceholderText(/비밀번호.*8자/), "Test1234!");
    expect(screen.getByRole("button", { name: /가입 완료/ })).not.toBeDisabled();
  });

  it("shows 매우 강함 label for score 5 password", async () => {
    const { user } = await goToProfileStep();
    await user.type(screen.getByPlaceholderText(/비밀번호.*8자/), "Test1234!");
    expect(screen.getByText("매우 강함")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 이메일 중복 검증 (Step 1)
// ─────────────────────────────────────────────────────────────────────────

describe("Email duplicate handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it("shows email-exists error when email is confirmed", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({ exists: true, confirmed: true });
    const { user } = await enterSignupMode();

    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "dup@example.com");
    await user.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() =>
      expect(screen.getByTestId("email-exists-error")).toBeInTheDocument()
    );
    expect(screen.getByText(/이미 가입된 이메일/)).toBeInTheDocument();
  });

  it("proceeds to OTP step when email exists but unconfirmed", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({ exists: true, confirmed: false });
    const { user } = await enterSignupMode();

    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "pending@example.com");
    await user.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText("000000")).toBeInTheDocument()
    );
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "pending@example.com",
      options: { shouldCreateUser: true },
    });
  });

  it("switches to login mode when 로그인하기 CTA is clicked", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({ exists: true, confirmed: true });
    const { user } = await enterSignupMode();

    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "dup@example.com");
    await user.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => screen.getByTestId("goto-login-button"));

    await user.click(screen.getByTestId("goto-login-button"));
    expect(screen.getByText("로그인")).toBeInTheDocument();
  });

  it("clears email-exists error when email is changed", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({ exists: true, confirmed: true });
    const { user } = await enterSignupMode();

    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "dup@example.com");
    await user.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => screen.getByTestId("email-exists-error"));

    const emailInput = screen.getByPlaceholderText(/사용할 이메일/);
    await user.clear(emailInput);
    await user.type(emailInput, "new@example.com");

    expect(screen.queryByTestId("email-exists-error")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// OTP 인증 흐름 (Step 2)
// ─────────────────────────────────────────────────────────────────────────

describe("OTP step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckEmailExists.mockResolvedValue({ exists: false, confirmed: false });
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it("shows OTP step after signInWithOtp succeeds", async () => {
    await goToOtpStep();
    expect(screen.getByText("이메일 인증")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
  });

  it("hides 닫기 button during OTP step", async () => {
    await goToOtpStep();
    expect(screen.queryByRole("button", { name: "닫기" })).not.toBeInTheDocument();
  });

  it("shows cooldown text immediately after OTP step appears", async () => {
    await goToOtpStep();
    await waitFor(() => screen.getByTestId("resend-button"));
    expect(screen.getByTestId("resend-button").textContent).toMatch(/초 후 재전송/);
  });

  it("disables resend button during cooldown", async () => {
    await goToOtpStep();
    await waitFor(() => screen.getByTestId("resend-button"));
    expect(screen.getByTestId("resend-button")).toBeDisabled();
  });

  it("calls verifyOtp with type 'email' on code submit", async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: {} },
      error: null,
    });
    const { user } = await goToOtpStep();
    await user.type(screen.getByPlaceholderText("000000"), "123456");
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: "test@example.com",
        token: "123456",
        type: "email",
      });
    });
  });

  it("advances to profile step after OTP verified", async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: {} },
      error: null,
    });
    const { user } = await goToOtpStep();
    await user.type(screen.getByPlaceholderText("000000"), "123456");
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText(/3~20자/)).toBeInTheDocument()
    );
  });

  it("shows expiry error when verifyOtp returns expired message", async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "OTP has expired", code: "otp_expired" },
    });
    const { user } = await goToOtpStep();
    await user.type(screen.getByPlaceholderText("000000"), "999999");
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() =>
      expect(screen.getByText(/만료됐어요/)).toBeInTheDocument()
    );
  });

  it("shows invalid-code error when verifyOtp returns invalid token", async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "invalid token" },
    });
    const { user } = await goToOtpStep();
    await user.type(screen.getByPlaceholderText("000000"), "000000");
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() =>
      expect(screen.getByText(/맞지 않아요/)).toBeInTheDocument()
    );
  });

  it("shows generic error on network failure", async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "network error" },
    });
    const { user } = await goToOtpStep();
    await user.type(screen.getByPlaceholderText("000000"), "111111");
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() =>
      expect(screen.getByText(/다시 시도해주세요/)).toBeInTheDocument()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 프로필 완성 (Step 3)
// ─────────────────────────────────────────────────────────────────────────

describe("Profile step (Step 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckEmailExists.mockResolvedValue({ exists: false, confirmed: false });
    mockSignInWithOtp.mockResolvedValue({ error: null });
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: "uid-1" }, session: {} },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ data: { user: { id: "uid-1" } }, error: null });
    mockCompleteProfile.mockResolvedValue({ error: null });
  });

  it("calls updateUser with password on submit", async () => {
    const { user } = await goToProfileStep();
    await submitProfileStep(user);

    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "Test1234!" })
    );
  });

  it("calls completeProfile after updateUser succeeds", async () => {
    const { user } = await goToProfileStep();
    await submitProfileStep(user);

    await waitFor(() => expect(mockCompleteProfile).toHaveBeenCalledTimes(1));
  });

  it("calls onClose after successful submit", async () => {
    const { user, onClose } = await goToProfileStep();
    await submitProfileStep(user);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows nickname conflict error on 23505 from completeProfile", async () => {
    mockCompleteProfile.mockResolvedValueOnce({ error: "duplicate key", code: "23505" });
    const { user } = await goToProfileStep();
    await submitProfileStep(user);

    await waitFor(() =>
      expect(screen.getByTestId("nickname-conflict-error")).toBeInTheDocument()
    );
    // 모달은 Step 3에 머무름 (onClose 미호출)
    expect(screen.getByRole("button", { name: /가입 완료/ })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// OTP 모달 닫기 버튼 (Step 2)
// ─────────────────────────────────────────────────────────────────────────

describe("OTP step close button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckEmailExists.mockResolvedValue({ exists: false, confirmed: false });
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  it("shows close button during OTP step", async () => {
    await goToOtpStep();
    expect(screen.getByTestId("otp-close-button")).toBeInTheDocument();
  });

  it("clicking close button switches to login mode", async () => {
    const { user } = await goToOtpStep();
    await user.click(screen.getByTestId("otp-close-button"));
    expect(screen.getByText("로그인")).toBeInTheDocument();
  });

  it("shows login link during OTP step", async () => {
    await goToOtpStep();
    expect(screen.getByTestId("otp-goto-login")).toBeInTheDocument();
  });

  it("clicking login link switches to login mode", async () => {
    const { user } = await goToOtpStep();
    await user.click(screen.getByTestId("otp-goto-login"));
    expect(screen.getByText("로그인")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B2: 비밀번호 재설정 (forgot mode)
// ─────────────────────────────────────────────────────────────────────────

describe("B2 비밀번호 재설정 (forgot mode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  async function enterForgotMode() {
    const user = userEvent.setup({ delay: null });
    const onClose = vi.fn();
    render(<AuthModal onClose={onClose} />);
    // "비밀번호를 잊으셨나요?" link is in login mode
    await user.click(screen.getByTestId("forgot-password-link"));
    return { user, onClose };
  }

  it("shows 비밀번호 재설정 header when forgot mode is active", async () => {
    await enterForgotMode();
    expect(screen.getByText("비밀번호 재설정")).toBeInTheDocument();
  });

  it("calls resetPasswordForEmail with correct email and redirectTo", async () => {
    const { user } = await enterForgotMode();
    await user.type(screen.getByTestId("forgot-email-input"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "재설정 메일 전송" }));

    await waitFor(() =>
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "user@example.com",
        expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password") })
      )
    );
  });

  it("shows confirmation UI after successful email send", async () => {
    const { user } = await enterForgotMode();
    await user.type(screen.getByTestId("forgot-email-input"), "user@example.com");
    await user.click(screen.getByRole("button", { name: "재설정 메일 전송" }));

    await waitFor(() =>
      expect(screen.getByTestId("forgot-sent-confirmation")).toBeInTheDocument()
    );
  });

  it("shows 로그인으로 돌아가기 and clicking it returns to login", async () => {
    const { user } = await enterForgotMode();
    const backLink = screen.getByTestId("back-to-login-link");
    expect(backLink).toBeInTheDocument();
    await user.click(backLink);
    expect(screen.getByText("돌아오신 것을 환영해요")).toBeInTheDocument();
  });
});
