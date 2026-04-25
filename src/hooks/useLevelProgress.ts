import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SublevelProgress, Sublevel } from "@/lib/levelSystem";

export interface RecordAttemptResult {
  level: number;
  sublevel: number;
  play_count: number;
  total_attempts: number;
  total_correct: number;
  accuracy: number;
  best_streak: number;
  passed: boolean;
  /** 이번 호출로 처음 통과 (false→true 순간) */
  just_passed: boolean;
}

/**
 * 사용자의 21단계 진도 관리 훅.
 *
 * - fetchProgress: DB에서 현재 사용자의 모든 단계 진도 조회
 * - recordAttempt: 게임 종료 시 호출. RPC 함수 record_sublevel_attempt 호출 후 자동 refetch
 * - getProgressFor: 특정 단계 진도 조회 (없으면 null)
 */
export function useLevelProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<SublevelProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!user) {
      setProgress([]);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from("user_sublevel_progress")
      .select(
        "level, sublevel, play_count, best_streak, total_attempts, total_correct, passed"
      )
      .eq("user_id", user.id);

    if (fetchError) {
      console.error("[useLevelProgress] fetch failed:", fetchError);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setProgress((data ?? []) as SublevelProgress[]);
    setLoading(false);
  }, [user]);

  const recordAttempt = useCallback(
    async (
      level: number,
      sublevel: Sublevel,
      attempts: number,
      correct: number,
      maxStreak: number,
      gameStatus: "success" | "gameover"
    ): Promise<RecordAttemptResult | null> => {
      if (!user) return null;

      const { data, error: rpcError } = await supabase.rpc(
        "record_sublevel_attempt",
        {
          p_level: level,
          p_sublevel: sublevel,
          p_attempts: attempts,
          p_correct: correct,
          p_max_streak: maxStreak,
          p_game_status: gameStatus,
        }
      );

      if (rpcError) {
        console.error("[useLevelProgress] recordAttempt failed:", rpcError);
        setError(rpcError.message);
        return null;
      }

      // 성공 시 로컬 progress 다시 fetch (자동 unlock된 다음 단계도 반영)
      await fetchProgress();

      return data as RecordAttemptResult;
    },
    [user, fetchProgress]
  );

  const getProgressFor = useCallback(
    (level: number, sublevel: Sublevel): SublevelProgress | null => {
      return (
        progress.find((p) => p.level === level && p.sublevel === sublevel) ??
        null
      );
    },
    [progress]
  );

  // 마운트 시 / user 변경 시 자동 fetch
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    progress,
    loading,
    error,
    fetchProgress,
    recordAttempt,
    getProgressFor,
  };
}