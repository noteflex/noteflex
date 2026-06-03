import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DailyReport, PeriodRollup } from "@/types/analytics";

/** YYYY-MM-DD (KST 기준) — RPC가 KST로 동작하므로 로컬 날짜를 그대로 보냄. */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface UseDailyReportResult {
  data: DailyReport | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 일간 보고서 (오늘 = live, 과거 = rollup).
 * `date` 미지정 시 RPC가 KST 오늘로 처리.
 */
export function useDailyReport(date?: Date): UseDailyReportResult {
  const [data, setData] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p_date = date ? toIsoDate(date) : null;
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_daily_report", { p_date });
      if (rpcErr) throw rpcErr;
      setData((rpcData ?? null) as DailyReport | null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "보고서 로드 실패";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void fetchOnce();
  }, [fetchOnce]);

  return { data, loading, error, refresh: fetchOnce };
}

/** ISO week 시작일(월요일) — KST 기준 로컬 날짜 사용 */
function isoWeekStart(d: Date): string {
  const day = d.getDay(); // 0=일, 1=월 ... 6=토
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

/** 월 시작일 */
function monthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export interface UsePeriodReportResult {
  data: PeriodRollup | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePeriodReport(periodType: "week" | "month"): UsePeriodReportResult {
  const [data, setData] = useState<PeriodRollup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const periodStart = periodType === "week" ? isoWeekStart(now) : monthStart(now);
      const { data: row, error: dbErr } = await supabase
        .from("user_analytics_rollup")
        .select("*")
        .eq("period_type", periodType)
        .eq("period_start", periodStart)
        .maybeSingle();
      if (dbErr) throw dbErr;
      setData((row ?? null) as PeriodRollup | null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "보고서 로드 실패";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [periodType]);

  useEffect(() => {
    void fetchOnce();
  }, [fetchOnce]);

  return { data, loading, error, refresh: fetchOnce };
}
