import { cn } from "@/lib/utils";
import { useSolfegeSystem } from "@/hooks/useSolfegeSystem";
import { toSolfege, toSolfegeAriaLabel } from "@/lib/solfege";
import { useSwipeAccidental, type SwipeDirection } from "@/hooks/useSwipeAccidental";

/**
 * 고정형 7버튼 — 애플 아이콘 스타일
 *  - 버튼 물리적 위치 세션 내내 불변 (근육 기억)
 *  - swipeEnabled=false: 조표 바뀌면 라벨(text)만 동적 변경 (Lv1-4)
 *  - swipeEnabled=true: 자연음 7개만 표시. 위 swipe → ♯, 아래 swipe → ♭ (Lv5+)
 *  - 색상은 letter에 귀속, 조표 영향 없음
 */

const NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
type NoteLetter = typeof NOTE_LETTERS[number];

const LETTER_STYLES: Record<NoteLetter, string> = {
  C: "bg-gradient-to-b from-red-400     to-red-500     shadow-red-500/40",
  D: "bg-gradient-to-b from-orange-400  to-orange-500  shadow-orange-500/40",
  E: "bg-gradient-to-b from-amber-400   to-amber-500   shadow-amber-500/40",
  F: "bg-gradient-to-b from-emerald-400 to-emerald-500 shadow-emerald-500/40",
  G: "bg-gradient-to-b from-sky-400     to-sky-500     shadow-sky-500/40",
  A: "bg-gradient-to-b from-purple-400  to-purple-500  shadow-purple-500/40",
  B: "bg-gradient-to-b from-indigo-400  to-indigo-500  shadow-indigo-500/40",
};

interface NoteButtonsProps {
  onNoteClick: (answer: string) => void;
  disabled?: boolean;
  disabledNotes?: Set<string>;
  keySharps?: string[];
  keyFlats?: string[];
  /** Lv5+ 에서 swipe 입력 활성화 (true: ♯/♭ 라벨 제거 + swipe 핸들러) */
  swipeEnabled?: boolean;
}

function resolveButton(
  letter: NoteLetter,
  keySharps?: string[],
  keyFlats?: string[],
): { baseDisplay: string; answer: string; accidentalSuffix: string } {
  if (keySharps?.includes(letter)) {
    return { baseDisplay: letter, answer: `${letter}#`, accidentalSuffix: "♯" };
  }
  if (keyFlats?.includes(letter)) {
    return { baseDisplay: letter, answer: `${letter}b`, accidentalSuffix: "♭" };
  }
  return { baseDisplay: letter, answer: letter, accidentalSuffix: "" };
}

interface NoteButtonProps {
  letter: NoteLetter;
  display: string;
  ariaLabel: string;
  isDisabled: boolean;
  swipeEnabled: boolean;
  onCommit: (direction: SwipeDirection) => void;
}

function NoteButton({
  letter,
  display,
  ariaLabel,
  isDisabled,
  swipeEnabled,
  onCommit,
}: NoteButtonProps) {
  const { handlers, dragOffset, activeDirection } = useSwipeAccidental({
    enabled: swipeEnabled,
    onCommit: (direction) => {
      if (isDisabled) return;
      onCommit(direction);
    },
  });

  return (
    <button
      type="button"
      disabled={isDisabled}
      style={
        swipeEnabled && dragOffset !== 0
          ? { transform: `translateY(${dragOffset}px)` }
          : undefined
      }
      {...handlers}
      className={cn(
        "relative h-12 sm:h-16",
        "rounded-[22%]",
        "flex items-center justify-center",
        "overflow-hidden",
        "select-none touch-manipulation",
        LETTER_STYLES[letter],
        "shadow-lg",
        "text-white font-bold text-base sm:text-xl tabular-nums",
        "[text-shadow:0_1px_2px_rgba(0,0,0,0.15)]",
        "transition-all duration-150 ease-out",
        "active:scale-[0.92]",
        "active:brightness-95",
        "active:shadow-md",
        "disabled:opacity-30 disabled:saturate-50",
        "disabled:active:scale-100 disabled:active:brightness-100",
        "disabled:cursor-not-allowed",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-offset-2 focus-visible:ring-primary",
        // swipe 임계 50% 도달 시 방향별 ring (♯ 시안, ♭ 앰버)
        activeDirection === "up" && "ring-4 ring-cyan-400 ring-offset-2",
        activeDirection === "down" && "ring-4 ring-amber-400 ring-offset-2",
      )}
      aria-label={ariaLabel}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
      />
      <span className="relative z-10">{display}</span>
    </button>
  );
}

export default function NoteButtons({
  onNoteClick,
  disabled = false,
  disabledNotes,
  keySharps,
  keyFlats,
  swipeEnabled = false,
}: NoteButtonsProps) {
  const { system } = useSolfegeSystem();

  return (
    <div className="w-full px-2 sm:px-0" role="group" aria-label="음표 정답 입력">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 max-w-2xl mx-auto">
        {NOTE_LETTERS.map((letter) => {
          // swipe 모드에서는 조표 라벨을 강제로 떼고 자연음만 표시.
          const resolved = swipeEnabled
            ? { baseDisplay: letter, answer: letter, accidentalSuffix: "" }
            : resolveButton(letter, keySharps, keyFlats);
          const { baseDisplay, answer: clickAnswer, accidentalSuffix } = resolved;

          const isDisabled =
            disabled ||
            (!swipeEnabled && (disabledNotes?.has(clickAnswer) ?? false));

          const solfegeLabel = toSolfege(baseDisplay, system);
          const displayLabel = `${solfegeLabel}${accidentalSuffix}`;
          const ariaLabel = accidentalSuffix
            ? `${solfegeLabel}${accidentalSuffix} 선택`
            : toSolfegeAriaLabel(baseDisplay, system);

          const handleCommit = (direction: SwipeDirection) => {
            if (swipeEnabled) {
              if (direction === "up") onNoteClick(`${letter}#`);
              else if (direction === "down") onNoteClick(`${letter}b`);
              else onNoteClick(letter);
            } else {
              onNoteClick(clickAnswer);
            }
          };

          return (
            <NoteButton
              key={letter}
              letter={letter}
              display={displayLabel}
              ariaLabel={ariaLabel}
              isDisabled={isDisabled}
              swipeEnabled={swipeEnabled}
              onCommit={handleCommit}
            />
          );
        })}
      </div>
    </div>
  );
}
