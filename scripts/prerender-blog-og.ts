import fs from "fs";
import path from "path";

const BASE_URL = "https://noteflex.app";
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

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
      const coverImage = getFrontmatterValue(raw, "coverImage") ?? DEFAULT_OG_IMAGE;
      return { lang, slug, title, description, coverImage };
    });
}

function injectMeta(baseHtml: string, post: PostMeta): string {
  const { lang, slug, title, description, coverImage } = post;
  const pageTitle = escapeHtml(`${title} — Noteflex`);
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const ogUrl = `${BASE_URL}/blog/${lang}/${slug}`;
  const locale = lang === "ko" ? "ko_KR" : "en_US";
  const altLocale = lang === "ko" ? "en_US" : "ko_KR";

  let h = baseHtml;

  h = h.replace(/<title>[^<]*<\/title>/, `<title>${pageTitle}</title>`);
  h = h.replace(/<meta name="title" content="[^"]*"/, `<meta name="title" content="${pageTitle}"`);
  h = h.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${safeDesc}"`);
  h = h.replace(/<meta property="og:type" content="[^"]*"/, `<meta property="og:type" content="article"`);
  h = h.replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${safeTitle}"`);
  h = h.replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${safeDesc}"`);
  h = h.replace(/<meta property="og:image" content="[^"]*"/, `<meta property="og:image" content="${coverImage}"`);
  h = h.replace(/<meta property="og:locale" content="[^"]*"/, `<meta property="og:locale" content="${locale}"`);
  h = h.replace(/<meta property="og:locale:alternate" content="[^"]*"/, `<meta property="og:locale:alternate" content="${altLocale}"`);
  h = h.replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${safeTitle}"`);
  h = h.replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${safeDesc}"`);
  h = h.replace(/<meta name="twitter:image" content="[^"]*"/, `<meta name="twitter:image" content="${coverImage}"`);

  // og:url + canonical — </head> 직전 삽입
  h = h.replace(
    "</head>",
    `    <meta property="og:url" content="${ogUrl}" />\n    <link rel="canonical" href="${ogUrl}" />\n  </head>`
  );

  return h;
}

const distIndexPath = "dist/index.html";
if (!fs.existsSync(distIndexPath)) {
  console.error("dist/index.html not found — run vite build first");
  process.exit(1);
}

const baseHtml = fs.readFileSync(distIndexPath, "utf-8");
const posts: PostMeta[] = [...collectPosts("ko"), ...collectPosts("en")];

let count = 0;
for (const post of posts) {
  const outDir = path.join("dist/blog", post.lang);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${post.slug}.html`), injectMeta(baseHtml, post));
  count++;
}

const koCnt = posts.filter((p) => p.lang === "ko").length;
const enCnt = posts.filter((p) => p.lang === "en").length;
console.log(`Prerendered ${count} blog post HTML files`);
console.log(`  - KO: ${koCnt}  EN: ${enCnt}`);
