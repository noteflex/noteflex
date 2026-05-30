import type { WeakScoreMap } from "@/hooks/useUserWeakScores";

/**
 * 5-A: WeakScoreMap 시드 헬퍼.
 *
 * 시뮬레이터에서 user_note_weak_scores 테이블을 fetch하지 않고
 * 시나리오마다 사전 정의된 약점 점수를 주입할 때 사용.
 *
 * 사용 예:
 *   const map = seedWeakScores([
 *     { noteId: "treble:F#4", combinedScore: 0.8 },
 *     { noteId: "treble:C#5", combinedScore: 0.6, sampleSize: 30 },
 *   ]);
 */

export interface WeakScoreSeed {
  /** noteId — "treble:F#4" / "bass:Bb3" 형식 (buildNoteId 결과와 동일). */
  noteId: string;
  /** 0..1. 미지정 시 combinedScore와 동일. */
  accuracyScore?: number;
  /** 0..1. 미지정 시 combinedScore와 동일. */
  responseTimeScore?: number;
  /** 0..1. 미지정 시 (accuracy+responseTime)/2. */
  combinedScore?: number;
  /** 30일 윈도우 시도 수. 미지정 시 10. */
  sampleSize?: number;
}

export function seedWeakScores(seeds: WeakScoreSeed[]): WeakScoreMap {
  const map: WeakScoreMap = new Map();
  for (const s of seeds) {
    const combined = s.combinedScore ?? (
      ((s.accuracyScore ?? 0) + (s.responseTimeScore ?? 0)) * 0.5
    );
    const acc = s.accuracyScore ?? combined;
    const rt = s.responseTimeScore ?? combined;
    map.set(s.noteId, {
      accuracy_score: acc,
      response_time_score: rt,
      combined_score: combined,
      sample_size: s.sampleSize ?? 10,
    });
  }
  return map;
}
