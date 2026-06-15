// ═══════════════════════════════════════════════════════════════
// scripts/prerender-blog.ts
// ═══════════════════════════════════════════════════════════════
// 블로그 본문 SSG — puppeteer 로 vite preview 산출물(dist/) 위에서 각 글을
// 실제 렌더해 #root 가 본문으로 채워진 정적 HTML 스냅샷을
// dist/blog/{lang}/{slug}.html 에 저장.
//
// 기존 OG 메타 주입(scripts/prerender-blog-og.ts)과 호환: og 메타·canonical 은
// 같은 injectMeta 후처리를 한 번 더 통과시켜 동일하게 박힌다.
//
// 모드:
//   SLUG=<lang>/<slug>  지정 → 1편만 (검증 단계).
//   SLUG 미지정         → 전체.
//
// 안전:
//   puppeteer page.evaluateOnNewDocument 로 window.__PRERENDER__=true 주입 →
//   IS_PRERENDER 헬퍼가 Sentry/Analytics/AdSense/SW init 과 AdBanner pushAd·
//   AnalyticsTracker trackPageView 호출을 모두 차단 → 산출 HTML 에 트래킹
//   호출이 남지 않는다.
//
// Vercel 빌드: 기본 npm run build 에는 미포함(이번 라운드 무영향). 검증 통과
//   후 build 흐름에 통합 결정.
// ═══════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { preview } from "vite";
import puppeteer from "puppeteer";

const BASE_URL = "https://noteflex.app";
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;
const PREVIEW_PORT = 4173;

interface PostMeta {
  lang: "ko" | "en";
  slug: string;
  title: string;
  description: string;
  coverImage: string;
}

function getFrontmatterValue(content: string, key: string): string | undefined {
  const dq = content.match(new RegExp(`^${key}:\\s*"([^"]*)"`, "m"));
  if (dq) return dq[1];
  const sq = content.match(new RegExp(`^${key}:\\s*'([^']*)'`, "m"));
  if (sq) return sq[1];
  const uq = content.match(new RegExp(`^${key}:\\s*([^\\n]+)`, "m"));
  return uq?.[1]?.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function collectPosts(lang: "ko" | "en"): PostMeta[] {
  const dir = path.join("src/content/blog", lang);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf-8");
      const slug =
        getFrontmatterValue(raw, "slug") ??
        f.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
      const title = getFrontmatterValue(raw, "title") ?? slug;
      const description = getFrontmatterValue(raw, "description") ?? "";
      const coverImage =
        getFrontmatterValue(raw, "coverImage") ?? DEFAULT_OG_IMAGE;
      return { lang, slug, title, description, coverImage };
    });
}

/** prerender-blog-og.ts 와 동일한 메타 주입 로직 (canonical/og:url 보강 포함). */
function injectMeta(html: string, post: PostMeta): string {
  const { lang, slug, title, description, coverImage } = post;
  const pageTitle = escapeHtml(`${title} — Noteflex`);
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const ogUrl = `${BASE_URL}/blog/${lang}/${slug}`;
  const locale = lang === "ko" ? "ko_KR" : "en_US";
  const altLocale = lang === "ko" ? "en_US" : "ko_KR";

  let h = html;
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${pageTitle}</title>`);
  h = h.replace(
    /<meta name="title" content="[^"]*"/,
    `<meta name="title" content="${pageTitle}"`,
  );
  h = h.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${safeDesc}"`,
  );
  h = h.replace(
    /<meta property="og:type" content="[^"]*"/,
    `<meta property="og:type" content="article"`,
  );
  h = h.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${safeTitle}"`,
  );
  h = h.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${safeDesc}"`,
  );
  h = h.replace(
    /<meta property="og:image" content="[^"]*"/,
    `<meta property="og:image" content="${coverImage}"`,
  );
  h = h.replace(
    /<meta property="og:locale" content="[^"]*"/,
    `<meta property="og:locale" content="${locale}"`,
  );
  h = h.replace(
    /<meta property="og:locale:alternate" content="[^"]*"/,
    `<meta property="og:locale:alternate" content="${altLocale}"`,
  );
  h = h.replace(
    /<meta name="twitter:title" content="[^"]*"/,
    `<meta name="twitter:title" content="${safeTitle}"`,
  );
  h = h.replace(
    /<meta name="twitter:description" content="[^"]*"/,
    `<meta name="twitter:description" content="${safeDesc}"`,
  );
  h = h.replace(
    /<meta name="twitter:image" content="[^"]*"/,
    `<meta name="twitter:image" content="${coverImage}"`,
  );

  if (/<meta property="og:url"/.test(h)) {
    h = h.replace(
      /<meta property="og:url" content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${ogUrl}" />`,
    );
  } else {
    h = h.replace(
      "</head>",
      `    <meta property="og:url" content="${ogUrl}" />\n  </head>`,
    );
  }
  if (/<link rel="canonical"/.test(h)) {
    h = h.replace(
      /<link rel="canonical" href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${ogUrl}" />`,
    );
  } else {
    h = h.replace(
      "</head>",
      `    <link rel="canonical" href="${ogUrl}" />\n  </head>`,
    );
  }
  return h;
}

async function main() {
  if (!fs.existsSync("dist/index.html")) {
    console.error("dist/index.html not found — run vite build first");
    process.exit(1);
  }

  const slugFilter = process.env.SLUG;
  const allPosts: PostMeta[] = [
    ...collectPosts("ko"),
    ...collectPosts("en"),
  ];
  const posts = slugFilter
    ? allPosts.filter((p) => `${p.lang}/${p.slug}` === slugFilter)
    : allPosts;

  if (posts.length === 0) {
    console.error(
      `[prerender-blog] no posts to render (SLUG=${slugFilter ?? "<all>"})`,
    );
    process.exit(1);
  }

  console.log(
    `[prerender-blog] target=${posts.length} post(s)${
      slugFilter ? ` (SLUG=${slugFilter})` : ""
    }`,
  );

  const server = await preview({
    preview: {
      port: PREVIEW_PORT,
      strictPort: true,
      host: "127.0.0.1",
    },
  });
  const baseUrl =
    server.resolvedUrls?.local[0]?.replace(/\/$/, "") ??
    `http://127.0.0.1:${PREVIEW_PORT}`;
  console.log(`[prerender-blog] vite preview ready at ${baseUrl}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let done = 0;
  let failed = 0;
  try {
    for (const post of posts) {
      const url = `${baseUrl}/blog/${post.lang}/${post.slug}`;
      const page = await browser.newPage();
      await page.evaluateOnNewDocument(() => {
        (window as unknown as { __PRERENDER__?: boolean }).__PRERENDER__ = true;
      });
      try {
        await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
        // 본문 렌더 대기 — MarkdownContent 가 <article> 로 감쌈.
        await page
          .waitForSelector("main article", { timeout: 10000 })
          .catch(() => undefined);
        const html = await page.content();
        const withMeta = injectMeta(html, post);
        const outDir = path.join("dist/blog", post.lang);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(
          path.join(outDir, `${post.slug}.html`),
          withMeta,
        );
        done++;
        console.log(`  ✓ ${post.lang}/${post.slug}`);
      } catch (err) {
        failed++;
        console.error(
          `  ✗ ${post.lang}/${post.slug}`,
          err instanceof Error ? err.message : err,
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  console.log(`[prerender-blog] done=${done} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
