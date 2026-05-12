import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
          navigate("/?auth_error=deletion_failed", { replace: true });
          return;
        }
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
          navigate("/?auth_error=restore_failed", { replace: true });
          return;
        }
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

      // Google OAuth 가입 시 localStorage에 저장된 TOS 동의 시점을 profile에 반영
      const stored = localStorage.getItem("noteflex_consent");
      if (stored) {
        try {
          const consent = JSON.parse(stored);
          await supabase.from("profiles").update(consent).eq("id", session.user.id);
        } catch {
          // 실패해도 인증 흐름 차단 안 함
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
