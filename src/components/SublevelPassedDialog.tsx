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
import { useLang, useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { useAuth } from "@/contexts/AuthContext";
import { useLevelProgress } from "@/hooks/useLevelProgress";
import CoachingDialogShell from "./coaching/CoachingDialogShell";

interface SublevelPassedDialogProps {
  open: boolean;
  level: number;
  sublevel: 1 | 2 | 3;
  totalAttempts: number;
  totalCorrect: number;
  bestStreak: number;
  avgReactionRatio?: number;
  /** 누적 플레이 횟수 (game_over coaching branch에서만 사용 — passed에서는 무관). */
  playCount?: number;
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
  playCount = 0,
  justPassed,
  fastTrack = false,
  onReplay,
  onGoToNextSublevel,
  onBackToSelect,
  onClose,
}: SublevelPassedDialogProps) {
  const { lang } = useLang();
  const t = useT();
  const { user } = useAuth();
  const { getProgressFor } = useLevelProgress();
  const [countdown, setCountdown] = useState(AUTO_ADVANCE_SECONDS);
  const autoAdvancedRef = useRef(false);

  // 이전 누적 정답률 — 사인인 사용자 + 이전 세션 충분(≥5 시도) 적용된 영역만 비교 완료
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
      playCount,
      fastTrack,
      historicalAccuracy,
    },
    lang === "ko" ? "ko" : "en"
  );

  // ── 패스트트랙 분기 ──────────────────────────────────────────
  if (fastTrack) {
    const badge = t.gameDialogs.fastTrackBadge;
    const autoLabel = formatI18n(t.gameDialogs.fastTrackAutoAdvance, { n: String(countdown) });
    const goNowLabel = t.gameDialogs.fastTrackGoNow;
    const selectLabel = t.gameDialogs.fastTrackLevelSelect;

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

  // ── 일반 통과 분기 — 5/31 디자인 리뉴얼 (CoachingDialogShell 사용) ─────
  return (
    <CoachingDialogShell
      open={open}
      onClose={onClose}
      variant="passed"
      stageLabel={currentLabel}
      accuracy={totalAttempts > 0 ? totalCorrect / totalAttempts : 0}
      historicalAccuracy={historicalAccuracy}
      coachingMessage={coaching}
      totalAttempts={totalAttempts}
      bestStreak={bestStreak}
      avgReactionRatio={avgReactionRatio}
      footer={
        <>
          <Button
            variant="outline"
            onClick={onBackToSelect}
            className="w-full sm:w-auto"
          >
            {t.gameDialogs.backToSelect}
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={onReplay}
              className="w-full sm:w-auto"
            >
              {t.gameDialogs.replaySameLevel}
            </Button>
            {hasNext && justPassed && nextLabel && (
              <Button onClick={onGoToNextSublevel} className="w-full sm:w-auto">
                {formatI18n(t.gameDialogs.nextLevelButton, { nextLabel })}
              </Button>
            )}
          </div>
        </>
      }
    />
  );
}
