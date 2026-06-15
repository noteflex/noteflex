import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAdSense } from "./lib/adsense";
import { initAnalytics } from "./lib/analytics";
import { initServiceWorker } from "./lib/registerSW";
import { initSentry } from "./lib/sentry";
import { IS_PRERENDER } from "./lib/prerender";

// prerender(puppeteer) 시점에는 외부 SDK 부팅을 모두 건너뛴다 — 정적 HTML 산출
// 단계에서 Sentry/AdSense/Analytics/SW 가 네트워크/스토리지를 건드릴 필요가 없고,
// 산출 HTML 안에 푸시·트래킹 호출이 남는 회귀를 막기 위함.
// 일반 SPA 사용자에겐 IS_PRERENDER=false → 기존 흐름 그대로.
if (!IS_PRERENDER) {
  initSentry();
  initAdSense();
  initAnalytics();
  initServiceWorker();
}

createRoot(document.getElementById("root")!).render(<App />);
