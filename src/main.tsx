import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAdSense } from "./lib/adsense";
import { initSentry } from "./lib/sentry";

// Sentry 영역 React 렌더링 박기 전 박음 (error boundary 영역 박음)
initSentry();
initAdSense();

createRoot(document.getElementById("root")!).render(<App />);
