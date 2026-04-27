// src/hooks/useSwipeAccidental.ts
import { useCallback, useRef, useState } from "react";

export type SwipeDirection = "up" | "down" | null;

interface UseSwipeAccidentalArgs {
  /** Lv5+ 일 때만 swipe 활성화 */
  enabled: boolean;
  /** swipe 임계 거리 (px). 기본 36 — 버튼 높이 12-16px의 1.5~2배 */
  threshold?: number;
  /**
   * 답안 확정 콜백.
   * - direction === "up"   → letter + "#"
   * - direction === "down" → letter + "b"
   * - direction === null   → letter (자연음, 단순 클릭)
   */
  onCommit: (direction: SwipeDirection) => void;
}

interface PointerState {
  pointerId: number;
  startY: number;
  startX: number;
  committed: boolean;
}

/**
 * 자연음 버튼에 부착하는 swipe 인터랙션.
 *
 * 동작:
 *  - pointerdown: 위치 기록
 *  - pointermove: dy 추적 → 드래그 시각 피드백 (translateY)
 *  - 임계 거리 도달 → 즉시 commit (손 떼기 안 기다림). 빠른 입력 유리.
 *  - pointerup (임계점 미도달): dy 작으면 자연음 클릭으로 처리, 크면 무시(취소)
 *  - pointercancel: 무시 (스크롤·드래그 충돌 시)
 *
 * enabled=false 면 모든 핸들러 no-op. 단순 onClick에 onCommit(null) 위임.
 */
export function useSwipeAccidental({
  enabled,
  threshold = 56,
  onCommit,
}: UseSwipeAccidentalArgs) {
  const stateRef = useRef<PointerState | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [activeDirection, setActiveDirection] = useState<SwipeDirection>(null);

  const reset = useCallback(() => {
    stateRef.current = null;
    setDragOffset(0);
    setActiveDirection(null);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!enabled) return;
      // 우클릭·중클릭 무시
      if (e.button !== 0) return;

      stateRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startX: e.clientX,
        committed: false,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* setPointerCapture 실패해도 진행 */
      }
    },
    [enabled]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!enabled) return;
      const s = stateRef.current;
      if (!s || s.pointerId !== e.pointerId || s.committed) return;

      const dy = e.clientY - s.startY;
      // 드래그 시각 피드백 (clamp)
      const clamped = Math.max(-threshold * 1.2, Math.min(threshold * 1.2, dy));
      setDragOffset(clamped);

      // 활성 방향 표시 (임계 도달 전)
      if (Math.abs(dy) >= threshold * 0.5) {
        setActiveDirection(dy < 0 ? "up" : "down");
      } else {
        setActiveDirection(null);
      }

      // 임계 도달 → 즉시 commit
      if (Math.abs(dy) >= threshold) {
        s.committed = true;
        const dir: SwipeDirection = dy < 0 ? "up" : "down";
        onCommit(dir);
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        reset();
      }
    },
    [enabled, threshold, onCommit, reset]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!enabled) {
        // swipe 비활성: 단순 클릭 → 자연음 commit
        onCommit(null);
        return;
      }
      const s = stateRef.current;
      if (!s || s.pointerId !== e.pointerId) {
        reset();
        return;
      }
      if (s.committed) {
        // 이미 임계점에서 commit됨
        reset();
        return;
      }

      const dy = e.clientY - s.startY;

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      // dy가 작으면 단순 클릭 → 자연음
      if (Math.abs(dy) < threshold * 0.5) {
        onCommit(null);
      }
      // dy가 임계의 50%~100% 사이면 애매한 swipe → 무시 (오발동 방지)
      reset();
    },
    [enabled, threshold, onCommit, reset]
  );

  const onPointerCancel = useCallback(() => {
    reset();
  }, [reset]);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    /** 드래그 중 시각 피드백용 — 버튼 transform: translateY(...) */
    dragOffset,
    /** 임계의 50% 이상 도달 시 "up" 또는 "down". 색상·아이콘 강조용 */
    activeDirection,
  };
}