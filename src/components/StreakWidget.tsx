// 대시보드 스트릭 카드 — 🔥 N일 연속 + 주간 7도트(월~일) + 최장 기록.
//
// 도트(3상태):
//   - 완료(done)         → 화사 오렌지(#FB923C) 채움 + 또렷 🔥 18px
//   - 오늘 미완(isToday)  → 오렌지 테두리 2px + 옅은 🔥(opacity 0.5) — 완료는 배경 채움+또렷 🔥, 오늘은 테두리만+옅은 🔥로 구분
//   - 그 외 미완(과거·미래) → 연회색 빈 원 (isFuture 는 살짝 opacity 낮춤)

import { useLang, useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { useStreak, type StreakWeekDay } from "@/hooks/useStreak";

const FLAME_ORANGE = "#FB923C"; // amber-400/orange-400 — 화사
const DOT_PX = 38;

export default function StreakWidget() {
  const t = useT();
  const { lang } = useLang();
  const { loading, currentStreak, longestStreak, todayDone, week } = useStreak();
  const isKo = lang === "ko";

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-border bg-card/60 p-4 animate-pulse"
        aria-hidden="true"
      >
        <div className="h-6 w-32 rounded bg-muted mb-3" />
        <div className="flex justify-between gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="rounded-full bg-muted"
              style={{ width: DOT_PX, height: DOT_PX }}
            />
          ))}
        </div>
      </div>
    );
  }

  const weekdayLabels = isKo
    ? ["월", "화", "수", "목", "금", "토", "일"]
    : ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm">
      <div className="flex items-end justify-between mb-3">
        <div
          className="flex items-center gap-1.5 text-lg font-bold text-foreground"
          style={todayDone ? { color: FLAME_ORANGE } : undefined}
        >
          {formatI18n(t.dashboard.streakLineLong, { n: String(currentStreak) })}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatI18n(t.dashboard.streakBestLine, { n: String(longestStreak) })}
        </span>
      </div>

      <div className="flex justify-between gap-1">
        {week.map((d, i) => (
          <DayDot key={d.date} day={d} label={weekdayLabels[i]} />
        ))}
      </div>
    </div>
  );
}

function DayDot({ day, label }: { day: StreakWeekDay; label: string }) {
  // 3상태 분기 — 완료 / 오늘 미완 / 그 외 미완
  let circleClass = "border-2 ";
  let circleStyle: React.CSSProperties = { width: DOT_PX, height: DOT_PX };
  let inner: React.ReactNode = null;

  if (day.done) {
    // 완료: 화사 오렌지 채움 + 또렷 🔥 18px
    circleStyle = {
      ...circleStyle,
      backgroundColor: FLAME_ORANGE,
      borderColor: FLAME_ORANGE,
    };
    inner = (
      <span aria-hidden="true" className="leading-none" style={{ fontSize: 18 }}>
        🔥
      </span>
    );
  } else if (day.isToday) {
    // 오늘 미완: 오렌지 테두리 + 옅은 🔥
    circleStyle = { ...circleStyle, borderColor: FLAME_ORANGE };
    inner = (
      <span
        aria-hidden="true"
        className="leading-none"
        style={{ fontSize: 18, opacity: 0.5 }}
      >
        🔥
      </span>
    );
  } else {
    // 그 외 미완 (과거 미완 / 미래): 연회색 빈 원
    circleClass += day.isFuture
      ? "border-border/40 bg-muted/30 opacity-70 "
      : "border-border bg-muted/30 ";
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className={`text-[10px] font-semibold ${
          day.isToday ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <div
        className={`rounded-full flex items-center justify-center ${circleClass}`}
        style={circleStyle}
        aria-label={`${day.date}${day.done ? " done" : day.isToday ? " today" : ""}`}
      >
        {inner}
      </div>
    </div>
  );
}
