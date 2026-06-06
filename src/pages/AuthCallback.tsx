import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/sentry";
import { trackEvent } from "@/lib/analytics";
import { useT } from "@/contexts/LanguageContext";

type AuthErrorKind = "expired" | "generic";

export default function AuthCallback() {
  const navigate = useNavigate();
  const t = useT();
  const tA = t.authModal;
  const [closeFailed, setCloseFailed] = useState(false);
  const [deletionDone, setDeletionDone] = useState(false);
  const [restoreDone, setRestoreDone] = useState(false);
  const [authErrorKind, setAuthErrorKind] = useState<AuthErrorKind | null>(null);

  useEffect(() => {
    const run = async () => {
      // URL に error パラメータがある場合は getSession() の前に処理する
      // (#error=... はハッシュ、error_code/error_description はクエリ両方を確認)
      const hash = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hash);
      const qParams = new URLSearchParams(window.location.search);
      const errorCode = hashParams.get("error_code") || qParams.get("error_code") || "";
      const errorDesc = hashParams.get("error_description") || qParams.get("error_description") || "";
      const hasUrlError = !!(hashParams.get("error") || qParams.get("error") || errorCode || errorDesc);

      if (hasUrlError) {
        const isExpired =
          errorCode === "otp_expired" ||
          errorDesc.toLowerCase().includes("expired") ||
          errorDesc.toLowerCase().includes("otp");
        logger.warn("AuthCallback URL 에러 파라미터 감지", {
          errorCode,
          errorDesc,
          isExpired,
        });
        setAuthErrorKind(isExpired ? "expired" : "generic");
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        logger.warn("AuthCallback 세션 없음", {
          cause: error?.message ?? "no session",
        });
        setAuthErrorKind("generic");
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const action = searchParams.get("action");

      // 탈퇴 확인 magic link (?action=confirm_deletion)
      if (action === "confirm_deletion") {
        const reason = searchParams.get("reason") || null;
        const { error: rpcError } = await supabase.rpc("request_account_deletion", { reason });
        if (rpcError) {
          logger.error("계정 영역 탈퇴 미설정", rpcError, {
            description: "request_account_deletion RPC 실패",
            cause: rpcError.message,
            impact: "사용자 영역 탈퇴 미설정",
            action: "request_account_deletion RPC 있는지 확인",
            metadata: { reason },
          });
          navigate("/?auth_error=deletion_failed", { replace: true });
          return;
        }
        logger.info("계정 탈퇴 완료", {
          description: "request_account_deletion RPC 완료 → deleted_at·is_deleted 적용됨",
          user_id: session.user.id,
          reason: reason ?? "(none)",
        });
        await supabase.auth.signOut();
        setDeletionDone(true);
        setTimeout(() => {
          window.close();
          setTimeout(() => navigate("/", { replace: true }), 500);
        }, 3000);
        return;
      }

      // 계정 복구 magic link (?action=restore)
      if (action === "restore") {
        const { error: rpcError } = await supabase.rpc("restore_account");
        if (rpcError) {
          logger.error("계정 영역 복구 미설정", rpcError, {
            description: "restore_account RPC 실패",
            cause: rpcError.message,
            impact: "사용자 영역 탈퇴 기록한 부분에서 복구 미설정",
            action: "restore_account RPC 있는지 확인 (30일 영역 내 영역 기록한 부분)",
          });
          navigate("/?auth_error=restore_failed", { replace: true });
          return;
        }
        logger.info("계정 복구 완료", {
          description: "restore_account RPC 완료 → is_deleted=false·deleted_at=NULL 적용됨",
          user_id: session.user.id,
        });
        localStorage.setItem("noteflex_auth_complete", Date.now().toString());
        if ("BroadcastChannel" in window) {
          const channel = new BroadcastChannel("noteflex_auth");
          channel.postMessage({ type: "AUTH_COMPLETE" });
          channel.close();
        }
        setRestoreDone(true);
        setTimeout(() => {
          window.close();
          setTimeout(() => navigate("/", { replace: true }), 500);
        }, 3000);
        return;
      }

      // 인증 영역 성공 기록한 부분 — Magic Link/OAuth 콜백 기록한 부분
      logger.info("인증 콜백 완료", {
        description: "Magic Link 영역 또는 OAuth 영역 인증 완료 영역 완료",
        user_id: session.user.id,
        email_domain: session.user.email?.split("@")[1],
        signup_method: localStorage.getItem("noteflex_consent") ? "magic_link_or_oauth_signup" : "signin",
      });

      // Google OAuth 가입 시 localStorage에 저장된 TOS 동의 시점을 profile에 반영
      const stored = localStorage.getItem("noteflex_consent");
      trackEvent(stored ? "sign_up" : "login", { method: "google" });
      if (stored) {
        try {
          const consent = JSON.parse(stored);
          await supabase.from("profiles").update(consent).eq("id", session.user.id);
        } catch (err) {
          // 의도된 silent — 인증 흐름 차단 미설정
          logger.warn("Consent UPDATE 미설정", {
            cause: err instanceof Error ? err.message : String(err),
            description: "인증 콜백 영역에서 약관 동의 미설정 기록한 부분",
            impact: "약관 동의 미설정 적용되어 있을 가능성 (출시 후 사용자 영역 재동의 기록할 영역)",
            metadata: { user_id: session.user.id },
          });
        }
        localStorage.removeItem("noteflex_consent");
      }

      // 원본 탭에 인증 완료 신호 전달 (BroadcastChannel + localStorage 이중 채널) — 모든 경로 유지
      localStorage.setItem("noteflex_auth_complete", Date.now().toString());
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("noteflex_auth");
        channel.postMessage({ type: "AUTH_COMPLETE" });
        channel.close();
      }

      const newUser = Date.now() - new Date(session.user.created_at).getTime() < 10 * 60 * 1000;
      const dest = newUser ? "/welcome" : "/";

      if (window.opener !== null) {
        // 스크립트로 열린 팝업: close 시도, 실패 시 화면에 버튼 표시
        window.close();
        setTimeout(() => setCloseFailed(true), 500);
      } else {
        // 전체 리다이렉트(구글 OAuth) 또는 메일 링크 탭: 즉시 이동
        navigate(dest, { replace: true });
      }
    };

    run();
  }, [navigate]);

  if (restoreDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" data-testid="restore-complete-screen">
        <div className="text-5xl">🎉</div>
        <p className="text-lg font-semibold text-foreground">{t.authCallback.restoreCompleteTitle}</p>
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          {t.authCallback.restoreCompleteDesc.split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </p>
        <p className="text-xs text-muted-foreground">{t.authCallback.redirecting}</p>
      </div>
    );
  }

  if (deletionDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" data-testid="deletion-complete-screen">
        <div className="text-5xl">👋</div>
        <p className="text-lg font-semibold text-foreground">{t.authCallback.deletionCompleteTitle}</p>
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          {t.authCallback.deletionCompleteDesc.split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </p>
        <p className="text-xs text-muted-foreground">{t.authCallback.redirecting}</p>
      </div>
    );
  }

  if (closeFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-5xl">✅</div>
        <p className="text-lg font-semibold text-foreground">{t.authCallback.authCompleteTitle}</p>
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          {t.authCallback.authCompleteDesc.split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
        </p>
        <button
          type="button"
          onClick={() => navigate("/", { replace: true })}
          className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95"
        >
          {t.authCallback.homeButton}
        </button>
      </div>
    );
  }

  if (authErrorKind === "expired") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" data-testid="auth-expired-screen">
        <div className="text-5xl">⏰</div>
        <p className="text-lg font-semibold text-foreground">{tA.authExpiredTitle}</p>
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          {tA.authExpiredBody}
        </p>
        <button
          type="button"
          onClick={() => navigate("/?open_auth=1", { replace: true })}
          className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95"
          data-testid="auth-expired-cta"
        >
          {tA.authExpiredCta}
        </button>
      </div>
    );
  }

  if (authErrorKind === "generic") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" data-testid="auth-error-screen">
        <div className="text-5xl">⚠️</div>
        <p className="text-lg font-semibold text-foreground">{tA.authErrorTitle}</p>
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          {tA.authErrorBody}
        </p>
        <button
          type="button"
          onClick={() => navigate("/?open_auth=1", { replace: true })}
          className="mt-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shadow hover:shadow-md transition-all active:scale-95"
          data-testid="auth-error-cta"
        >
          {tA.authErrorCta}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">{t.authCallback.processing}</p>
    </div>
  );
}
