import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdsEnabled, pushAd, getPublisherId } from "@/lib/adsense";
import { getUserTier } from "@/lib/subscriptionTier";

interface AdBannerProps {
  slot: string;
  format?: "auto" | "rectangle" | "vertical" | "horizontal";
  className?: string;
}

export function AdBanner({ slot, format = "auto", className }: AdBannerProps): JSX.Element | null {
  const { user, profile } = useAuth();
  const pushed = useRef(false);

  const isPro = getUserTier(user, profile) === "pro";
  const adsEnabled = isAdsEnabled();
  const showReal = adsEnabled && !isPro;
  const showPlaceholder = !adsEnabled && import.meta.env.DEV && !isPro;

  useEffect(() => {
    if (!showReal || pushed.current) return;
    pushed.current = true;
    pushAd();
  }, [showReal]);

  if (showPlaceholder) {
    return (
      <div
        className={`flex items-center justify-center border border-dashed border-muted-foreground/30 bg-muted/20 text-xs text-muted-foreground rounded ${className ?? ""}`}
        style={{ minHeight: 60 }}
        data-ad-slot={slot}
      >
        광고 영역
      </div>
    );
  }

  if (!showReal) return null;

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={getPublisherId()}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
