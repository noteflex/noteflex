import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  completeProfile,
  detectCountryCodeSmart,
  detectLocale,
  detectTimezone,
  validateBirthDate,
  calculateAge,
  checkEmailExists,
  COUNTRY_OPTIONS,
} from "@/lib/profile";
import { useNicknameAvailability } from "@/hooks/useNicknameAvailability";
import { nicknameErrorMessage, validateNicknameFormat } from "@/lib/nicknameValidation";

// ─── Password strength ─────────────────────────────────────────────────────

export interface PasswordChecks {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  digit: boolean;
  special: boolean;
}

export function analyzePassword(pw: string): { score: number; checks: PasswordChecks } {
  const checks: PasswordChecks = {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    digit:     /[0-9]/.test(pw),
    special:   /[^A-Za-z0-9]/.test(pw),
  };
  return { score: Object.values(checks).filter(Boolean).length, checks };
}

const STRENGTH_LABEL  = ["", "약함", "보통", "강함", "강함", "매우 강함"] as const;
const STRENGTH_BAR_CL = ["", "bg-red-500", "bg-yellow-400", "bg-blue-400", "bg-blue-500", "bg-green-500"] as const;
const STRENGTH_TXT_CL = ["", "text-red-500", "text-yellow-500", "text-blue-400", "text-blue-500", "text-green-500"] as const;

// ─── Types ────────────────────────────────────────────────────────────────

interface AuthModalProps {
  onClose: () => void;
}

type Mode = "login" | "signup";
type SignupStep = 1 | 2 | 3;

// ─── Component ───────────────────────────────────────────────────────────

