import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 음표 마스터리 플래그 맵.
 *
 * 키 포맷: `${clef}:${note_key}` (예: "treble:F4", "bass:C3")
 *   - note_key는 note_mastery 테이블의 note_key 컬럼 그대로 ("F4", "C#5" 등)
 *   - octave 정보가 이미 note_key에 포함되어 있음
 */
export type MasteryFlag = "weakness" | "mastery" | "normal";
export type MasteryMap = Map<string, MasteryFlag>;

export interface UseUserMasteryReturn {
  /** clef:note_key → "weakness" | "mastery" | "normal" */
  masteryMap: MasteryMap;
  /** 최초 로드 중 */
  loading: boolean;
  /** 마지막 배치 분석 시각 (UI에서 "몇 시간 전 분석" 표시용) */
  lastAnalyzedAt: Date | null;
}

/**
 * 현재 유저의 note_mastery 데이터를 읽어서
 * clef:note_key → flag 맵으로 변환.
 *
 * 게임 시작 시 1회 로드. 이후 로컬 메모리에서만 참조.
 * 로그아웃 시 맵 초기화.
 */
export function useUserMastery(): UseUserMasteryReturn {
  const { user } = useAuth();
  const [masteryMap, setMasteryMap] = useState<MasteryMap>(new Map());
  const [loading, setLoading] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) {
      setMasteryMap(new Map());
      setLastAnalyzedAt(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from("note_mastery")
        .select("note_key, clef, weakness_flag, mastery_flag, last_batch_analyzed_at")
        .eq("user_id", user.id);

      if (cancelled) return;

      if (error) {
        console.warn("[useUserMastery] 로드 실패:", error);
        setMasteryMap(new Map());
        setLoading(false);
        return;
      }

      const map: MasteryMap = new Map();
      let latestAnalyzedAt: Date | null = null;

      for (const row of data ?? []) {
        const key = `${row.clef}:${row.note_key}`;
        if (row.weakness_flag) {
          map.set(key, "weakness");
        } else if (row.mastery_flag) {
          map.set(key, "mastery");
        }
        // normal(기본)은 맵에 넣지 않음 → get() 시 undefined 반환

        if (row.last_batch_analyzed_at) {
          const t = new Date(row.last_batch_analyzed_at);
          if (!latestAnalyzedAt || t > latestAnalyzedAt) {
            latestAnalyzedAt = t;
          }
        }
      }

      setMasteryMap(map);
      setLastAnalyzedAt(latestAnalyzedAt);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { masteryMap, loading, lastAnalyzedAt };
}

/**
 * 키 조회 유틸: 특정 음표의 플래그 조회.
 * 맵에 없으면 "normal" 반환.
 */
export function getMasteryFlag(
  masteryMap: MasteryMap,
  clef: "treble" | "bass",
  noteKey: string
): MasteryFlag {
  return masteryMap.get(`${clef}:${noteKey}`) ?? "normal";
}