import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/contexts/LanguageContext";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const navigate = useNavigate();
  const t = useT();

  const handlePricing = () => {
    // onClose 영역 먼저 박음 — Dashboard.setSearchParams 영역 박은 영역 박은 영역
    // navigate 박은 영역 박은 영역 영역 setSearchParams(replace: true) 박은 영역 박은 영역 박음 박은 영역
    // /dashboard 영역 박은 영역 URL 영역 박은 영역 영역 박은 영역 박음 박은 영역.
    onClose();
    navigate("/pricing");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.premiumDialog.title}</DialogTitle>
          <DialogDescription>{t.premiumDialog.subtitle}</DialogDescription>
        </DialogHeader>

        <ul className="text-sm text-muted-foreground space-y-1.5 py-2">
          {t.premiumDialog.benefits.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={handlePricing}
            data-testid="upgrade-modal-cta"
          >
            {t.premiumDialog.cta}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="upgrade-modal-close"
          >
            {t.premiumDialog.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
