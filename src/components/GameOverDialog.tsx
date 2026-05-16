import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatSublevel, getPreviousSublevel } from "@/lib/levelSystem";
import { generateCoachingComment } from "@/lib/aiCoaching";
import { useLang, useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { useAuth } from "@/contexts/AuthContext";
import { useLevelProgress } from "@/hooks/useLevelProgress";

interface GameOverDialogProps {
  open: boolean;
  level: number;
  sublevel: 1 | 2 | 3;
  totalAttempts: number;
  totalCorrect: number;
  bestStreak: number;
  avgReactionRatio?: number;
  playCount?: number;
  onReplay: () => void;
  onGoToPreviousSublevel: () => void;
  onClose: () => void;
}

export function GameOverDialog({
  open,
  level,
  sublevel,
  totalAttempts,
  totalCorrect,
  bestStreak,
  avgReactionRatio,
  playCount = 0,
  onReplay,
  onGoToPreviousSublevel,
  onClose,
}: GameOverDialogProps) {
  const { lang } = useLang();
  const t = useT();
  const { user } = useAuth();
  const { getProgressFor } = useLevelProgress();
  const accuracy = totalAttempts > 0
    ? Math.round((totalCorrect / totalAttempts) * 100)
    : 0;
  const prev = getPreviousSublevel(level, sublevel);
  const hasPrevious = prev !== null;
  const currentLabel = formatSublevel(level, sublevel);
  const prevLabel = prev ? formatSublevel(prev.level, prev.sublevel) : null;

  const accuracyRatio = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

  // 이전 누적 정답률 — 사인인 + 이전 세션 충분(≥5 시도) 영역만 비교 박음
  const historicalAccuracy: number | undefined = (() => {
    if (!user) return undefined;
    const cumulative = getProgressFor(level, sublevel);
    if (!cumulative) return undefined;
    const preAttempts = cumulative.total_attempts - totalAttempts;
    const preCorrect = cumulative.total_correct - totalCorrect;
    if (preAttempts < 5) return undefined;
    return preCorrect / preAttempts;
  })();

  const coaching = generateCoachingComment(
    {
      outcome: "game_over",
      accuracy: accuracyRatio,
      bestStreak,
      avgReactionRatio,
      playCount,
      historicalAccuracy,
    },
    lang === "ko" ? "ko" : "en"
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">
            {formatI18n(t.gameDialogs.gameOverTitle, { label: currentLabel })}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {t.gameDialogs.gameOverDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center text-sm">
          <div>
            <div className="text-xs text-muted-foreground">{t.gameDialogs.statAttempts}</div>
            <div className="font-semibold">{totalAttempts}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t.gameDialogs.statAccuracy}</div>
            <div className="font-semibold">{accuracy}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t.gameDialogs.statBestStreak}</div>
            <div className="font-semibold">{bestStreak}</div>
          </div>
        </div>

        <p
          className="text-sm text-muted-foreground text-center px-1"
          data-testid="coaching-comment"
        >
          {coaching}
        </p>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          {hasPrevious && prevLabel && (
            <Button
              variant="outline"
              onClick={onGoToPreviousSublevel}
              className="w-full sm:w-auto"
            >
              {formatI18n(t.gameDialogs.backToPrevious, { label: prevLabel })}
            </Button>
          )}
          <Button onClick={onReplay} className="w-full sm:w-auto">
            {t.gameDialogs.retrySameLevel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
