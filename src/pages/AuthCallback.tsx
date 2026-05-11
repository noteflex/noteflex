import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      // Supabase가 URL hash/code를 자동 처리 → getSession으로 결과 획득
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

      if (!profile?.profile_completed) {
        navigate("/?complete_profile=1", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    };

    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground text-sm">인증 처리 중...</p>
    </div>
  );
}
