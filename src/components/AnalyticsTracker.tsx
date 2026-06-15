import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";
import { IS_PRERENDER } from "@/lib/prerender";

// BrowserRouter 자식으로 마운트 → useLocation 으로 pathname 변경 감지 →
// GA4 page_view 이벤트 전송. VITE_GA_MEASUREMENT_ID 미설정 시 trackPageView no-op.
// prerender(puppeteer) 시점에는 GA 호출 차단 — 산출 HTML 안에 트래킹 호출 회귀 방지.
export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    if (IS_PRERENDER) return;
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
