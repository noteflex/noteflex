import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useT, useLang } from "@/contexts/LanguageContext";
import MetricCard from "./MetricCard";
import { useWeeklyReport } from "@/hooks/useWeeklyReport";
import type { WeakNoteRollup, DayRollupRow, PerNote } from "@/types/analytics";

const TREND_COLOR = "#D3224E";
const RHYTHM_ACTIVE_COLOR = "#22c55e";
const GRACE_BAR_COLOR = "#f97316";

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

function fmtMs(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v / 1000).toFixed(2)}s`;
}

function missedDays(note: WeakNoteRollup, rows: DayRollupRow[]): { n: number; m: number } {
  let m = 0;
  let n = 0;
  for (const row of rows) {
    const entry = ((row.per_note as PerNote[] | null) ?? []).find(
      (p) => p.note_key === note.note_key && p.octave === note.octave && p.clef === note.clef,
    );
    if (entry) {
      m++;
      if (entry.accuracy < 1) n++;
    }
  }
  return { n, m };
}

// ── Headline card ──────────────────────────────────────────────────────────

function HeadlineCard({ eyebrow, main, sub }: { eyebrow: string; main: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
        {eyebrow}
      </p>
      <p className="text-sm font-semibold text-foreground leading-snug">{main}</p>
      {sub && (
        <p className="mt-1.5 text-xs text-muted-foreground leading-snug">{sub}</p>
      )}
    </div>
  );
}

// ── Accuracy trend chart ───────────────────────────────────────────────────

interface ChartPoint {
  day: string;
  accuracy: number | null;
  inactive: boolean;
}

function AccuracyTrend({
  chartData,
  threshold85Label,
}: {
  chartData: ChartPoint[];
  threshold85Label: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData} margin={{ top: 12, right: 8, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="day"
          tick={({ x, y, payload, index }: { x: number; y: number; payload: { value: string }; index: number }) => {
            const inactive = chartData[index]?.inactive;
            return (
              <text
                x={x}
                y={y + 12}
                textAnchor="middle"
                fontSize={11}
                fill={inactive ? "#9ca3af" : "#6b7280"}
              >
                {payload.value}
              </text>
            );
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <ReferenceLine
          y={85}
          stroke="#9ca3af"
          strokeDasharray="4 4"
          strokeWidth={1}
          label={{
            value: threshold85Label,
            position: "insideTopRight",
            fontSize: 9,
            fill: "#9ca3af",
            dy: -2,
          }}
        />
        <Tooltip
          formatter={(value: number) => [`${value}%`, "정확도"]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "white",
            padding: "4px 10px",
          }}
          cursor={{ stroke: "#e5e7eb", strokeWidth: 1 }}
        />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke={TREND_COLOR}
          strokeWidth={2}
          dot={(props: { cx: number; cy: number; index: number }) => {
            const point = chartData[props.index];
            if (!point || point.inactive || point.accuracy == null) {
              return <g key={`dot-${props.index}`} />;
            }
            return (
              <circle
                key={`dot-${props.index}`}
                cx={props.cx}
                cy={props.cy}
                r={4}
                fill={TREND_COLOR}
                stroke="white"
                strokeWidth={1.5}
              />
            );
          }}
          activeDot={{ r: 5, fill: TREND_COLOR, stroke: "white", strokeWidth: 1.5 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Rhythm circles ─────────────────────────────────────────────────────────

function RhythmCircles({
  weekDays,
  activeDayIndices,
  todayIndex,
  dayLabels,
  streakText,
}: {
  weekDays: string[];
  activeDayIndices: Set<number>;
  todayIndex: number;
  dayLabels: string[];
  streakText: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 justify-between">
        {weekDays.map((_, i) => {
          const active = activeDayIndices.has(i);
          const isFuture = i > todayIndex;
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors"
                style={
                  active
                    ? { backgroundColor: RHYTHM_ACTIVE_COLOR, color: "white" }
                    : isFuture
                      ? { border: "1.5px solid #d1d5db", color: "#d1d5db" }
                      : { border: "1.5px dashed #9ca3af", color: "#9ca3af" }
                }
              >
                {active ? "✓" : ""}
              </div>
              <span
                className="text-[10px]"
                style={{ color: active ? "#15803d" : isFuture ? "#d1d5db" : "#9ca3af" }}
              >
                {dayLabels[i]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground text-right">{streakText}</p>
    </div>
  );
}

// ── Focus notes ────────────────────────────────────────────────────────────

function FocusNotes({
  notes,
  dailyRows,
  missedOfLabel,
  clefTreble,
  clefBass,
}: {
  notes: WeakNoteRollup[];
  dailyRows: DayRollupRow[];
  missedOfLabel: string;
  clefTreble: string;
  clefBass: string;
}) {
  if (notes.length === 0) return null;

  return (
    <div className="space-y-2">
      {notes.map((note) => {
        const accuracy = 1 - note.error_rate;
        const { n, m } = missedDays(note, dailyRows);

        const dot = accuracy >= 0.5 ? "bg-amber-400" : "bg-red-500";
        const accColor =
          accuracy >= 0.5
            ? "text-amber-500 dark:text-amber-400"
            : "text-red-500 dark:text-red-400";

        const clefLabel = note.clef === "treble" ? clefTreble : clefBass;
        const missed =
          m > 0
            ? missedOfLabel.replace("{n}", String(n)).replace("{m}", String(m))
            : null;

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
              {missed && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{missed}</p>
              )}
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

// ── Grace bar ─────────────────────────────────────────────────────────────

function GraceBar({ activeDays }: { activeDays: number }) {
  const pct = Math.round((activeDays / 7) * 100);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: GRACE_BAR_COLOR }}
          />
        </div>
        <p className="text-[12px] font-semibold text-foreground tabular-nums shrink-0">
          {activeDays}/7
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function WeeklyReport() {
  const t = useT();
  const { lang } = useLang();
  const {
    current,
    prev,
    dailyRows,
    loading,
    error,
    refresh,
    headlineKind,
    headlineDeltaPp,
    accuracyDeltaPp,
    reactionDeltaMs,
    streakDays,
    focusNotes,
    topFocusNote,
    activeDayCount,
    activeDayIndices,
    todayIndex,
    weekDays,
    todayStr,
  } = useWeeklyReport();

  const dayLabels =
    lang === "ko"
      ? ["월", "화", "수", "목", "금", "토", "일"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const topNoteName = topFocusNote ? `${topFocusNote.note_key}${topFocusNote.octave}` : null;

  const headlineMain = (() => {
    switch (headlineKind) {
      case "up":    return t.analytics.weeklyHeadlineUp.replace("{n}", String(headlineDeltaPp));
      case "down":  return t.analytics.weeklyHeadlineDown.replace("{n}", String(headlineDeltaPp));
      case "same":  return t.analytics.weeklyHeadlineSame;
      case "grace": return t.analytics.weeklyGrace.replace("{n}", String(activeDayCount));
      case "nodata":return t.analytics.weeklyNoData;
    }
  })();

  const headlineSub =
    headlineKind !== "nodata" && headlineKind !== "grace"
      ? (topNoteName
          ? t.analytics.weeklyHeadlineSubFocus.replace("{note}", topNoteName)
          : t.analytics.weeklyHeadlineSubNone)
      : "";

  const accDeltaSub = (() => {
    if (accuracyDeltaPp == null) return { text: "—", tone: "neutral" as const };
    const n = Math.round(Math.abs(accuracyDeltaPp));
    if (accuracyDeltaPp >= 1) return { text: t.analytics.weeklyDeltaAccUp.replace("{n}", String(n)), tone: "up" as const };
    if (accuracyDeltaPp <= -1) return { text: t.analytics.weeklyDeltaAccDown.replace("{n}", String(n)), tone: "neutral" as const };
    return { text: "—", tone: "neutral" as const };
  })();

  const msDeltaSub = (() => {
    if (reactionDeltaMs == null) return { text: "—", tone: "neutral" as const };
    const n = Math.round(Math.abs(reactionDeltaMs));
    if (n < 20) return { text: "—", tone: "neutral" as const };
    if (reactionDeltaMs < 0) return { text: t.analytics.weeklyDeltaMsFaster.replace("{n}", String(n)), tone: "up" as const };
    return { text: t.analytics.weeklyDeltaMsSlower.replace("{n}", String(n)), tone: "neutral" as const };
  })();

  const streakText =
    streakDays >= 2
      ? t.analytics.weeklyStreakN.replace("{streak}", String(streakDays))
      : t.analytics.weeklyStreakOne.replace("{active}", String(activeDayCount));

  const chartData: ChartPoint[] = weekDays.map((dateStr, i) => {
    const row = dailyRows.find((r) => r.period_start === dateStr);
    const isFuture = dateStr > todayStr;
    return {
      day: dayLabels[i],
      accuracy:
        row && !isFuture && row.overall_accuracy != null
          ? Math.round(row.overall_accuracy * 100)
          : null,
      inactive: !row || isFuture,
    };
  });

  const isGrace = prev == null && current != null && current.total_attempts > 0;

  const encouragingText = topNoteName
    ? t.analytics.weeklyEncouragingFocus.replace("{note}", topNoteName)
    : t.analytics.weeklyEncouragingNone;

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card px-4 py-3 animate-pulse h-14" />
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
        <p className="text-sm text-muted-foreground">{t.analytics.weeklyNoData}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{t.analytics.periodWeeklyNoDataHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Headline */}
      <HeadlineCard
        eyebrow={t.analytics.weeklyThisWeekLabel}
        main={headlineMain}
        sub={headlineSub}
      />

      {/* 2. Metric cards */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label={t.analytics.weeklyMetricAccLabel}
          value={fmtPct(current.overall_accuracy)}
          sub={accDeltaSub.text}
          deltaTone={accDeltaSub.tone}
          highlight
        />
        <MetricCard
          label={t.analytics.weeklyMetricReactionLabel}
          value={fmtMs(current.avg_reaction_ms)}
          sub={msDeltaSub.text}
          deltaTone={msDeltaSub.tone}
        />
        <MetricCard
          label={t.analytics.weeklyMetricActiveDaysLabel}
          value={`${activeDayCount}/7`}
        />
      </div>

      {/* 3. Accuracy trend chart */}
      {chartData.some((p) => p.accuracy != null) && (
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-3">
            {t.analytics.weeklyAccTrendTitle}
          </p>
          <AccuracyTrend
            chartData={chartData}
            threshold85Label={t.analytics.weeklyThreshold85}
          />
        </div>
      )}

      {/* 4. Rhythm circles */}
      {weekDays.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-3">
            {t.analytics.weeklyRhythmTitle}
          </p>
          <RhythmCircles
            weekDays={weekDays}
            activeDayIndices={activeDayIndices}
            todayIndex={todayIndex >= 0 ? todayIndex : 0}
            dayLabels={dayLabels}
            streakText={streakText}
          />
        </div>
      )}

      {/* 5. Focus notes */}
      {focusNotes.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-3">
            {t.analytics.weeklyFocusTitle}
          </p>
          <FocusNotes
            notes={focusNotes}
            dailyRows={dailyRows}
            missedOfLabel={t.analytics.weeklyWeakMissedOf}
            clefTreble={t.analytics.clefTreble}
            clefBass={t.analytics.clefBass}
          />
        </div>
      )}

      {/* 6. Encouraging card */}
      <EncouragingCard message={encouragingText} />

      {/* 7. Grace bar (cold-start progress) */}
      {isGrace && <GraceBar activeDays={activeDayCount} />}
    </div>
  );
}
