import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAdSense } from "./lib/adsense";
import { initAnalytics } from "./lib/analytics";
import { initServiceWorker } from "./lib/registerSW";
import { initSentry } from "./lib/sentry";

// Sentry 영역 React 렌더링 박기 전 완료 (error boundary 영역 완료)
initSentry();
initAdSense();
initAnalytics();
initServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
