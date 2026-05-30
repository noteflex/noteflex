import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getUserTier } from "@/lib/subscriptionTier";

/**
 * 음표 약점 점수 1행.
 *
 * `user_note_weak_scores` 테이블에서 가져온 값.
 * - accuracy_score: 0..1 (높을수록 약점)
 * - response_time_score: 0..1 (높을수록 약점)
 * - combined_score: (accuracy_score + response_time_score) * 0.5
 * - sample_size: 30일 윈도우 내 시도 수 (최소 5 이상만 행 존재)
 */
export interface WeakScoreEntry {
  accuracy_score: number;
  response_time_score: number;
  combined_score: number;
  sample_size: number;
}

/**
 * 약점 점수 맵.
 *
 * 키 포맷: `${clef}:${note_key}` (예: "treble:F#4")
 *   - 백엔드 `user_note_weak_scores.note_id` 컬럼을 그대로 사용
 *   - octave 정보가 키에 이미 포함되어 있음
 */
export type WeakScoreMap = Map<string, WeakScoreEntry>;

export interface UseUserWeakScoresReturn {
  /** clef:note_key → WeakScoreEntry. 행 없는 음표는 Map에 없음 */
  weakScoreMap: WeakScoreMap;
  /** 최초 로드 중 */
  isLoading: boolean;
  /** fetch 실패 시 메시지. UI 차단 X (게임은 진행됨) */
  error: string | null;
}

/**
 * 현재 유저의 user_note_weak_scores 데이터를 (level, sublevel) 단위로 읽어서
 * note_id → WeakScoreEntry 맵으로 변환.
 *
 * 동작 규칙:
 * - level=0 (custom_score 모드) → 빈 Map (custom 모드는 약점 가중 미적용)
 * - 비로그인 → 빈 Map
 * - Free·guest 사용자 → 빈 Map (fetch 안 함, 비용 절약)
 * - Premium·admin 사용자 → SELECT 후 맵 변환
 * - error 발생 → console.error + 빈 Map (게임 진행 차단 X)
 *
 * 행이 존재하는 음표만 가중치 적용 대상. 행 없는 음표는 균등 분포.
 */
export function useUserWeakScores(
  level: number,
  sublevel: number,
): UseUserWeakScoresReturn {
  const { user, profile } = useAuth();
  const [weakScoreMap, setWeakScoreMap] = useState<WeakScoreMap>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // level=0 = custom_score 모드 → 약점 가중 미적용
    if (level === 0) {
      setWeakScoreMap(new Map());
      setIsLoading(false);
      setError(null);
      return;
    }

    if (!user) {
      setWeakScoreMap(new Map());
      setIsLoading(false);
      setError(null);
      return;
    }

    // Premium·admin만 fetch (RLS상 Free는 어차피 빈 결과지만 네트워크 비용 절약)
    const tier = getUserTier(user, profile ?? null);
    if (tier !== "pro") {
      setWeakScoreMap(new Map());
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      const { data, error: fetchError } = await supabase
        .from("user_note_weak_scores")
        .select(
          "note_id, accuracy_score, response_time_score, combined_score, sample_size",
        )
        .eq("user_id", user.id)
        .eq("level", level)
        .eq("sublevel", sublevel);

      if (cancelled) return;

      if (fetchError) {
        console.error("[useUserWeakScores] 로드 실패:", fetchError);
        setWeakScoreMap(new Map());
        setError(fetchError.message);
        setIsLoading(false);
        return;
      }

      const map: WeakScoreMap = new Map();
      for (const row of data ?? []) {
        map.set(row.note_id, {
          accuracy_score: row.accuracy_score,
          response_time_score: row.response_time_score,
          combined_score: row.combined_score,
          sample_size: row.sample_size,
        });
      }

      setWeakScoreMap(map);
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, profile, level, sublevel]);

  return { weakScoreMap, isLoading, error };
}

/**
 * 키 조회 유틸: 특정 음표의 약점 점수 조회.
 * 맵에 없으면 undefined (가중치 미적용 → 균등 분포 대상).
 */
export function getWeakScore(
  weakScoreMap: WeakScoreMap,
  clef: "treble" | "bass",
  noteKey: string,
): WeakScoreEntry | undefined {
  return weakScoreMap.get(`${clef}:${noteKey}`);
}
