import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BatchRun {
  id: string;
  run_date: string; // YYYY-MM-DD
  users_analyzed: number;
  weakness_flagged: number;
  mastery_flagged: number;
  weakness_released: number;
  premium_expired: number;
  duration_ms: number;
  status: "success" | "partial" | "failed";
  error_message: string | null;
  created_at: string;
}

export interface BatchSummary {
  totalRuns: number;
  successCount: number;
  failedCount: number;
  last7DaysAvgDurationMs: number;
  lastRunStatus: "success" | "partial" | "failed" | null;
  lastRunDate: string | null;
}

export interface UseBatchRunsReturn {
  runs: BatchRun[];
  summary: BatchSummary;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** 관리자 수동 실행 */
  triggerManualRun: () => Promise<{ success: boolean; message: string }>;
}

/**
 * 최근 30일 배치 실행 이력 + 요약 통계 로드.
 * 관리자 페이지에서만 사용.
 */
export function useBatchRuns(): UseBatchRunsReturn {
  const [runs, setRuns] = useState<BatchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error: dbError } = await supabase
      .from("daily_batch_runs")
      .select("*")
      .gte("run_date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("run_date", { ascending: false });

    if (dbError) {
      setError(dbError.message);
      setRuns([]);
    } else {
      setRuns((data ?? []) as BatchRun[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary: BatchSummary = {
    totalRuns: runs.length,
    successCount: runs.filter((r) => r.status === "success").length,
    failedCount: runs.filter((r) => r.status === "failed").length,
    last7DaysAvgDurationMs: (() => {
      const last7 = runs.slice(0, 7).filter((r) => r.status === "success");
      if (last7.length === 0) return 0;
      return Math.round(
        last7.reduce((sum, r) => sum + r.duration_ms, 0) / last7.length
      );
    })(),
    lastRunStatus: runs[0]?.status ?? null,
    lastRunDate: runs[0]?.run_date ?? null,
  };

  const triggerManualRun = useCallback(async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    const { data, error: rpcError } = await supabase.rpc(
      "run_daily_batch_analysis"
    );

    if (rpcError) {
      return { success: false, message: rpcError.message };
    }
    if (!data) {
      return {
        success: false,
        message: "오늘 이미 배치가 실행됨 (재실행하려면 DB에서 직접 제거)",
      };
    }
    await load();
    return { success: true, message: `실행 완료 (run_id: ${data})` };
  }, [load]);

  return { runs, summary, loading, error, reload: load, triggerManualRun };
}
