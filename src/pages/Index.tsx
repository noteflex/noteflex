import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { PremiumBadge } from "@/components/PremiumBadge";
import { initSound } from "@/lib/sound";
import NoteGame from "@/components/NoteGame";
import LevelSelect from "@/components/LevelSelect";
import AuthModal from "@/components/AuthModal";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { GAME_ENABLED } from "@/lib/featureFlags";

import { AdBanner } from "@/components/AdBanner";
import { AdInterstitialModal } from "@/components/AdInterstitialModal";
import { onAdGameEnd } from "@/lib/adInterstitial";
import { getSlot } from "@/lib/adsense";
import {
  type Sublevel,
  getNextSublevel,
  getPreviousSublevel,
} from "@/lib/levelSystem";
import { GameOverDialog } from "@/components/GameOverDialog";
import { SublevelPassedDialog } from "@/components/SublevelPassedDialog";

type PlayScreen = "loading" | "levelSelect" | "game";

function ComingSoonNotice() {
  const t = useT();
  const [bodyBefore, bodyAfter] = t.comingSoon.body.split("{email}");
  const email = "admin@noteflex.app";
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

interface AuthBarProps {
  authLoading: boolean;
  user: { email?: string } | null;
  onSignOut: () => void;
  onLoginRequest: () => void;
}
function AuthBar({ authLoading, user, onSignOut, onLoginRequest }: AuthBarProps) {
  const t = useT();

  // Coming Soon 모드: 로그인/계정 UI 전체 숨김 (관리자는 /admin 직접 접근)
  if (!GAME_ENABLED) {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 h-10 bg-background/80 backdrop-blur-sm border-b border-border/50" />
    );
  }

  if (authLoading)
    return (
      <div className="fixed top-0 left-0 right-0 z-40 h-10 bg-background/80 border-b border-border/50" />
    );
  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-end px-4 py-2 bg-background/80 backdrop-blur-sm border-b border-border/50">
      {user ? (
        <div className="flex items-center gap-3">
          {profile?.role !== "admin" && (
            <Link
              to="/dashboard"
              className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {t.header.dashboard}
            </Link>
          )}
          <Link
            to="/profile"
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {t.header.profile}
          </Link>
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
            {user.email}
          </span>
          <PremiumBadge />
          <button
            onClick={onSignOut}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {t.header.signOut}
          </button>
        </div>
      ) : (
        <button
          onClick={onLoginRequest}
          className="text-xs px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          {t.header.signIn}
        </button>
      )}
    </div>
  );
}

