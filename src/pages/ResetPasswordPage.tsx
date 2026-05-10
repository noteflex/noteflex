import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  analyzePassword,
  STRENGTH_LABEL,
  STRENGTH_BAR_CL,
  STRENGTH_TXT_CL,
} from "@/lib/password";
import type { PasswordChecks } from "@/lib/password";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [ready, setReady] = useState(false);       // PASSWORD_RECOVERY event received
  const [invalid, setInvalid] = useState(false);   // arrived without a valid reset link
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const pwAnalysis = analyzePassword(password);
  const pwValid = pwAnalysis.score === 5;
  const confirmMatch = password === confirm && confirm.length > 0;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // If no PASSWORD_RECOVERY fires within 4 s, show invalid state
    const timer = setTimeout(() => {
      setInvalid((prev) => (prev ? prev : !ready));
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When ready switches on, clear the invalid timer result
  useEffect(() => {
    if (ready) setInvalid(false);
  }, [ready]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwValid) {
      toast({ title: "비밀번호 요구사항을 모두 충족해주세요", variant: "destructive" });
      return;
    }
    if (!confirmMatch) {
      toast({ title: "비밀번호가 일치하지 않아요", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "비밀번호가 변경됐어요", description: "새 비밀번호로 로그인해주세요." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "비밀번호 변경 실패", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <Header
        right={
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 홈으로
          </Link>
        }
      />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* ── 유효하지 않은 링크 ── */}
          {invalid && !ready && (
            <Card>
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <div className="text-5xl">⚠️</div>
                <p className="font-semibold text-foreground">링크가 만료됐거나 유효하지 않아요</p>
                <p className="text-sm text-muted-foreground">
                  비밀번호 재설정 링크는 1시간 동안만 유효해요.<br />
                  새로운 링크를 요청해주세요.
                </p>
                <Button className="w-full" onClick={() => navigate("/")}>
                  홈으로 돌아가기
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ── 대기 중 (이벤트 수신 전) ── */}
          {!invalid && !ready && (
            <div className="text-center text-muted-foreground text-sm py-12">
              확인 중...
            </div>
          )}

          {/* ── 비밀번호 재설정 폼 ── */}
          {ready && (
            <Card>
              <CardHeader>
                <div className="flex flex-col items-center gap-2 pt-2">
                  <span className="text-4xl">🔐</span>
                  <CardTitle className="text-xl">새 비밀번호 설정</CardTitle>
                  <p className="text-xs text-muted-foreground text-center">
                    8자 이상, 대소문자·숫자·특수문자를 포함해주세요
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                  {/* 새 비밀번호 */}
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="새 비밀번호"
                        required
                        minLength={8}
                        data-testid="new-password-input"
                        className="w-full px-4 py-2.5 pr-16 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:text-primary/80 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors"
                      >
                        {showPw ? "숨기기" : "보기"}
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
                          {([
                            { key: "length",    label: "8자 이상" },
                            { key: "uppercase", label: "대문자" },
                            { key: "lowercase", label: "소문자" },
                            { key: "digit",     label: "숫자" },
                            { key: "special",   label: "특수문자" },
                          ] as { key: keyof PasswordChecks; label: string }[]).map(({ key, label }) => {
                            const ok = pwAnalysis.checks[key];
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

                  {/* 비밀번호 확인 */}
                  <div>
                    <input
                      type={showPw ? "text" : "password"}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="비밀번호 확인"
                      required
                      data-testid="confirm-password-input"
                      className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {confirm.length > 0 && !confirmMatch && (
                      <p className="text-xs text-destructive mt-1">비밀번호가 일치하지 않아요</p>
                    )}
                    {confirmMatch && (
                      <p className="text-xs text-green-600 mt-1">✓ 비밀번호가 일치해요</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !pwValid || !confirmMatch}
                    className="w-full"
                    data-testid="reset-submit-button"
                  >
                    {loading ? "변경 중..." : "비밀번호 변경"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
