import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/sentry";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [closeFailed, setCloseFailed] = useState(false);
  const [deletionDone, setDeletionDone] = useState(false);
  const [restoreDone, setRestoreDone] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        navigate("/?auth_error=session", { replace: true });
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

      // 원본 탭에 인증 완료 신호 전달 (BroadcastChannel + localStorage 이중 채널)
      localStorage.setItem("noteflex_auth_complete", Date.now().toString());
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("noteflex_auth");
        channel.postMessage({ type: "AUTH_COMPLETE" });
        channel.close();
      }

      window.close();
      setTimeout(() => setCloseFailed(true), 500);
    };

    run();
  }, [navigate]);

  if (restoreDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" data-testid="restore-complete-screen">
        <div className="text-5xl">🎉</div>
        <p className="text-lg font-semibold text-foreground">계정이 복구됐어요.</p>
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          다시 오신 것을 환영합니다.<br />
          이전 데이터가 그대로 유지됩니다.
        </p>
        <p className="text-xs text-muted-foreground">잠시 후 메인 페이지로 이동합니다...</p>
      </div>
    );
  }

  if (deletionDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" data-testid="deletion-complete-screen">
        <div className="text-5xl">👋</div>
        <p className="text-lg font-semibold text-foreground">탈퇴가 완료됐어요.</p>
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          그동안 NoteFlex를 이용해 주셔서 감사합니다.<br />
          30일 내 복구가 가능합니다.
        </p>
        <p className="text-xs text-muted-foreground">잠시 후 메인 페이지로 이동합니다...</p>
      </div>
    );
  }

  if (closeFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="text-5xl">✅</div>
        <p className="text-lg font-semibold text-foreground">인증이 완료됐어요!</p>
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          이 탭을 닫고<br />기존 탭에서 계속 진행해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">인증 처리 중...</p>
    </div>
  );
}
