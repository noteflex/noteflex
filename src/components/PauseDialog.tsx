import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/contexts/LanguageContext";

interface PauseDialogProps {
  open: boolean;
  onResume: () => void;
  onQuit: () => void;
}

export function PauseDialog({ open, onResume, onQuit }: PauseDialogProps) {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">{t.gameDialogs.pauseTitle}</DialogTitle>
          <DialogDescription className="pt-1">
            {t.gameDialogs.pauseBody}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={onResume} className="w-full ring-offset-0 focus-visible:ring-inset">
            {t.gameDialogs.pauseResume}
          </Button>
          <Button variant="outline" onClick={onQuit} className="w-full">
            {t.gameDialogs.pauseExit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
