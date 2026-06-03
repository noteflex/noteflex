import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  PeriodRollup,
  DayRollupRow,
  WeakNoteRollup,
  PerNote,
  GraduatedNoteEntry,
  PersistentWeakNote,
  CalendarBucket,
  MonthlyHeadlineKind,
} from "@/types/analytics";
import {
  WEAK_NOTE_GREEN_THRESHOLD,
  CALENDAR_MEDIUM_THRESHOLD,
  CALENDAR_DARK_THRESHOLD,
  WEEKLY_VOLUME_MEDIUM_THRESHOLD,
  WEEKLY_VOLUME_HIGH_THRESHOLD,
} from "@/types/analytics";

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Parse YYYY-MM-DD as local date (never UTC) to avoid timezone shift.
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthStartOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function prevMonthStartOf(d: Date): string {
  const m = d.getMonth();
  if (m === 0) return `${d.getFullYear() - 1}-12-01`;
  return `${d.getFullYear()}-${String(m).padStart(2, "0")}-01`;
}

function daysInMonthOf(yearMonthDay: string): number {
  const y = parseInt(yearMonthDay.slice(0, 4));
  const m = parseInt(yearMonthDay.slice(5, 7));
  return new Date(y, m, 0).getDate();
}

export interface CalendarDay {
  date: string;
  bucket: CalendarBucket;
}

export interface WeeklyChartPoint {
  week: string;
  accuracy: number | null;
  totalAttempts: number;
}

export interface UseMonthlyReportResult {
  current: PeriodRollup | null;
  prev: PeriodRollup | null;
  dayRows: DayRollupRow[];
  weekRows: PeriodRollup[];
  monthStart: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  headlineKind: MonthlyHeadlineKind;
  headlineDeltaPp: number;
  accuracyDeltaPp: number | null;
  reactionDeltaMs: number | null;
  activeDayCount: number;
  elapsedDays: number;
  daysInMonth: number;
  longestStreak: number;
  graduatedNotes: GraduatedNoteEntry[];
  persistentWeakNotes: PersistentWeakNote[];
  calendarDays: CalendarDay[];
  monthFirstDayOffset: number;
  weeklyChartData: WeeklyChartPoint[];
  isGrace: boolean;
  todayStr: string;
}

