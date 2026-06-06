import { useEffect, useState } from "react";
import { AdPlaceholder } from "./AdPlaceholder";
import { useT } from "@/contexts/LanguageContext";

interface AdInterstitialModalProps {
  open: boolean;
  onClose: () => void;
}

const AUTO_CLOSE_SEC = 5;

export function AdInterstitialModal({ open, onClose }: AdInterstitialModalProps) {
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SEC);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    setCountdown(AUTO_CLOSE_SEC);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  // 메모리 #20: backdrop·ESC 닫기 X (5초 강제 시청 후 스킵 버튼만)
  // 메모리 #21: 자체 노출 영역 (Noteflex 프리미엄 + 블로그 추천 랜덤)
  return (
    <div
      className="fixed inset-0 z-50 bg-background/90 flex flex-col items-center justify-center gap-4 p-6"
      role="dialog"
      aria-label={t.adInterstitial.ariaLabel}
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-4">
        <AdPlaceholder
          variant="horizontal-random"
          className="w-full"
        />
        {countdown > 0 ? (
          <p className="text-xs text-muted-foreground">{t.adInterstitial.waitingLabel.replace("{countdown}", String(countdown))}</p>
        ) : (
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground underline"
          >
            {t.adInterstitial.skip}
          </button>
        )}
      </div>
    </div>
  );
}
