import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdsEnabled, pushAd, getPublisherId } from "@/lib/adsense";
import { getUserTier } from "@/lib/subscriptionTier";
import { AdPlaceholder, type AdPlaceholderVariant } from "./AdPlaceholder";
import { useT } from "@/contexts/LanguageContext";

interface AdBannerProps {
  slot: string;
  format?: "auto" | "rectangle" | "vertical" | "horizontal";
  className?: string;
  /** Placeholder 사양 — VITE_ADS_ENABLED=false 영역에서 노출. 미박이면 단순 텍스트 placeholder. */
  placeholderVariant?: AdPlaceholderVariant;
  /** 보고 있는 글 회피 영역 (BlogPost.tsx에서 현재 slug 완료) */
  excludeSlug?: string;
}

export function AdBanner({
  slot,
  format = "auto",
  className,
  placeholderVariant,
  excludeSlug,
}: AdBannerProps): JSX.Element | null {
  const { user, profile } = useAuth();
  const pushed = useRef(false);
  const t = useT();

  const isPro = getUserTier(user, profile) === "pro";
  const adsEnabled = isAdsEnabled();
  const showReal = adsEnabled && !isPro;
  const showPlaceholder = !adsEnabled && !isPro;

  useEffect(() => {
    if (!showReal || pushed.current) return;
    pushed.current = true;
    pushAd();
  }, [showReal]);

  if (showPlaceholder) {
    if (placeholderVariant) {
      return (
        <AdPlaceholder
          variant={placeholderVariant}
          excludeSlug={excludeSlug}
          className={className}
        />
      );
    }
    return (
      <div
        className={`flex items-center justify-center border border-dashed border-muted-foreground/30 bg-muted/20 text-xs text-muted-foreground rounded ${className ?? ""}`}
        style={{ minHeight: 60 }}
        data-ad-slot={slot}
      >
        {t.adBanner.placeholder}
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
