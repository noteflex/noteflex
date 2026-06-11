// Daily Challenge — 자체 입력 버튼 (7글자) + 자체 스와이프 임시표 인터랙션.
// NoteButtons / useSwipeAccidental 임포트 없음. 같은 메커니즘을 데일리 모듈 안에 복제.
//
// swipeEnabled=true (조표 턴):
//   - 버튼 라벨은 자연 글자만 (♯/♭ 미부착)
//   - pointermove로 translateY 시각 피드백 (clamp ±1.2×threshold)
//   - 50% 임계 도달 시 cyan(♯) / amber(♭) 링
//   - 100% 임계 도달 시 즉시 commit (release 안 기다림)
//   - tap (dy < 50%) → 자연음 commit
//   - 50%~100% 사이 release → 모호 → 무시
// swipeEnabled=false (그 외 턴): 단순 tap만 — 자연 글자 commit.

import { useCallback, useRef, useState } from "react";
import type { DailyLetter } from "./dailyTypes";

const NOTE_LETTERS: readonly DailyLetter[] = ["C", "D", "E", "F", "G", "A", "B"];

const LETTER_STYLES: Record<DailyLetter, string> = {
  C: "bg-gradient-to-b from-red-400     to-red-500     shadow-red-500/40",
  D: "bg-gradient-to-b from-orange-400  to-orange-500  shadow-orange-500/40",
  E: "bg-gradient-to-b from-amber-400   to-amber-500   shadow-amber-500/40",
  F: "bg-gradient-to-b from-emerald-400 to-emerald-500 shadow-emerald-500/40",
  G: "bg-gradient-to-b from-sky-400     to-sky-500     shadow-sky-500/40",
  A: "bg-gradient-to-b from-purple-400  to-purple-500  shadow-purple-500/40",
  B: "bg-gradient-to-b from-indigo-400  to-indigo-500  shadow-indigo-500/40",
};

const SWIPE_THRESHOLD = 56; // px — useSwipeAccidental 기본값과 동일 감각

type SwipeDirection = "up" | "down" | null;
type PointerState = {
  pointerId: number;
  startY: number;
  startX: number;
  committed: boolean;
};

interface DailyButtonsProps {
  /** true일 때 글자 자연 표시 + swipe 입력 활성화. */
  swipeEnabled: boolean;
  disabled: boolean;
  onAnswer: (answer: string) => void;
}

export function DailyButtons({
  swipeEnabled,
  disabled,
  onAnswer,
}: DailyButtonsProps) {
  return (
    <div className="w-full px-2 sm:px-0" role="group" aria-label="Daily note input">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 max-w-2xl mx-auto">
        {NOTE_LETTERS.map((letter) => (
          <DailyNoteButton
            key={letter}
            letter={letter}
            swipeEnabled={swipeEnabled}
            disabled={disabled}
            onCommit={(direction) => {
              if (direction === "up") onAnswer(`${letter}#`);
              else if (direction === "down") onAnswer(`${letter}b`);
              else onAnswer(letter);
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── 개별 버튼 + 자체 스와이프 핸들러 ────────────────────────────
function DailyNoteButton({
  letter,
  swipeEnabled,
  disabled,
  onCommit,
}: {
  letter: DailyLetter;
  swipeEnabled: boolean;
  disabled: boolean;
  onCommit: (direction: SwipeDirection) => void;
}) {
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
      if (disabled) return;
      if (!swipeEnabled) return;
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
        /* ignore */
      }
    },
    [disabled, swipeEnabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!swipeEnabled) return;
      const s = stateRef.current;
      if (!s || s.pointerId !== e.pointerId || s.committed) return;

      const dy = e.clientY - s.startY;
      const clamped = Math.max(
        -SWIPE_THRESHOLD * 1.2,
        Math.min(SWIPE_THRESHOLD * 1.2, dy),
      );
      setDragOffset(clamped);

      if (Math.abs(dy) >= SWIPE_THRESHOLD * 0.5) {
        setActiveDirection(dy < 0 ? "up" : "down");
      } else {
        setActiveDirection(null);
      }

      if (Math.abs(dy) >= SWIPE_THRESHOLD) {
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
    [swipeEnabled, onCommit, reset],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (!swipeEnabled) {
        // 단순 클릭 — 자연 글자 commit.
        onCommit(null);
        return;
      }
      const s = stateRef.current;
      if (!s || s.pointerId !== e.pointerId) {
        reset();
        return;
      }
      if (s.committed) {
        reset();
        return;
      }
      const dy = e.clientY - s.startY;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      // 50% 미만 = tap → 자연음. 50~100% = 모호 → 무시.
      if (Math.abs(dy) < SWIPE_THRESHOLD * 0.5) {
        onCommit(null);
      }
      reset();
    },
    [disabled, swipeEnabled, onCommit, reset],
  );

  const onPointerCancel = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`note-${letter}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={
        swipeEnabled && dragOffset !== 0
          ? { transform: `translateY(${dragOffset}px)` }
          : undefined
      }
      className={
        "relative h-12 sm:h-16 rounded-[22%] flex items-center justify-center " +
        "overflow-hidden select-none " +
        (swipeEnabled ? "touch-none " : "touch-manipulation ") +
        LETTER_STYLES[letter] + " shadow-lg " +
        "text-white font-bold text-base sm:text-xl " +
        "[text-shadow:0_1px_2px_rgba(0,0,0,0.15)] " +
        "transition-all duration-150 ease-out " +
        "active:scale-[0.92] active:brightness-95 active:shadow-md " +
        "disabled:opacity-30 disabled:saturate-50 " +
        "disabled:active:scale-100 disabled:active:brightness-100 " +
        "disabled:cursor-not-allowed " +
        "focus-visible:outline-none focus-visible:ring-2 " +
        "focus-visible:ring-offset-2 focus-visible:ring-primary " +
        (activeDirection === "up" ? "ring-4 ring-cyan-400 ring-offset-2 " : "") +
        (activeDirection === "down" ? "ring-4 ring-amber-400 ring-offset-2 " : "")
      }
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
      />
      <span className="relative z-10">{letter}</span>
    </button>
  );
}
