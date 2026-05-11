import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthModal, { analyzePassword } from "./AuthModal";

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockSignInWithOtp         = vi.fn().mockResolvedValue({ error: null });
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

async function enterSignupMode() {
  const user = userEvent.setup({ delay: null });
  const onClose = vi.fn();
  render(<AuthModal onClose={onClose} />);
  await user.click(screen.getByText("회원가입"));
  return { user, onClose };
}

// Step 1 이메일 제출 → Magic Link 안내 화면 (Step 2)
async function goToMagicLinkStep() {
  const { user, onClose } = await enterSignupMode();
  await user.type(screen.getByPlaceholderText(/사용할 이메일/), "test@example.com");
  await user.click(screen.getByRole("button", { name: "다음" }));
  await waitFor(() => expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument());
  return { user, onClose };
}

// Step 3 직접 렌더 (initialSignupStep=3, callback 흐름)
async function renderAtStep3() {
  const user = userEvent.setup({ delay: null });
  const onClose = vi.fn();
  render(<AuthModal onClose={onClose} initialSignupStep={3} />);
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
// Password strength UI (Step 3 — initialSignupStep=3)
// ─────────────────────────────────────────────────────────────────────────

describe("Password strength UI", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("does not show strength bar when password is empty", async () => {
    await renderAtStep3();
    expect(screen.queryByTestId("password-strength")).not.toBeInTheDocument();
  });

  it("shows strength section when password has characters", async () => {
    const { user } = await renderAtStep3();
    await user.type(screen.getByPlaceholderText(/비밀번호.*8자/), "a");
    expect(screen.getByTestId("password-strength")).toBeInTheDocument();
  });

  it("disables 가입완료 button when password is weak", async () => {
    const { user } = await renderAtStep3();
    await user.type(screen.getByPlaceholderText(/비밀번호.*8자/), "weak");
    expect(screen.getByRole("button", { name: /가입 완료/ })).toBeDisabled();
  });

  it("enables 가입완료 button when password meets all 5 criteria", async () => {
    const { user } = await renderAtStep3();
    await user.type(screen.getByPlaceholderText(/비밀번호.*8자/), "Test1234!");
    expect(screen.getByRole("button", { name: /가입 완료/ })).not.toBeDisabled();
  });

  it("shows 매우 강함 label for score 5 password", async () => {
    const { user } = await renderAtStep3();
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

  it("proceeds to magic link step when email exists but unconfirmed", async () => {
    mockCheckEmailExists.mockResolvedValueOnce({ exists: true, confirmed: false });
    const { user } = await enterSignupMode();

    await user.type(screen.getByPlaceholderText(/사용할 이메일/), "pending@example.com");
    await user.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() =>
      expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument()
    );
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "pending@example.com" })
    );
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
// Magic Link Step 2 흐름
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

  it("resennd 버튼 cooldown 직후 비활성화", async () => {
    await goToMagicLinkStep();
    await waitFor(() => screen.getByTestId("resend-button"));
    expect(screen.getByTestId("resend-button")).toBeDisabled();
    expect(screen.getByTestId("resend-button").textContent).toMatch(/초 후 재전송/);
  });

  it("재전송 시 signInWithOtp 재호출 + emailRedirectTo 포함", async () => {
    // fake timers를 render 전에 설정해야 setInterval도 fake로 생성됨
    vi.useFakeTimers();
    render(<AuthModal onClose={vi.fn()} />);

    // fireEvent를 사용하면 fake timer 환경에서도 userEvent 호환성 문제 없음
    await act(async () => { fireEvent.click(screen.getByText("회원가입")); });
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/사용할 이메일/), {
        target: { value: "test@example.com" },
      });
    });
    // "다음" 버튼 클릭 → handleStep1Next(checkEmailExists + signInWithOtp) 실행
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "다음" }).closest("form")!);
    });
    // checkEmailExists → signInWithOtp → setSignupStep(2) + startCooldown() 순차 resolve
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByTestId("magic-link-screen")).toBeInTheDocument();

    // cooldown 60초 해제
    await act(async () => { vi.advanceTimersByTime(61_000); });

    expect(screen.getByTestId("resend-button")).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("resend-button"));
    });
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

  it("로그인 링크 클릭 시 login 모드 전환", async () => {
    const { user } = await goToMagicLinkStep();
    await user.click(screen.getByTestId("magic-link-goto-login"));
    expect(screen.getByText("돌아오신 것을 환영해요")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 프로필 완성 (Step 3 — initialSignupStep=3)
// ─────────────────────────────────────────────────────────────────────────

describe("Profile step (Step 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ data: { user: { id: "uid-1" } }, error: null });
    mockCompleteProfile.mockResolvedValue({ error: null });
  });

  it("calls updateUser with password on submit", async () => {
    const { user } = await renderAtStep3();
    await submitProfileStep(user);

    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "Test1234!" })
    );
  });

  it("calls completeProfile after updateUser succeeds", async () => {
    const { user } = await renderAtStep3();
    await submitProfileStep(user);

    await waitFor(() => expect(mockCompleteProfile).toHaveBeenCalledTimes(1));
  });

  it("calls onClose after successful submit", async () => {
    const { user, onClose } = await renderAtStep3();
    await submitProfileStep(user);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows nickname conflict error on 23505 from completeProfile", async () => {
    mockCompleteProfile.mockResolvedValueOnce({ error: "duplicate key", code: "23505" });
    const { user } = await renderAtStep3();
    await submitProfileStep(user);

    await waitFor(() =>
      expect(screen.getByTestId("nickname-conflict-error")).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /가입 완료/ })).toBeInTheDocument();
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
