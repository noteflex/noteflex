interface GameHeaderProps {
  score: number;
  lives: number;
  maxLives: number;
  level?: number;
  perfectStreak?: number;
  streakTarget?: number;
  lifeRecovered?: boolean;
}

export default function GameHeader({ score, lives, maxLives, level = 1, perfectStreak = 0, streakTarget = 3, lifeRecovered = false }: GameHeaderProps) {
  const showCombo = perfectStreak > 0 && lives < maxLives;

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto px-2 gap-1">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground tracking-wide uppercase">Score</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">{score}</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
            Lv.{level}
          </span>
        </div>
        <div className="flex items-center gap-1 relative">
          {Array.from({ length: maxLives }).map((_, i) => (
            <span
              key={i}
              className={`text-xl transition-all duration-300 ${
                i < lives ? "scale-100 opacity-100" : "scale-75 opacity-30 grayscale"
              }`}
            >
              ❤️
            </span>
          ))}
          {lifeRecovered && (
            <span className="absolute -top-5 right-0 text-xs font-bold text-red-500 animate-fade-in">
              ❤️ +1!
            </span>
          )}
        </div>
      </div>

      {/* ✅ 항상 렌더링되고 opacity로만 토글 → 높이 불변 */}
      <div
        className={`flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-200 ${
          showCombo ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!showCombo}
      >
        <span>🔥</span>
        <span className="font-semibold">
          Combo {Math.max(perfectStreak, 0)}/{streakTarget}
        </span>
        {perfectStreak === streakTarget - 1 && (
          <span className="text-destructive font-bold animate-pulse">MAX!</span>
        )}
      </div>
    </div>
  );
}