export default function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [loading, setLoading] = useState(false);

  // 공통
  const [email, setEmail] = useState("");
  const [emailExistsError, setEmailExistsError] = useState(false);

  // Step 2 — OTP
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 3 — 비밀번호 + 프로필
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nickname, setNickname] = useState("");
  const nicknameStatus = useNicknameAvailability(
    mode === "signup" && signupStep === 3 ? nickname : ""
  );
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [countryCode, setCountryCode] = useState(detectCountryCodeSmart());
  const [tosAgreed, setTosAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const startCooldown = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null; }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const pwAnalysis = analyzePassword(password);
  const pwValid = pwAnalysis.score === 5;

  // ───────── Google OAuth ─────────
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Google 로그인 실패", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  // ───────── 로그인 ─────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: "로그인 성공!" });
      onClose();
    } catch (err: any) {
      toast({ title: "로그인 실패", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ───────── Step 1: 이메일 → OTP 전송 ─────────
  const handleStep1Next = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast({ title: "이메일을 확인해주세요", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const exists = await checkEmailExists(email);
      if (exists) {
        setEmailExistsError(true);
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setSignupStep(2);
      startCooldown();
    } catch (err: any) {
      toast({ title: "오류가 발생했어요", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ───────── Step 2: OTP 인증 → Step 3 ─────────
  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) return;
    setOtpLoading(true);
    setOtpError("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });
      if (error) throw error;
      if (!data.user) throw new Error("인증 실패");
      setOtpCode("");
      setSignupStep(3);
    } catch (err: any) {
      const msg = (err.message ?? "").toLowerCase();
      if (msg.includes("expired") || (err as any).code === "otp_expired") {
        setOtpError("코드가 만료됐어요. 재전송 버튼을 눌러주세요.");
      } else if (
        msg.includes("invalid") ||
        msg.includes("token") ||
        (err as any).code === "otp_disabled"
      ) {
        setOtpError("코드가 맞지 않아요. 다시 확인해주세요.");
      } else {
        setOtpError("인증에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // ───────── Step 2: 재전송 ─────────
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({ type: "email", email });
      if (error) throw error;
      setOtpCode("");
      setOtpError("");
      startCooldown();
      toast({ title: "코드를 재전송했어요", description: "이메일함을 확인해주세요." });
    } catch (err: any) {
      toast({ title: "재전송 실패", description: err.message, variant: "destructive" });
    }
  };

  // ───────── Step 3: 비밀번호+프로필 제출 ─────────
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nicknameValidation = validateNicknameFormat(nickname);
    if (!nicknameValidation.valid) {
      toast({ title: nicknameErrorMessage(nicknameValidation.reason), variant: "destructive" });
      return;
    }
    if (!pwValid) {
      toast({ title: "비밀번호 요구사항을 모두 충족해주세요", variant: "destructive" });
      return;
    }

    const year  = parseInt(birthYear,  10);
    const month = parseInt(birthMonth, 10);
    const day   = parseInt(birthDay,   10);
    const birthError = validateBirthDate(year, month, day);
    if (birthError) {
      toast({ title: birthError, variant: "destructive" });
      return;
    }

    if (!tosAgreed || !privacyAgreed) {
      toast({ title: "필수 약관에 동의해주세요", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user: updatedUser }, error: updateError } =
        await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      if (!updatedUser) throw new Error("사용자 정보를 불러올 수 없어요");

      await completeProfile(updatedUser.id, {
        nickname,
        birth_year:       year,
        birth_month:      month,
        birth_day:        day,
        country_code:     countryCode,
        locale:           detectLocale(),
        timezone:         detectTimezone(),
        tos_agreed:       tosAgreed,
        privacy_agreed:   privacyAgreed,
        marketing_agreed: marketingAgreed,
      });

      const age = calculateAge(year, month, day);
      toast({
        title: "회원가입 완료!",
        description: age < 14 ? "보호자 동의가 필요한 연령입니다." : "환영합니다 🎼",
      });
      onClose();
    } catch (err: any) {
      toast({ title: "가입 완료에 실패했어요", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ───────── 모드 전환 ─────────
  const switchMode = (next: Mode) => {
    setMode(next);
    setSignupStep(1);
    setEmailExistsError(false);
    setOtpCode("");
    setOtpError("");
  };

  // ─────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-pop-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">

        {/* ━━━━━━━━━━━━━━━━ Step 2: OTP (인증 완료 전 닫기 X) ━━━━━━━━━━━━━━━━ */}
        {mode === "signup" && signupStep === 2 ? (
          <div className="px-6 py-8 flex flex-col items-center gap-5">
            <div className="text-5xl">📧</div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground">이메일 인증</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                <span className="font-medium text-foreground">{email}</span>로<br />
                6자리 인증 코드를 보냈어요
              </p>
            </div>

            <form onSubmit={handleOtpVerify} className="w-full flex flex-col gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={otpCode}
                onChange={e => {
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setOtpError("");
                }}
                placeholder="000000"
                maxLength={6}
                autoFocus
                autoComplete="one-time-code"
                className="w-full px-4 py-3 rounded-xl border border-input bg-background text-2xl text-center tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {otpError && (
                <p className="text-xs text-destructive text-center">{otpError}</p>
              )}

              <button
                type="submit"
                disabled={otpCode.length !== 6 || otpLoading}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {otpLoading ? "확인 중..." : "인증하기"}
              </button>
            </form>

            <div className="text-center space-y-1.5">
              <p className="text-xs text-muted-foreground">코드를 받지 못했나요?</p>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0}
                className="text-sm font-semibold text-primary disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
                data-testid="resend-button"
              >
                {resendCooldown > 0 ? `${resendCooldown}초 후 재전송` : "코드 재전송"}
              </button>
              <p className="text-xs text-muted-foreground">스팸함도 확인해보세요 📁</p>
            </div>
          </div>
        ) : (
          <>
            {/* ━━━━━━━━━━━━━━━━ Header ━━━━━━━━━━━━━━━━ */}
            {mode === "login" ? (
              <div className="flex flex-col items-center gap-2 pt-6 pb-5 px-6">
                <span className="text-4xl">🎹</span>
                <h2 className="text-xl font-bold text-foreground">로그인</h2>
                <p className="text-xs text-muted-foreground">돌아오신 것을 환영해요</p>
              </div>
            ) : (
              <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-primary/15 via-primary/10 to-accent/10 border-b border-border rounded-t-2xl">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-3xl">✨</span>
                    <span className="text-3xl">🎹</span>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">독보 마스터 시작하기</h2>
                  <p className="text-xs text-muted-foreground text-center">
                    {signupStep === 1
                      ? "계정을 만들고 첫 걸음을 시작해요"
                      : "거의 다 왔어요! 비밀번호와 프로필을 완성해주세요"}
                  </p>
                  <div className="w-full mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-primary" />
                    <div className={`flex-1 h-1.5 rounded-full transition-colors ${signupStep === 3 ? "bg-primary" : "bg-muted"}`} />
                    <div className={`flex-1 h-1.5 rounded-full transition-colors ${signupStep === 3 ? "bg-primary" : "bg-muted"}`} />
                  </div>
                  <div className="w-full flex justify-between text-[10px] font-medium">
                    <span className={signupStep === 1 ? "text-primary font-bold" : "text-muted-foreground"}>① 이메일</span>
                    <span className="text-muted-foreground">② 인증</span>
                    <span className={signupStep === 3 ? "text-primary font-bold" : "text-muted-foreground"}>③ 프로필</span>
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 pb-6 pt-5">
              {/* ━━━━━━━━━━━━━━━━ 로그인 모드 ━━━━━━━━━━━━━━━━ */}
              {mode === "login" && (
                <>
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-border bg-background hover:bg-muted transition-colors text-sm font-semibold mb-4 disabled:opacity-50"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google로 계속하기
                  </button>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">또는</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <form onSubmit={handleLogin} className="flex flex-col gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="이메일을 입력해주세요"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="비밀번호를 입력해주세요"
                        required
                        className="w-full px-4 py-2.5 pr-16 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                      >
                        {showPassword ? "숨기기" : "보기"}
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                      {loading ? "처리 중..." : "이메일로 로그인"}
                    </button>
                  </form>
                </>
              )}

              {/* ━━━━━━━━━━━━━━━━ 회원가입 Step 1: 이메일 ━━━━━━━━━━━━━━━━ */}
              {mode === "signup" && signupStep === 1 && (
                <>
                  <div className="mb-4 p-3 rounded-xl bg-muted/50 border border-border">
                    <p className="text-xs font-semibold text-foreground mb-2">🎁 가입하면 이런 게 가능해요</p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-start gap-1.5"><span className="text-primary">✓</span><span>연주 기록 저장 및 성장 추적</span></li>
                      <li className="flex items-start gap-1.5"><span className="text-primary">✓</span><span>모든 레벨 자유롭게 도전</span></li>
                      <li className="flex items-start gap-1.5"><span className="text-primary">✓</span><span>학습 통계로 약점 분석</span></li>
                    </ul>
                  </div>

                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-border bg-background hover:bg-muted transition-colors text-sm font-semibold mb-4 disabled:opacity-50"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google로 계속하기
                  </button>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground">또는</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <form onSubmit={handleStep1Next} className="flex flex-col gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setEmailExistsError(false); }}
                      placeholder="사용할 이메일을 입력해주세요"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />

                    {emailExistsError && (
                      <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30" data-testid="email-exists-error">
                        <p className="text-sm font-semibold text-destructive">이미 가입된 이메일이에요</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <p className="text-xs text-muted-foreground flex-1">로그인 탭에서 로그인해 보세요.</p>
                          <button
                            type="button"
                            onClick={() => switchMode("login")}
                            className="text-xs font-bold text-primary shrink-0 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                            data-testid="goto-login-button"
                          >
                            로그인하기
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                      {loading ? "전송 중..." : "다음"}
                    </button>
                  </form>
                </>
              )}

              {/* ━━━━━━━━━━━━━━━━ 회원가입 Step 3: 비밀번호 + 프로필 ━━━━━━━━━━━━━━━━ */}
              {mode === "signup" && signupStep === 3 && (
                <form onSubmit={handleSignupSubmit} className="flex flex-col gap-4">
                  {/* 비밀번호 */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground block mb-1.5 ml-1">
                      비밀번호 <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="비밀번호 (8자+·대소문자·숫자·특수문자)"
                        required
                        minLength={8}
                        className="w-full px-4 py-2.5 pr-16 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                      >
                        {showPassword ? "숨기기" : "보기"}
                      </button>
                    </div>

                    {password.length > 0 && (
                      <div className="space-y-2" data-testid="password-strength">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1 flex-1">
                            {[1, 2, 3, 4, 5].map(i => (
                              <div
                                key={i}
                                className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                                  i <= pwAnalysis.score ? STRENGTH_BAR_CL[pwAnalysis.score] : "bg-muted"
                                }`}
                              />
                            ))}
                          </div>
                          {pwAnalysis.score > 0 && (
                            <span className={`text-xs font-medium ${STRENGTH_TXT_CL[pwAnalysis.score]}`}>
                              {STRENGTH_LABEL[pwAnalysis.score]}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                          {[
                            { key: "length",    label: "8자 이상" },
                            { key: "uppercase", label: "대문자" },
                            { key: "lowercase", label: "소문자" },
                            { key: "digit",     label: "숫자" },
                            { key: "special",   label: "특수문자" },
                          ].map(({ key, label }) => {
                            const ok = pwAnalysis.checks[key as keyof PasswordChecks];
                            return (
                              <span key={key} className={ok ? "text-green-600" : "text-muted-foreground"}>
                                {ok ? "✓" : "✗"} {label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 닉네임 */}
                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-foreground block mb-1.5 ml-1">
                      닉네임 <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={e => setNickname(e.target.value.toLowerCase())}
                      placeholder="3~20자, 영문 소문자/숫자/밑줄"
                      maxLength={20}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {nicknameStatus.state === "checking" && (
                      <p className="text-xs text-muted-foreground ml-1">확인 중...</p>
                    )}
                    {nicknameStatus.state === "available" && (
                      <p className="text-xs text-green-600 ml-1">✅ 사용 가능한 닉네임입니다</p>
                    )}
                    {nicknameStatus.state === "invalid_format" && (
                      <p className="text-xs text-destructive ml-1">{nicknameStatus.reason}</p>
                    )}
                    {nicknameStatus.state === "taken" && (
                      <div className="space-y-1">
                        <p className="text-xs text-destructive ml-1">이미 사용 중인 닉네임입니다</p>
                        {nicknameStatus.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-2 items-center ml-1">
                            <span className="text-xs text-muted-foreground">추천:</span>
                            {nicknameStatus.suggestions.map(s => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setNickname(s)}
                                className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 생년월일 */}
                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-1.5 ml-1">
                      생년월일 <span className="text-destructive">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="number" value={birthYear}  onChange={e => setBirthYear(e.target.value)}  placeholder="YYYY" min="1900" max={new Date().getFullYear()} required className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-center" />
                      <input type="number" value={birthMonth} onChange={e => setBirthMonth(e.target.value)} placeholder="MM"   min="1"    max="12"                         required className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-center" />
                      <input type="number" value={birthDay}   onChange={e => setBirthDay(e.target.value)}   placeholder="DD"   min="1"    max="31"                         required className="px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-center" />
                    </div>
                  </div>

                  {/* 국가 */}
                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-1.5 ml-1">
                      국가 <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {COUNTRY_OPTIONS.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 약관 동의 */}
                  <div className="flex flex-col gap-3 mt-1 p-4 rounded-xl bg-muted/40 border border-border">
                    <p className="text-sm font-semibold text-foreground mb-0">약관 동의</p>
                    <label className="flex items-start gap-2.5 text-sm cursor-pointer hover:bg-background/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                      <input type="checkbox" checked={tosAgreed} onChange={e => setTosAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary cursor-pointer" />
                      <span><span className="font-bold text-destructive">[필수]</span><span className="ml-1 text-foreground">이용약관에 동의합니다</span></span>
                    </label>
                    <label className="flex items-start gap-2.5 text-sm cursor-pointer hover:bg-background/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                      <input type="checkbox" checked={privacyAgreed} onChange={e => setPrivacyAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary cursor-pointer" />
                      <span><span className="font-bold text-destructive">[필수]</span><span className="ml-1 text-foreground">개인정보처리방침에 동의합니다</span></span>
                    </label>
                    <label className="flex items-start gap-2.5 text-sm cursor-pointer hover:bg-background/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                      <input type="checkbox" checked={marketingAgreed} onChange={e => setMarketingAgreed(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary cursor-pointer" />
                      <span><span className="font-medium text-muted-foreground">[선택]</span><span className="ml-1 text-foreground/80">마케팅 정보 수신에 동의합니다</span></span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !pwValid ||
                      nicknameStatus.state === "checking" ||
                      nicknameStatus.state === "taken" ||
                      nicknameStatus.state === "invalid_format"
                    }
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? "처리 중..." : "가입 완료"}
                  </button>
                </form>
              )}

              {/* ━━━━━━━━━━━━━━━━ Footer ━━━━━━━━━━━━━━━━ */}
              <div className="mt-5 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => switchMode(mode === "login" ? "signup" : "login")}
                  className="w-full text-center text-sm py-1 group"
                >
                  <span className="text-muted-foreground">
                    {mode === "login" ? "아직 계정이 없으신가요? " : "이미 계정이 있으신가요? "}
                  </span>
                  <span className="font-bold text-primary underline underline-offset-2 group-hover:text-primary/80 transition-colors">
                    {mode === "login" ? "회원가입" : "로그인"}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full text-center text-sm text-muted-foreground mt-3 py-2 rounded-lg hover:bg-muted hover:text-foreground transition-colors font-medium"
              >
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
