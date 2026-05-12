import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "node:fs";
import sitemap from "vite-plugin-sitemap";

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
export default defineConfig(({ mode }) => {
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
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
