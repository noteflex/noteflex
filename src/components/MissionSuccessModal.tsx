import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/contexts/LanguageContext";

interface MissionSuccessModalProps {
  open: boolean;
  score: number;
  /** 다음 레벨로 진행. undefined이면 버튼 숨김 (마지막 레벨 등) */
  onNextLevel?: () => void;
  onReplay: () => void;
  /** 레벨 선택 화면으로 돌아가기 (마지막 레벨일 때 대체 CTA) */
  onLevelSelect?: () => void;
  /** 마지막 레벨 클리어 여부 (축하 메시지 강조용) */
  isFinalLevel?: boolean;
}

export default function MissionSuccessModal({
  open,
  score,
  onNextLevel,
  onReplay,
  onLevelSelect,
  isFinalLevel = false,
}: MissionSuccessModalProps) {
  const t = useT();
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md text-center" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="items-center">
          <div className="text-6xl mb-2">{isFinalLevel ? "🏆" : "🎉"}</div>
          <DialogTitle className="text-2xl">
            {isFinalLevel ? t.missionSuccess.finalTitle : "Mission Success!"}
          </DialogTitle>
          <DialogDescription className="text-base">
            {isFinalLevel ? (
              <>
                {t.missionSuccess.finalDescPre}
                <span className="font-bold text-foreground">{score}</span>
                {t.missionSuccess.finalDescPost}
              </>
            ) : (
              <>
                {t.missionSuccess.normalDescPre}
                <span className="font-bold text-foreground">{score}</span>
                {t.missionSuccess.normalDescPost}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-3 sm:flex-col sm:gap-3 mt-4">
          {onNextLevel ? (
            <Button onClick={onNextLevel} className="w-full text-base py-5">
              {t.missionSuccess.nextLevel}
            </Button>
          ) : null}
          <Button onClick={onReplay} variant="outline" className="w-full text-base py-5">
            {t.missionSuccess.replay}
          </Button>
          {onLevelSelect ? (
            <Button
              onClick={onLevelSelect}
              variant="ghost"
              className="w-full text-base py-5"
            >
              {t.missionSuccess.levelSelect}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}