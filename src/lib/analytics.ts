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
  function gtag(...args: GtagArgs) {
    // 표준 스니펫: arguments 객체를 그대로 push (배열 래핑 금지) — google gtag.js 가 큐를 인식.
    window.dataLayer.push(arguments as unknown as GtagArgs);
  }
  window.gtag = gtag;
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

// Custom event 전송. params 의 undefined 값은 GA4 가 무시함 — 호출 측 분기 단순화 가능.
// reserved name (sign_up · login · purchase 등) GA4 가 recommended event 로 별도 처리.
export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean | undefined>,
): void {
  if (!isAnalyticsEnabled() || typeof window.gtag !== "function") return;
  window.gtag("event", name, params ?? {});
}
