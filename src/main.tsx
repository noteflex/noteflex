import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAdSense } from "./lib/adsense";

initAdSense();

createRoot(document.getElementById("root")!).render(<App />);
