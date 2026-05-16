import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { fetchUserNoteLogs, type UserNoteLogRecord } from "@/lib/userNoteLogs";
import InfoTooltip from "@/components/ui/info-tooltip";

interface NoteStat {
  /** "C4", "F#3" 영역 박힘 — note_key + octave 통합 */
  noteKey: string;
  total: number;
  correct: number;
  accuracy: number;
  avgTime: number;
}

const MIN_SAMPLES = 5;
const TOP_N = 5;

function aggregate(logs: UserNoteLogRecord[]): NoteStat[] {
  const map = new Map<string, { total: number; correct: number; times: number[] }>();
  for (const log of logs) {
    const k = `${log.note_key}${log.octave}`;
    const entry = map.get(k) || { total: 0, correct: 0, times: [] };
    entry.total++;
    if (log.is_correct) entry.correct++;
    if (log.response_time != null) entry.times.push(log.response_time);
    map.set(k, entry);
  }
  return Array.from(map.entries()).map(([noteKey, v]) => ({
    noteKey,
    total: v.total,
    correct: v.correct,
    accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    avgTime: v.times.length > 0
      ? +(v.times.reduce((a, b) => a + b, 0) / v.times.length).toFixed(1)
      : 0,
  }));
}

interface WeakSlowNotesCardsProps {
  /** false면 hooks만 박고 렌더링 X (신규 사용자 영역) */
  enabled?: boolean;
}

/**
 * 약점/느린 음표 Top 5 카드 (대시보드 미니멀 영역).
 * - 옥타브 정확 표시: C4, F#3 등
 * - Top 1 = 빨강, Top 2~5 = 노랑
 * - 5+ 시도 영역만 박음
 */
export function WeakSlowNotesCards({ enabled = true }: WeakSlowNotesCardsProps) {
  const { user } = useAuth();
  const t = useT();
  const [logs, setLogs] = useState<UserNoteLogRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !user) return;
    let cancelled = false;
    setLoading(true);
    fetchUserNoteLogs(500).then(({ data }) => {
      if (cancelled) return;
      setLogs(data ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, user]);

  if (!enabled || !user) return null;
  if (loading) return null;

  const stats = aggregate(logs);
  // 5+ 시도 영역만 박음 (정책)
  const eligible = stats.filter((s) => s.total >= MIN_SAMPLES);

  const weakest = [...eligible]
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, TOP_N);
  const slowest = [...eligible]
    .filter((s) => s.avgTime > 0)
    .sort((a, b) => b.avgTime - a.avgTime)
    .slice(0, TOP_N);

  if (weakest.length === 0 && slowest.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {weakest.length > 0 && (
        <WeakestList items={weakest} t={t} />
      )}
      {slowest.length > 0 && (
        <SlowestList items={slowest} t={t} />
      )}
    </div>
  );
}

function getColorClass(idx: number): { text: string; bar: string } {
  if (idx === 0) {
    return {
      text: "text-red-600 dark:text-red-400",
      bar: "bg-red-500 dark:bg-red-600",
    };
  }
  return {
    text: "text-yellow-600 dark:text-yellow-500",
    bar: "bg-yellow-400 dark:bg-yellow-500",
  };
}

function WeakestList({
  items,
  t,
}: {
  items: NoteStat[];
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center">
        {t.diagnosis.weakestNotesTitle}
        <InfoTooltip content={t.diagnosis.weakestNotesTooltip} />
      </h3>
      <div className="flex flex-col gap-2">
        {items.map((w, i) => {
          const c = getColorClass(i);
          return (
            <div key={w.noteKey} className="flex items-center gap-3">
              <span className="text-xs w-5 text-muted-foreground">#{i + 1}</span>
              <span className={`font-mono font-bold text-sm w-12 ${c.text}`}>
                {w.noteKey}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${c.bar}`}
                  style={{ width: `${w.accuracy}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
                {w.accuracy}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlowestList({
  items,
  t,
}: {
  items: NoteStat[];
  t: ReturnType<typeof useT>;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center">
        {t.diagnosis.slowestNotesTitle}
        <InfoTooltip content={t.diagnosis.slowestNotesTooltip} />
      </h3>
      <div className="flex flex-col gap-2">
        {items.map((s, i) => {
          const c = getColorClass(i);
          return (
            <div key={s.noteKey} className="flex items-center gap-3">
              <span className="text-xs w-5 text-muted-foreground">#{i + 1}</span>
              <span className={`font-mono font-bold text-sm w-12 ${c.text}`}>
                {s.noteKey}
              </span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${c.bar}`}
                  style={{ width: `${Math.min((s.avgTime / 7) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-14 text-right tabular-nums">
                {s.avgTime}{t.diagnosis.secondsSuffix}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
