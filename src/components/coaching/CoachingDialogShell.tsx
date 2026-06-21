import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { NoteAnalysisSection } from "./NoteAnalysisSection";

/**
 * 5/31 코칭 다이얼로그 공용 shell.
 * SublevelPassedDialog(통과) + GameOverDialog(실패) 둘 다 사용.
 * fastTrack 분기는 SublevelPassedDialog 안에 그대로 유지 — 이 Shell 미사용.
 *
 * 디자인:
 *  1) 헤더: 통과/실패 배지 + "Lv X · Stage Y" 라벨
 *  2) Hero: 정답률 큰 숫자 + 트렌드 배지(historicalAccuracy 비교)
 *  3) 동기부여 한 줄
 *  4) 보조 stats 3-col: 시도·최고 연속·평균 반응
 *  5) 음표별 분석 (NoteAnalysisSection — signed-in + 데이터 충분일 때만)
 *  6) Footer 슬롯 (CTA 버튼)
 *
 * 색상: 통과 emerald / 실패 red / 트렌드 ↑emerald ↓red →amber.
 */

export type CoachingVariant = "passed" | "gameover";

export interface CoachingDialogShellProps {
  open: boolean;
  onClose: () => void;
  variant: CoachingVariant;
  /** "Lv 3 · Stage 2" 같은 라벨 (작게 배지 옆 표시). */
  stageLabel: string;
  /** 이번 세션 정답률 0..1. */
  accuracy: number;
  /** 이전 누적 정답률 0..1. undefined면 트렌드 배지 미표시. */
  historicalAccuracy?: number;
  /** 동기부여 한 줄 메시지 (generateCoachingComment 결과). */
  coachingMessage: string;
  /** 보조 stats. */
  totalAttempts: number;
  bestStreak: number;
  /** 평균 반응시간 비율 (0..1, 응답 ms / TIMER ms). undefined면 — 표시. */
  avgReactionRatio?: number;
  /** Footer CTA 버튼 슬롯. */
  footer: ReactNode;
  /** Footer 직전에 렌더되는 추가 슬롯 (예: 게스트 가입 nudge 배너). */
  nudge?: ReactNode;
}

export default function CoachingDialogShell({
  open,
  onClose,
  variant,
  stageLabel,
  accuracy,
  historicalAccuracy,
  coachingMessage,
  totalAttempts,
  bestStreak,
  avgReactionRatio,
  footer,
  nudge,
}: CoachingDialogShellProps) {
  const t = useT();

  const isPassed = variant === "passed";
  const accuracyPct = Math.round(accuracy * 100);
  const deltaPp =
    historicalAccuracy !== undefined
      ? Math.round((accuracy - historicalAccuracy) * 100)
      : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Radix a11y 요구 — 시각상 컴팩트 배지 + 라벨이 우선이라 sr-only 처리 */}
        <DialogTitle className="sr-only">
          {isPassed ? t.gameDialogs.variantPassed : t.gameDialogs.variantFailed} — {stageLabel}
        </DialogTitle>
        <DialogDescription className="sr-only">{coachingMessage}</DialogDescription>

        {/* 1. Header — variant 배지 + stage 라벨 */}
        <div className="flex items-center gap-2">
          <VariantBadge isPassed={isPassed} t={t} />
          <span className="text-[15px] text-muted-foreground">{stageLabel}</span>
        </div>

        {/* 2. Hero — 정답률 큰 숫자 + 트렌드 배지 */}
        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-xs text-muted-foreground">
            {t.gameDialogs.statAccuracy}
          </span>
          <span
            className={`text-5xl font-medium tabular-nums ${
              isPassed ? "text-emerald-600" : "text-red-600"
            }`}
            data-testid="coaching-accuracy"
          >
            {accuracyPct}%
          </span>
          <TrendBadge deltaPp={deltaPp} t={t} />
        </div>

        {/* 3. 동기부여 메시지 — testid는 기존 tests 호환 위해 "coaching-comment" 유지 */}
        <p
          className="text-center text-[15px] font-medium text-foreground px-2"
          data-testid="coaching-comment"
        >
          {coachingMessage}
        </p>

        {/* 4. 보조 stats 3-col */}
        <div className="grid grid-cols-3 gap-2 border-y border-border py-3 text-center">
          <SubStat
            label={t.gameDialogs.statAttempts}
            value={String(totalAttempts)}
          />
          <SubStat
            label={t.gameDialogs.statBestStreak}
            value={String(bestStreak)}
          />
          <SubStat
            label={t.gameDialogs.statAvgReaction}
            value={
              avgReactionRatio !== undefined
                ? `${(avgReactionRatio * 100).toFixed(0)}%`
                : "—"
            }
          />
        </div>

        {/* 5. 음표별 분석 — signed-in + 데이터 충분 시 그리드, 부족 시 empty state */}
        <NoteAnalysisSection />

        {/* 5.5 nudge 슬롯 — 게스트 가입 nudge 등 (지정 시에만 렌더) */}
        {nudge}

        {/* 6. Footer (CTA 버튼) */}
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────────────────

function VariantBadge({
  isPassed,
  t,
}: {
  isPassed: boolean;
  t: ReturnType<typeof useT>;
}) {
  const cls = isPassed
    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300"
    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300";
  const Icon = isPassed ? Check : X;
  const label = isPassed ? t.gameDialogs.variantPassed : t.gameDialogs.variantFailed;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold ${cls}`}
      data-testid="coaching-variant-badge"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function TrendBadge({
  deltaPp,
  t,
}: {
  deltaPp: number | null;
  t: ReturnType<typeof useT>;
}) {
  if (deltaPp === null) return null;
  // ±2%p 이내 = 평소 수준 (노이즈 회피, aiCoaching.ts 정책과 합치)
  if (deltaPp >= -2 && deltaPp <= 2) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
        data-testid="coaching-trend-badge"
      >
        <Minus className="h-3 w-3" aria-hidden="true" />
        {t.gameDialogs.vsAvgFlat}
      </span>
    );
  }
  if (deltaPp > 2) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
        data-testid="coaching-trend-badge"
      >
        <TrendingUp className="h-3 w-3" aria-hidden="true" />
        {formatI18n(t.gameDialogs.vsAvgUp, { n: String(deltaPp) })}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300"
      data-testid="coaching-trend-badge"
    >
      <TrendingDown className="h-3 w-3" aria-hidden="true" />
      {formatI18n(t.gameDialogs.vsAvgDown, { n: String(Math.abs(deltaPp)) })}
    </span>
  );
}

function SubStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
