import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { usePeriodReport } from "@/hooks/useAnalytics";
import { useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import MetricCard from "./MetricCard";
import WeakNoteChip from "./WeakNoteChip";
import type { WeakNoteForChip } from "@/types/analytics";

interface PeriodReportProps {
  periodType: "week" | "month";
}

/* ---------- 헬퍼 ---------- */

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

function fmtMs(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v / 1000).toFixed(2)}s`;
}

/* ---------- 상태 컴포넌트 ---------- */

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-2/3 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
      <div className="h-16 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
  );
}

function NoDataState({
  onRetry,
  hint,
}: {
  onRetry: () => void;
  hint: string;
}) {
  const t = useT();
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <p className="text-2xl mb-2" aria-hidden>📈</p>
      <p className="text-sm font-semibold text-foreground">{t.analytics.periodNoData}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <Button size="sm" variant="ghost" onClick={onRetry} className="mt-3 text-xs text-muted-foreground">
        {t.analytics.errorRetry}
      </Button>
    </div>
  );
}

function ErrorState({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-foreground">{t.analytics.errorTitle}</p>
      <p className="mt-1 text-xs text-muted-foreground">{msg}</p>
      <Button size="sm" variant="outline" onClick={onRetry} className="mt-3">
        {t.analytics.errorRetry}
      </Button>
    </div>
  );
}

/* ---------- 본체 ---------- */

export default function PeriodReport({ periodType }: PeriodReportProps) {
  const t = useT();
  const { data, loading, error, refresh } = usePeriodReport(periodType);

  const isWeekly = periodType === "week";

  const weakNotes = useMemo((): WeakNoteForChip[] => {
    if (!data) return [];
    return (data.weak_notes_top ?? [])
      .map((w) => ({
        note_key: w.note_key,
        octave: w.octave,
        clef: w.clef,
        attempts: w.attempts,
        error_rate: w.error_rate,
        avg_ms: w.avg_ms,
      }))
      .slice(0, 5);
  }, [data]);

  const headline = useMemo(() => {
    if (!data) return null;
    if (weakNotes.length > 0) {
      const w = weakNotes[0];
      const clefLabel = w.clef === "bass" ? t.analytics.clefBass : t.analytics.clefTreble;
      const noteLabel = `${clefLabel} ${w.note_key}${w.octave}`;
      return formatI18n(
        isWeekly ? t.analytics.periodWeeklyHeadlineWeak : t.analytics.periodMonthlyHeadlineWeak,
        { note: noteLabel },
      );
    }
    return isWeekly
      ? t.analytics.periodWeeklyHeadlineClean
      : t.analytics.periodMonthlyHeadlineClean;
  }, [data, weakNotes, isWeekly, t]);

  const showDelta =
    !!data &&
    data.baseline_accuracy != null &&
    data.overall_accuracy != null;

  const accDelta = showDelta && data
    ? (data.overall_accuracy ?? 0) - (data.baseline_accuracy ?? 0)
    : null;
  const msDelta = showDelta && data && data.avg_reaction_ms != null && data.baseline_avg_reaction_ms != null
    ? data.avg_reaction_ms - data.baseline_avg_reaction_ms
    : null;

  const accDeltaLabel = accDelta == null
    ? undefined
    : `${accDelta >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(accDelta * 100))}%p ${t.analytics.deltaVsBaseline}`;
  const accDeltaTone: "up" | "down" | "neutral" =
    accDelta == null ? "neutral" : accDelta >= 0 ? "up" : "down";

  const msDeltaLabel = msDelta == null
    ? undefined
    : `${msDelta <= 0 ? "▲" : "▼"} ${Math.abs(msDelta / 1000).toFixed(2)}s ${t.analytics.deltaVsBaseline}`;
  const msDeltaTone: "up" | "down" | "neutral" =
    msDelta == null ? "neutral" : msDelta <= 0 ? "up" : "down";

  if (loading) return <Skeleton />;
  if (error) return <ErrorState msg={error} onRetry={() => void refresh()} />;
  if (!data) {
    return (
      <NoDataState
        onRetry={() => void refresh()}
        hint={
          isWeekly
            ? t.analytics.periodWeeklyNoDataHint
            : t.analytics.periodMonthlyNoDataHint
        }
      />
    );
  }

  const eyebrow = isWeekly ? t.analytics.periodWeeklyEyebrow : t.analytics.periodMonthlyEyebrow;
  const weakTitle = isWeekly
    ? t.analytics.periodWeeklyWeakNotesTitle
    : t.analytics.periodMonthlyWeakNotesTitle;

  const activeDaysLabel = data.active_days > 0
    ? formatI18n(t.analytics.periodActiveDays, { n: String(data.active_days) })
    : undefined;

  return (
    <div className="space-y-5">
      {headline && (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground">{eyebrow}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{headline}</p>
          {(data.streak_days ?? 0) > 0 && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              {formatI18n(t.analytics.streakBadge, { n: String(data.streak_days) })}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label={t.analytics.metricAccuracy}
          value={fmtPct(data.overall_accuracy)}
          sub={accDeltaLabel}
          deltaTone={accDeltaTone}
          highlight
        />
        <MetricCard
          label={t.analytics.metricAvgReaction}
          value={fmtMs(data.avg_reaction_ms)}
          sub={msDeltaLabel}
          deltaTone={msDeltaTone}
        />
        <MetricCard
          label={t.analytics.metricTotalAttempts}
          value={data.total_attempts}
          sub={
            activeDaysLabel
              ? `${formatI18n(t.analytics.metricSessions, { n: String(data.sessions_count) })} · ${activeDaysLabel}`
              : formatI18n(t.analytics.metricSessions, { n: String(data.sessions_count) })
          }
        />
      </div>

      {(data.graduated_count > 0 || data.regressed_count > 0) && (
        <div className="flex gap-3">
          {data.graduated_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
              🎓 {formatI18n(t.analytics.periodGraduated, { n: String(data.graduated_count) })}
            </span>
          )}
          {data.regressed_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2.5 py-1 text-[11px] font-medium text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800">
              📉 {formatI18n(t.analytics.periodRegressed, { n: String(data.regressed_count) })}
            </span>
          )}
        </div>
      )}

      {weakNotes.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-foreground mb-2">{weakTitle}</p>
          <div className="flex flex-wrap gap-1.5">
            {weakNotes.map((w, idx) => (
              <WeakNoteChip
                key={`${w.clef}-${w.note_key}-${w.octave}-${idx}`}
                noteKey={w.note_key}
                octave={w.octave}
                clef={w.clef}
                errorRate={w.error_rate}
                attempts={w.attempts}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
