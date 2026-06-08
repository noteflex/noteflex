import { useT, useLang } from "@/contexts/LanguageContext";
import MetricCard from "./MetricCard";
import { useMonthlyReport } from "@/hooks/useMonthlyReport";
import type { GraduatedNoteEntry, PersistentWeakNote } from "@/types/analytics";
import {
  WEEKLY_VOLUME_MEDIUM_THRESHOLD,
  WEEKLY_VOLUME_HIGH_THRESHOLD,
} from "@/types/analytics";
import type { CalendarDay, WeeklyChartPoint } from "@/hooks/useMonthlyReport";

const TODAY_RING_COLOR = "#D3224E";
const GRADUATED_COLOR = "#1a9d52";

// Volume color scale (low → high)
const VOL_LOW = "#c7ebd3";
const VOL_MED = "#6dd58f";
const VOL_HIGH = "#22c55e";
const VOL_NUM_COLOR = "#0f3d20";

const MONTH_NAMES_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

function fmtMs(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v / 1000).toFixed(2)}s`;
}

function volumeColor(attempts: number): string {
  if (attempts >= WEEKLY_VOLUME_HIGH_THRESHOLD) return VOL_HIGH;
  if (attempts >= WEEKLY_VOLUME_MEDIUM_THRESHOLD) return VOL_MED;
  return VOL_LOW;
}

// ── Section description helper ─────────────────────────────────────────────
// Splits at " — " and renders the suffix in green font-medium.

function SectionDesc({ text }: { text: string }) {
  const sepIdx = text.indexOf(" — ");
  if (sepIdx === -1) {
    return (
      <p className="mt-0.5 mb-3 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
    );
  }
  return (
    <p className="mt-0.5 mb-3 text-[13px] leading-relaxed text-muted-foreground">
      {text.slice(0, sepIdx)}
      {" — "}
      <span className="font-medium" style={{ color: "#15803d" }}>
        {text.slice(sepIdx + 3)}
      </span>
    </p>
  );
}

// ── Headline card ──────────────────────────────────────────────────────────

function HeadlineCard({ eyebrow, main }: { eyebrow: string; main: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
        {eyebrow}
      </p>
      <p className="text-sm font-semibold text-foreground leading-snug">{main}</p>
    </div>
  );
}

// ── Weekly bar chart (SVG) ─────────────────────────────────────────────────

const CL = 32;    // chart left margin (y-axis labels)
const CR = 8;     // chart right padding
const CT = 18;    // chart top (accuracy label space)
const CB = 22;    // chart bottom (week label space)
const VB_W = 280; // viewBox width
const VB_H = 130; // viewBox height (reduced for compact layout)
const PH = VB_H - CT - CB; // plot height = 90
const PW = VB_W - CL - CR; // plot width = 240

const Y_TICKS = [0, 25, 50, 75, 100];

function barY(accuracy: number): number {
  return CT + ((100 - accuracy) / 100) * PH;
}

function WeeklyBarChart({
  chartData,
  threshold85Label,
}: {
  chartData: WeeklyChartPoint[];
  threshold85Label: string;
}) {
  const hasData = chartData.some((p) => p.accuracy != null);
  if (!hasData) return null;

  const numSlots = chartData.length;
  const slotW = PW / Math.max(numSlots, 1);
  const barW = Math.min(slotW * 0.55, 36);
  const y85 = barY(85);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {/* Gridlines + y-axis labels */}
      {Y_TICKS.map((pct) => {
        const y = barY(pct);
        return (
          <g key={pct}>
            <line
              x1={CL}
              y1={y}
              x2={VB_W - CR}
              y2={y}
              stroke="#f0f0f0"
              strokeWidth={0.8}
            />
            <text
              x={CL - 4}
              y={y + 3.5}
              fontSize={8}
              fill="#9ca3af"
              textAnchor="end"
            >
              {pct}%
            </text>
          </g>
        );
      })}

      {/* 85% goal dashed line */}
      <line
        x1={CL}
        y1={y85}
        x2={VB_W - CR}
        y2={y85}
        stroke="#9ca3af"
        strokeDasharray="4 3"
        strokeWidth={1}
      />
      <text
        x={VB_W - CR - 2}
        y={y85 - 3}
        fontSize={8}
        fill="#9ca3af"
        textAnchor="end"
      >
        {threshold85Label}
      </text>

      {/* Bars */}
      {chartData.map((point, idx) => {
        if (point.accuracy == null) return null;
        const cx = CL + (idx + 0.5) * slotW;
        const bh = (point.accuracy / 100) * PH;
        const bx = cx - barW / 2;
        const by = CT + PH - bh;
        const color = volumeColor(point.totalAttempts);

        return (
          <g key={idx}>
            <rect x={bx} y={by} width={barW} height={Math.max(bh, 1)} fill={color} rx={2} />
            <text
              x={cx}
              y={by - 4}
              fontSize={9}
              fill="#374151"
              textAnchor="middle"
              fontWeight="600"
            >
              {point.accuracy}%
            </text>
            <text
              x={cx}
              y={VB_H - CB + 14}
              fontSize={9}
              fill="#6b7280"
              textAnchor="middle"
            >
              {point.week}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Practice calendar ──────────────────────────────────────────────────────

const DAY_LABELS_KO = ["월", "화", "수", "목", "금", "토", "일"];
const DAY_LABELS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function CalendarGrid({
  calendarDays,
  monthFirstDayOffset,
  longestStreak,
  streakText,
  monthYearLabel,
  todayStr,
  lang,
}: {
  calendarDays: CalendarDay[];
  monthFirstDayOffset: number;
  longestStreak: number;
  streakText: string;
  monthYearLabel: string;
  todayStr: string;
  lang: string;
}) {
  const dayLabels = lang === "ko" ? DAY_LABELS_KO : DAY_LABELS_EN;
  const cells: (CalendarDay | null)[] = [
    ...Array(monthFirstDayOffset).fill(null),
    ...calendarDays,
  ];

  return (
    <div className="space-y-2">
      {/* Full-width grid — cells are wide flat rectangles (~48px tall), like Google Calendar month view */}
      <div className="grid grid-cols-7 gap-1">
        {dayLabels.map((label) => (
          <div
            key={label}
            className="text-center text-[9px] text-muted-foreground font-medium pb-1"
          >
            {label}
          </div>
        ))}

        {cells.map((cell, i) => {
          if (!cell) {
            return <div key={`empty-${i}`} style={{ height: "48px" }} />;
          }

          const dayNum = parseInt(cell.date.slice(8, 10));
          const bucket = cell.bucket as 0 | 1 | 2 | 3;
          const isToday = cell.date === todayStr;
          const isFuture = cell.date > todayStr;
          const isActive = bucket > 0;

          const bgColor = isActive
            ? ([VOL_LOW, VOL_MED, VOL_HIGH] as const)[bucket - 1]
            : "transparent";

          // No opacity stacking — future gets its own lighter text color
          const numColor = isActive
            ? VOL_NUM_COLOR
            : isFuture
              ? "#d1d5db"
              : "#6b7280";

          return (
            <div
              key={cell.date}
              className="rounded-sm relative"
              style={{
                height: "48px",
                backgroundColor: bgColor,
                border: isFuture
                  ? "1px solid #f3f4f6"
                  : !isActive
                    ? "1px solid #e5e7eb"
                    : "none",
              }}
            >
              {isToday && (
                <div
                  className="absolute inset-0 rounded-sm pointer-events-none"
                  style={{ boxShadow: `inset 0 0 0 2px ${TODAY_RING_COLOR}` }}
                />
              )}
              <span
                className="absolute leading-none select-none"
                style={{
                  top: "4px",
                  right: "5px",
                  fontSize: "12px",
                  fontWeight: isToday ? 700 : 500,
                  color: numColor,
                }}
              >
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* D3: streak 14px #15803d, month-year 13px muted */}
      <div className="flex items-center justify-between mt-2">
        {longestStreak >= 2 ? (
          <p style={{ fontSize: "14px", fontWeight: 500, color: "#15803d" }}>{streakText}</p>
        ) : (
          <span />
        )}
        <p className="text-[13px] text-muted-foreground">{monthYearLabel}</p>
      </div>
    </div>
  );
}

// ── Graduated notes ────────────────────────────────────────────────────────

function GraduatedNoteList({
  notes,
  clefTreble,
  clefBass,
}: {
  notes: GraduatedNoteEntry[];
  clefTreble: string;
  clefBass: string;
}) {
  if (notes.length === 0) return null;

  return (
    <div className="space-y-2">
      {notes.map((note) => {
        const clefLabel = note.clef === "treble" ? clefTreble : clefBass;
        const prevPct =
          note.prevAccuracy != null ? `${Math.round(note.prevAccuracy * 100)}%` : null;
        const currPct =
          note.currAccuracy != null ? `${Math.round(note.currAccuracy * 100)}%` : null;
        const delta =
          prevPct && currPct ? `${prevPct} → ${currPct} ✓` : currPct ? `${currPct} ✓` : "✓";

        return (
          <div
            key={`${note.note_key}-${note.octave}-${note.clef}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: GRADUATED_COLOR }}
            />
            <div className="flex-1 min-w-0">
              <span className="text-[19px] font-bold text-foreground leading-none">
                {note.note_key}
                {note.octave}
              </span>
              <span className="ml-1.5 text-[13px] text-muted-foreground">{clefLabel}</span>
            </div>
            <p className="text-sm font-semibold shrink-0" style={{ color: GRADUATED_COLOR }}>
              {delta}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Persistent weak notes ──────────────────────────────────────────────────

