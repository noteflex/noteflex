import { useNavigate } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PremiumRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 진입하려던 레벨 번호 (안내 문구용) */
  attemptedLevel?: number;
  /** 취소(=레벨 선택 화면 복귀) 핸들러 */
  onCancel: () => void;
}

export default function PremiumRequiredDialog({
  open,
  onOpenChange,
  attemptedLevel,
  onCancel,
}: PremiumRequiredDialogProps) {
  const navigate = useNavigate();
  const t = useT();

  const handleSubscribe = () => {
    onOpenChange(false);
    navigate("/pricing");
  };

  const handleCancel = () => {
    onOpenChange(false);
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleCancel();
        else onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl" aria-hidden>
              ✨
            </span>
            <DialogTitle>{t.premiumRequired.title}</DialogTitle>
          </div>
          <DialogDescription>
            {attemptedLevel
              ? t.premiumRequired.bodyLevel.replace("{n}", String(attemptedLevel))
              : t.premiumRequired.body}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 px-4 py-3 my-2">
          <p className="text-sm font-semibold text-amber-900 mb-1">
            {t.premiumRequired.benefitsTitle}
          </p>
          <ul className="text-xs text-amber-800 space-y-1">
            <li>• {t.premiumRequired.benefitAllLevels}</li>
            <li>• {t.premiumRequired.benefitWeakNotes}</li>
            <li>• {t.premiumRequired.benefitAdFree}</li>
          </ul>
          <p className="text-xs text-amber-700 mt-2 font-medium">
            {t.premiumRequired.price}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            {t.premiumRequired.cancel}
          </Button>
          <Button
            onClick={handleSubscribe}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
          >
            {t.premiumRequired.subscribe}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}