import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SublevelProgress, Sublevel } from "@/lib/levelSystem";
import { logger } from "@/lib/sentry";

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
  /** 패스트트랙 조건 충족 → 즉시 통과 */
  fast_track?: boolean;
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
        "level, sublevel, play_count, best_streak, total_attempts, total_correct, passed, avg_reaction_ratio, recent_plays, fast_track"
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
      gameStatus: "success" | "gameover",
      avgReactionRatio?: number
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
          p_avg_reaction_ratio: avgReactionRatio ?? null,
        }
      );

      if (rpcError) {
        logger.error("Sublevel 진행 박지 X", rpcError, {
          description: `Lv ${level}-${sublevel} 게임 종료 후 record_sublevel_attempt RPC 실패`,
          cause: rpcError.message,
          impact: "레벨 잠금 해제 박지 X — 사용자 다음 단계 진행 차단",
          action: "useLevelProgress.ts:72 영역 확인",
          metadata: {
            level,
            sublevel,
            attempts,
            correct,
            max_streak: maxStreak,
            avg_reaction_ratio: avgReactionRatio,
            game_status: gameStatus,
          },
        });
        setError(rpcError.message);
        return null;
      }

      // 성공 시 로컬 progress 다시 fetch (자동 unlock된 다음 단계도 반영)
      await fetchProgress();

      const result = data as RecordAttemptResult;
      // 통과 박힌 영역 박은 영역 (just_passed=true → 다음 sublevel 자동 잠금 해제 박음)
      if (result?.just_passed) {
        logger.info("레벨 통과", {
          description: `Lv ${level}-${sublevel} 통과 박음 — 다음 sublevel 자동 잠금 해제`,
          user_id: user.id,
          level,
          sublevel,
          play_count: result.play_count,
          accuracy: result.accuracy,
          best_streak: result.best_streak,
          fast_track: result.fast_track ?? false,
        });
      }
      return result;
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