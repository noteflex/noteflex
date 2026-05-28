import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useDailyReport } from "@/hooks/useAnalytics";
import { useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import MetricCard from "./MetricCard";
import WeakNoteChip from "./WeakNoteChip";
import {
  isLive,
  isNoData,
  isRollup,
  normalizeWeakNotes,
  type DailyReport as DailyReportData,
  type SessionSummary,
} from "@/types/analytics";

interface DailyReportProps {
  /** 기본: 오늘 (RPC KST 처리) */
  date?: Date;
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

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function pickValues(report: DailyReportData):
  | {
      totalAttempts: number;
      accuracy: number | null;
      avgMs: number | null;
      sessions: SessionSummary[];
      streak: number;
      baselineAccuracy: number | null;
      baselineAvgMs: number | null;
      baselineDays: number;
    }
  | null {
  if (isNoData(report)) return null;
  if (isLive(report)) {
    return {
      totalAttempts: report.total_attempts ?? 0,
      accuracy: report.overall_accuracy,
      avgMs: report.avg_reaction_ms,
      sessions: report.sessions ?? [],
      streak: report.streak_days ?? 0,
      baselineAccuracy: report.baseline_accuracy,
      baselineAvgMs: report.baseline_avg_reaction_ms,
      baselineDays: report.baseline_days ?? 0,
    };
  }
  if (isRollup(report)) {
    return {
      totalAttempts: report.total_attempts ?? 0,
      accuracy: report.overall_accuracy,
      avgMs: report.avg_reaction_ms,
      sessions: report.sessions ?? [],
      streak: report.streak_days ?? 0,
      baselineAccuracy: report.baseline_accuracy,
      baselineAvgMs: report.baseline_avg_reaction_ms,
      baselineDays: 14,
    };
  }
  return null;
}

/* ---------- 상태 표시 컴포넌트 ---------- */

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-5 w-2/3 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg"
          />
        ))}
      </div>
      <div className="h-24 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="h-16 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>
  );
}

function GraceState() {
  const t = useT();
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <p className="text-2xl mb-2" aria-hidden>🎵</p>
      <p className="text-sm font-semibold text-foreground">{t.analytics.graceTitle}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t.analytics.graceBody}</p>
      <Button asChild size="sm" className="mt-4">
        <a href="/play">{t.analytics.graceCta}</a>
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

export default function DailyReport({ date }: DailyReportProps) {
  const t = useT();
  const { data, loading, error, refresh } = useDailyReport(date);

  const values = useMemo(() => (data ? pickValues(data) : null), [data]);
  const weakNotes = useMemo(() => normalizeWeakNotes(data, 5), [data]);

  const showDelta = !!values && values.baselineDays >= 3;
  const accDelta =
    showDelta && values && values.accuracy != null && values.baselineAccuracy != null
      ? values.accuracy - values.baselineAccuracy
      : null;
  const msDelta =
    showDelta && values && values.avgMs != null && values.baselineAvgMs != null
      ? values.avgMs - values.baselineAvgMs
      : null;

  const headline = useMemo(() => {
    if (!data || isNoData(data)) return null;
    if (weakNotes.length > 0) {
      const w = weakNotes[0];
      const clefLabel = w.clef === "bass" ? t.analytics.clefBass : t.analytics.clefTreble;
      return formatI18n(t.analytics.headlineWeak, { note: `${clefLabel} ${w.note_key}${w.octave}` });
    }
    return t.analytics.headlineClean;
  }, [data, weakNotes, t]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorState msg={error} onRetry={() => void refresh()} />;
  if (!data || isNoData(data)) return <GraceState />;
  if (!values) return <GraceState />;

  if (values.totalAttempts === 0 && values.sessions.length === 0) {
    return <GraceState />;
  }

  const accDeltaLabel =
    accDelta == null
      ? undefined
      : `${accDelta >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(accDelta * 100))}%p ${t.analytics.deltaVsBaseline}`;
  const accDeltaTone: "up" | "down" | "neutral" =
    accDelta == null ? "neutral" : accDelta >= 0 ? "up" : "down";

  const msDeltaLabel =
    msDelta == null
      ? undefined
      : `${msDelta <= 0 ? "▲" : "▼"} ${Math.abs(msDelta / 1000).toFixed(2)}s ${t.analytics.deltaVsBaseline}`;
  const msDeltaTone: "up" | "down" | "neutral" =
    msDelta == null ? "neutral" : msDelta <= 0 ? "up" : "down";

  return (
    <div className="space-y-5">
      {headline && (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[11px] text-muted-foreground">{t.analytics.headlineEyebrow}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{headline}</p>
          {values.streak > 0 && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              {formatI18n(t.analytics.streakBadge, { n: String(values.streak) })}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label={t.analytics.metricAccuracy}
          value={fmtPct(values.accuracy)}
          sub={accDeltaLabel}
          deltaTone={accDeltaTone}
          highlight
        />
        <MetricCard
          label={t.analytics.metricAvgReaction}
          value={fmtMs(values.avgMs)}
          sub={msDeltaLabel}
          deltaTone={msDeltaTone}
        />
        <MetricCard
          label={t.analytics.metricTotalAttempts}
          value={values.totalAttempts}
          sub={formatI18n(t.analytics.metricSessions, { n: String(values.sessions.length) })}
        />
      </div>

      {weakNotes.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-foreground mb-2">{t.analytics.weakNotesTitle}</p>
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

      {values.sessions.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-foreground mb-2">{t.analytics.sessionsTitle}</p>
          <ul className="space-y-1.5">
            {values.sessions.map((s) => {
              const acc = s.accuracy != null ? `${Math.round(s.accuracy * 100)}%` : "—";
              const ms = s.avg_reaction_ms != null ? `${(s.avg_reaction_ms / 1000).toFixed(2)}s` : "—";
              const range = `${fmtTime(s.started_at)} – ${fmtTime(s.ended_at)}`;
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground tabular-nums">{range}</span>
                  <span className="flex items-center gap-3 tabular-nums">
                    <span>
                      <span className="text-muted-foreground">{t.analytics.sessionAccLabel}</span>{" "}
                      <span className="font-semibold text-foreground">{acc}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">{t.analytics.sessionSpeedLabel}</span>{" "}
                      <span className="font-semibold text-foreground">{ms}</span>
                    </span>
                    <span>
                      <span className="text-muted-foreground">{t.analytics.sessionAttemptsLabel}</span>{" "}
                      <span className="font-semibold text-foreground">{s.total_notes ?? 0}</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
