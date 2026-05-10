import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthModal, { analyzePassword } from "./AuthModal";

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockSignUp        = vi.fn();
const mockVerifyOtp     = vi.fn();
const mockResend        = vi.fn();
const mockSignInOAuth   = vi.fn();
const mockSignInPassword = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithOAuth:    (...args: any[]) => mockSignInOAuth(...args),
      signInWithPassword: (...args: any[]) => mockSignInPassword(...args),
      signUp:             (...args: any[]) => mockSignUp(...args),
      verifyOtp:          (...args: any[]) => mockVerifyOtp(...args),
      resend:             (...args: any[]) => mockResend(...args),
    },
  },
}));

const mockCheckEmailExists = vi.fn().mockResolvedValue(false);
const mockCompleteProfile  = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/profile", () => ({
  checkEmailExists:      (...args: any[]) => mockCheckEmailExists(...args),
  completeProfile:       (...args: any[]) => mockCompleteProfile(...args),
  detectCountryCodeSmart: vi.fn().mockReturnValue("KR"),
  detectLocale:          vi.fn().mockReturnValue("ko"),
  detectTimezone:        vi.fn().mockReturnValue("Asia/Seoul"),
  validateBirthDate:     vi.fn().mockReturnValue(null),
  calculateAge:          vi.fn().mockReturnValue(25),
  COUNTRY_OPTIONS:       [{ code: "KR", flag: "🇰🇷", name: "대한민국" }],
}));

vi.mock("@/hooks/useNicknameAvailability", () => ({
  useNicknameAvailability: vi.fn().mockReturnValue({ state: "available", suggestions: [] }),
}));

vi.mock("@/lib/nicknameValidation", () => ({
  validateNicknameFormat: vi.fn().mockReturnValue({ valid: true }),
  nicknameErrorMessage:   vi.fn().mockReturnValue(""),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

// ─── Helper: navigate to Step 1 (signup mode) ─────────────────────────────

async function goToSignupStep1() {
  const user = userEvent.setup({ delay: null });
  const onClose = vi.fn();
  render(<AuthModal onClose={onClose} />);

  // Click "회원가입" to switch to signup mode
  await user.click(screen.getByText("회원가입"));

  return { user, onClose };
}

// Helper: fill Step 1 with a strong password and proceed to Step 2
async function goToSignupStep2() {
  const { user, onClose } = await goToSignupStep1();

  await user.type(screen.getByPlaceholderText(/사용할 이메일/), "test@example.com");
  await user.type(screen.getByPlaceholderText(/비밀번호/), "Test1234!");

  await user.click(screen.getByRole("button", { name: "다음" }));
  await waitFor(() => expect(screen.getByPlaceholderText(/3~20자/)).toBeInTheDocument());

  return { user, onClose };
}

// Helper: fill Step 2 and submit (triggering signUp)
async function submitStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/3~20자/), "testuser");
  await user.type(screen.getAllByPlaceholderText(/YYYY/)[0], "1998");
  await user.type(screen.getAllByPlaceholderText(/MM/)[0], "5");
  await user.type(screen.getAllByPlaceholderText(/DD/)[0], "15");

  const checkboxes = screen.getAllByRole("checkbox");
  await user.click(checkboxes[0]); // 이용약관
  await user.click(checkboxes[1]); // 개인정보

  await user.click(screen.getByRole("button", { name: /시작하기/ }));
}

// ─────────────────────────────────────────────────────────────────────────
// C3: analyzePassword (pure function unit tests)
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
    expect(score).toBe(3); // length + lowercase + digit
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
// C3: Password strength UI
// ─────────────────────────────────────────────────────────────────────────

