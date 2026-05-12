import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [closeFailed, setCloseFailed] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        navigate("/?auth_error=session", { replace: true });
        return;
      }

      // 계정 복구 magic link (?action=restore)
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("action") === "restore") {
        const { error: rpcError } = await supabase.rpc("restore_account");
        if (rpcError) {
          navigate("/?auth_error=restore_failed", { replace: true });
          return;
        }
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
