import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MasteryDetail {
  note_key: string; // "F4", "C#5"
  clef: "treble" | "bass";
  total_attempts: number;
  correct_count: number;
  recent_accuracy: number | null; // 0.0 ~ 1.0
  avg_reaction_ms: number | null;
  weakness_flag: boolean;
  mastery_flag: boolean;
  weakness_flagged_at: string | null;
  mastery_flagged_at: string | null;
  last_batch_analyzed_at: string | null;
}

export interface UseMasteryDetailsReturn {
  /** weakness_flag = true 인 음표 (recent_accuracy 오름차순) */
  weaknesses: MasteryDetail[];
  /** mastery_flag = true 인 음표 */
  masters: MasteryDetail[];
  /** 모든 row 중 가장 최신 last_batch_analyzed_at */
  lastAnalyzedAt: Date | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * 현재 유저의 note_mastery 테이블에서 **플래그된** 음표만 상세 정보로 로드.
 *
 * - 성적표/대시보드용 (가중치 출제용은 useUserMastery 사용)
 * - weakness_flag OR mastery_flag = true 인 row만 조회
 * - recent_accuracy ASC NULLS LAST → 약점부터
 */
export function useMasteryDetails(): UseMasteryDetailsReturn {
  const { user } = useAuth();
  const [weaknesses, setWeaknesses] = useState<MasteryDetail[]>([]);
  const [masters, setMasters] = useState<MasteryDetail[]>([]);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) {
      setWeaknesses([]);
      setMasters([]);
      setLastAnalyzedAt(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: dbError } = await supabase
      .from("note_mastery")
      .select(
        "note_key, clef, total_attempts, correct_count, recent_accuracy, avg_reaction_ms, weakness_flag, mastery_flag, weakness_flagged_at, mastery_flagged_at, last_batch_analyzed_at"
      )
      .eq("user_id", userId)
      .or("weakness_flag.eq.true,mastery_flag.eq.true")
      .order("recent_accuracy", { ascending: true, nullsFirst: false });

    if (dbError) {
      setError(dbError.message);
      setWeaknesses([]);
      setMasters([]);
      setLastAnalyzedAt(null);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as MasteryDetail[];

    const w = rows.filter((r) => r.weakness_flag);
    const m = rows.filter((r) => r.mastery_flag);

    let latest: Date | null = null;
    for (const r of rows) {
      if (r.last_batch_analyzed_at) {
        const t = new Date(r.last_batch_analyzed_at);
        if (!Number.isNaN(t.getTime()) && (!latest || t > latest)) {
          latest = t;
        }
      }
    }

    setWeaknesses(w);
    setMasters(m);
    setLastAnalyzedAt(latest);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    weaknesses,
    masters,
    lastAnalyzedAt,
    loading,
    error,
    refresh: load,
  };
}
