// Daily Challenge — 정답/오답 가장자리 글로우.
// 동일한 글로벌 CSS 클래스(edge-glow-overlay, edge-glow-correct/incorrect)를 재사용해
// 일반 게임과 같은 시각 피드백을 낸다. (코드는 import 안 함, CSS 클래스명만 공유.)

import { useEffect } from "react";
import { createPortal } from "react-dom";

const DURATION_MS = { correct: 400, incorrect: 600 } as const;

interface Props {
  trigger: "correct" | "incorrect" | null;
  onComplete?: () => void;
}

export function DailyEdgeGlow({ trigger, onComplete }: Props) {
  useEffect(() => {
    if (trigger === null) return;
    const id = window.setTimeout(() => onComplete?.(), DURATION_MS[trigger]);
    return () => window.clearTimeout(id);
  }, [trigger, onComplete]);

  if (trigger === null) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`edge-glow-overlay edge-glow-${trigger}`}
      aria-hidden="true"
    />,
    document.body,
  );
}
