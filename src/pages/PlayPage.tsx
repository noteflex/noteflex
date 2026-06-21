import { useState, useEffect, useRef } from "react";
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
  const [authInitialMode, setAuthInitialMode] = useState<"login" | "signup">("login");
  // "다음 단계로" 클릭이 Premium 잠금 단계로 가는 경우 노출
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const [gameOverOpen, setGameOverOpen] = useState(false);
  const [passedDialogOpen, setPassedDialogOpen] = useState(false);

  // §광고-유입 (2026-06-22): 게스트 1-1 직행은 /play 세션당 1회만 발화.
  //   "나가기 → 레벨선택" 으로 screen 만 game→levelSelect 로 돌아온 경우 다시 autoEnter 가
  //   걸리면 게임으로 즉시 튕겨 무한 바운스. screen 전환을 넘어 유지되는 PlayPage 레벨 ref
  //   로 1회 소비 추적. 랜딩에서 Play 를 다시 눌러 /play 가 새로 마운트되면 자연 리셋.
  const guestAutoEntryConsumedRef = useRef(false);
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
    // 게스트가 어떤 경로로든 게임에 진입하면 autoEnter 1회 소비 처리 — 이후 levelSelect 로
    // 돌아왔을 때 다시 직행되지 않도록.
    if (!user) guestAutoEntryConsumedRef.current = true;
    setSelectedLevel(level);
    setSelectedSublevel(sublevel);
    setReplayCounter(0);
    setScreen("game");
    trackEvent("play_start", { level, sublevel });
  };

  const handleGoMain = () => navigate("/");
  const handleNextLevel = () => setScreen("levelSelect");

  // §광고-유입 (2026-06-21): 게스트 1-1 완료 후 무료가입 nudge.
  //   결제(paywall) 유도 아님 — 무료 가입 권유. UpgradeModal/paywall_view 와 혼동 금지.
  //   view 이벤트는 다이얼로그가 처음 열릴 때 1회만 발화.
  const isGuestOneOne =
    !user &&
    !!lastResult &&
    lastResult.level === 1 &&
    lastResult.sublevel === 1;
  const nudgeVisible =
    isGuestOneOne && (gameOverOpen || passedDialogOpen);

  useEffect(() => {
    if (nudgeVisible) {
      trackEvent("guest_signup_nudge_view", { level: 1, sublevel: 1 });
    }
  }, [nudgeVisible]);

  // 게스트 가입 유도 단일 진입점 — nudge·잠금셀·DailyLimitModal 가 공통 사용.
  // 새 모달 상태를 만들지 않고 기존 showAuth + authInitialMode 메커니즘 재사용.
  const openGuestSignup = () => {
    setAuthInitialMode("signup");
    setShowAuth(true);
  };

  const handleNudgeCta = () => {
    trackEvent("guest_signup_nudge_click", { level: 1, sublevel: 1 });
    openGuestSignup();
  };

  const guestNudge = nudgeVisible ? (
    <div
      className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      data-testid="guest-signup-nudge"
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-[13px] font-semibold text-foreground leading-snug">
          {t.gameDialogs.guestSignupNudgeTitle}
        </p>
        <p className="text-[12px] text-muted-foreground leading-snug">
          {t.gameDialogs.guestSignupNudgeBody}
        </p>
      </div>
      <button
        type="button"
        onClick={handleNudgeCta}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        data-testid="guest-signup-nudge-cta"
      >
        {t.gameDialogs.guestSignupNudgeCta}
      </button>
    </div>
  ) : null;

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
                onClick={() => { setAuthInitialMode("login"); setShowAuth(true); }}
                className="text-xs px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                {t.header.signIn}
              </button>
            ) : null
        } />
        {showAuth && <AuthModal initialMode={authInitialMode} onClose={() => setShowAuth(false)} />}
        <div className="safe-area-page flex-1 flex flex-col items-center px-4 overflow-y-auto">
          {/* §광고-유입 (2026-06-21): 비로그인 게스트는 LevelSelect 건너뛰고 Lv1-1 직행.
              LevelSelect.autoEnterSublevel 가 내부 handleSelect 를 1회 호출하여
              일일한도 게이트(GUEST_LIMIT=3) + play_start 발화를 그대로 재사용.
              2026-06-22: guestAutoEntryConsumedRef 로 /play 세션당 1회 제한
              ("나가기 → 레벨선택" 으로 돌아온 경우 무한 바운스 차단). */}
          {!authLoading && !user && !guestAutoEntryConsumedRef.current ? (
            <LevelSelect
              autoEnterSublevel={{ level: 1, sublevel: 1 }}
              onSelectSublevel={handleSelectSublevel}
              onLoginRequest={() => { setAuthInitialMode("login"); setShowAuth(true); }}
              onGuestSignupRequest={openGuestSignup}
              onAutoEnterAbort={() => navigate("/")}
            />
          ) : (
            <>
              <LevelSelect
                onSelectSublevel={handleSelectSublevel}
                onLoginRequest={() => { setAuthInitialMode("login"); setShowAuth(true); }}
                onGuestSignupRequest={openGuestSignup}
              />
              <div className="w-full max-w-lg px-4 pb-6">
                <AdBanner
                  slot={getSlot("PLAY_BOTTOM")}
                  format="horizontal"
                  placeholderVariant="horizontal-random"
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // game screen — h-screen, no scroll
  return (
    <GameErrorBoundary>
      {seoBlock}
      {showAuth && <AuthModal initialMode={authInitialMode} onClose={() => setShowAuth(false)} />}
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
            nudge={guestNudge}
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
            nudge={guestNudge}
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
