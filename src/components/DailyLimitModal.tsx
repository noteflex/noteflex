import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";
import { getStrings, format } from "@/i18n/strings";

interface DailyLimitModalProps {
  open: boolean;
  tier: "guest" | "free";
  /** UTC 자정까지 남은 ms. 부모(useDailyLimit)가 1초마다 갱신해 전달. */
  timeUntilResetMs: number;
  onClose: () => void;
  /** Guest 영역에서 "가입하기" 클릭 시. 부모가 AuthModal·navigate 결정. */
  onSignUpRequest?: () => void;
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
  onSignUpRequest,
}: DailyLimitModalProps) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const s = getStrings(lang).dailyLimit;
  const tierStrings = tier === "guest" ? s.guest : s.free;

  const handleCta = () => {
    if (tier === "guest") {
      if (onSignUpRequest) {
        onSignUpRequest();
      } else {
        navigate("/signup");
      }
    } else {
      navigate("/pricing");
    }
    onClose();
  };

  // 메모리 #19: backdrop 클릭·ESC 닫기 X — CTA·close·X(시각) 버튼만으로 닫기
  // onPointerDownOutside·onEscapeKeyDown 가 prevent 영역, X 버튼은 onOpenChange(false) 호출.
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
          <DialogTitle>{tierStrings.title}</DialogTitle>
          <DialogDescription>{tierStrings.body}</DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground text-center py-1">
          {formatCountdown(timeUntilResetMs, s.countdown)}
        </p>

        <div className="flex gap-2">
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
