import { cn } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";

export interface WeakNoteChipProps {
  noteKey: string;
  octave: number;
  clef: string;
  /** 0..1 error_rate — 색 농도 결정 */
  errorRate?: number;
  /** 시도 수 (보조) */
  attempts?: number;
}

export default function WeakNoteChip({
  noteKey,
  octave,
  clef,
  errorRate = 0,
  attempts,
}: WeakNoteChipProps) {
  const t = useT();

  const tone =
    errorRate >= 0.66
      ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
      : errorRate >= 0.34
        ? "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800"
        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900";

  const clefLabel =
    clef === "bass" ? t.analytics.clefBass : clef === "treble" ? t.analytics.clefTreble : clef;
  const errorPct = Math.round(errorRate * 100);
  const attemptsStr = attempts ? ` (${attempts}${t.analytics.chipAttemptsUnit})` : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tone,
      )}
      title={`${clefLabel} ${noteKey}${octave} · ${t.analytics.chipErrorRateLabel} ${errorPct}%${attemptsStr}`}
    >
      <span className="text-[10px] opacity-70">{clefLabel}</span>
      <span className="font-mono font-bold">
        {noteKey}
        {octave}
      </span>
      {errorRate > 0 ? <span className="opacity-80">· {errorPct}%</span> : null}
    </span>
  );
}
