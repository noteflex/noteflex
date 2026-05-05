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
  
  interface GameOverDialogProps {
    open: boolean;
    level: number;
    sublevel: 1 | 2 | 3;
    totalAttempts: number;
    totalCorrect: number;
    bestStreak: number;
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
    onReplay,
    onGoToPreviousSublevel,
    onClose,
  }: GameOverDialogProps) {
    const accuracy = totalAttempts > 0
      ? Math.round((totalCorrect / totalAttempts) * 100)
      : 0;
    const prev = getPreviousSublevel(level, sublevel);
    const hasPrevious = prev !== null;
    const currentLabel = formatSublevel(level, sublevel);
    const prevLabel = prev ? formatSublevel(prev.level, prev.sublevel) : null;
  
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">
              😵 게임 오버 — {currentLabel}
            </DialogTitle>
            <DialogDescription className="pt-2">
              목숨이 다했어요. 다시 도전하거나 이전 단계로 돌아가서 연습할 수 있어요.
            </DialogDescription>
          </DialogHeader>
  
          <div className="my-4 grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center text-sm">
            <div>
              <div className="text-xs text-muted-foreground">시도</div>
              <div className="font-semibold">{totalAttempts}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">정답률</div>
              <div className="font-semibold">{accuracy}%</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">최고 연속</div>
              <div className="font-semibold">{bestStreak}</div>
            </div>
          </div>
  
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            {hasPrevious && (
              <Button
                variant="outline"
                onClick={onGoToPreviousSublevel}
                className="w-full sm:w-auto"
              >
                이전 단계로 ({prevLabel})
              </Button>
            )}
            <Button onClick={onReplay} className="w-full sm:w-auto">
              같은 단계 다시 도전
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }