// PWA Service Worker 등록. vite-plugin-pwa의 virtual:pwa-register 사용.
// vite.config.ts → injectRegister:false 와 짝. 자동 생성 registerSW.js(catch 없음)는 주입되지 않음.
// onRegisterError: register Promise rejection 을 silent 처리 (Android 6.0.1·incognito·SW 차단 환경 등에서
// unhandled rejection → Sentry noise 방지).
import { registerSW } from "virtual:pwa-register";

export function initServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  registerSW({
    immediate: false,
    onRegisterError(error) {
      // PWA 설치만 영향, 페이지·게임 동작 영향 X — warn 으로만 남김
      console.warn("[PWA] Service Worker 등록 거부:", error);
    },
  });
}
