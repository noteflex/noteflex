import { useCallback, useEffect, useRef } from "react";
import { computeStreakMultiplier } from "@/lib/noteWeighting";

/**
 * 세션 내 음표별 streak 상태.
 *   - streak: 연속 정답 횟수
 *   - recentResponseTimes: 최근 정답들의 응답 시간(초), FIFO 최대 5개
 */
interface NoteStreakState {
  streak: number;
  recentResponseTimes: number[];
}

/** 평균 응답시간 계산 (정답 없으면 null). */
function avgOf(times: number[]): number | null {
  if (times.length === 0) return null;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

/** 최근 응답시간 버퍼 상한. */
const RECENT_BUFFER = 5;
/** 마스터 조건: 연속 정답 횟수 임계. */
const MIN_STREAK = 5;
/** 마스터 조건: 최근 평균 응답 임계 (초). */
const MAX_AVG_TIME = 1.5;

export interface UseSessionStreakMasteryReturn {
  /** 시도 1건 기록. isCorrect=false면 즉시 streak 리셋. */
  recordAttempt: (
    noteId: string,
    isCorrect: boolean,
    responseTimeSec: number,
  ) => void;
  /**
   * 음표의 현재 streak 마스터 multiplier.
   *   - 마스터 → 0.3
   *   - 그 외  → 1.0
   */
  getMasteryMultiplier: (noteId: string) => number;
  /** 음표가 현재 세션 마스터 상태인지 (디버그·PickDecision trace용). */
  isMastered: (noteId: string) => boolean;
  /** 모든 음표 상태 초기화. */
  reset: () => void;
}

/**
 * 세션 내 streak 자동 마스터 hook.
 *
 * 정책:
 *   - 음표별로 연속 정답 횟수와 최근 5회 평균 응답시간을 추적.
 *   - streak >= 5 AND 평균 < 1.5초 → 마스터 → 출제 가중치 ×0.3.
 *   - 오답 1회 → 즉시 리셋 (streak=0, recentResponseTimes=[]).
 *   - sublevelKey 변경 시 자동 reset (세션 전환).
 *   - DB 저장 X. graduated 시스템(user_note_status)과는 완전히 별개.
 *   - Free·Premium 공통 동작.
 *
 * 구현 메모:
 *   - 상태는 useRef<Map>으로 보관 — 매 입력마다 setState 리렌더 비용 회피.
 *   - getMasteryMultiplier는 출제 시점에 호출되는 동기 조회.
 */
export function useSessionStreakMastery(
  sublevelKey: string,
): UseSessionStreakMasteryReturn {
  const stateRef = useRef<Map<string, NoteStreakState>>(new Map());

  // sublevelKey 변경 시 세션 초기화.
  useEffect(() => {
    stateRef.current = new Map();
  }, [sublevelKey]);

  const recordAttempt = useCallback(
    (noteId: string, isCorrect: boolean, responseTimeSec: number) => {
      const map = stateRef.current;
      const prev = map.get(noteId);

      if (!isCorrect) {
        // 오답 1회로 즉시 리셋.
        map.set(noteId, { streak: 0, recentResponseTimes: [] });
        return;
      }

      // 정답: streak +1, 최근 응답시간 FIFO 누적.
      const recent = prev ? [...prev.recentResponseTimes, responseTimeSec] : [responseTimeSec];
      while (recent.length > RECENT_BUFFER) recent.shift();

      map.set(noteId, {
        streak: (prev?.streak ?? 0) + 1,
        recentResponseTimes: recent,
      });
    },
    [],
  );

  const getMasteryMultiplier = useCallback((noteId: string): number => {
    const s = stateRef.current.get(noteId);
    if (!s) return 1.0;
    return computeStreakMultiplier(
      s.streak,
      avgOf(s.recentResponseTimes),
      MIN_STREAK,
      MAX_AVG_TIME,
    );
  }, []);

  const isMastered = useCallback((noteId: string): boolean => {
    return getMasteryMultiplier(noteId) < 1.0;
  }, [getMasteryMultiplier]);

  const reset = useCallback(() => {
    stateRef.current = new Map();
  }, []);

  return { recordAttempt, getMasteryMultiplier, isMastered, reset };
}
