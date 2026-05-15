import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Paddle 심사관 전용 별도 진입 페이지.
 *
 * 배경:
 *   - 실서버 GAME_ENABLED=false → ComingSoonGate가 메인 페이지 차단
 *   - AuthModal 자체에 진입 불가
 *   - 별도 URL로 reviewer 로그인 폼 노출 (모든 가드 우회)
 *
 * 흐름:
 *   1. 이메일 + 액세스 코드 입력
 *   2. /api/reviewer-login POST
 *   3. access_token + refresh_token 받아 supabase.auth.setSession
 *   4. /play 로 navigate (reviewer = ComingSoonGate 우회)
 *
 * 보안:
 *   - 가드 X — 로그인 자체가 목적이라 인증 X 영역 박혀야 함
 *   - 401 노출은 "Invalid credentials"만 (구체 사유 X)
 */
export default function ReviewerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.includes("@") || !code) {
      setError("Invalid credentials");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reviewer-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      if (!res.ok) {
        setError("Invalid credentials");
        return;
      }

      const { access_token, refresh_token } = await res.json();
      if (!access_token || !refresh_token) {
        setError("Invalid credentials");
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        setError("Invalid credentials");
        return;
      }

      // 성공 → 게임 영역으로 이동 (reviewer = ComingSoonGate 우회)
      navigate("/play", { replace: true });
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl">
        <div className="px-6 pt-8 pb-2 flex flex-col items-center gap-2">
          <span className="text-3xl">🔐</span>
          <h1 className="text-lg font-bold text-foreground">Paddle Reviewer Access</h1>
          <p className="text-xs text-muted-foreground text-center">
            For Paddle reviewers only
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="reviewer email"
            autoComplete="off"
            required
            className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="reviewer-email-input"
          />
          <input
            type="password"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(null); }}
            placeholder="access code"
            autoComplete="off"
            required
            className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="reviewer-code-input"
          />

          {error && (
            <div
              className="p-3 rounded-xl bg-destructive/10 border border-destructive/30"
              data-testid="reviewer-error"
            >
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
            data-testid="reviewer-submit-button"
          >
            {loading ? "Verifying..." : "Continue"}
          </button>
        </form>

        <div className="px-6 pb-6 text-center">
          <a
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
