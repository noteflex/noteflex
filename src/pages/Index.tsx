import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { initSound } from "@/lib/sound";
import PianoGame from "@/components/PianoGame";
import LevelSelect from "@/components/LevelSelect";
import AuthModal from "@/components/AuthModal";
import PremiumRequiredDialog from "@/components/PremiumRequiredDialog";
import { useAuth } from "@/contexts/AuthContext";

// "main" 화면은 URL "/"에서만, 나머지는 "/play"에서 screen state로 전환
type PlayScreen = "loading" | "levelSelect" | "game";

// 프리미엄 전용 레벨 (LevelSelect.tsx 기준과 일치시켜야 함)
const PREMIUM_MIN_LEVEL = 5;
const MAX_LEVEL = 7;

// ✨ AuthBar: 메모이즈된 상단 바 (컴포넌트 밖으로 추출 → 매 렌더마다 재생성 방지)
interface AuthBarProps {
  authLoading: boolean;
  user: { email?: string } | null;
  onSignOut: () => void;
  onLoginRequest: () => void;
}
function AuthBar({ authLoading, user, onSignOut, onLoginRequest }: AuthBarProps) {
  if (authLoading) return <div className="fixed top-0 left-0 right-0 z-40 h-10 bg-background/80 border-b border-border/50" />;
  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-end px-4 py-2 bg-background/80 backdrop-blur-sm border-b border-border/50">
      {user ? (
        <div className="flex items-center gap-3">
          <Link
            to="/home"
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            연습 대시보드
          </Link>
          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
            {user.email}
          </span>
          <button
            onClick={onSignOut}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            로그아웃
          </button>
        </div>
      ) : (
        <button
          onClick={onLoginRequest}
          className="text-xs px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
        >
          로그인 / 회원가입
        </button>
      )}
    </div>
  );
}

export default function Index() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // 현재 URL이 "/play" 인지 메인인지
  const isPlayRoute = location.pathname === "/play";

  const [screen, setScreen] = useState<PlayScreen>("levelSelect");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [showAuth, setShowAuth] = useState(false);

  // 프리미엄 요구 모달 상태
  const [premiumDialog, setPremiumDialog] = useState<{
    open: boolean;
    attemptedLevel?: number;
  }>({ open: false });

  // /play 진입 시 사운드 preload 보장
  useEffect(() => {
    if (isPlayRoute) {
      // 이미 로드되어 있으면 initSound는 즉시 resolve
      initSound().catch((e) => console.warn("initSound 실패:", e));
    }
  }, [isPlayRoute]);

  const handleStart = async () => {
    setScreen("loading");
    await initSound();
    navigate("/play");
    setScreen("levelSelect");
  };

  const handleSelectLevel = (level: number) => {
    setSelectedLevel(level);
    setScreen("game");
  };

  // ✨ 다음 레벨 진행 (프리미엄 체크)
  const handleNextLevel = () => {
    const nextLevel = selectedLevel + 1;

    if (nextLevel > MAX_LEVEL) {
      setScreen("levelSelect");
      return;
    }

    const isPremiumLevel = nextLevel >= PREMIUM_MIN_LEVEL;
    const hasPremium = !!profile?.is_premium;
    if (isPremiumLevel && !hasPremium) {
      setPremiumDialog({ open: true, attemptedLevel: nextLevel });
      return;
    }

    setSelectedLevel(nextLevel);
  };

  const handlePremiumDialogCancel = () => {
    setScreen("levelSelect");
  };

  // ✨ 로그아웃 → 메인(/)으로 이동
  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // ✨ 메인으로 (레벨 선택 → 메인)
  const handleGoMain = () => {
    navigate("/");
  };

  // ─────────────────────────────────────
  // 라우트: "/" → 메인 화면 (게임 시작)
  // ─────────────────────────────────────
  if (!isPlayRoute) {
    return (
      <>
        <AuthBar authLoading={authLoading} user={user} onSignOut={handleSignOut} onLoginRequest={() => setShowAuth(true)} />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        <div
          className="safe-area-page flex flex-col items-center justify-center min-h-screen gap-8 px-4"
          style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
        >
          <div className="flex flex-col items-center gap-4 animate-fade-up">
            <span className="text-7xl">🎹</span>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight text-center" style={{ textWrap: "balance" as any }}>
              Piano Note Trainer
            </h1>
            <p className="text-muted-foreground text-center max-w-sm text-base">
              오선지에 표시된 음표의 이름을 맞춰보세요!
            </p>
          </div>

          <button
            onClick={handleStart}
            className="px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 animate-fade-up"
            style={{ animationDelay: "0.15s" }}
          >
            🎵 게임 시작
          </button>

          {user && !profile?.is_premium && (
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
                <p className="text-xs text-amber-700">
                  연간 $19.99 · 44% 할인
                </p>
              </div>
              <span className="text-amber-600 group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </Link>
          )}

          {user && profile?.is_premium && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 animate-fade-up"
              style={{ animationDelay: "0.3s" }}
            >
              <span className="text-lg">✨</span>
              <span className="text-sm font-semibold text-primary">
                Premium 이용 중
              </span>
            </div>
          )}
        </div>
      </>
    );
  }

  // ─────────────────────────────────────
  // 라우트: "/play" 이하 → 화면 상태에 따라
  // ─────────────────────────────────────
  if (screen === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="text-7xl animate-pulse">🎹</div>
        <p className="text-lg text-muted-foreground font-medium animate-fade-up">
          피아노 사운드 로딩 중...
        </p>
        <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-loading-bar" />
        </div>
      </div>
    );
  }

  if (screen === "levelSelect") {
    return (
      <>
        <AuthBar authLoading={authLoading} user={user} onSignOut={handleSignOut} onLoginRequest={() => setShowAuth(true)} />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
        <div className="safe-area-page flex flex-col items-center justify-center min-h-screen px-4 pt-12">
          <LevelSelect
            onSelectLevel={handleSelectLevel}
            onBack={handleGoMain}
            maxUnlocked={7}
            isLoggedIn={!!user}
            onLoginRequest={() => setShowAuth(true)}
          />
        </div>
      </>
    );
  }

  // screen === "game"
  return (
    <>
      <AuthBar authLoading={authLoading} user={user} onSignOut={handleSignOut} onLoginRequest={() => setShowAuth(true)} />
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <PremiumRequiredDialog
        open={premiumDialog.open}
        onOpenChange={(open) => setPremiumDialog((prev) => ({ ...prev, open }))}
        attemptedLevel={premiumDialog.attemptedLevel}
        onCancel={handlePremiumDialogCancel}
      />
      <div
        className="safe-area-page flex flex-col items-center min-h-screen px-4 py-8 sm:py-12 pt-16"
        style={{ background: "radial-gradient(circle at top, #ffffff 0%, #f8f5e4 100%)" }}
      >
        <h1 className="text-xl font-bold text-foreground mb-6 tracking-tight">🎹 Piano Note Trainer</h1>
        <PianoGame
          key={`level-${selectedLevel}`}
          onReset={handleGoMain}
          onLevelSelect={() => setScreen("levelSelect")}
          onNextLevel={handleNextLevel}
          level={selectedLevel}
        />
      </div>
    </>
  );
}