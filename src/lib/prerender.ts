/**
 * Prerender 런타임 플래그.
 *
 * scripts/prerender-blog.ts 의 puppeteer 가 페이지 로드 직전에
 *   window.__PRERENDER__ = true
 * 를 주입한다. 일반 SPA 사용자에겐 undefined → false 로 평가되어 영향 0.
 *
 * import.meta.env.VITE_PRERENDER 대신 런타임 플래그를 채택한 이유:
 *   - 빌드타임 환경변수는 inline 되므로 prerender 용 빌드와 SPA 용 빌드가
 *     별도로 필요해진다(같은 dist 를 두 용도로 못 씀).
 *   - 런타임 플래그면 단일 빌드 산출물로 두 가지 모드를 모두 만족.
 *   - prerender 시 차단 + 일반 빌드 영향 0 이라는 목표는 동일하게 달성.
 *
 * Node SSR 안전: typeof window 체크.
 */
export const IS_PRERENDER: boolean =
  typeof window !== "undefined" &&
  (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__ === true;
