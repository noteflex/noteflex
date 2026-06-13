// 메인 화면 헤더용 스트릭 배지. "🔥 N일" 한 줄, compact.
//
// 표시 조건:
//   - 로그인 사용자만 (비로그인 / loading / currentStreak === 0 시 미표시).
//   - 오늘 완료(todayDone=true) → 불꽃 amber(#BA7517) + 본문 진하게.
//   - 오늘 미완 → 회색.
//
// Index.tsx 우측 slot에서만 마운트(다른 페이지엔 박지 않음).

import { useLang } from "@/contexts/LanguageContext";
import { useStreak } from "@/hooks/useStreak";

const FLAME_AMBER = "#BA7517";

export default function StreakBadge() {
  const { lang } = useLang();
  const { currentStreak, todayDone, loading } = useStreak();

  if (loading || currentStreak <= 0) return null;

  const isKo = lang === "ko";
  const label = isKo ? `${currentStreak}일` : `${currentStreak}d`;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-sm font-semibold"
      aria-label={isKo ? `스트릭 ${currentStreak}일` : `${currentStreak}-day streak`}
    >
      <span
        aria-hidden="true"
        style={todayDone ? { color: FLAME_AMBER } : undefined}
        className={todayDone ? "" : "text-muted-foreground opacity-60"}
      >
        🔥
      </span>
      <span className={todayDone ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </span>
  );
}
