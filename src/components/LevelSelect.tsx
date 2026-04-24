interface LevelSelectProps {
  onSelectLevel: (level: number) => void;
  onBack: () => void;
  maxUnlocked?: number;
  isLoggedIn?: boolean;
  onLoginRequest?: () => void;
}

const LEVELS = [
  { level: 1, label: "높은음자리표 (C4–C6)", emoji: "🌱" },
  { level: 2, label: "낮은음자리표 (C2–C4)", emoji: "🌿" },
  { level: 3, label: "고급 높은음자리표 (C3–C7)", emoji: "🔥" },
  { level: 4, label: "고급 낮은음자리표 (C1–C5)", emoji: "⚡" },
  { level: 5, label: "Sharp Mastery (♯ + 랜덤 음자리표)", emoji: "🎯" },
  { level: 6, label: "Flat Mastery (♭ + 랜덤 음자리표)", emoji: "💎" },
  { level: 7, label: "마스터 믹스 (전체 + ♯♭)", emoji: "👑" },
];

export default function LevelSelect({
  onSelectLevel,
  onBack,
  maxUnlocked = 1,
  isLoggedIn,
  onLoginRequest,
}: LevelSelectProps) {
  return (
    <div className="flex flex-col items-center gap-8 animate-fade-up">
      <div className="flex flex-col items-center gap-2">
        <span className="text-5xl">🎼</span>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">레벨 선택</h2>
        <p className="text-sm text-muted-foreground">도전할 레벨을 선택하세요</p>
      </div>

      <div className="grid gap-3 w-full max-w-xs">
        {LEVELS.map(({ level, label, emoji }) => {
          const unlocked = level <= maxUnlocked;
          return (
            <button
              key={level}
              onClick={() => unlocked && onSelectLevel(level)}
              disabled={!unlocked}
              className={`
                flex items-center gap-4 px-5 py-4 rounded-2xl text-left
                border-2 transition-all duration-200
                ${unlocked
                  ? "bg-card border-border hover:border-primary/50 hover:shadow-md active:scale-[0.98] cursor-pointer"
                  : "bg-muted/50 border-border/50 opacity-50 cursor-not-allowed"
                }
              `}
            >
              <span className="text-2xl">{unlocked ? emoji : "🔒"}</span>
              <div className="flex flex-col">
                <span className="font-bold text-foreground text-base">Level {level}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 비로그인 시 로그인 유도만 유지.
          악보인식/라이브러리/성적표/충전소는 런칭 전 메뉴 재정비 때 복구 예정 */}
      {!isLoggedIn && (
        <button
          onClick={onLoginRequest}
          className="flex items-center gap-3 px-5 py-4 rounded-2xl text-left border-2 border-dashed border-muted-foreground/30 bg-muted/30 hover:bg-muted/50 transition-all duration-200 cursor-pointer w-full max-w-xs"
        >
          <span className="text-2xl">🔐</span>
          <div className="flex flex-col">
            <span className="font-bold text-foreground text-base">로그인하기</span>
            <span className="text-xs text-muted-foreground">계정 기능 이용하기</span>
          </div>
        </button>
      )}

      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← 메인으로 돌아가기
      </button>
    </div>
  );
}
