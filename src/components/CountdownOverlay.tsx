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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm"
      aria-live="polite"
      aria-label={`${count}초 뒤 시작`}
    >
      <div
        key={count}
        className="flex flex-col items-center gap-4 animate-countdown-pop"
      >
        <span className="text-8xl sm:text-9xl font-bold text-primary tabular-nums drop-shadow-lg">
          {count}
        </span>
        <span className="text-sm text-muted-foreground font-medium tracking-wide">
          곧 시작합니다
        </span>
      </div>

      {/* 애니메이션 keyframes (Tailwind config에 없어도 inline 동작) */}
      <style>{`
        @keyframes countdown-pop {
          0% { transform: scale(0.6); opacity: 0; }
          30% { transform: scale(1.1); opacity: 1; }
          60% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.9; }
        }
        .animate-countdown-pop {
          animation: countdown-pop 0.9s ease-out;
        }
      `}</style>
    </div>
  );
}