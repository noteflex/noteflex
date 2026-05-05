import { useEffect, useState } from "react";

interface CountdownOverlayProps {
  /** 카운트 시작 (3부터). 0이면 표시 안 함 */
  seconds?: number;
  /** 카운트 완료 시 콜백 */
  onComplete: () => void;
}

/**
 * 게임 시작 전 3-2-1 카운트다운 풀스크린 오버레이.
 * 1초 간격으로 숫자 변경, 0 도달 시 onComplete 호출.
 */
export default function CountdownOverlay({
  seconds = 3,
  onComplete,
}: CountdownOverlayProps) {
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    if (count <= 0) {
      onComplete();
      return;
    }
    const id = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [count, onComplete]);

  if (count <= 0) return null;

  // §F1 (2026-05-05, 정책 P3): 외부 div의 key={count} 영역 제거 — 매초 unmount/mount 영역 차단.
  // 숫자 텍스트 span에만 key={count} 유지 → wrapper backdrop은 mount 1회, 숫자만 매초 새 element + animation.
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95"
      aria-live="polite"
      aria-label={`${count}초 뒤 시작`}
    >
      <div className="flex flex-col items-center gap-4">
        <span
          key={count}
          className="text-8xl sm:text-9xl font-bold text-primary tabular-nums drop-shadow-lg animate-countdown-pop"
        >
          {count}
        </span>
        <span className="text-sm text-muted-foreground font-medium tracking-wide">
          곧 시작합니다
        </span>
      </div>

      {/* 5/2 fix: animation 1s 동기화 (setTimeout 1000ms와 일치) + fade-out 끝 frame.
          기존 0.9s ease-out + scale 0.95/opacity 0.9 (정지 100ms) → 1s cubic-bezier + scale 0.85/opacity 0 (자연 fade-out). */}
      <style>{`
        @keyframes countdown-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          20%  { transform: scale(1.1); opacity: 1; }
          50%  { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.85); opacity: 0; }
        }
        .animate-countdown-pop {
          animation: countdown-pop 1s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
}