// src/lib/featureFlags.ts

/**
 * 게임 서비스 활성화 여부.
 * - false: Coming Soon 모드 (정적 페이지만 노출, 심사용)
 * - true:  게임·결제·인증 전부 활성 (실서비스)
 *
 * 출시일에 Vercel 환경변수에서 VITE_GAME_ENABLED=true 로 변경.
 */
export const GAME_ENABLED =
  import.meta.env.VITE_GAME_ENABLED === "true";