describe("Password strength UI", () => {
  it("does not show strength bar when password is empty", async () => {
    await goToSignupStep1();
    expect(screen.queryByTestId("password-strength")).not.toBeInTheDocument();
  });

  it("shows strength section when password has characters", async () => {
    const { user } = await goToSignupStep1();
    await user.type(screen.getByPlaceholderText(/비밀번호/), "a");
    expect(screen.getByTestId("password-strength")).toBeInTheDocument();
  });

  it("disables 다음 button when password is weak", async () => {
    const { user } = await goToSignupStep1();
    await user.type(screen.getByPlaceholderText(/이메일/), "test@example.com");
    await user.type(screen.getByPlaceholderText(/비밀번호/), "weak");
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
  });

  it("enables 다음 button when password meets all 5 criteria", async () => {
    const { user } = await goToSignupStep1();
    await user.type(screen.getByPlaceholderText(/이메일/), "test@example.com");
    await user.type(screen.getByPlaceholderText(/비밀번호/), "Test1234!");
    expect(screen.getByRole("button", { name: "다음" })).not.toBeDisabled();
  });

  it("shows 매우 강함 label for score 5 password", async () => {
    const { user } = await goToSignupStep1();
    await user.type(screen.getByPlaceholderText(/비밀번호/), "Test1234!");
    expect(screen.getByText("매우 강함")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C2: 이메일 중복 검증
// ─────────────────────────────────────────────────────────────────────────

describe("Email duplicate handling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows email-exists error when checkEmailExists returns true", async () => {
    mockCheckEmailExists.mockResolvedValueOnce(true);
    const { user } = await goToSignupStep1();

    await user.type(screen.getByPlaceholderText(/이메일/), "dup@example.com");
    await user.type(screen.getByPlaceholderText(/비밀번호/), "Test1234!");
    await user.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() =>
      expect(screen.getByTestId("email-exists-error")).toBeInTheDocument()
    );
    expect(screen.getByText(/이미 가입된 이메일/)).toBeInTheDocument();
  });

  it("switches to login mode when 로그인하기 CTA is clicked", async () => {
    mockCheckEmailExists.mockResolvedValueOnce(true);
    const { user } = await goToSignupStep1();

    await user.type(screen.getByPlaceholderText(/이메일/), "dup@example.com");
    await user.type(screen.getByPlaceholderText(/비밀번호/), "Test1234!");
    await user.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => screen.getByTestId("goto-login-button"));

    await user.click(screen.getByTestId("goto-login-button"));
    expect(screen.getByText("로그인")).toBeInTheDocument();
  });

  it("clears email-exists error when email is changed", async () => {
    mockCheckEmailExists.mockResolvedValueOnce(true);
    const { user } = await goToSignupStep1();

    await user.type(screen.getByPlaceholderText(/이메일/), "dup@example.com");
    await user.type(screen.getByPlaceholderText(/비밀번호/), "Test1234!");
    await user.click(screen.getByRole("button", { name: "다음" }));
    await waitFor(() => screen.getByTestId("email-exists-error"));

    const emailInput = screen.getByPlaceholderText(/이메일/);
    await user.clear(emailInput);
    await user.type(emailInput, "new@example.com");

    expect(screen.queryByTestId("email-exists-error")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C1: OTP 가입 인증 흐름
// ─────────────────────────────────────────────────────────────────────────

describe("OTP signup flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckEmailExists.mockResolvedValue(false);
  });

  it("shows OTP modal after signUp succeeds", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: null },
      error: null,
    });

    const { user } = await goToSignupStep2();
    await submitStep2(user);

    await waitFor(() =>
      expect(screen.getByText("이메일 인증")).toBeInTheDocument()
    );
    expect(screen.getByPlaceholderText("000000")).toBeInTheDocument();
  });

  it("hides 닫기 button inside OTP modal", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: null },
      error: null,
    });

    const { user } = await goToSignupStep2();
    await submitStep2(user);

    await waitFor(() => screen.getByText("이메일 인증"));
    expect(screen.queryByRole("button", { name: "닫기" })).not.toBeInTheDocument();
  });

  it("calls verifyOtp on code submit and then completeProfile", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: null },
      error: null,
    });
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: {} },
      error: null,
    });

    const { user, onClose } = await goToSignupStep2();
    await submitStep2(user);

    await waitFor(() => screen.getByPlaceholderText("000000"));
    await user.type(screen.getByPlaceholderText("000000"), "123456");
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() => {
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: "test@example.com",
        token: "123456",
        type: "signup",
      });
    });
    await waitFor(() => expect(mockCompleteProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows cooldown text on resend button immediately after OTP modal appears", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: null },
      error: null,
    });

    const { user } = await goToSignupStep2();
    await submitStep2(user);

    await waitFor(() => screen.getByTestId("resend-button"));
    // startCooldown() was called → button text shows countdown
    expect(screen.getByTestId("resend-button").textContent).toMatch(/초 후 재전송/);
  });

  it("disables resend button during cooldown (just started)", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: null },
      error: null,
    });

    const { user } = await goToSignupStep2();
    await submitStep2(user);

    await waitFor(() => screen.getByTestId("resend-button"));
    // cooldown just started → button should be disabled
    expect(screen.getByTestId("resend-button")).toBeDisabled();
  });

  it("shows expiry error when verifyOtp returns expired message", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: null },
      error: null,
    });
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "OTP has expired", code: "otp_expired" },
    });

    const { user } = await goToSignupStep2();
    await submitStep2(user);

    await waitFor(() => screen.getByPlaceholderText("000000"));
    await user.type(screen.getByPlaceholderText("000000"), "999999");
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() =>
      expect(screen.getByText(/만료됐어요/)).toBeInTheDocument()
    );
  });

  it("shows invalid-code error when verifyOtp returns invalid token", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: null },
      error: null,
    });
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "invalid token" },
    });

    const { user } = await goToSignupStep2();
    await submitStep2(user);

    await waitFor(() => screen.getByPlaceholderText("000000"));
    await user.type(screen.getByPlaceholderText("000000"), "000000");
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() =>
      expect(screen.getByText(/맞지 않아요/)).toBeInTheDocument()
    );
  });

  it("shows generic error on network failure", async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "uid-1" }, session: null },
      error: null,
    });
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: "network error" },
    });

    const { user } = await goToSignupStep2();
    await submitStep2(user);

    await waitFor(() => screen.getByPlaceholderText("000000"));
    await user.type(screen.getByPlaceholderText("000000"), "111111");
    await user.click(screen.getByRole("button", { name: "인증하기" }));

    await waitFor(() =>
      expect(screen.getByText(/다시 시도해주세요/)).toBeInTheDocument()
    );
  });
});
