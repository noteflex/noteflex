// PWA Service Worker 등록. vite-plugin-pwa의 virtual:pwa-register 사용.
// vite.config.ts → injectRegister:false 와 짝. 자동 생성 registerSW.js(catch 없음)는 주입되지 않음.
//
// registerType:"prompt" — 새 SW 감지 시 자동 reload 없이 onNeedRefresh 콜백을 호출.
// UpdateBanner 컴포넌트가 "pwa-update-ready" CustomEvent를 수신해 배너를 표시.
// 사용자가 배너를 클릭할 때만 skipWaiting + reload 실행.
import { registerSW } from "virtual:pwa-register";

const CHUNK_RELOAD_KEY = "chunk_reload_attempted";

export function initServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      // 새 SW 대기 중 — 배너로 사용자에게 알림. 자동 reload 없음.
      window.dispatchEvent(
        new CustomEvent("pwa-update-ready", {
          detail: {
            update: () => updateSW(true),
          },
        }),
      );
    },
    onRegisterError(error) {
      // PWA 설치만 영향, 페이지·게임 동작 영향 X — warn 으로만 남김
      console.warn("[PWA] Service Worker 등록 거부:", error);
    },
  });

  // ChunkLoadError 1회 auto-reload.
  // 새 배포 후 브라우저가 구 hash chunk URL을 fetch하려다 404 → unhandledrejection.
  // sessionStorage 플래그로 루프 방지 — 재실패 시 reload 반복 안 함.
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String(e.reason?.message ?? e.reason ?? "");
    const isChunkError =
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("ChunkLoadError") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("dynamically imported module");
    if (!isChunkError) return;

    if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
      window.location.reload();
    }
  });
}
