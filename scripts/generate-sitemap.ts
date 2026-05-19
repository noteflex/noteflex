import fs from "fs";
import path from "path";

const BASE_URL = "https://noteflex.app";
const TODAY = new Date().toISOString().split("T")[0];

const STATIC_PAGES = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/pricing", priority: 0.9, changefreq: "monthly" },
  { path: "/blog", priority: 0.9, changefreq: "daily" },
  { path: "/about", priority: 0.7, changefreq: "monthly" },
  { path: "/contact", priority: 0.6, changefreq: "monthly" },
  { path: "/faq", priority: 0.7, changefreq: "monthly" },
  { path: "/terms", priority: 0.3, changefreq: "yearly" },
  { path: "/privacy", priority: 0.3, changefreq: "yearly" },
  { path: "/refund", priority: 0.3, changefreq: "yearly" },
  { path: "/cookies", priority: 0.3, changefreq: "yearly" },
];

function collectBlogPosts(lang: "ko" | "en"): { slug: string; date: string }[] {
  const dir = path.join("src/content/blog", lang);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const content = fs.readFileSync(path.join(dir, f), "utf-8");
      const slugMatch = content.match(/^slug:\s*["']?([^"'\n]+)["']?/m);
      const dateMatch = content.match(/^date:\s*["']?([^"'\n]+)["']?/m);
      return {
        slug:
          slugMatch?.[1] ??
          f.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, ""),
        date: dateMatch?.[1] ?? TODAY,
      };
    });
}

const koPosts = collectBlogPosts("ko");
const enPosts = collectBlogPosts("en");

const urls: string[] = [];

STATIC_PAGES.forEach((p) => {
  urls.push(`  <url>
    <loc>${BASE_URL}${p.path}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);
});

koPosts.forEach((p) => {
  urls.push(`  <url>
    <loc>${BASE_URL}/blog/ko/${p.slug}</loc>
    <lastmod>${p.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
});

enPosts.forEach((p) => {
  urls.push(`  <url>
    <loc>${BASE_URL}/blog/en/${p.slug}</loc>
    <lastmod>${p.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
});

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

fs.writeFileSync("public/sitemap.xml", xml);
console.log(
  `Generated sitemap.xml with ${STATIC_PAGES.length + koPosts.length + enPosts.length} URLs`
);
console.log(`  - Static: ${STATIC_PAGES.length}`);
console.log(`  - KO posts: ${koPosts.length}`);
console.log(`  - EN posts: ${enPosts.length}`);
