import { useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { openCheckout, PADDLE_PRICES } from "@/lib/paddle";
import { logger } from "@/lib/sentry";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const navigate = useNavigate();
  const t = useT();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    // 비로그인 영역 → 가입 흐름 영역 박음
    if (!user?.email) {
      navigate("/signup");
      onClose();
      return;
    }

    const priceId = PADDLE_PRICES.monthly;
    if (!priceId) {
      logger.error("Paddle Price ID 누락 (UpgradeModal)", new Error("Missing price ID"), {
        description: "VITE_PADDLE_PRICE_MONTHLY 환경변수 누락",
        impact: "결제 진행 불가",
        action: "Vercel 환경변수 영역 확인 필요",
      });
      return;
    }

    try {
      setIsLoading(true);
      logger.info("결제 시작 (UpgradeModal)", {
        description: "UpgradeModal 영역에서 Paddle Checkout 호출",
        user_id: user.id,
        plan: "monthly",
      });
      await openCheckout({
        plan: "monthly",
        userEmail: user.email,
        userId: user.id,
      });
      onClose();
    } catch (err) {
      logger.error("결제 진행 실패 (UpgradeModal)", err, {
        description: "openCheckout 호출 실패",
        cause: err instanceof Error ? err.message : String(err),
        impact: "사용자가 결제 진행 불가",
        metadata: { user_id: user.id },
      });
    } finally {
      setIsLoading(false);
    }
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
            onClick={handleUpgrade}
            disabled={isLoading}
            data-testid="upgrade-modal-cta"
          >
            {isLoading ? "..." : t.premiumDialog.cta}
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
