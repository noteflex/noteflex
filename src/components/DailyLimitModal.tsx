import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";
import { getStrings, format } from "@/i18n/strings";
import { trackEvent } from "@/lib/analytics";

interface DailyLimitModalProps {
  open: boolean;
  tier: "guest" | "free";
  /** UTC 자정까지 남은 ms. 부모(useDailyLimit)가 1초마다 갱신해 전달. */
  timeUntilResetMs: number;
  onClose: () => void;
  /** Guest CTA 클릭 시. 부모가 /signup 또는 AuthModal 결정. 미제공 시 /signup 이동. */
  onSignUpClick?: () => void;
  /** Free CTA 클릭 시. 부모가 /pricing 또는 결제 모달 결정. 미제공 시 /pricing 이동. */
  onPremiumClick?: () => void;
}

function formatCountdown(ms: number, template: string): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return format(template, {
    hours: String(hours),
    minutes: String(minutes),
  });
}

export default function DailyLimitModal({
  open,
  tier,
  timeUntilResetMs,
  onClose,
  onSignUpClick,
  onPremiumClick,
}: DailyLimitModalProps) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const s = getStrings(lang).dailyLimit;
  const tierStrings = tier === "guest" ? s.guest : s.free;

  useEffect(() => {
    if (open) trackEvent("paywall_view", { source: "daily_limit", tier });
  }, [open, tier]);

  const handleCta = () => {
    if (tier === "guest") {
      if (onSignUpClick) onSignUpClick();
      else navigate("/signup");
    } else {
      if (onPremiumClick) onPremiumClick();
      else navigate("/pricing");
    }
    onClose();
  };

  // 메모리 #19: backdrop·ESC 닫기 X — CTA·close·X(시각) 버튼만으로 닫기.
  // onPointerDownOutside·onEscapeKeyDown preventDefault, X 버튼은 onOpenChange(false).
  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-sm animate-pop-in"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-semibold">
            {tierStrings.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {tierStrings.title}
          </DialogDescription>
        </DialogHeader>

        {/* 가치 리스트 (Guest 3개 / Free 4개) */}
        <ul className="space-y-2 py-2">
          {tierStrings.values.map((v) => (
            <li key={v} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-0.5 flex-shrink-0" aria-hidden="true">✓</span>
              <span className="text-foreground">{v}</span>
            </li>
          ))}
        </ul>

        {/* Free 영역 가격 표시 */}
        {tier === "free" && "pricing" in tierStrings && (
          <p className="text-xs text-foreground font-semibold text-center">
            {tierStrings.pricing}
          </p>
        )}

        {/* 카운트다운 */}
        <p className="text-xs text-muted-foreground text-center">
          {formatCountdown(timeUntilResetMs, s.countdown)}
        </p>

        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={handleCta}>
            {tierStrings.cta}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {tierStrings.close}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
