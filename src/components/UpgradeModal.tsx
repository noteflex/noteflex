import { useEffect } from "react";
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
import { trackEvent } from "@/lib/analytics";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const navigate = useNavigate();
  const t = useT();

  useEffect(() => {
    if (open) trackEvent("paywall_view", { source: "upgrade_modal" });
  }, [open]);

  const handlePricing = () => {
    // onClose 영역 먼저 완료 — Dashboard.setSearchParams 영역 기록한 부분 기록한 부분
    // navigate 기록한 부분 기록한 부분 영역 setSearchParams(replace: true) 기록한 부분 기록한 부분 완료 기록한 부분
    // /dashboard 영역 기록한 부분 URL 영역 기록한 부분 영역 기록한 부분 완료 기록한 부분.
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
