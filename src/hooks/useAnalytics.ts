import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DailyReport } from "@/types/analytics";

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
