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
  
  interface SublevelPassedDialogProps {
    open: boolean;
    level: number;
    sublevel: 1 | 2 | 3;
    totalAttempts: number;
    totalCorrect: number;
    bestStreak: number;
    justPassed: boolean;
    onReplay: () => void;
    onGoToNextSublevel: () => void;
    onBackToSelect: () => void;
    onClose: () => void;
  }
  
  export function SublevelPassedDialog({
    open,
    level,
    sublevel,
    totalAttempts,
    totalCorrect,
    bestStreak,
    justPassed,
    onReplay,
    onGoToNextSublevel,
    onBackToSelect,
    onClose,
  }: SublevelPassedDialogProps) {
    const accuracy = totalAttempts > 0
      ? Math.round((totalCorrect / totalAttempts) * 100)
      : 0;
    const next = getNextSublevel(level, sublevel);
    const hasNext = next !== null;
    const currentLabel = formatSublevel(level, sublevel);
    const nextLabel = next ? formatSublevel(next.level, next.sublevel) : null;
  
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