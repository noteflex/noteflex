import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { checkEmailExists } from "@/lib/profile";

// ─── Types ────────────────────────────────────────────────────────────────

interface AuthModalProps {
  onClose: () => void;
}

type Mode = "login" | "signup";

// ─── Sub-components ───────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground">또는</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────

export default function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState(1); // 1: 이메일 폼, 2: 매직링크 전송 완료, 3: 복구 패널

  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Step 1 (signup) — 약관 동의
  const [tosAgreed, setTosAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);

  // Step 3 — 복구 UX
  const [recoveryDaysLeft, setRecoveryDaysLeft] = useState<number | null>(null);
  const [isRecovery, setIsRecovery] = useState(false);
  const [freshStartConfirm, setFreshStartConfirm] = useState(false);

  // Step 2 — 재전송 cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ESC 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [onClose]);

  // Step 2: 다른 탭에서 매직링크 클릭 시 자동 닫기
  // 이중 채널: localStorage storage event + BroadcastChannel
  useEffect(() => {
    if (step !== 2) return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === "noteflex_auth_complete") onClose();
    };
    window.addEventListener("storage", onStorage);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("noteflex_auth");
      channel.onmessage = (e: MessageEvent) => {
        if (e.data.type === "AUTH_COMPLETE") onClose();
      };
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [step, onClose]);

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

  const switchMode = (next: Mode) => {
    setMode(next);
    setStep(1);
    setEmail("");
    setEmailError(null);
    setTosAgreed(false);
    setMarketingAgreed(false);
    setRecoveryDaysLeft(null);
    setIsRecovery(false);
    setFreshStartConfirm(false);
  };

  // ───────── Google OAuth ─────────
  const handleGoogleLogin = async () => {
    if (mode === "signup" && !tosAgreed) {
      toast({ title: "필수 약관에 동의해주세요", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const now = new Date().toISOString();
        localStorage.setItem("noteflex_consent", JSON.stringify({
          tos_agreed_at: now,
          privacy_agreed_at: now,
          marketing_agreed_at: marketingAgreed ? now : null,
        }));
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err: any) {
      localStorage.removeItem("noteflex_consent");
      toast({ title: "Google 로그인 실패", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  // ───────── 로그인: 이메일 → 매직링크 ─────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast({ title: "이메일을 확인해주세요", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setStep(2);
      startCooldown();
    } catch (err: any) {
      setEmailError("가입된 이메일이 아니에요. 회원가입을 시작해볼까요?");
    } finally {
      setLoading(false);
    }
  };

  // ───────── 가입 Step 1: 이메일 + 약관 → 매직링크 ─────────
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast({ title: "이메일을 확인해주세요", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await checkEmailExists(email);
      // accountStatus takes precedence; fall back to v2 exists/confirmed for mock compat
      const status = result.accountStatus ?? ((result.exists && result.confirmed) ? "active" : "new");
      if (status === "active") {
        setEmailError("이미 가입된 이메일이에요.");
        setLoading(false);
        return;
      }
      if (status === "deleted_recoverable") {
        setRecoveryDaysLeft(result.recoveryDaysLeft ?? 30);
        setStep(3);
        setLoading(false);
        return;
      }
      if (status === "deleted_expired") {
        setEmailError("이 계정은 완전히 삭제되었습니다. 다른 이메일로 가입해주세요.");
        setLoading(false);
        return;
      }
      const now = new Date().toISOString();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            tos_agreed_at: now,
            privacy_agreed_at: now,
            marketing_agreed_at: marketingAgreed ? now : null,
          },
        },
      });
      if (error) throw error;
      setStep(2);
      startCooldown();
    } catch (err: any) {
      toast({ title: "오류가 발생했어요", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ───────── Step 3: 계정 복구 링크 전송 ─────────
  const handleRecoverAccount = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback?action=restore`,
        },
      });
      if (error) throw error;
      setIsRecovery(true);
      setStep(2);
      startCooldown();
    } catch (err: any) {
      toast({ title: "오류가 발생했어요", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ───────── Step 3: 새로 시작 (영구 삭제 후 신규 가입) ─────────
  const handleFreshStart = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc("hard_delete_account", { p_email: email });
      if (error) {
        toast({ title: "오류가 발생했어요", description: error.message, variant: "destructive" });
        return;
      }
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (otpError) throw otpError;
      setFreshStartConfirm(false);
      setIsRecovery(false);
      setStep(2);
      startCooldown();
    } catch (err: any) {
      toast({ title: "오류가 발생했어요", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ───────── Step 2: 재전송 ─────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      if (isRecovery) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${window.location.origin}/auth/callback?action=restore`,
          },
        });
        if (error) throw error;
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
      } else {
        const now = new Date().toISOString();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              tos_agreed_at: now,
              privacy_agreed_at: now,
              marketing_agreed_at: marketingAgreed ? now : null,
            },
          },
        });
        if (error) throw error;
      }
      startCooldown();
      toast({ title: "메일을 재전송했어요", description: "이메일함을 확인해주세요." });
    } catch (err: any) {
      toast({ title: "재전송 실패", description: err.message, variant: "destructive" });
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // JSX
  // ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-pop-in"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* ━━━━━━━━━━━━━━━━ Step 3: 계정 복구 패널 ━━━━━━━━━━━━━━━━ */}
        {step === 3 ? (
          <div className="px-6 py-10 flex flex-col items-center gap-5" data-testid="recovery-panel">
            {freshStartConfirm ? (
              /* ── 새로 시작 확인 화면 ── */
              <>
                <div className="text-5xl">⚠️</div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-foreground">정말 진행하시겠어요?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed" data-testid="fresh-start-confirm-text">
                    이전 데이터가 영구 삭제됩니다. 진행하시겠어요?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleFreshStart}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                  data-testid="fresh-start-confirm-button"
                >
                  {loading ? "처리 중..." : "확인"}
                </button>
                <button
                  type="button"
                  onClick={() => setFreshStartConfirm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="fresh-start-back-button"
                >
                  뒤로
                </button>
              </>
            ) : (
              /* ── 복구 / 새로 시작 선택 화면 ── */
              <>
                <div className="text-5xl">⏳</div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-foreground">계정 복구 가능</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">{email}</span>은<br />
                    삭제 처리 중인 계정이에요.<br />
                    <span className="font-semibold text-primary">{recoveryDaysLeft}일 이내</span>에 복구할 수 있어요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRecoverAccount}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                  data-testid="recover-account-button"
                >
                  {loading ? "전송 중..." : "계정 복구하기"}
                </button>
                <button
                  type="button"
                  onClick={() => setFreshStartConfirm(true)}
                  disabled={loading}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                  data-testid="fresh-start-button"
                >
                  새로 시작
                </button>
                <button
                  type="button"
                  onClick={() => { setStep(1); setRecoveryDaysLeft(null); setIsRecovery(false); setFreshStartConfirm(false); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="recovery-cancel-button"
                >
                  취소
                </button>
              </>
            )}
          </div>
        ) : step === 2 ? (
        /* ━━━━━━━━━━━━━━━━ Step 2: 매직링크 안내 ━━━━━━━━━━━━━━━━ */
          <div className="px-6 py-10 flex flex-col items-center gap-5" data-testid="magic-link-screen">
            <div className="text-5xl">✉️</div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-foreground">메일을 확인해주세요</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground" data-testid="magic-link-email">{email}</span>로<br />
                인증 메일을 보냈어요.<br />
                메일 속 링크를 클릭하면 {isRecovery ? "계정 복구가" : mode === "login" ? "로그인이" : "가입이"} 이어집니다.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">스팸함도 확인해보세요 📁</p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse" data-testid="auth-waiting-indicator">
              <span>⏳</span>
              <span>인증 대기 중...</span>
            </div>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-sm font-semibold text-primary disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
              data-testid="resend-button"
            >
              {resendCooldown > 0 ? `${resendCooldown}초 후 재전송` : "메일 재전송"}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="magic-link-back"
            >
              이메일 다시 입력하기
            </button>
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
                  <p className="text-xs text-muted-foreground text-center">계정을 만들고 첫 걸음을 시작해요</p>
                  <div className="w-full mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-primary" />
                    <div className="flex-1 h-1.5 rounded-full bg-muted" />
                  </div>
                  <div className="w-full flex justify-between text-[10px] font-medium">
                    <span className="text-primary font-bold">① 이메일 + 약관</span>
                    <span className="text-muted-foreground">② 메일 확인</span>
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
                    <GoogleIcon />
                    Google로 계속하기
                  </button>
                  <Divider />
                  <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setEmailError(null); }}
                      placeholder="이메일을 입력해주세요"
                      required
                      autoComplete="email"
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {emailError && (
                      <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30" data-testid="login-email-error">
                        <p className="text-sm text-destructive">{emailError}</p>
                        <button
                          type="button"
                          onClick={() => switchMode("signup")}
                          className="text-xs font-bold text-primary mt-1"
                          data-testid="goto-signup-button"
                        >
                          회원가입하기
                        </button>
                      </div>
                    )}
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

              {/* ━━━━━━━━━━━━━━━━ 회원가입 Step 1: 이메일 + 약관 ━━━━━━━━━━━━━━━━ */}
              {mode === "signup" && (
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
                    <GoogleIcon />
                    Google로 계속하기
                  </button>
                  <Divider />

                  <form onSubmit={handleSignupSubmit} className="flex flex-col gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setEmailError(null); }}
                      placeholder="사용할 이메일을 입력해주세요"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />

                    {emailError && (
                      <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30" data-testid="email-exists-error">
                        <p className="text-sm font-semibold text-destructive">{emailError}</p>
                        <button
                          type="button"
                          onClick={() => switchMode("login")}
                          className="text-xs font-bold text-primary mt-1"
                          data-testid="goto-login-button"
                        >
                          로그인하기
                        </button>
                      </div>
                    )}

                    {/* 약관 동의 */}
                    <div className="flex flex-col gap-2.5 mt-1 p-3 rounded-xl bg-muted/40 border border-border">
                      <label className="flex items-start gap-2.5 text-sm cursor-pointer hover:bg-background/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                        <input
                          type="checkbox"
                          checked={tosAgreed}
                          onChange={e => setTosAgreed(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
                          data-testid="tos-checkbox"
                        />
                        <span>
                          <span className="font-bold text-destructive">[필수]</span>
                          <span className="ml-1 text-foreground">만 14세 이상이며, </span>
                          <a href="/terms" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">이용약관</a>
                          <span>·</span>
                          <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">개인정보처리방침</a>
                          <span>에 동의합니다</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2.5 text-sm cursor-pointer hover:bg-background/50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                        <input
                          type="checkbox"
                          checked={marketingAgreed}
                          onChange={e => setMarketingAgreed(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
                          data-testid="marketing-checkbox"
                        />
                        <span className="text-foreground/80">
                          <span className="font-medium text-muted-foreground">[선택]</span>
                          <span className="ml-1">마케팅 정보 수신에 동의합니다</span>
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !tosAgreed}
                      className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
                      data-testid="signup-submit-button"
                    >
                      {loading ? "전송 중..." : "이메일로 시작"}
                    </button>
                  </form>
                </>
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
