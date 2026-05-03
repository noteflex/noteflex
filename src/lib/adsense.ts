export function isAdsEnabled(): boolean {
  return import.meta.env.VITE_ADS_ENABLED === "true";
}

export function getPublisherId(): string {
  return import.meta.env.VITE_ADSENSE_PUBLISHER_ID ?? "";
}

export function getSlot(
  key: "BANNER" | "SIDEBAR_LEFT" | "SIDEBAR_RIGHT" | "INFEED" | "INTERSTITIAL"
): string {
  const map: Record<string, string> = {
    BANNER: import.meta.env.VITE_ADSENSE_SLOT_BANNER ?? "0000000000",
    SIDEBAR_LEFT: import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR_LEFT ?? "0000000001",
    SIDEBAR_RIGHT: import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR_RIGHT ?? "0000000002",
    INFEED: import.meta.env.VITE_ADSENSE_SLOT_INFEED ?? "0000000003",
    INTERSTITIAL: import.meta.env.VITE_ADSENSE_SLOT_INTERSTITIAL ?? "0000000004",
  };
  return map[key];
}

export function initAdSense(): void {
  if (!isAdsEnabled() || !getPublisherId()) return;
  const existing = document.querySelector('script[data-adsense]');
  if (existing) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${getPublisherId()}`;
  script.crossOrigin = "anonymous";
  script.setAttribute("data-adsense", "1");
  document.head.appendChild(script);
}

export function pushAd(): void {
  if (!isAdsEnabled()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
  } catch {
    // ignore
  }
}
