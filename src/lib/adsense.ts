export type AdSlotKey =
  | "PLAY_BOTTOM"
  | "PLAY_MID"
  | "BLOG_LIST_LEFT"
  | "BLOG_LIST_RIGHT"
  | "BLOG_LIST_INFEED"
  | "BLOG_LIST_MOBILE"
  | "BLOG_POST_LEFT"
  | "BLOG_POST_RIGHT"
  | "BLOG_POST_MOBILE"
  | "BLOG_POST_BOTTOM"
  | "DASH_INFEED"
  | "DASH_BOTTOM";

export function isAdsEnabled(): boolean {
  return import.meta.env.VITE_ADS_ENABLED === "true";
}

export function getPublisherId(): string {
  return import.meta.env.VITE_ADSENSE_PUBLISHER_ID ?? "";
}

export function getSlot(key: AdSlotKey): string {
  const map: Record<AdSlotKey, string> = {
    PLAY_BOTTOM: import.meta.env.VITE_ADSENSE_SLOT_PLAY_BOTTOM ?? "0000000000",
    PLAY_MID: import.meta.env.VITE_ADSENSE_SLOT_PLAY_MID ?? "0000000011",
    BLOG_LIST_LEFT: import.meta.env.VITE_ADSENSE_SLOT_BLOG_LIST_LEFT ?? "0000000001",
    BLOG_LIST_RIGHT: import.meta.env.VITE_ADSENSE_SLOT_BLOG_LIST_RIGHT ?? "0000000002",
    BLOG_LIST_INFEED: import.meta.env.VITE_ADSENSE_SLOT_BLOG_LIST_INFEED ?? "0000000003",
    BLOG_LIST_MOBILE: import.meta.env.VITE_ADSENSE_SLOT_BLOG_LIST_MOBILE ?? "0000000004",
    BLOG_POST_LEFT: import.meta.env.VITE_ADSENSE_SLOT_BLOG_POST_LEFT ?? "0000000005",
    BLOG_POST_RIGHT: import.meta.env.VITE_ADSENSE_SLOT_BLOG_POST_RIGHT ?? "0000000006",
    BLOG_POST_MOBILE: import.meta.env.VITE_ADSENSE_SLOT_BLOG_POST_MOBILE ?? "0000000007",
    BLOG_POST_BOTTOM: import.meta.env.VITE_ADSENSE_SLOT_BLOG_POST_BOTTOM ?? "0000000010",
    DASH_INFEED: import.meta.env.VITE_ADSENSE_SLOT_DASH_INFEED ?? "0000000008",
    DASH_BOTTOM: import.meta.env.VITE_ADSENSE_SLOT_DASH_BOTTOM ?? "0000000009",
  };
  return map[key];
}

// index.html에 AdSense head 스크립트 하드코딩 — 동적 로드 영역은 fallback
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
