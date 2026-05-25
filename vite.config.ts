import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "node:fs";
import sitemap from "vite-plugin-sitemap";
import { VitePWA } from "vite-plugin-pwa";

// 블로그 slug 추출: src/content/blog/en/*.md 파일명에서 추출
// 파일명 패턴: YYYY-MM-DD-slug-name.md → slug-name
function getBlogRoutes(): string[] {
  const blogDir = path.resolve(__dirname, "src/content/blog/en");
  if (!fs.existsSync(blogDir)) return [];
  const slugs = fs.readdirSync(blogDir)
    .filter(f => f.endsWith(".md"))
    .map(f => {
      const m = f.match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/);
      return m ? m[1] : null;
    })
    .filter(Boolean) as string[];
  return slugs.flatMap(slug => [`/blog/en/${slug}`, `/blog/ko/${slug}`]);
}

// https://vitejs.dev/config/
export default defineConfig(() => {
  const blogRoutes = getBlogRoutes();

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://rcwydfzkuhfcnnbqjmpp.supabase.co"),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjd3lkZnprdWhmY25uYnFqbXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDY2ODcsImV4cCI6MjA5MDg4MjY4N30.FX1VAUv-tbKtgj1sW5m-rqOLNn5McUZ_uIZDWEvQTSs"),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        includeAssets: ["favicon.svg", "favicon.ico", "favicon-32x32.png", "apple-touch-icon.png"],
        manifest: {
          name: "Noteflex",
          short_name: "Noteflex",
          description: "음악 초견 훈련 앱 — 음표 인식 속도를 빠르게",
          lang: "ko",
          start_url: "/",
          scope: "/",
          display: "standalone",
          theme_color: "#D3224E",
          background_color: "#faf8f0",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/index.html",
          // Supabase API·외부 요청은 SW가 가로채지 않음
          navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/realtime\//],
          // 메인 번들 ~2.8MB → 기본 2MB 초과, 4MB로 상향
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
      }),
      sitemap({
        hostname: "https://noteflex.app",
        dynamicRoutes: [
          "/about",
          "/contact",
          "/pricing",
          "/faq",
          "/blog",
          "/terms",
          "/privacy",
          "/cookies",
          "/refund",
          ...blogRoutes,
        ],
        // Google Search Console 인증 파일·보호 라우트 제외
        exclude: ["/google8962581177005031"],
        changefreq: "weekly",
        priority: 0.7,
        lastmod: new Date(),
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