export function useMonthlyReport(): UseMonthlyReportResult {
  const [current, setCurrent] = useState<PeriodRollup | null>(null);
  const [prev, setPrev] = useState<PeriodRollup | null>(null);
  const [dayRows, setDayRows] = useState<DayRollupRow[]>([]);
  const [weekRows, setWeekRows] = useState<PeriodRollup[]>([]);
  const [monthStart, setMonthStart] = useState("");
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
      const mStart = monthStartOf(now);
      const mPrev = prevMonthStartOf(now);
      const dim = daysInMonthOf(mStart);
      const mEnd = addDays(mStart, dim - 1);
      const weekQueryStart = addDays(mStart, -6); // weeks that may partially overlap month start

      const currRes = await supabase
        .from("user_analytics_rollup")
        .select("*")
        .eq("user_id", userId)
        .eq("period_type", "month")
        .eq("period_start", mStart)
        .maybeSingle();

      if (currRes.error) throw currRes.error;

      const [prevRes, dayRes, weekRes] = await Promise.all([
        supabase
          .from("user_analytics_rollup")
          .select("*")
          .eq("user_id", userId)
          .eq("period_type", "month")
          .eq("period_start", mPrev)
          .maybeSingle(),
        supabase
          .from("user_analytics_rollup")
          .select("*")
          .eq("user_id", userId)
          .eq("period_type", "day")
          .gte("period_start", mStart)
          .lte("period_start", mEnd),
        supabase
          .from("user_analytics_rollup")
          .select("*")
          .eq("user_id", userId)
          .eq("period_type", "week")
          .gte("period_start", weekQueryStart)
          .lte("period_start", mEnd)
          .order("period_start", { ascending: true }),
      ]);

      if (prevRes.error) {
        console.warn("[useMonthlyReport] prev-month query error (non-fatal):", prevRes.error);
      }
      if (dayRes.error) {
        console.warn("[useMonthlyReport] day-rows query error (non-fatal):", dayRes.error);
      }
      if (weekRes.error) {
        console.warn("[useMonthlyReport] week-rows query error (non-fatal):", weekRes.error);
      }

      setMonthStart(mStart);
      setCurrent((currRes.data ?? null) as PeriodRollup | null);
      setPrev(prevRes.error ? null : (prevRes.data ?? null) as PeriodRollup | null);
      setDayRows(dayRes.error ? [] : (dayRes.data ?? []) as DayRollupRow[]);
      setWeekRows(weekRes.error ? [] : (weekRes.data ?? []) as PeriodRollup[]);
    } catch (e: unknown) {
      console.error("[useMonthlyReport] fatal error:", e);
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

  const daysInMonth = useMemo(
    () => (monthStart ? daysInMonthOf(monthStart) : 0),
    [monthStart],
  );

  const accuracyDeltaPp = useMemo(() => {
    if (current?.overall_accuracy == null || prev?.overall_accuracy == null) return null;
    return (current.overall_accuracy - prev.overall_accuracy) * 100;
  }, [current, prev]);

  const reactionDeltaMs = useMemo(() => {
    if (current?.avg_reaction_ms == null || prev?.avg_reaction_ms == null) return null;
    return current.avg_reaction_ms - prev.avg_reaction_ms;
  }, [current, prev]);

  const headlineKind = useMemo<MonthlyHeadlineKind>(() => {
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

  const activeDayCount = useMemo(
    () => dayRows.filter((r) => r.period_start <= todayStr).length,
    [dayRows, todayStr],
  );

  const elapsedDays = useMemo(() => {
    if (!monthStart || daysInMonth === 0) return 1;
    const monthEndStr = addDays(monthStart, daysInMonth - 1);
    const cap = todayStr < monthEndStr ? todayStr : monthEndStr;
    const startMs = parseLocalDate(monthStart).getTime();
    const capMs = parseLocalDate(cap).getTime();
    return Math.max(1, Math.round((capMs - startMs) / 86_400_000) + 1);
  }, [monthStart, daysInMonth, todayStr]);

  const longestStreak = useMemo(() => {
    if (!monthStart || daysInMonth === 0) return 0;
    const activeDates = new Set(dayRows.map((r) => r.period_start));
    let max = 0;
    let cur = 0;
    for (let i = 0; i < daysInMonth; i++) {
      const d = addDays(monthStart, i);
      if (d > todayStr) break;
      if (activeDates.has(d)) {
        if (++cur > max) max = cur;
      } else {
        cur = 0;
      }
    }
    return max;
  }, [dayRows, monthStart, daysInMonth, todayStr]);

  const graduatedNotes = useMemo((): GraduatedNoteEntry[] => {
    type RawGrad = { note_key: string; octave: number; clef: "treble" | "bass" };
    const raw = (current?.graduated_notes as RawGrad[] | null) ?? [];
    const prevWeak = (prev?.weak_notes_top as WeakNoteRollup[] | null) ?? [];
    const currPerNote = (current?.per_note as PerNote[] | null) ?? [];

    return raw.map((entry) => {
      const prevMatch = prevWeak.find(
        (w) => w.note_key === entry.note_key && w.octave === entry.octave && w.clef === entry.clef,
      );
      const currMatch = currPerNote.find(
        (p) => p.note_key === entry.note_key && p.octave === entry.octave && p.clef === entry.clef,
      );
      return {
        note_key: entry.note_key,
        octave: entry.octave,
        clef: entry.clef,
        prevAccuracy: prevMatch != null ? 1 - prevMatch.error_rate : null,
        currAccuracy: currMatch?.accuracy ?? null,
      };
    });
  }, [current, prev]);

  const persistentWeakNotes = useMemo((): PersistentWeakNote[] => {
    const totalWeeks = weekRows.length;
    if (totalWeeks === 0) return [];

    const noteMap = new Map<string, { count: number; lastErrorRate: number; note: WeakNoteRollup }>();

    for (const row of weekRows) {
      const weakNotes = (row.weak_notes_top as WeakNoteRollup[] | null) ?? [];
      for (const note of weakNotes) {
        if (1 - note.error_rate >= WEAK_NOTE_GREEN_THRESHOLD) continue;
        const key = `${note.note_key}-${note.octave}-${note.clef}`;
        const existing = noteMap.get(key);
        if (existing) {
          existing.count++;
          existing.lastErrorRate = note.error_rate;
        } else {
          noteMap.set(key, { count: 1, lastErrorRate: note.error_rate, note });
        }
      }
    }

    return Array.from(noteMap.values())
      .filter((v) => v.count >= 2)
      .map((v) => ({
        note_key: v.note.note_key,
        octave: v.note.octave,
        clef: v.note.clef,
        accuracy: 1 - v.lastErrorRate,
        weeksCount: v.count,
        totalWeeks,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [weekRows]);

  const calendarDays = useMemo((): CalendarDay[] => {
    if (!monthStart || daysInMonth === 0) return [];
    const attemptsMap = new Map(dayRows.map((r) => [r.period_start, r.total_attempts ?? 0]));
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = addDays(monthStart, i);
      const attempts = attemptsMap.get(date) ?? 0;
      let bucket: CalendarBucket = 0;
      if (attempts >= CALENDAR_DARK_THRESHOLD) bucket = 3;
      else if (attempts >= CALENDAR_MEDIUM_THRESHOLD) bucket = 2;
      else if (attempts > 0) bucket = 1;
      return { date, bucket };
    });
  }, [dayRows, monthStart, daysInMonth]);

  // Mon-first offset: 0=Mon, 1=Tue, ..., 6=Sun
  // (getDay()+6)%7 converts JS Sunday=0 to Mon-first 0-6.
  const monthFirstDayOffset = useMemo(() => {
    if (!monthStart) return 0;
    const [y, m] = monthStart.split("-").map(Number);
    return (new Date(y, m - 1, 1).getDay() + 6) % 7;
  }, [monthStart]);

  const weeklyChartData = useMemo((): WeeklyChartPoint[] => {
    return weekRows.map((row, idx) => ({
      week: `W${idx + 1}`,
      accuracy: row.overall_accuracy != null ? Math.round(row.overall_accuracy * 100) : null,
      totalAttempts: row.total_attempts ?? 0,
    }));
  }, [weekRows]);

  const isGrace = useMemo(
    () => prev == null && current != null && current.total_attempts > 0,
    [prev, current],
  );

  return {
    current,
    prev,
    dayRows,
    weekRows,
    monthStart,
    loading,
    error,
    refresh: fetchAll,
    headlineKind,
    headlineDeltaPp,
    accuracyDeltaPp,
    reactionDeltaMs,
    activeDayCount,
    elapsedDays,
    daysInMonth,
    longestStreak,
    graduatedNotes,
    persistentWeakNotes,
    calendarDays,
    monthFirstDayOffset,
    weeklyChartData,
    isGrace,
    todayStr,
  };
}
