import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PeriodRollup, DayRollupRow } from "@/types/analytics";

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

export interface UseWeeklyReportResult {
  current: PeriodRollup | null;
  prev: PeriodRollup | null;
  dailyRows: DayRollupRow[];
  weekStart: string;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
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
      // userId 필터: admin policy가 전체 사용자 행을 반환하므로 명시적으로 자신의 행만 조회
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("인증 필요");

      const now = new Date();
      const thisWeek = isoWeekStart(now);
      const prevWeekDate = new Date(now);
      prevWeekDate.setDate(now.getDate() - 7);
      const lastWeek = isoWeekStart(prevWeekDate);

      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(thisWeek, i));

      // 현재 주 weekly 롤업만 필수 — 직전 주(delta용)·일간 rows(차트용)는 없어도 동작
      const currRes = await supabase
        .from("user_analytics_rollup")
        .select("*")
        .eq("user_id", userId)
        .eq("period_type", "week")
        .eq("period_start", thisWeek)
        .maybeSingle();

      if (currRes.error) throw currRes.error;

      // 직전 주 + 일간 rows: 실패 시 null/빈 배열로 처리 (에러 전파 없음)
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
          .in("period_start", weekDays),
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

  return { current, prev, dailyRows, weekStart, loading, error, refresh: fetchAll };
}
