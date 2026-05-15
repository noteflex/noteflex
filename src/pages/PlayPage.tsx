import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { PremiumBadge } from "@/components/PremiumBadge";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { initSound, ensureAudioReady } from "@/lib/sound";
import NoteGame from "@/components/NoteGame";
import LevelSelect from "@/components/LevelSelect";
import AuthModal from "@/components/AuthModal";
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

type PlayScreen = "levelSelect" | "game";

interface AuthBarProps {
  authLoading: boolean;
  user: { email?: string } | null;
  onSignOut: () => void;
  onLoginRequest: () => void;
}

function AuthBar({ authLoading, user, onSignOut, onLoginRequest }: AuthBarProps) {
  const t = useT();
  const { profile } = useAuth();

  if (!GAME_ENABLED || authLoading) {
    return (
      <div className="fixed top-0 left-0 right-0 z-40 h-10 bg-background/80 border-b border-border/50" />
    );
  }

  // displayName chip 박음 — AuthBar 영역:
  //   - 자동 닉네임(user_xxx) → 이메일 prefix + Tooltip "닉네임 설정하기 →"
  //   - 정상 닉네임 → 닉네임 그대로 + Tooltip X
  const nickname = profile?.nickname ?? "";
  const email = user?.email ?? "";
  const isAutoNickname = nickname.startsWith("user_");
  const displayName = isAutoNickname ? email.split("@")[0] : nickname;

  const chipLink = (
    <Link
      to="/profile"
      className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium",
        "bg-secondary/60 text-secondary-foreground",
        "hover:bg-secondary transition-colors",
        "cursor-pointer truncate max-w-[150px]",
      )}
      data-testid="header-display-name"
    >
      {displayName}
    </Link>
  );

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-end px-4 py-2 bg-background/80 border-b border-border/50">
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
          {isAutoNickname ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>{chipLink}</TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  <p className="text-xs">{t.header.setNicknameHint}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            chipLink
          )}
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

export default function PlayPage() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const t = useT();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<PlayScreen>("levelSelect");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [selectedSublevel, setSelectedSublevel] = useState<Sublevel>(1);
  const [showAuth, setShowAuth] = useState(false);

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
    passed: boolean;
    just_passed: boolean;
    fast_track?: boolean;
    gameStatus: "success" | "gameover";
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
    passed: boolean;
    just_passed: boolean;
    fast_track?: boolean;
    gameStatus: "success" | "gameover";
  }) => {
    setLastResult(result);
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

  const handleSelectSublevel = (level: number, sublevel: Sublevel) => {
    setSelectedLevel(level);
    setSelectedSublevel(sublevel);
    setReplayCounter(0);
    setScreen("game");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleGoMain = () => navigate("/");
  const handleNextLevel = () => setScreen("levelSelect");

  // displayName chip 박음 — pageHeaderRight 영역 (AuthBar와 동일 패턴).
  const nickname = profile?.nickname ?? "";
  const email = user?.email ?? "";
  const isAutoNickname = nickname.startsWith("user_");
  const displayName = isAutoNickname ? email.split("@")[0] : nickname;

  const headerChipLink = (
    <Link
      to="/profile"
      className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium",
        "bg-secondary/60 text-secondary-foreground",
        "hover:bg-secondary transition-colors",
        "cursor-pointer truncate max-w-[150px]",
      )}
      data-testid="header-display-name"
    >
      {displayName}
    </Link>
  );

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
        {isAutoNickname ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>{headerChipLink}</TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <p className="text-xs">{t.header.setNicknameHint}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          headerChipLink
        )}
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
    <>
      <AuthBar
        authLoading={authLoading}
        user={user}
        onSignOut={handleSignOut}
        onLoginRequest={() => setShowAuth(true)}
      />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <div
        className="safe-area-page h-screen overflow-hidden flex flex-col items-center pt-10 px-4"
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
    </>
  );
}
