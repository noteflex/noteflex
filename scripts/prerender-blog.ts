// ═══════════════════════════════════════════════════════════════
// scripts/prerender-blog.ts  (로컬 전용)
// ═══════════════════════════════════════════════════════════════
// 블로그 본문 SSG — puppeteer 로 vite preview 산출물(dist/) 위에서 각 글을
// 실제 렌더해 #root 가 본문으로 채워진 정적 HTML 스냅샷을
// prerendered/blog/{lang}/{slug}.html 에 저장.
//
// Vercel 빌드는 puppeteer/chromium 의 libnss3 등 시스템 공유 라이브러리 부재로
// 브라우저 launch 가 실패한다(@sparticuz/chromium 으로도 동일 증상). 그래서
// prerender 산출물 자체를 레포에 커밋하는 방식으로 전환 — 이 스크립트는
// 개발자 로컬에서만 실행되고, 결과 prerendered/blog/* 가 git 추적된다.
// vite build 흐름은 그 디렉토리를 dist/blog 로 복사할 뿐(브라우저 미사용).
//
// 워크플로:
//   1. .md 작성·수정
//   2. npm run build && npm run prerender:blog    (로컬, ~5분)
//   3. git add prerendered/blog && commit && push (Vercel 재빌드)
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
// ═══════════════════════════════════════════════════════════════

import fs from "node:fs";
import path from "node:path";
import { preview } from "vite";
import type { Browser } from "puppeteer-core";

/**
 * 환경 분기 launcher.
 *
 * - 로컬(macOS 등): `puppeteer` 풀 패키지 + 번들 chromium 사용. 개발자 검증 흐름 유지.
 * - Vercel(VERCEL 환경변수 존재): puppeteer 번들 chromium 은 Vercel Linux 의 시스템
 *   공유 라이브러리(libnss3 등) 부재로 실행 불가 → `@sparticuz/chromium` 의 정적 링크
 *   바이너리 + `puppeteer-core` 조합.
 *
 * dynamic import 인 이유: 한쪽 분기에서만 필요한 패키지를 top-level import 하면 다른
 * 환경에서 모듈 자체 로드 단계가 깨질 위험 → 분기 실행 시점에만 동적으로 로드.
 *
 * 호환:
 *   puppeteer ^23           = Chrome for Testing 131 번들
 *   puppeteer-core ^23      = 동일 protocol API
 *   @sparticuz/chromium ^131 = Chromium 131 (puppeteer ^23 페어)
 */
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const [{ default: chromium }, puppeteerCore] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return (await puppeteerCore.default.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })) as unknown as Browser;
  }
  const { default: puppeteer } = await import("puppeteer");
  return (await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })) as unknown as Browser;
}

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

  const browser = await launchBrowser();
  console.log(
    `[prerender-blog] browser launched (${process.env.VERCEL ? "vercel/@sparticuz" : "local/puppeteer"})`,
  );

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
        const outDir = path.join("prerendered/blog", post.lang);
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
