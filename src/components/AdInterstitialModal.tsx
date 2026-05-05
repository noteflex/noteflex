import { useEffect, useState } from "react";
import { AdBanner } from "./AdBanner";
import { getSlot } from "@/lib/adsense";

interface AdInterstitialModalProps {
  open: boolean;
  onClose: () => void;
}

const AUTO_CLOSE_SEC = 5;

export function AdInterstitialModal({ open, onClose }: AdInterstitialModalProps) {
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SEC);

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

  return (
    <div
      className="fixed inset-0 z-50 bg-background/90 flex flex-col items-center justify-center gap-4 p-6"
      role="dialog"
      aria-label="광고"
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-4">
        <AdBanner
          slot={getSlot("INTERSTITIAL")}
          format="rectangle"
          className="w-full min-h-[250px]"
        />
        {countdown > 0 ? (
          <p className="text-xs text-muted-foreground">{countdown}초 후 건너뛸 수 있어요</p>
        ) : (
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground underline"
          >
            건너뛰기
          </button>
        )}
      </div>
    </div>
  );
}