export default function Index() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();

  const isPlayRoute = location.pathname === "/play";

  const [screen, setScreen] = useState<PlayScreen>("levelSelect");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedSublevel, setSelectedSublevel] = useState<Sublevel>(1);
  const [showAuth, setShowAuth] = useState(false);

  // ── Phase 4: 게임 종료 모달 상태 ────────────────────────
  const [gameOverOpen, setGameOverOpen] = useState(false);
  const [passedDialogOpen, setPassedDialogOpen] = useState(false);
  const [replayCounter, setReplayCounter] = useState(0); // NoteGame 리마운트 트리거
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const [lastResult, setLastResult] = useState<{
    level: number;
    sublevel: Sublevel;
    totalAttempts: number;
    totalCorrect: number;
    bestStreak: number;
    passed: boolean;
    just_passed: boolean;
    gameStatus: "success" | "gameover";
  } | null>(null);

  const handleAttemptRecorded = (result: {
    level: number;
    sublevel: Sublevel;
    totalAttempts: number;
    totalCorrect: number;
    bestStreak: number;
    passed: boolean;
    just_passed: boolean;
    gameStatus: "success" | "gameover";
  }) => {
    setLastResult(result);
    if (onAdGameEnd(result.just_passed)) {
      setInterstitialOpen(true);
      return; // 전면 광고 닫힌 후 결과 모달 진입
    }
    if (result.gameStatus === "gameover") {
      setGameOverOpen(true);
    } else {
      setPassedDialogOpen(true);
    }
  };

  // ── 다이얼로그 콜백 ─────────────────────────────────────
  const handleReplaySameSublevel = () => {
    setReplayCounter((c) => c + 1);
    setGameOverOpen(false);
    setPassedDialogOpen(false);
  };

  const handleGoToPreviousSublevel = () => {
    if (!lastResult) return;
    const prev = getPreviousSublevel(lastResult.level, lastResult.sublevel);
    if (prev) {
      setSelectedLevel(prev.level);
      setSelectedSublevel(prev.sublevel);
      setReplayCounter((c) => c + 1);
    }
    setGameOverOpen(false);
  };

  const handleGoToNextSublevel = () => {
    if (!lastResult) return;
    const next = getNextSublevel(lastResult.level, lastResult.sublevel);
    if (next) {
      setSelectedLevel(next.level);
      setSelectedSublevel(next.sublevel);
      setReplayCounter((c) => c + 1);
    }
    setPassedDialogOpen(false);
  };

  const handleBackToLevelSelect = () => {
    setScreen("levelSelect");
    setPassedDialogOpen(false);
    setGameOverOpen(false);
  };

  const handleDialogDismiss = () => {
    setGameOverOpen(false);
    setPassedDialogOpen(false);
    setScreen("levelSelect");
  };

  const handleInterstitialClose = () => {
    setInterstitialOpen(false);
    if (!lastResult) return;
    if (lastResult.gameStatus === "gameover") {
      setGameOverOpen(true);
    } else {
      setPassedDialogOpen(true);
    }
  };

  // /play 진입 시 사운드 preload 보장
  useEffect(() => {
    if (isPlayRoute && GAME_ENABLED) {
      initSound().catch((e) => console.warn("initSound 실패:", e));
    }
  }, [isPlayRoute]);

  const handleStart = async () => {
    setScreen("loading");
    await initSound();
    navigate("/play");
    setScreen("levelSelect");
  };

  const handleSelectSublevel = (level: number, sublevel: Sublevel) => {
    setSelectedLevel(level);
    setSelectedSublevel(sublevel);
    setReplayCounter(0);
    setScreen("game");
  };

  const handleNextLevel = () => {
    setScreen("levelSelect");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleGoMain = () => {
    navigate("/");
  };

  // 랜딩 + 레벨 선택 화면 Header 우측 슬롯
  const pageHeaderRight = GAME_ENABLED && !authLoading ? (
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
        <Link
          to="/profile"
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {t.header.profile}
        </Link>
        <span className="text-xs text-muted-foreground truncate max-w-[150px]">{user.email}</span>
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

  // ─────────────────────────────────────
  // 라우트: "/" → 메인 화면
  // ─────────────────────────────────────
  if (!isPlayRoute) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
      >
        <Header right={pageHeaderRight} />
        {showAuth && GAME_ENABLED && <AuthModal onClose={() => setShowAuth(false)} />}

        <div className="safe-area-page flex-1 flex flex-col items-center justify-center gap-8 px-4 pb-10">
          <div className="flex flex-col items-center gap-3 animate-fade-up">
            <span className="text-4xl">{t.hero.emoji}</span>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground text-center tracking-tight">
              {t.hero.title}
            </h1>
            <p className="text-muted-foreground text-center max-w-md text-base leading-relaxed">
              {t.hero.subtitle}
            </p>
          </div>

          {GAME_ENABLED ? (
            <button
              onClick={handleStart}
              className="px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 animate-fade-up"
              style={{ animationDelay: "0.15s" }}
            >
              🎵 게임 시작
            </button>
          ) : (
            <ComingSoonNotice />
          )}

          {GAME_ENABLED && user && !profile?.is_premium && (
            <Link
              to="/pricing"
              className="flex items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 hover:border-amber-300 hover:shadow-md transition-all animate-fade-up group"
              style={{ animationDelay: "0.3s" }}
            >
              <span className="text-2xl">✨</span>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-amber-900">
                  Premium으로 모든 레벨 잠금 해제
                </p>
                <p className="text-xs text-amber-700">연간 $19.99 · 44% 할인</p>
              </div>
              <span className="text-amber-600 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </Link>
          )}

          {/* Coming Soon 모드: 블로그·약관 안내 */}
          {!GAME_ENABLED && (
            <div
              className="flex flex-col sm:flex-row gap-3 mt-4 animate-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              <Link
                to="/blog"
                className="px-5 py-2.5 rounded-xl border border-border text-sm text-foreground hover:bg-muted transition-colors"
              >
                {t.comingSoon.blogButton}
              </Link>
              <Link
                to="/terms"
                className="px-5 py-2.5 rounded-xl border border-border text-sm text-foreground hover:bg-muted transition-colors"
              >
                📄 이용약관
              </Link>
            </div>
          )}
        </div>

        {/* 랜딩 페이지 하단 배너 (게임 페이지가 아닌 "/" 라우트) */}
        <AdBanner
          slot={getSlot("BANNER")}
          format="horizontal"
          className="w-full px-4 pb-4"
        />

        <Footer />
      </div>
    );
  }

  // ─────────────────────────────────────
  // 라우트: "/play" — Coming Soon 모드에서는 ComingSoonGate가 막음
  // ─────────────────────────────────────
  if (screen === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="text-7xl animate-pulse">🎼</div>
        <p className="text-lg text-muted-foreground font-medium animate-fade-up">
          사운드 로딩 중...
        </p>
        <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-loading-bar" />
        </div>
      </div>
    );
  }

  if (screen === "levelSelect") {
    return (
      <div className="flex flex-col min-h-screen">
        <Header right={pageHeaderRight} />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        <div className="safe-area-page flex-1 flex flex-col items-center px-4 overflow-y-auto">
          <LevelSelect
            onSelectSublevel={handleSelectSublevel}
            onBack={handleGoMain}
            onLoginRequest={() => setShowAuth(true)}
          />
          <div className="w-full max-w-lg px-4 pb-6">
            <AdBanner slot={getSlot("BANNER")} format="horizontal" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AuthBar
        authLoading={authLoading}
        user={user}
        onSignOut={handleSignOut}
        onLoginRequest={() => setShowAuth(true)}
      />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <div
        className="safe-area-page flex flex-col items-center min-h-screen px-4 py-8 sm:py-12 pt-16"
        style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
      >
        <h1 className="text-xl font-bold text-foreground mb-6 tracking-tight">
          🎼 Noteflex — 악보 독보 훈련
        </h1>
        <NoteGame
          key={`level-${selectedLevel}-${selectedSublevel}-${replayCounter}`}
          onReset={handleGoMain}
          onLevelSelect={() => setScreen("levelSelect")}
          onNextLevel={handleNextLevel}
          level={selectedLevel}
          sublevel={selectedSublevel}
          onAttemptRecorded={handleAttemptRecorded}
          useExternalDialogs={true}
        />

        {lastResult && (
          <>
            <GameOverDialog
              open={gameOverOpen}
              level={lastResult.level}
              sublevel={lastResult.sublevel}
              totalAttempts={lastResult.totalAttempts}
              totalCorrect={lastResult.totalCorrect}
              bestStreak={lastResult.bestStreak}
              onReplay={handleReplaySameSublevel}
              onGoToPreviousSublevel={handleGoToPreviousSublevel}
              onClose={handleDialogDismiss}
            />
            <SublevelPassedDialog
              open={passedDialogOpen}
              level={lastResult.level}
              sublevel={lastResult.sublevel}
              totalAttempts={lastResult.totalAttempts}
              totalCorrect={lastResult.totalCorrect}
              bestStreak={lastResult.bestStreak}
              justPassed={lastResult.just_passed}
              onReplay={handleReplaySameSublevel}
              onGoToNextSublevel={handleGoToNextSublevel}
              onBackToSelect={handleBackToLevelSelect}
              onClose={handleDialogDismiss}
            />
          </>
        )}

        {/* 전면 광고 — 3게임마다 + 잠금 해제 시점 */}
        <AdInterstitialModal
          open={interstitialOpen}
          onClose={handleInterstitialClose}
        />
      </div>
    </>
  );
}