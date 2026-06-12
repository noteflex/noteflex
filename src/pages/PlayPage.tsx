import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import UserMenu from "@/components/UserMenu";
import { initSound, ensureAudioReady } from "@/lib/sound";
import NoteGame from "@/components/NoteGame";
import LevelSelect from "@/components/LevelSelect";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { useLang, useT } from "@/contexts/LanguageContext";
import { GAME_ENABLED } from "@/lib/featureFlags";
import Seo from "@/components/Seo";
import { AdBanner } from "@/components/AdBanner";
import { AdInterstitialModal } from "@/components/AdInterstitialModal";
import { onAdGameEnd } from "@/lib/adInterstitial";
import { getSlot } from "@/lib/adsense";
import {
  type Sublevel,
  canAccessSublevel,
  getNextSublevel,
  getPreviousSublevel,
} from "@/lib/levelSystem";
import { getUserTier } from "@/lib/subscriptionTier";
import UpgradeModal from "@/components/UpgradeModal";
import { GameOverDialog } from "@/components/GameOverDialog";
import { SublevelPassedDialog } from "@/components/SublevelPassedDialog";
import { GameErrorBoundary } from "@/components/GameErrorBoundary";
import { trackEvent } from "@/lib/analytics";

type PlayScreen = "levelSelect" | "game";

export default function PlayPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<PlayScreen>("levelSelect");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedSublevel, setSelectedSublevel] = useState<Sublevel>(1);
  const [showAuth, setShowAuth] = useState(false);
  // "다음 단계로" 클릭이 Premium 잠금 단계로 가는 경우 노출
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const [gameOverOpen, setGameOverOpen] = useState(false);
  const [passedDialogOpen, setPassedDialogOpen] = useState(false);
  const [replayCounter, setReplayCounter] = useState(0);
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const [lastResult, setLastResult] = useState<{
    level: number;
    sublevel: Sublevel;
    totalAttempts: number;
    totalCorrect: number;
    bestStreak: number;
    play_count?: number;
    passed: boolean;
    just_passed: boolean;
    fast_track?: boolean;
    gameStatus: "success" | "gameover";
    avgReactionRatio?: number;
  } | null>(null);

  useEffect(() => {
    initSound().catch((e) => console.warn("initSound 실패:", e));
    ensureAudioReady().catch((e) => console.warn("ensureAudioReady prefetch 실패:", e));
  }, []);

  const handleAttemptRecorded = (result: {
    level: number;
    sublevel: Sublevel;
    totalAttempts: number;
    totalCorrect: number;
    bestStreak: number;
    play_count?: number;
    passed: boolean;
    just_passed: boolean;
    fast_track?: boolean;
    gameStatus: "success" | "gameover";
    avgReactionRatio?: number;
  }) => {
    setLastResult(result);
    trackEvent("game_complete", {
      level: result.level,
      sublevel: result.sublevel,
      passed: result.passed,
      just_passed: result.just_passed,
      total_attempts: result.totalAttempts,
      total_correct: result.totalCorrect,
      best_streak: result.bestStreak,
    });
    if (result.just_passed) {
      trackEvent("stage_unlock", {
        level: result.level,
        sublevel: result.sublevel,
      });
    }
    if (onAdGameEnd(result.just_passed)) {
      setInterstitialOpen(true);
      return;
    }
    if (result.gameStatus === "gameover") {
      setGameOverOpen(true);
    } else {
      setPassedDialogOpen(true);
    }
  };

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
    setPassedDialogOpen(false);
    if (!next) return;

    // 다음 단계가 현재 tier로 접근 불가(예: Free의 Lv 3 Sub2)면 NoteGame 마운트 금지.
    // PassedDialog → "다음 단계" 경로로 LevelSelect의 subscription 잠금을 우회하는 회귀 차단.
    const tier = getUserTier(user ?? null, profile ?? null);
    if (!canAccessSublevel(tier, next.level, next.sublevel)) {
      setUpgradeModalOpen(true);
      return;
    }

    setSelectedLevel(next.level);
    setSelectedSublevel(next.sublevel);
    setReplayCounter((c) => c + 1);
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

  const handleSelectSublevel = (level: number, sublevel: Sublevel) => {
    setSelectedLevel(level);
    setSelectedSublevel(sublevel);
    setReplayCounter(0);
    setScreen("game");
    trackEvent("game_start", { level, sublevel });
  };

  const handleGoMain = () => navigate("/");
  const handleNextLevel = () => setScreen("levelSelect");

  const seoBlock = (
    <Seo
      title={t.pageMeta.play.title}
      description={t.pageMeta.play.description}
      canonical="https://noteflex.app/play"
      lang={lang === "ko" ? "ko" : "en"}
      noindex
    />
  );

  if (screen === "levelSelect") {
    return (
      <div className="flex flex-col min-h-screen">
        {seoBlock}
        <Header right={
          !GAME_ENABLED ? null
            : user ? <UserMenu />
            : !authLoading ? (
              <button
                onClick={() => setShowAuth(true)}
                className="text-xs px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                {t.header.signIn}
              </button>
            ) : null
        } />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        <div className="safe-area-page flex-1 flex flex-col items-center px-4 overflow-y-auto">
          <LevelSelect
            onSelectSublevel={handleSelectSublevel}
            onLoginRequest={() => setShowAuth(true)}
          />
          <div className="w-full max-w-lg px-4 pb-6">
            <AdBanner
              slot={getSlot("PLAY_BOTTOM")}
              format="horizontal"
              placeholderVariant="horizontal-random"
            />
          </div>
        </div>
      </div>
    );
  }

  // game screen — h-screen, no scroll
  return (
    <GameErrorBoundary>
      {seoBlock}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <div
        className="safe-area-page min-h-[100dvh] overflow-y-auto flex flex-col items-center justify-center py-4 px-4"
        style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
      >
        <NoteGame
          key={`level-${selectedLevel}-${selectedSublevel}-${replayCounter}`}
          onReset={handleGoMain}
          onLevelSelect={handleBackToLevelSelect}
          onNextLevel={handleNextLevel}
          level={selectedLevel}
          sublevel={selectedSublevel}
          onAttemptRecorded={handleAttemptRecorded}
          useExternalDialogs={true}
        />
      </div>
      {lastResult && (
        <>
          <GameOverDialog
            open={gameOverOpen}
            level={lastResult.level}
            sublevel={lastResult.sublevel}
            totalAttempts={lastResult.totalAttempts}
            totalCorrect={lastResult.totalCorrect}
            bestStreak={lastResult.bestStreak}
            avgReactionRatio={lastResult.avgReactionRatio}
            playCount={lastResult.play_count}
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
            avgReactionRatio={lastResult.avgReactionRatio}
            playCount={lastResult.play_count}
            justPassed={lastResult.just_passed}
            fastTrack={lastResult.fast_track ?? false}
            onReplay={handleReplaySameSublevel}
            onGoToNextSublevel={handleGoToNextSublevel}
            onBackToSelect={handleBackToLevelSelect}
            onClose={handleDialogDismiss}
          />
        </>
      )}
      <AdInterstitialModal
        open={interstitialOpen}
        onClose={handleInterstitialClose}
      />
      <UpgradeModal
        open={upgradeModalOpen}
        onClose={() => {
          setUpgradeModalOpen(false);
          setScreen("levelSelect");
        }}
      />
    </GameErrorBoundary>
  );
}