function PersistentWeakList({
  notes,
  nOfMLabel,
  clefTreble,
  clefBass,
}: {
  notes: PersistentWeakNote[];
  nOfMLabel: string;
  clefTreble: string;
  clefBass: string;
}) {
  if (notes.length === 0) return null;

  return (
    <div className="space-y-2">
      {notes.map((note) => {
        const accuracy = note.accuracy;
        const dot = accuracy >= 0.5 ? "bg-amber-400" : "bg-red-500";
        const accColor =
          accuracy >= 0.5
            ? "text-amber-500 dark:text-amber-400"
            : "text-red-500 dark:text-red-400";
        const clefLabel = note.clef === "treble" ? clefTreble : clefBass;
        const weekStr = nOfMLabel
          .replace("{n}", String(note.weeksCount))
          .replace("{m}", String(note.totalWeeks));

        return (
          <div
            key={`${note.note_key}-${note.octave}-${note.clef}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${dot}`} />
            <div className="flex-1 min-w-0">
              <span className="text-[19px] font-bold text-foreground leading-none">
                {note.note_key}
                {note.octave}
              </span>
              <span className="ml-1.5 text-[13px] text-muted-foreground">{clefLabel}</span>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-lg font-bold leading-none ${accColor}`}>
                {Math.round(accuracy * 100)}%
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{weekStr}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Encouraging card ───────────────────────────────────────────────────────

function EncouragingCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20 px-4 py-3">
      <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-snug">{message}</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function MonthlyReport() {
  const t = useT();
  const { lang } = useLang();
  const {
    current,
    loading,
    error,
    refresh,
    headlineKind,
    headlineDeltaPp,
    accuracyDeltaPp,
    reactionDeltaMs,
    activeDayCount,
    elapsedDays,
    longestStreak,
    graduatedNotes,
    persistentWeakNotes,
    calendarDays,
    monthFirstDayOffset,
    weeklyChartData,
    monthStart,
    isGrace,
    todayStr,
  } = useMonthlyReport();

  const headlineMain = (() => {
    const n = headlineDeltaPp;
    const g = graduatedNotes.length;
    switch (headlineKind) {
      case "up": {
        const base = t.analytics.monthlyHeadlineUp.replace("{n}", String(n));
        return g > 0
          ? `${base} · ${t.analytics.monthlyHeadlineGraduated.replace("{n}", String(g))}`
          : base;
      }
      case "down":
        return t.analytics.monthlyHeadlineDown.replace("{n}", String(n));
      case "same":
        return g > 0
          ? t.analytics.monthlyHeadlineGraduated.replace("{n}", String(g))
          : t.analytics.monthlyHeadlineSame;
      case "grace":
        return t.analytics.monthlyHeadlineGrace;
      case "nodata":
        return t.analytics.monthlyNoData;
    }
  })();

  const accDeltaSub = (() => {
    if (isGrace || accuracyDeltaPp == null) return { text: "—", tone: "neutral" as const };
    const n = Math.round(Math.abs(accuracyDeltaPp));
    if (accuracyDeltaPp >= 1)
      return { text: t.analytics.monthlyDeltaAccUp.replace("{n}", String(n)), tone: "up" as const };
    if (accuracyDeltaPp <= -1)
      return {
        text: t.analytics.monthlyDeltaAccDown.replace("{n}", String(n)),
        tone: "neutral" as const,
      };
    return { text: "—", tone: "neutral" as const };
  })();

  // ms↓ = faster = ▲ + emerald, ms↑ = slower = ▼ + red (일간·주간과 동일 규칙)
  const msDeltaSub = (() => {
    if (isGrace || reactionDeltaMs == null) return { text: "—", tone: "neutral" as const };
    const absMs = Math.round(Math.abs(reactionDeltaMs));
    if (absMs < 20) return { text: "—", tone: "neutral" as const };
    const n = (Math.abs(reactionDeltaMs) / 1000).toFixed(2);
    if (reactionDeltaMs < 0)
      return {
        text: t.analytics.monthlyDeltaMsFaster.replace("{n}", n),
        tone: "up" as const,
      };
    return {
      text: t.analytics.monthlyDeltaMsSlower.replace("{n}", n),
      tone: "down" as const,
    };
  })();

  const encouragingText = (() => {
    if (isGrace) return t.analytics.monthlyGraceMessage;
    if (graduatedNotes.length > 0)
      return t.analytics.monthlyEncouragingGraduated.replace(
        "{n}",
        String(graduatedNotes.length),
      );
    if (headlineKind === "down") return t.analytics.monthlyEncouragingDown;
    return t.analytics.monthlyEncouragingSame;
  })();

  const streakText = t.analytics.monthlyCalendarStreak.replace("{n}", String(longestStreak));

  const monthYearLabel = monthStart
    ? lang === "ko"
      ? `${monthStart.slice(0, 4)}년 ${parseInt(monthStart.slice(5, 7))}월`
      : `${MONTH_NAMES_EN[parseInt(monthStart.slice(5, 7)) - 1]} ${monthStart.slice(0, 4)}`
    : "";

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card px-4 py-3 animate-pulse h-14"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-6 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{t.analytics.errorTitle}</p>
        <button
          onClick={() => void refresh()}
          className="text-xs text-primary underline underline-offset-2"
        >
          {t.analytics.errorRetry}
        </button>
      </div>
    );
  }

  if (!current || current.total_attempts === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">{t.analytics.monthlyNoData}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t.analytics.periodMonthlyNoDataHint}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Headline */}
      <HeadlineCard eyebrow={t.analytics.monthlyThisMonthLabel} main={headlineMain} />

      {/* 2. Metric cards (2×2) */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label={t.analytics.monthlyMetricAccLabel}
          value={fmtPct(current.overall_accuracy)}
          sub={accDeltaSub.text}
          deltaTone={accDeltaSub.tone}
          highlight
        />
        <MetricCard
          label={t.analytics.monthlyMetricReactionLabel}
          value={fmtMs(current.avg_reaction_ms)}
          sub={msDeltaSub.text}
          deltaTone={msDeltaSub.tone}
        />
        <MetricCard
          label={t.analytics.monthlyMetricActiveDaysLabel}
          value={`${activeDayCount}/${elapsedDays}`}
        />
        <MetricCard
          label={t.analytics.monthlyMetricGraduatedLabel}
          value={String(graduatedNotes.length)}
        />
      </div>

      {/* 3. Weekly growth chart */}
      {weeklyChartData.some((p) => p.accuracy != null) && (
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t.analytics.monthlyWeeklyGrowthTitle}
          </p>
          <SectionDesc text={t.analytics.monthlyWeeklyGrowthDesc} />
          <div style={{ width: "80%", margin: "0 auto" }}>
            <WeeklyBarChart
              chartData={weeklyChartData}
              threshold85Label={t.analytics.monthlyThreshold85}
            />
          </div>
          {/* Volume legend */}
          <div className="flex items-center gap-4 mt-3">
            {(
              [
                { color: VOL_LOW, label: t.analytics.monthlyVolumeLow },
                { color: VOL_MED, label: t.analytics.monthlyVolumeMed },
                { color: VOL_HIGH, label: t.analytics.monthlyVolumeHigh },
              ] as const
            ).map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[12px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Practice calendar */}
      {calendarDays.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t.analytics.monthlyCalendarTitle}
          </p>
          <SectionDesc text={t.analytics.monthlyCalendarDesc} />
          <CalendarGrid
            calendarDays={calendarDays}
            monthFirstDayOffset={monthFirstDayOffset}
            longestStreak={longestStreak}
            streakText={streakText}
            monthYearLabel={monthYearLabel}
            todayStr={todayStr}
            lang={lang}
          />
        </div>
      )}

      {/* 5. Graduated notes */}
      {graduatedNotes.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t.analytics.monthlyGraduatedTitle}
          </p>
          <SectionDesc text={t.analytics.monthlyGraduatedDesc} />
          <GraduatedNoteList
            notes={graduatedNotes}
            clefTreble={t.analytics.clefTreble}
            clefBass={t.analytics.clefBass}
          />
        </div>
      )}

      {/* 6. Persistent weak notes */}
      {persistentWeakNotes.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[11px] font-medium text-muted-foreground">
            {t.analytics.monthlyPersistentWeakTitle}
          </p>
          <SectionDesc text={t.analytics.monthlyPersistentWeakDesc} />
          <PersistentWeakList
            notes={persistentWeakNotes}
            nOfMLabel={t.analytics.monthlyPersistentWeakNOfM}
            clefTreble={t.analytics.clefTreble}
            clefBass={t.analytics.clefBass}
          />
        </div>
      )}

      {/* 7. Encouraging card */}
      <EncouragingCard message={encouragingText} />
    </div>
  );
}
