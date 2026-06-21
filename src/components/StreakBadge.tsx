// 메인 화면 헤더용 스트릭 배지. compact 짧은 형태.
//
// 표시 조건:
//   - 로그인 사용자만 (비로그인 / loading / 신규(0 + !broken) 시 미표시).
//   - 오늘 완료(todayDone=true) → 본문 화사 오렌지(#FB923C).
//   - 오늘 미완 살아있음(어제 활동, broken=false) → 회색.
//   - 끊김(broken=true) → "0·꺼진 불꽃" — opacity 낮춤 + 회색 텍스트.
//
// 카피: ko "🔥 {n}일" / en 단복수 "🔥 {n} day" or "🔥 {n} days" (약어 금지).
// Index.tsx 우측 slot에서만 마운트.

import { useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { useStreak } from "@/hooks/useStreak";

const FLAME_ORANGE = "#FB923C";

export default function StreakBadge() {
  const t = useT();
  const { currentStreak, todayDone, broken, loading } = useStreak();

  if (loading) return null;
  // 신규(끊김 아님 + 0) → 미표시. 끊김(0 + broken) → 표시(꺼진 불꽃).
  if (currentStreak <= 0 && !broken) return null;

  const text = formatI18n(t.dashboard.streakLineShort, { n: String(currentStreak) });

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-sm font-semibold ${
        broken ? "opacity-60" : ""
      }`}
      aria-label={text}
      style={todayDone ? { color: FLAME_ORANGE } : undefined}
    >
      <span className={todayDone ? "text-foreground" : "text-muted-foreground"}>
        {text}
      </span>
    </span>
  );
}
