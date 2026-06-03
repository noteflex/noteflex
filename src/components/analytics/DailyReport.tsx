import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useDailyReport, useDailyIntervals, type DailyLogRow } from "@/hooks/useAnalytics";
import { useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import MetricCard from "./MetricCard";
import {
  isLive,
  isNoData,
  isRollup,
  normalizeWeakNotes,
  type DailyReport as DailyReportData,
  type SessionSummary,
  type WeakNoteForChip,
} from "@/types/analytics";

interface DailyReportProps {
  /** 기본: 오늘 (RPC KST 처리) */
  date?: Date;
}

/* ---------- 인터벌 버킷 ---------- */

type BucketKey = "repeat" | "step" | "skip" | "leap" | "wide";

interface BucketStat {
  key: BucketKey;
  attempts: number;
  errors: number;
  errorRate: number;
}

const BUCKETS: ReadonlyArray<{ key: BucketKey; min: number; max: number }> = [
  { key: "repeat", min: 0,  max: 0        },
  { key: "step",   min: 1,  max: 2        },
  { key: "skip",   min: 3,  max: 5        },
  { key: "leap",   min: 6,  max: 9        },
  { key: "wide",   min: 10, max: Infinity },
];

function computeBuckets(logs: DailyLogRow[]): BucketStat[] {
  const raw: Record<string, { attempts: number; errors: number }> = {};
  for (const log of logs) {
    if (log.interval_from_prev == null) continue;
    const abs = Math.abs(log.interval_from_prev);
    const bucket = BUCKETS.find((b) => abs >= b.min && abs <= b.max);
    if (!bucket) continue;
    const s = raw[bucket.key] ?? { attempts: 0, errors: 0 };
    s.attempts++;
    if (!log.is_correct) s.errors++;
    raw[bucket.key] = s;
  }
  return BUCKETS.map((b) => {
    const s = raw[b.key] ?? { attempts: 0, errors: 0 };
    return {
      key: b.key,
      attempts: s.attempts,
      errors: s.errors,
      errorRate: s.attempts > 0 ? s.errors / s.attempts : 0,
    };
  });
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
      baselineDays: report.baseline_accuracy != null ? 14 : 0,
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

/* ---------- 약점 음표 강조 카드 ---------- */

function WeakNoteHighlightSection({ notes }: { notes: WeakNoteForChip[] }) {
  const t = useT();
  if (notes.length === 0) return null;
  return (
    <section>
      <p className="text-xs font-semibold text-foreground mb-2">{t.analytics.weakNotesTitle}</p>
      <ul className="space-y-1.5">
        {notes.map((w, idx) => {
          const clefLabel = w.clef === "bass" ? t.analytics.clefBass : t.analytics.clefTreble;
          const accuracy = 1 - w.error_rate;
          const errors = Math.round(w.error_rate * w.attempts);
          const dot =
            accuracy >= 0.75
              ? "bg-emerald-500"
              : accuracy >= 0.5
              ? "bg-amber-400"
              : "bg-red-500";
          return (
            <li
              key={`${w.clef}-${w.note_key}-${w.octave}-${idx}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-foreground">
                  {w.note_key}{w.octave}
                </span>
                <span className="ml-1.5 text-[11px] text-muted-foreground">{clefLabel}</span>
              </div>
              <div className="text-right tabular-nums">
                <p className="text-sm font-semibold text-foreground">{fmtPct(accuracy)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatI18n(t.analytics.weakNoteMissedOf, {
                    errors: String(errors),
                    attempts: String(w.attempts),
                  })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- 인터벌 섹션 ---------- */

function IntervalSection({
  allBuckets,
  loadingLogs,
}: {
  allBuckets: BucketStat[];
  loadingLogs: boolean;
}) {
  const t = useT();
  const qualified = allBuckets.filter((b) => b.attempts >= 5);
  if (loadingLogs || qualified.length < 2) return null;

  const bucketLabel: Record<BucketKey, string> = {
    repeat: t.analytics.intervalBucketRepeat,
    step:   t.analytics.intervalBucketStep,
    skip:   t.analytics.intervalBucketSkip,
    leap:   t.analytics.intervalBucketLeap,
    wide:   t.analytics.intervalBucketWide,
  };

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-semibold text-foreground">{t.analytics.intervalSectionTitle}</p>
        <p className="text-[10px] text-muted-foreground">{t.analytics.intervalSectionNote}</p>
      </div>
      {/* TODO v1.1: normalize bar widths by per-level difficulty */}
      <ul className="space-y-2">
        {qualified.map((b) => {
          const acc = 1 - b.errorRate;
          const barColor =
            acc >= 0.75 ? "bg-emerald-400" : acc >= 0.5 ? "bg-amber-400" : "bg-red-400";
          const pct = Math.round(acc * 100);
          return (
            <li key={b.key}>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="font-medium text-foreground">{bucketLabel[b.key]}</span>
                <span className="tabular-nums text-muted-foreground">
                  {pct}% · {b.attempts}{t.analytics.chipAttemptsUnit}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------- 본체 ---------- */

export default function DailyReport({ date }: DailyReportProps) {
  const t = useT();
  const { data, loading, error, refresh } = useDailyReport(date);
  const { logs, loading: logsLoading } = useDailyIntervals();

  const values = useMemo(() => (data ? pickValues(data) : null), [data]);
  const weakNotes = useMemo(() => normalizeWeakNotes(data, 5), [data]);
  const isLiveData = !!data && isLive(data);

  const allBuckets = useMemo(
    () => (isLiveData ? computeBuckets(logs) : []),
    [isLiveData, logs],
  );
  const qualifiedBuckets = useMemo(
    () => allBuckets.filter((b) => b.attempts >= 5),
    [allBuckets],
  );

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
    const worstNote = weakNotes[0] ?? null;
    const worstBucket =
      qualifiedBuckets.length >= 2
        ? qualifiedBuckets.reduce((a, b) => (b.errorRate > a.errorRate ? b : a), qualifiedBuckets[0])
        : null;

    if (worstNote && worstBucket && worstBucket.errorRate > worstNote.error_rate) {
      const bucketLabels: Record<BucketKey, string> = {
        repeat: t.analytics.intervalBucketRepeat,
        step:   t.analytics.intervalBucketStep,
        skip:   t.analytics.intervalBucketSkip,
        leap:   t.analytics.intervalBucketLeap,
        wide:   t.analytics.intervalBucketWide,
      };
      return formatI18n(t.analytics.takeawayIntervalWeak, { bucket: bucketLabels[worstBucket.key] });
    }
    if (worstNote) {
      const clefLabel = worstNote.clef === "bass" ? t.analytics.clefBass : t.analytics.clefTreble;
      return formatI18n(t.analytics.headlineWeak, {
        note: `${clefLabel} ${worstNote.note_key}${worstNote.octave}`,
      });
    }
    return t.analytics.headlineClean;
  }, [data, weakNotes, qualifiedBuckets, t]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorState msg={error} onRetry={() => void refresh()} />;
  if (!data || isNoData(data)) return <GraceState />;
  if (!values) return <GraceState />;
  if (values.totalAttempts === 0 && values.sessions.length === 0) return <GraceState />;

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

      <WeakNoteHighlightSection notes={weakNotes} />

      {isLiveData && (
        <IntervalSection allBuckets={allBuckets} loadingLogs={logsLoading} />
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
