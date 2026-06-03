import { useMemo } from "react";
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
import type { PeriodRollup, DayRollupRow, WeakNoteRollup, PerNote } from "@/types/analytics";

// B1: 추세선 = 로고 색 #D3224E
const TREND_COLOR = "#D3224E";
// B2: 리듬 채운 동그라미 = 부드러운 초록
const RHYTHM_ACTIVE_COLOR = "#22c55e";
// B3: grace 프로그레스 바 = 부드러운 주황
const GRACE_BAR_COLOR = "#f97316";

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

function fmtMs(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v / 1000).toFixed(2)}s`;
}

function fmtDelta(diff: number, vsLabel: string): {
  label: string;
  tone: "up" | "down" | "neutral";
} {
  const abs = Math.abs(diff);
  if (abs < 0.005) return { label: "—", tone: "neutral" };
  const sign = diff > 0 ? "▲" : "▼";
  return {
    label: `${sign}${Math.round(abs * 100)}%p ${vsLabel}`,
    tone: diff > 0 ? "up" : "down",
  };
}

function fmtMsDelta(diff: number, vsLabel: string): { label: string; tone: "up" | "down" | "neutral" } {
  const abs = Math.abs(diff);
  if (abs < 20) return { label: "—", tone: "neutral" };
  const sign = diff > 0 ? "▲" : "▼";
  return {
    label: `${sign}${Math.round(abs)}ms ${vsLabel}`,
    tone: diff < 0 ? "up" : "down",
  };
}

function longestGap(activeDays: Set<number>): number {
  let max = 0;
  let cur = 0;
  for (let i = 0; i < 7; i++) {
    if (!activeDays.has(i)) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 0;
    }
  }
  return max;
}

function missedDays(note: WeakNoteRollup, rows: DayRollupRow[]): { n: number; m: number } {
  let m = 0;
  let n = 0;
  for (const row of rows) {
    const entry = (row.per_note as PerNote[] | null ?? []).find(
      (p) => p.note_key === note.note_key && p.octave === note.octave && p.clef === note.clef,
    );
    if (entry) {
      m++;
      if (entry.accuracy < 1) n++;
    }
  }
  return { n, m };
}

function buildHeadline(
  current: PeriodRollup | null,
  dailyRows: DayRollupRow[],
  activeDayCount: number,
  t: ReturnType<typeof useT>,
): string {
  if (!current || current.total_attempts === 0) return t.analytics.weeklyNoData;

  const accuracies = dailyRows
    .filter((r) => r.overall_accuracy != null)
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .map((r) => r.overall_accuracy!);

  if (accuracies.length < 2) {
    return t.analytics.weeklyGrace.replace("{n}", String(activeDayCount));
  }

  const topNote = (current.weak_notes_top as WeakNoteRollup[] | null ?? [])[0];
  const noteName = topNote ? `${topNote.note_key}${topNote.octave}` : null;

  if (!noteName) return t.analytics.weeklyHeadlineNoNote;

  const slope = accuracies[accuracies.length - 1] - accuracies[0];
  const templ =
    slope > 0.03
      ? t.analytics.weeklyHeadlineUp
      : slope < -0.03
        ? t.analytics.weeklyHeadlineDown
        : t.analytics.weeklyHeadlineFlat;
  return templ.replace("{note}", noteName);
}

// ── Headline card ──────────────────────────────────────────────────────────

function HeadlineCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
        이번 주 요약
      </p>
      <p className="text-sm font-semibold text-foreground leading-snug">{text}</p>
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
  summary,
}: {
  weekDays: string[];
  activeDayIndices: Set<number>;
  todayIndex: number;
  dayLabels: string[];
  summary: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 justify-between">
        {weekDays.map((_, i) => {
          const active = activeDayIndices.has(i);
          const isFuture = i > todayIndex;
          const isToday = i === todayIndex;
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: RHYTHM_ACTIVE_COLOR, color: "white" }
                    : isFuture
                      ? { border: "1.5px solid #d1d5db", color: "#d1d5db" }
                      : { border: "1.5px dashed #9ca3af", color: "#9ca3af" }
                }
              >
                {isToday && !active ? "·" : ""}
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
      <p className="text-[11px] text-muted-foreground text-right">{summary}</p>
    </div>
  );
}

// ── Weak all week ──────────────────────────────────────────────────────────

function WeakAllWeek({
  weakNotes,
  dailyRows,
  missedOfLabel,
  clefTreble,
  clefBass,
}: {
  weakNotes: WeakNoteRollup[];
  dailyRows: DayRollupRow[];
  missedOfLabel: string;
  clefTreble: string;
  clefBass: string;
}) {
  if (weakNotes.length === 0) return null;

  return (
    <div className="space-y-2">
      {weakNotes.map((note) => {
        const accuracy = 1 - note.error_rate;
        const { n, m } = missedDays(note, dailyRows);

        const dot =
          accuracy >= 0.75 ? "bg-emerald-500" : accuracy >= 0.5 ? "bg-amber-400" : "bg-red-500";
        const accColor =
          accuracy >= 0.75
            ? "text-emerald-600 dark:text-emerald-400"
            : accuracy >= 0.5
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

// ── Grace bar ─────────────────────────────────────────────────────────────

function GraceBar({ activeDays, message }: { activeDays: number; message: string }) {
  const pct = Math.round((activeDays / 7) * 100);
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">{message}</p>
        <p className="text-[12px] font-semibold text-foreground tabular-nums">{activeDays}/7</p>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: GRACE_BAR_COLOR }}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function WeeklyReport() {
  const t = useT();
  const { lang } = useLang();
  const { current, prev, dailyRows, weekStart, loading, error, refresh } = useWeeklyReport();

  const dayLabels =
    lang === "ko"
      ? ["월", "화", "수", "목", "금", "토", "일"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const todayStr = useMemo(() => toIsoDate(new Date()), []);

  const weekDays = useMemo(
    () => (weekStart ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : []),
    [weekStart],
  );

  const todayIndex = useMemo(
    () => (weekStart ? weekDays.indexOf(todayStr) : -1),
    [weekDays, todayStr, weekStart],
  );

  const activeDayIndices = useMemo(() => {
    const s = new Set<number>();
    dailyRows.forEach((row) => {
      const idx = weekDays.indexOf(row.period_start);
      if (idx >= 0) s.add(idx);
    });
    return s;
  }, [dailyRows, weekDays]);

  const activeDayCount = useMemo(
    () => dailyRows.filter((r) => r.period_start <= todayStr).length,
    [dailyRows, todayStr],
  );

  // grace 바는 cold-start(직전 주 rollup 없음 = 처음 주)에서만 표시
  const isGrace = prev == null && activeDayCount < 7;

  const chartData: ChartPoint[] = useMemo(
    () =>
      weekDays.map((dateStr, i) => {
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
      }),
    [weekDays, dailyRows, todayStr, dayLabels],
  );

  const gap = useMemo(
    () => longestGap(activeDayIndices),
    [activeDayIndices],
  );

  const rhythmSummary = t.analytics.weeklyRhythmSummary
    .replace("{activeDays}", String(activeDayCount))
    .replace("{gap}", String(gap));

  const headline = useMemo(
    () => buildHeadline(current, dailyRows, activeDayCount, t),
    [current, dailyRows, activeDayCount, t],
  );

  const vsLabel = t.analytics.weeklyDeltaVsPrev;

  const deltaAcc = useMemo(() => {
    if (current?.overall_accuracy == null || prev?.overall_accuracy == null)
      return { label: "—", tone: "neutral" as const };
    return fmtDelta(current.overall_accuracy - prev.overall_accuracy, vsLabel);
  }, [current, prev, vsLabel]);

  const deltaMs = useMemo(() => {
    if (current?.avg_reaction_ms == null || prev?.avg_reaction_ms == null)
      return { label: "—", tone: "neutral" as const };
    return fmtMsDelta(current.avg_reaction_ms - prev.avg_reaction_ms, vsLabel);
  }, [current, prev, vsLabel]);

  // error_rate > 0.15 (accuracy < 85%) 인 경우만 "약점"으로 표시
  const weakNotes = useMemo(
    () =>
      (current?.weak_notes_top as WeakNoteRollup[] | null ?? [])
        .filter((n) => n.error_rate > 0.15)
        .slice(0, 5),
    [current],
  );

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
      <HeadlineCard text={headline} />

      {/* 2. Metric cards */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label={t.analytics.metricAccuracy}
          value={fmtPct(current.overall_accuracy)}
          sub={deltaAcc.label}
          deltaTone={deltaAcc.tone}
          highlight
        />
        <MetricCard
          label={t.analytics.metricAvgReaction}
          value={fmtMs(current.avg_reaction_ms)}
          sub={deltaMs.label}
          deltaTone={deltaMs.tone}
        />
        <MetricCard
          label={lang === "ko" ? "활동일" : "Active days"}
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
            summary={rhythmSummary}
          />
        </div>
      )}

      {/* 5. Weak all week */}
      {weakNotes.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-3">
            {t.analytics.weeklyWeakTitle}
          </p>
          <WeakAllWeek
            weakNotes={weakNotes}
            dailyRows={dailyRows}
            missedOfLabel={t.analytics.weeklyWeakMissedOf}
            clefTreble={t.analytics.clefTreble}
            clefBass={t.analytics.clefBass}
          />
        </div>
      )}

      {/* 6. Grace bar (incomplete week) */}
      {isGrace && (
        <GraceBar
          activeDays={activeDayCount}
          message={t.analytics.weeklyGrace.replace("{n}", String(activeDayCount))}
        />
      )}
    </div>
  );
}
