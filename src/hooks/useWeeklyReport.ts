import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PeriodRollup, DayRollupRow, WeakNoteRollup } from "@/types/analytics";
import { WEAK_NOTE_GREEN_THRESHOLD, type WeeklyHeadlineKind } from "@/types/analytics";

function isoWeekStart(d: Date): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface UseWeeklyReportResult {
  // raw
  current: PeriodRollup | null;
  prev: PeriodRollup | null;
  dailyRows: DayRollupRow[];
  weekStart: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  // derived
  headlineKind: WeeklyHeadlineKind;
  headlineDeltaPp: number;
  accuracyDeltaPp: number | null;
  reactionDeltaMs: number | null;
  streakDays: number;
  focusNotes: WeakNoteRollup[];
  topFocusNote: WeakNoteRollup | null;
  activeDayCount: number;
  activeDayIndices: Set<number>;
  todayIndex: number;
  weekDays: string[];
  todayStr: string;
}

export function useWeeklyReport(): UseWeeklyReportResult {
  const [current, setCurrent] = useState<PeriodRollup | null>(null);
  const [prev, setPrev] = useState<PeriodRollup | null>(null);
  const [dailyRows, setDailyRows] = useState<DayRollupRow[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("인증 필요");

      const now = new Date();
      const thisWeek = isoWeekStart(now);
      const prevWeekDate = new Date(now);
      prevWeekDate.setDate(now.getDate() - 7);
      const lastWeek = isoWeekStart(prevWeekDate);
      const weekDaysForQuery = Array.from({ length: 7 }, (_, i) => addDays(thisWeek, i));

      const currRes = await supabase
        .from("user_analytics_rollup")
        .select("*")
        .eq("user_id", userId)
        .eq("period_type", "week")
        .eq("period_start", thisWeek)
        .maybeSingle();

      if (currRes.error) throw currRes.error;

      const [prevRes, dailyRes] = await Promise.all([
        supabase
          .from("user_analytics_rollup")
          .select("*")
          .eq("user_id", userId)
          .eq("period_type", "week")
          .eq("period_start", lastWeek)
          .maybeSingle(),
        supabase
          .from("user_analytics_rollup")
          .select("*")
          .eq("user_id", userId)
          .eq("period_type", "day")
          .in("period_start", weekDaysForQuery),
      ]);

      if (prevRes.error) {
        console.warn("[useWeeklyReport] prev-week query error (non-fatal):", prevRes.error);
      }
      if (dailyRes.error) {
        console.warn("[useWeeklyReport] daily-rows query error (non-fatal):", dailyRes.error);
      }

      setWeekStart(thisWeek);
      setCurrent((currRes.data ?? null) as PeriodRollup | null);
      setPrev(prevRes.error ? null : (prevRes.data ?? null) as PeriodRollup | null);
      setDailyRows(dailyRes.error ? [] : (dailyRes.data ?? []) as DayRollupRow[]);
    } catch (e: unknown) {
      console.error("[useWeeklyReport] fatal error:", e);
      setError(e instanceof Error ? e.message : "보고서 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const todayStr = useMemo(() => toIsoDate(new Date()), []);

  const weekDays = useMemo(
    () => (weekStart ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : []),
    [weekStart],
  );

  const todayIndex = useMemo(() => weekDays.indexOf(todayStr), [weekDays, todayStr]);

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

  // Longest consecutive active-day run from weekStart to today (inclusive).
  // Future days are excluded.
  const streakDays = useMemo(() => {
    const cap = todayIndex >= 0 ? todayIndex : weekDays.length - 1;
    let max = 0;
    let cur = 0;
    for (let i = 0; i <= cap; i++) {
      if (activeDayIndices.has(i)) {
        if (++cur > max) max = cur;
      } else {
        cur = 0;
      }
    }
    return max;
  }, [activeDayIndices, todayIndex, weekDays.length]);

  // Accuracy < WEAK_NOTE_GREEN_THRESHOLD, sorted weakest-first (highest error_rate first)
  const focusNotes = useMemo(() => {
    const raw = (current?.weak_notes_top as WeakNoteRollup[] | null) ?? [];
    return raw
      .filter((n) => 1 - n.error_rate < WEAK_NOTE_GREEN_THRESHOLD)
      .sort((a, b) => b.error_rate - a.error_rate)
      .slice(0, 5);
  }, [current]);

  const topFocusNote = useMemo(() => focusNotes[0] ?? null, [focusNotes]);

  const accuracyDeltaPp = useMemo(() => {
    if (current?.overall_accuracy == null || prev?.overall_accuracy == null) return null;
    return (current.overall_accuracy - prev.overall_accuracy) * 100;
  }, [current, prev]);

  const reactionDeltaMs = useMemo(() => {
    if (current?.avg_reaction_ms == null || prev?.avg_reaction_ms == null) return null;
    return current.avg_reaction_ms - prev.avg_reaction_ms;
  }, [current, prev]);

  // Headline: based on week-over-week accuracy delta (single source of truth)
  const headlineKind = useMemo<WeeklyHeadlineKind>(() => {
    if (!current || current.total_attempts === 0) return "nodata";
    if (accuracyDeltaPp == null) return "grace";
    if (accuracyDeltaPp >= 1) return "up";
    if (accuracyDeltaPp <= -1) return "down";
    return "same";
  }, [current, accuracyDeltaPp]);

  const headlineDeltaPp = useMemo(
    () => (accuracyDeltaPp != null ? Math.round(Math.abs(accuracyDeltaPp)) : 0),
    [accuracyDeltaPp],
  );

  return {
    current,
    prev,
    dailyRows,
    weekStart,
    loading,
    error,
    refresh: fetchAll,
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
  };
}
