import { useEffect, useState, useRef } from "react";

interface CountdownTimerProps {
  duration: number; // seconds
  resetKey: number; // change this to reset the timer
  onExpire: () => void;
  paused?: boolean;
}

export default function CountdownTimer({ duration, resetKey, onExpire, paused = false }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(duration * 1000);
  const startRef = useRef(performance.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    setRemaining(duration * 1000);
    startRef.current = performance.now();
    expiredRef.current = false;
  }, [resetKey, duration]);

  useEffect(() => {
    if (paused) return;

    const interval = setInterval(() => {
      const elapsed = performance.now() - startRef.current;
      const left = Math.max(0, duration * 1000 - elapsed);
      setRemaining(left);

      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [resetKey, duration, onExpire, paused]);

  const fraction = remaining / (duration * 1000);
  const isUrgent = remaining <= 1000 && remaining > 0;

  return (
    <div className="w-full max-w-[500px] mx-auto px-1">
      <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            isUrgent
              ? "bg-destructive animate-pulse"
              : fraction > 0.5
              ? "bg-primary"
              : fraction > 0.25
              ? "bg-yellow-500"
              : "bg-orange-500"
          }`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
