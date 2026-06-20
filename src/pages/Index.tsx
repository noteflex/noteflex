import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import { initSound } from "@/lib/sound";
import AuthModal from "@/components/AuthModal";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useT, useLang } from "@/contexts/LanguageContext";
import { GAME_ENABLED } from "@/lib/featureFlags";
import UserMenu from "@/components/UserMenu";
import StreakBadge from "@/components/StreakBadge";
import Seo from "@/components/Seo";
import heroMp4 from "@/assets/hero/hero.mp4";
import heroWebm from "@/assets/hero/hero.webm";
import heroPoster from "@/assets/hero/hero-poster.png";

function ComingSoonNotice() {
  const t = useT();
  const [bodyBefore, bodyAfter] = t.comingSoon.body.split("{email}");
  const email = "contact@noteflex.app";
  return (
    <div
      className="flex flex-col items-center gap-4 animate-fade-up"
      style={{ animationDelay: "0.15s" }}
    >
      <div className="px-8 py-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 font-semibold text-lg shadow-md">
        {t.comingSoon.badge}
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {bodyBefore}
        <a
          href={`mailto:${email}?subject=Noteflex%20Launch%20Notification`}
          className="text-primary underline hover:text-primary/80"
        >
          {email}
        </a>
        {bodyAfter}
      </p>
    </div>
  );
}

export default function Index() {
  const { user, profile, loading: authLoading } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showAuth, setShowAuth] = useState(false);
  const isKo = lang === "ko";

  // admin·reviewer는 GAME_ENABLED 무관하게 게임 UI 노출.
  const isPrivilegedRole =
    profile?.role === "admin" || profile?.role === "reviewer";
  const showGameUI = GAME_ENABLED || isPrivilegedRole;

  // AuthCallback 에러 후 재진입: ?open_auth=1 → 로그인 모달 자동 오픈
  useEffect(() => {
    if (searchParams.get("open_auth") === "1" && !user && showGameUI) {
      setShowAuth(true);
      navigate("/", { replace: true });
    }
  }, [searchParams, user, showGameUI, navigate]);

  // step 1에서 다른 탭 인증이 완료된 경우에도 모달이 남지 않도록
  useEffect(() => {
    if (user) setShowAuth(false);
  }, [user]);

  const handleAuthClose = () => setShowAuth(false);

  const handleStart = async () => {
    initSound().catch(() => {});
    navigate("/play", { state: { fromNav: true } });
  };

  const pageHeaderRight = !showGameUI ? null
    : user ? (
      <div className="flex items-center gap-2">
        <StreakBadge />
        <UserMenu />
      </div>
    )
    : !authLoading ? (
      <button
        onClick={() => setShowAuth(true)}
        className="text-xs px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
      >
        {t.header.signIn}
      </button>
    ) : null;

  return (
    <div
      className="min-h-[100svh] flex flex-col"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <Seo
        title={
          "Noteflex — See it, Play it. Sight-Reading Game"
        }
        description={
          isKo
            ? "게임처럼 익히는 악보 읽기. Lv1~7 단계별 학습, 맞춤 분석 보고서, 일일 진척 추적. 무료로 시작하세요."
            : "Learn to read sheet music like a game. Lv1–7 progressive levels, data-driven analysis, daily progress tracking. Free to start."
        }
        canonical="https://noteflex.app/"
        lang={isKo ? "ko" : "en"}
      />
      <Header right={pageHeaderRight} />
      {showAuth && showGameUI && (
        <AuthModal onClose={handleAuthClose} />
      )}

      <main
        className="safe-area-page flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8"
      >
        <h1
          className="text-3xl sm:text-5xl md:text-6xl font-semibold text-foreground text-center tracking-tight leading-tight whitespace-pre-line animate-fade-up"
        >
          {t.hero.title}
        </h1>
        <p
          className="text-base sm:text-xl font-normal text-muted-foreground text-center mt-3 sm:mt-6 max-w-md whitespace-pre-line animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          {t.hero.subtitle}
        </p>
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={heroPoster}
          aria-hidden="true"
          className="mt-5 sm:mt-8 w-full max-w-[240px] sm:max-w-[300px] md:max-w-[340px] rounded-2xl shadow-md animate-fade-up"
          style={{ animationDelay: "0.3s", aspectRatio: "886 / 1180" }}
        >
          <source src={heroWebm} type="video/webm" />
          <source src={heroMp4} type="video/mp4" />
        </video>
        {showGameUI ? (
          <>
            <button
              onClick={handleStart}
              className="mt-6 sm:mt-8 px-10 py-3.5 rounded-full bg-primary text-primary-foreground font-medium text-lg shadow hover:shadow-md hover:scale-[1.02] transition-all duration-150 active:scale-[0.98] animate-fade-up"
              style={{ animationDelay: "0.4s" }}
            >
              {t.game.start}
            </button>
            {t.hero.ctaHint && (
              <p
                className="text-xs text-muted-foreground text-center mt-2 animate-fade-up"
                style={{ animationDelay: "0.5s" }}
              >
                {t.hero.ctaHint}
              </p>
            )}
          </>
        ) : (
          <div className="mt-8 animate-fade-up" style={{ animationDelay: "0.4s" }}>
            <ComingSoonNotice />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
