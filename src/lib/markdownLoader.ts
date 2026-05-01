// src/lib/markdownLoader.ts

export interface MarkdownDoc {
  meta: Record<string, string>;
  content: string;
}

export interface BlogPostMeta {
  slug: string;
  lang: string;
  title: string;
  date: string;
  description: string;
  category: string;
}

export interface BlogPost extends MarkdownDoc {
  slug: string;
}

function parseFrontmatter(raw: string): MarkdownDoc {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, content: raw };
  }
  const meta: Record<string, string> = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    const value = line
      .slice(colonIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key) meta[key] = value;
  });
  return { meta, content: match[2] };
}

// ── Legal: 빌드 시점 즉시 로드 (양 적음) ───────────────────
const legalModules = import.meta.glob("/src/content/legal/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export function loadLegalContent(slug: string): MarkdownDoc {
  const path = `/src/content/legal/${slug}.md`;
  const raw = legalModules[path];
  if (!raw) {
    return {
      meta: {},
      content: "> 이 문서는 곧 게시됩니다.",
    };
  }
  return parseFrontmatter(raw);
}

// ── Blog ──────────────────────────────────────────────
const blogModulesEager = import.meta.glob("/src/content/blog/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const blogModulesLazy = import.meta.glob("/src/content/blog/**/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

function pathToSlug(path: string): string {
  // "/src/content/blog/ko/2026-05-01-clef-guide.md" → "ko/2026-05-01-clef-guide"
  const match = path.match(/\/blog\/(.+)\.md$/);
  return match ? match[1] : path;
}

export function listBlogPosts(lang?: "ko" | "en"): BlogPostMeta[] {
  return Object.entries(blogModulesEager)
    .map(([path, raw]) => {
      const slug = pathToSlug(path);
      const { meta } = parseFrontmatter(raw);
      const [postLang] = slug.split("/");
      return {
        slug,
        lang: postLang,
        title: meta.title || slug,
        date: meta.date || "",
        description: meta.description || "",
        category: meta.category || "",
      };
    })
    .filter((post) => !lang || post.lang === lang)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function loadBlogPost(slug: string): Promise<BlogPost | null> {
  const path = `/src/content/blog/${slug}.md`;
  const loader = blogModulesLazy[path];
  if (!loader) return null;
  const raw = await loader();
  const parsed = parseFrontmatter(raw);
  return { slug, ...parsed };
}
