// 대시보드 스트릭 카드 — 🔥 N일 연속 + 주간 7도트(월~일) + 최장 기록.
//
// 도트:
//   - 완료(done)        → amber 채움 + 🔥
//   - 오늘 미완(isToday) → amber 테두리 빈 원
//   - 그 외 미완         → 회색 빈 원 (미래 포함, isFuture 는 더 옅게)

import { useLang } from "@/contexts/LanguageContext";
import { useStreak, type StreakWeekDay } from "@/hooks/useStreak";

const FLAME_AMBER = "#BA7517";
const DOT_PX = 34;

export default function StreakWidget() {
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
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="text-xl"
            style={todayDone ? { color: FLAME_AMBER } : undefined}
          >
            🔥
          </span>
          <span className="text-xl font-bold text-foreground tabular-nums">
            {currentStreak}
          </span>
          <span className="text-sm text-muted-foreground">
            {isKo ? "일 연속" : "day streak"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {isKo
            ? `최장 ${longestStreak}일`
            : `Best ${longestStreak}d`}
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
  // 셀 클래스 결정
  let circleClass = "border-2 ";
  let circleStyle: React.CSSProperties = { width: DOT_PX, height: DOT_PX };
  let inner: React.ReactNode = null;

  if (day.done) {
    // 완료
    circleStyle = {
      ...circleStyle,
      backgroundColor: "#FEF3C7", // amber-100
      borderColor: FLAME_AMBER,
    };
    inner = (
      <span aria-hidden="true" className="text-xs" style={{ color: FLAME_AMBER }}>
        🔥
      </span>
    );
  } else if (day.isToday) {
    // 오늘 미완
    circleStyle = { ...circleStyle, borderColor: FLAME_AMBER };
  } else {
    // 그 외 미완 (미래 포함)
    circleClass += day.isFuture
      ? "border-border/50 opacity-60 "
      : "border-border ";
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
