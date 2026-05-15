import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { initSound } from "@/lib/sound";
import AuthModal from "@/components/AuthModal";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { GAME_ENABLED } from "@/lib/featureFlags";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);

  // admin·reviewer는 GAME_ENABLED 무관하게 게임 UI 노출.
  // - admin: 내부 테스트
  // - reviewer: Paddle 심사관 게임 영역 확인
  const isPrivilegedRole =
    profile?.role === "admin" || profile?.role === "reviewer";
  const showGameUI = GAME_ENABLED || isPrivilegedRole;

  const handleAuthClose = () => {
    setShowAuth(false);
  };

  const handleStart = async () => {
    initSound().catch(() => {});
    navigate("/play", { state: { fromNav: true } });
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // 헤더 displayName 박음:
  //   - 자동 닉네임(user_xxx) → 이메일 prefix + 호버 시 "닉네임 설정하기 →"
  //   - 정상 닉네임 → 닉네임 그대로 + 호버 시 전체 이메일
  // 로딩 상태(nickname 미박힘) = 이메일 prefix + 이메일 호버 (자동 닉네임 가정 X).
  const nickname = profile?.nickname ?? "";
  const email = user?.email ?? "";
  const isAutoNickname = nickname.startsWith("user_");
  const displayName = isAutoNickname ? email.split("@")[0] : nickname;
  const displayTitle = isAutoNickname ? t.header.setNicknameHint : email;

  const pageHeaderRight = showGameUI && !authLoading ? (
    user ? (
      <div className="flex items-center gap-3">
        {profile?.role !== "admin" && (
          <Link
            to="/dashboard"
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {t.header.dashboard}
          </Link>
        )}
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/profile"
                className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted hover:underline underline-offset-4 transition-colors truncate max-w-[150px] cursor-pointer"
                data-testid="header-display-name"
              >
                {displayName}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              <p className="text-xs">{displayTitle}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <button
          onClick={handleSignOut}
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {t.header.signOut}
        </button>
      </div>
    ) : (
      <button
        onClick={() => setShowAuth(true)}
        className="text-xs px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
      >
        {t.header.signIn}
      </button>
    )
  ) : null;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
    >
      <Header right={pageHeaderRight} />
      {showAuth && showGameUI && (
        <AuthModal onClose={handleAuthClose} />
      )}

      <div className="safe-area-page flex-1 flex flex-col items-center justify-center px-4">
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-semibold text-foreground text-center tracking-tight leading-tight whitespace-pre-line animate-fade-up"
        >
          {t.hero.title}
        </h1>
        <p
          className="text-lg sm:text-xl font-normal text-muted-foreground text-center mt-6 animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          {t.hero.subtitle}
        </p>
        {showGameUI ? (
          <button
            onClick={handleStart}
            className="mt-10 px-10 py-4 rounded-full bg-primary text-primary-foreground font-medium text-lg shadow hover:shadow-md hover:scale-[1.02] transition-all duration-150 active:scale-[0.98] animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            {t.game.start}
          </button>
        ) : (
          <div className="mt-12 animate-fade-up" style={{ animationDelay: "0.4s" }}>
            <ComingSoonNotice />
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
