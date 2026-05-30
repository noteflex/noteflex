import { useCallback, useEffect, useRef } from "react";
import {
  computeAdaptiveWeakRatio,
  type AdaptiveMode,
} from "@/lib/noteWeighting";

interface AccuracyState {
  correct: number;
  total: number;
}

export interface UseAdaptiveDifficultyReturn {
  /** 시도 1건 기록. 정답 여부만 누적. */
  recordAttempt: (isCorrect: boolean) => void;
  /**
   * 현재 약점 슬롯 비율.
   *   - Free: 0
   *   - 처음 5턴(이하): 0.6
   *   - 정답률 > 0.92: 0.8
   *   - 정답률 < 0.55: 0.3
   *   - 그 외: 0.6
   */
  getWeakSlotRatio: () => number;
  /** 현재 모드 (PickDecision trace용). */
  getAdaptiveMode: () => AdaptiveMode;
  /** 누적 상태 초기화. */
  reset: () => void;
}

/**
 * 세션 내 누적 정답률 기반 약점 슬롯 비율 동적 조정 hook (Premium 전용).
 *
 * 정책:
 *   - Free 사용자 → 항상 ratio=0 (약점 슬롯 자체 미적용).
 *   - 처음 5턴 워밍업 → 기본 비율 0.6 (데이터 부족 + 적응 보류).
 *   - 5턴 이후 정답률 기반:
 *     · > 0.92 → 0.8 (boost_weak, 약점 더 많이)
 *     · < 0.55 → 0.3 (reduce_weak, 약점 줄임)
 *     · 그 외 → 0.6 (normal)
 *   - 경계는 normal 영역 포함 (strict 비교).
 *
 * 구현 메모:
 *   - 상태는 useRef로 보관 — 매 입력마다 setState 리렌더 회피.
 *   - sublevelKey 변경 시 자동 reset (세션 전환).
 *   - 판정 로직은 `computeAdaptiveWeakRatio` 헬퍼에 위임 → 시뮬레이터 parity.
 */
export function useAdaptiveDifficulty(
  sublevelKey: string,
  isPremium: boolean,
): UseAdaptiveDifficultyReturn {
  const stateRef = useRef<AccuracyState>({ correct: 0, total: 0 });

  // sublevelKey 변경 시 세션 초기화.
  useEffect(() => {
    stateRef.current = { correct: 0, total: 0 };
  }, [sublevelKey]);

  const recordAttempt = useCallback((isCorrect: boolean) => {
    const s = stateRef.current;
    s.total += 1;
    if (isCorrect) s.correct += 1;
  }, []);

  const getWeakSlotRatio = useCallback((): number => {
    const { correct, total } = stateRef.current;
    const accuracy = total > 0 ? correct / total : 0;
    return computeAdaptiveWeakRatio(accuracy, total, isPremium).ratio;
  }, [isPremium]);

  const getAdaptiveMode = useCallback((): AdaptiveMode => {
    const { correct, total } = stateRef.current;
    const accuracy = total > 0 ? correct / total : 0;
    return computeAdaptiveWeakRatio(accuracy, total, isPremium).mode;
  }, [isPremium]);

  const reset = useCallback(() => {
    stateRef.current = { correct: 0, total: 0 };
  }, []);

  return { recordAttempt, getWeakSlotRatio, getAdaptiveMode, reset };
}
