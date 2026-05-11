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

      const { data: profile } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("id", session.user.id)
        .single();

      const profileCompleted = profile?.profile_completed ?? false;

      // 원본 탭(Magic Link Step 2 대기 중)에 인증 완료 알림
      if ("BroadcastChannel" in window) {
        const channel = new BroadcastChannel("noteflex_auth");
        channel.postMessage({ type: "AUTH_COMPLETE", profile_completed: profileCompleted });
        channel.close();
      }

      // 새 탭 닫기 시도 (보안 정책상 실패 시 안내 메시지 표시)
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
