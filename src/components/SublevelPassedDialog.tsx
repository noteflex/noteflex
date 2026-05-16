import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatSublevel, getNextSublevel } from "@/lib/levelSystem";
import { generateCoachingComment } from "@/lib/aiCoaching";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLevelProgress } from "@/hooks/useLevelProgress";

interface SublevelPassedDialogProps {
  open: boolean;
  level: number;
  sublevel: 1 | 2 | 3;
  totalAttempts: number;
  totalCorrect: number;
  bestStreak: number;
  avgReactionRatio?: number;
  justPassed: boolean;
  fastTrack?: boolean;
  onReplay: () => void;
  onGoToNextSublevel: () => void;
  onBackToSelect: () => void;
  onClose: () => void;
}

const AUTO_ADVANCE_SECONDS = 5;

export function SublevelPassedDialog({
  open,
  level,
  sublevel,
  totalAttempts,
  totalCorrect,
  bestStreak,
  avgReactionRatio,
  justPassed,
  fastTrack = false,
  onReplay,
  onGoToNextSublevel,
  onBackToSelect,
  onClose,
}: SublevelPassedDialogProps) {
  const { lang } = useLang();
  const { user } = useAuth();
  const { getProgressFor } = useLevelProgress();
  const [countdown, setCountdown] = useState(AUTO_ADVANCE_SECONDS);
  const autoAdvancedRef = useRef(false);

  const accuracy = totalAttempts > 0
    ? Math.round((totalCorrect / totalAttempts) * 100)
    : 0;

  // 이전 누적 정답률 — 사인인 사용자 + 이전 세션 충분(≥5 시도) 박힌 영역만 비교 박음
  const historicalAccuracy: number | undefined = (() => {
    if (!user) return undefined;
    const cumulative = getProgressFor(level, sublevel);
    if (!cumulative) return undefined;
    const preAttempts = cumulative.total_attempts - totalAttempts;
    const preCorrect = cumulative.total_correct - totalCorrect;
    if (preAttempts < 5) return undefined; // 신규 음정 영역
    return preCorrect / preAttempts;
  })();
  const next = getNextSublevel(level, sublevel);
  const hasNext = next !== null;
  const currentLabel = formatSublevel(level, sublevel);
  const nextLabel = next ? formatSublevel(next.level, next.sublevel) : null;

  // 패스트트랙 5초 자동 진입 카운트다운 (state updater에서 콜백 직접 호출 금지 — React 18 배치 2중 호출)
  useEffect(() => {
    if (!open || !fastTrack || !hasNext) return;
    autoAdvancedRef.current = false;
    setCountdown(AUTO_ADVANCE_SECONDS);
    const id = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fastTrack, hasNext]);

  // countdown=0 도달 시 정확히 1회 자동 진입
  useEffect(() => {
    if (!fastTrack || !hasNext || countdown !== 0 || autoAdvancedRef.current) return;
    autoAdvancedRef.current = true;
    onGoToNextSublevel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, fastTrack, hasNext]);

  const coaching = generateCoachingComment(
    {
      outcome: "passed",
      accuracy: totalAttempts > 0 ? totalCorrect / totalAttempts : 0,
      bestStreak,
      avgReactionRatio,
      playCount: 0,
      fastTrack,
      historicalAccuracy,
    },
    lang === "ko" ? "ko" : "en"
  );

  // ── 패스트트랙 분기 ──────────────────────────────────────────
  if (fastTrack) {
    const badge = lang === "ko" ? "🚀 패스트트랙" : "🚀 Fast Track";
    const autoLabel = lang === "ko"
      ? `${countdown}초 후 자동 진입`
      : `Auto-advance in ${countdown}s`;
    const goNowLabel = lang === "ko" ? "지금 바로 다음 단계" : "Next stage now";
    const selectLabel = lang === "ko" ? "레벨 선택" : "Level select";

    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <span
                className="inline-block rounded-full bg-primary/10 px-3 py-0.5 text-sm font-semibold text-primary"
                data-testid="fast-track-badge"
              >
                {badge}
              </span>
            </DialogTitle>
            <DialogDescription
              className="pt-2 text-base font-medium text-foreground"
              data-testid="fast-track-message"
            >
              {coaching}
            </DialogDescription>
          </DialogHeader>

          {hasNext && (
            <p
              className="text-sm text-muted-foreground text-center"
              data-testid="auto-advance-label"
            >
              {autoLabel}
            </p>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                onBackToSelect();
              }}
              className="w-full sm:w-auto"
              data-testid="fast-track-level-select-btn"
            >
              {selectLabel}
            </Button>
            {hasNext && (
              <Button
                onClick={() => onGoToNextSublevel()}
                className="w-full sm:w-auto"
                data-testid="fast-track-go-now-btn"
              >
                {goNowLabel}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── 일반 통과 분기 (Group C 영역 무손상) ────────────────────────
  const title = justPassed
    ? `🎉 ${currentLabel} 통과!`
    : `✅ ${currentLabel} 클리어`;
  const description = justPassed
    ? hasNext
      ? `축하해요! ${nextLabel}이(가) 해제됐어요.`
      : "🏆 마지막 단계까지 통과했어요. 진짜 그랜드마스터!"
    : "이번 판도 깔끔하게 클리어. 더 도전해볼래요?";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="pt-2">{description}</DialogDescription>
        </DialogHeader>

        <div className="my-4 grid grid-cols-3 gap-2 rounded-lg bg-emerald-50 p-3 text-center text-sm dark:bg-emerald-950/30">
          <div>
            <div className="text-xs text-muted-foreground">시도</div>
            <div className="font-semibold">{totalAttempts}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">정답률</div>
            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
              {accuracy}%
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">최고 연속</div>
            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
              {bestStreak}
            </div>
          </div>
        </div>

        <p
          className="text-sm text-muted-foreground text-center px-1"
          data-testid="coaching-comment"
        >
          {coaching}
        </p>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            onClick={onBackToSelect}
            className="w-full sm:w-auto"
          >
            단계 선택으로
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={onReplay}
              className="w-full sm:w-auto"
            >
              같은 단계 한 번 더
            </Button>
            {hasNext && justPassed && (
              <Button onClick={onGoToNextSublevel} className="w-full sm:w-auto">
                {nextLabel}로 →
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
