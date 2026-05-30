import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * 정답/오답 시각 피드백: 화면 가장자리 부드러운 inset 글로우.
 *
 * 정책:
 *   - blur·filter 사용 X (GPU compositor layer 누적 함정 회피 — 사용자 메모리)
 *   - pointer-events: none → 게임 입력 차단 X
 *   - trigger=null 시 미마운트 (GPU layer 누적 회피)
 *   - 같은 trigger 연속 발동 시 부모가 key를 갱신해 unmount→remount 시키면 애니메이션 재시작
 *   - prefers-reduced-motion 시 동작 비활성 (접근성)
 *
 * Portal: document.body에 마운트 (NoteGame 루트가 animate-fade-up으로 transform을
 * 유지하면 position:fixed가 viewport 대신 NoteGame 박스 기준이 돼 화면 일부만 덮음.
 * 이를 회피하기 위해 createPortal로 body 직속 자식으로 렌더).
 *
 * 부모 호출 예 (NoteGame):
 *   const [glow, setGlow] = useState<{ kind: ...; key: number }>({ kind: null, key: 0 });
 *   const fire = (kind) => setGlow(p => ({ kind, key: p.key + 1 }));
 *   <EdgeGlowFeedback key={glow.key} trigger={glow.kind}
 *                     onComplete={() => setGlow(p => ({ ...p, kind: null }))} />
 */

interface EdgeGlowFeedbackProps {
  trigger: "correct" | "incorrect" | null;
  onComplete?: () => void;
}

// CSS의 animation-duration과 일치 필수 — 불일치 시 애니메이션 도중 unmount.
const DURATION_MS: Record<"correct" | "incorrect", number> = {
  correct: 400,
  incorrect: 600,
};

export default function EdgeGlowFeedback({ trigger, onComplete }: EdgeGlowFeedbackProps) {
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
      data-testid="edge-glow-feedback"
    />,
    document.body,
  );
}
