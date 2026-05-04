import { useAuth } from "@/contexts/AuthContext";
import { getUserTier } from "@/lib/subscriptionTier";
import { AdBanner } from "./AdBanner";
import { getSlot } from "@/lib/adsense";

interface InFeedAdProps {
  lang: "ko" | "en";
}

function isInFeedAdsEnabled(): boolean {
  return import.meta.env.VITE_INFEED_ADS_ENABLED === "true";
}

export function InFeedAd({ lang }: InFeedAdProps): JSX.Element | null {
  const { user, profile } = useAuth();
  const isPro = getUserTier(user, profile) === "pro";

  if (!isInFeedAdsEnabled() || isPro) return null;

  const label = lang === "en" ? "Ad" : "광고";

  return (
    <li className="border-b border-border pb-6 last:border-b-0">
      <span className="text-xs text-muted-foreground mb-2 block">{label}</span>
      <AdBanner slot={getSlot("INFEED")} format="auto" />
    </li>
  );
}
