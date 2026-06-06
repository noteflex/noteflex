import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { initSound } from "@/lib/sound";

// 가입 후 10분 이내 created_at이면 신규 유저로 간주 — 이 창을 벗어나면 재방문 시 홈으로 리다이렉트됨.
const NEW_USER_THRESHOLD_MS = 10 * 60 * 1000;

function isNewUser(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_USER_THRESHOLD_MS;
}

export default function WelcomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  useEffect(() => {
    if (loading) return;
    if (!user || !isNewUser(user.created_at)) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleStart = () => {
    initSound().catch(() => {});
    navigate("/play", { state: { fromNav: true } });
  };

  if (loading || !user || !isNewUser(user.created_at)) return null;

  return (
    <div
      className="min-h-[100svh] flex flex-col items-center justify-center px-4 gap-8"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <div className="text-6xl">🎹</div>
      <div className="text-center flex flex-col gap-3">
        <h1 className="text-3xl font-bold text-foreground">{t.welcome.title}</h1>
        <p className="text-lg text-muted-foreground">{t.welcome.subtitle}</p>
      </div>
      <button
        onClick={handleStart}
        className="px-10 py-4 rounded-full bg-primary text-primary-foreground font-medium text-lg shadow hover:shadow-md hover:scale-[1.02] transition-all duration-150 active:scale-[0.98]"
      >
        {t.welcome.cta}
      </button>
    </div>
  );
}
