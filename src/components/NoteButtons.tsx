import { cn } from "@/lib/utils";

/**
 * 고정형 7버튼 — 애플 아이콘 스타일
 *  - 버튼 물리적 위치 세션 내내 불변 (근육 기억)
 *  - 조표 바뀌면 라벨(text)만 동적 변경
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
}

function resolveButton(
  letter: NoteLetter,
  keySharps?: string[],
  keyFlats?: string[],
): { display: string; answer: string } {
  if (keySharps?.includes(letter)) {
    return { display: `${letter}\u266F`, answer: `${letter}#` };
  }
  if (keyFlats?.includes(letter)) {
    return { display: `${letter}\u266D`, answer: `${letter}b` };
  }
  return { display: letter, answer: letter };
}

export default function NoteButtons({
  onNoteClick,
  disabled = false,
  disabledNotes,
  keySharps,
  keyFlats,
}: NoteButtonsProps) {
  return (
    <div className="w-full px-2 sm:px-0" role="group" aria-label="음표 정답 입력">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 max-w-2xl mx-auto">
        {NOTE_LETTERS.map((letter) => {
          const { display, answer } = resolveButton(letter, keySharps, keyFlats);
          const isDisabled = disabled || (disabledNotes?.has(answer) ?? false);

          return (
            <button
              key={letter}
              type="button"
              onClick={() => !isDisabled && onNoteClick(answer)}
              disabled={isDisabled}
              className={cn(
                // 높이 고정 + 정사각형 해제 → 세로 덜 차지
                "relative h-12 sm:h-16",
                "rounded-[22%]",
                "flex items-center justify-center",
                "overflow-hidden",
                "select-none touch-manipulation",
                // 색 + 컬러 섀도우 (letter별)
                LETTER_STYLES[letter],
                "shadow-lg",
                // 타이포
                "text-white font-bold text-base sm:text-xl tabular-nums",
                "[text-shadow:0_1px_2px_rgba(0,0,0,0.15)]",
                // 인터랙션
                "transition-all duration-150 ease-out",
                "active:scale-[0.92]",
                "active:brightness-95",
                "active:shadow-md",
                // 비활성화
                "disabled:opacity-30 disabled:saturate-50",
                "disabled:active:scale-100 disabled:active:brightness-100",
                "disabled:cursor-not-allowed",
                // 포커스 접근성
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-offset-2 focus-visible:ring-primary",
              )}
              aria-label={`${display} 선택`}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
              />
              <span className="relative z-10">{display}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}