import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { getUserTier } from "@/lib/subscriptionTier";
import { AdBanner } from "./AdBanner";
import { getSlot } from "@/lib/adsense";

function isInFeedAdsEnabled(): boolean {
  return import.meta.env.VITE_INFEED_ADS_ENABLED === "true";
}

export function InFeedAd(): JSX.Element | null {
  const { user, profile } = useAuth();
  const t = useT();
  const isPro = getUserTier(user, profile) === "pro";

  if (!isInFeedAdsEnabled() || isPro) return null;

  return (
    <li className="border-b border-border pb-6 last:border-b-0">
      <span className="text-xs text-muted-foreground mb-2 block">
        {t.blog.adLabel}
      </span>
      <AdBanner slot={getSlot("INFEED")} format="auto" />
    </li>
  );
}
