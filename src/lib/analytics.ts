// Google Analytics 4 — gtag.js 런타임 주입 + SPA page_view 추적 헬퍼.
// VITE_GA_MEASUREMENT_ID 미설정 시 모든 함수가 silent skip — dev/local·테스트 안전.
// 라우트 추적: src/components/AnalyticsTracker.tsx 가 useLocation 으로 호출.

type GtagArgs =
  | ["js", Date]
  | ["config", string, Record<string, unknown>?]
  | ["event", string, Record<string, unknown>?]
  | ["set", Record<string, unknown>];

declare global {
  interface Window {
    dataLayer: GtagArgs[];
    gtag: (...args: GtagArgs) => void;
  }
}

export function getMeasurementId(): string {
  return import.meta.env.VITE_GA_MEASUREMENT_ID ?? "";
}

export function isAnalyticsEnabled(): boolean {
  return !!getMeasurementId();
}

export function initAnalytics(): void {
  if (!isAnalyticsEnabled()) return;
  if (document.querySelector("script[data-ga4]")) return;

  const id = getMeasurementId();

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: GtagArgs) {
    window.dataLayer.push(args);
  };
  window.gtag("js", new Date());
  // send_page_view: false — SPA 라우트 추적을 직접 제어 (AnalyticsTracker)
  // 초기 페이지뷰는 AnalyticsTracker 가 마운트되며 useLocation 첫 effect 에서 전송.
  window.gtag("config", id, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  script.setAttribute("data-ga4", "1");
  document.head.appendChild(script);
}

export function trackPageView(path: string): void {
  if (!isAnalyticsEnabled() || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: document.title,
    page_location: window.location.href,
  });
}
