import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

// BrowserRouter 자식으로 마운트 → useLocation 으로 pathname 변경 감지 →
// GA4 page_view 이벤트 전송. VITE_GA_MEASUREMENT_ID 미설정 시 trackPageView no-op.
export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
