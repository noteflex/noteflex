import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PeriodRollup, DayRollupRow, WeakNoteRollup } from "@/types/analytics";
import { WEAK_NOTE_GREEN_THRESHOLD, type WeeklyHeadlineKind } from "@/types/analytics";

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

function kstTodayIso(): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

/** KST 오늘 기준 직전 완료 주(지난주 월요일). cron이 채우는 가장 최근 주. */
function latestCompletedWeekStart(): string {
  const today = kstTodayIso();
  const d = parseIso(today);
  const isoDow = d.getDay() === 0 ? 7 : d.getDay();
  const mondayThis = addDays(today, -(isoDow - 1));
  return addDays(mondayThis, -7);
}

interface WeeklyRpcResponse {
  status?: "no_data";
  source: "rollup";
  days?: Array<{
    date: string;
    accuracy: number | null;
    avg_ms: number | null;
    attempts: number;
    sessions: number;
  }>;
  [key: string]: unknown;
}

function rpcToPeriodRollup(res: WeeklyRpcResponse | null): PeriodRollup | null {
  if (!res || res.status === "no_data") return null;
  return res as unknown as PeriodRollup;
}

export interface UseWeeklyReportResult {
  current: PeriodRollup | null;
  prev: PeriodRollup | null;
  dailyRows: DayRollupRow[];
  weekStart: string;
  loading: boolean;
  error: string | null;
  isProLocked: boolean;
  refresh: () => Promise<void>;
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

/**
 * 주간 보고서 (Pro 전용 RPC 호출).
 * - weekStartParam 미지정 시 = 직전 완료 주(지난주 월요일).
 * - prev = weekStart - 7일 (non-fatal).
 * - dailyRows = user_analytics_rollup 직접 SELECT (period_type='day').
 *   사유: get_weekly_report RPC가 일별 per_note를 반환하지 않음 → FocusNotes의
 *   "missed of N days" 라벨 계산을 위해 일간 row만 보조 조회. 일간 row는
 *   기존에도 일간 페이지에서 노출되며, 본인 SELECT RLS로 보호됨.
 */
export function useWeeklyReport(weekStartParam?: string): UseWeeklyReportResult {
  const [current, setCurrent] = useState<PeriodRollup | null>(null);
  const [prev, setPrev] = useState<PeriodRollup | null>(null);
  const [dailyRows, setDailyRows] = useState<DayRollupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProLocked, setIsProLocked] = useState(false);

  const weekStart = useMemo(
    () => weekStartParam ?? latestCompletedWeekStart(),
    [weekStartParam],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsProLocked(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("인증 필요");

      const prevWeek = addDays(weekStart, -7);
      const weekDaysForQuery = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

      const [currRes, prevRes, dailyRes] = await Promise.all([
        supabase.rpc("get_weekly_report", { p_week_start: weekStart }),
        supabase.rpc("get_weekly_report", { p_week_start: prevWeek }),
        supabase
          .from("user_analytics_rollup")
          .select("*")
          .eq("user_id", userId)
          .eq("period_type", "day")
          .in("period_start", weekDaysForQuery),
      ]);

      if (currRes.error) {
        if (currRes.error.message === "pro_required") {
          setIsProLocked(true);
          setCurrent(null);
          setPrev(null);
          setDailyRows([]);
          return;
        }
        throw currRes.error;
      }

      if (prevRes.error) {
        console.warn("[useWeeklyReport] prev-week RPC error (non-fatal):", prevRes.error);
      }
      if (dailyRes.error) {
        console.warn("[useWeeklyReport] daily-rows query error (non-fatal):", dailyRes.error);
      }

      setCurrent(rpcToPeriodRollup(currRes.data as WeeklyRpcResponse | null));
      setPrev(
        prevRes.error
          ? null
          : rpcToPeriodRollup(prevRes.data as WeeklyRpcResponse | null),
      );
      setDailyRows(dailyRes.error ? [] : ((dailyRes.data ?? []) as DayRollupRow[]));
    } catch (e: unknown) {
      console.error("[useWeeklyReport] fatal error:", e);
      setError(e instanceof Error ? e.message : "보고서 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const todayStr = useMemo(() => kstTodayIso(), []);

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
    isProLocked,
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
