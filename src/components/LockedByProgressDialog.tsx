import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/contexts/LanguageContext";

interface LockedByProgressDialogProps {
  open: boolean;
  onClose: () => void;
  /** 먼저 통과해야 할 선행 단계 */
  requiredLevel: number;
  requiredSublevel: number;
  /** "Go to Lv X-Y" 클릭 시 호출 (스크롤·하이라이트는 부모에서 완료) */
  onGoToRequired: () => void;
}

/**
 * 이전 단계 미통과 잠금 알림.
 *
 * 다이얼로그 정책 (메모리 #19·#20·#25):
 *   - backdrop 클릭 닫기 X (onPointerDownOutside preventDefault)
 *   - ESC 닫기 X (onEscapeKeyDown preventDefault)
 *   - 버튼으로만 닫기
 */
export default function LockedByProgressDialog({
  open,
  onClose,
  requiredLevel,
  requiredSublevel,
  onGoToRequired,
}: LockedByProgressDialogProps) {
  const t = useT();

  // 동적 치환 완료
  const subtitle = t.lockedByProgress.subtitle
    .replace("{requiredLevel}", String(requiredLevel))
    .replace("{requiredSublevel}", String(requiredSublevel));
  const ctaText = t.lockedByProgress.cta
    .replace("{requiredLevel}", String(requiredLevel))
    .replace("{requiredSublevel}", String(requiredSublevel));

  const handleGoToRequired = () => {
    onClose();
    onGoToRequired();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // X 버튼은 onOpenChange로 적용됨 → onClose 실행 허용.
        // backdrop·ESC는 onPointerDownOutside·onEscapeKeyDown으로 적용된서 onOpenChange 도달 X.
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t.lockedByProgress.title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground py-2">
          {t.lockedByProgress.description}
        </p>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={handleGoToRequired}
            data-testid="locked-by-progress-cta"
          >
            {ctaText}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="locked-by-progress-close"
          >
            {t.lockedByProgress.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
