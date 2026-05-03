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
  const enabled = isAdsEnabled() && !isPro;

  useEffect(() => {
    if (!enabled || pushed.current) return;
    pushed.current = true;
    pushAd();
  }, [enabled]);

  if (!enabled) return null;

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
