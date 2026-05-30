// src/lib/markdownLoader.ts

export interface MarkdownDoc {
  meta: Record<string, string>;
  content: string;
}

export interface BlogPostMeta {
  /** "ko/chunking-music-reading" — URL용 깨끗한 슬러그 (frontmatter slug 우선, 없으면 파일명에서 날짜 제거) */
  slug: string;
  lang: string;
  title: string;
  date: string;
  description: string;
  category: string;
  coverImage?: string;
  coverImageAlt?: string;
  coverImageSource?: string;
  coverImageLicense?: string;
  coverImageCredit?: string;
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

export function loadLegalContent(
  slug: string,
  lang: "ko" | "en" = "ko"
): MarkdownDoc {
  const path =
    lang === "en"
      ? `/src/content/legal/${slug}.en.md`
      : `/src/content/legal/${slug}.md`;
  const raw = legalModules[path];
  if (!raw) {
    if (lang === "en") {
      const koPath = `/src/content/legal/${slug}.md`;
      const koRaw = legalModules[koPath];
      if (koRaw) return parseFrontmatter(koRaw);
    }
    return {
      meta: {},
      content:
        lang === "en"
          ? "> This document is being drafted."
          : "> 이 문서는 곧 게시됩니다.",
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

/**
 * 블로그 인덱스 — 빌드 시 1회 계산.
 * cleanSlug: URL용 깨끗한 슬러그 (frontmatter `slug:` 우선, 없으면 파일명에서 `YYYY-MM-DD-` prefix 제거)
 * fileSlug:  파일명에서 `.md`만 떼어낸 raw 형식 (옛 URL 호환용)
 * combinedSlug: "lang/cleanSlug" — Blog 목록·BlogPost·AdPlaceholder가 사용하는 URL 슬러그 형식
 */
interface BlogIndexEntry {
  path: string;
  raw: string;
  lang: "ko" | "en";
  cleanSlug: string;
  fileSlug: string;
  combinedSlug: string;
  meta: Record<string, string>;
}

const blogIndex: BlogIndexEntry[] = Object.entries(blogModulesEager)
  .map(([path, raw]): BlogIndexEntry | null => {
    const m = path.match(/\/blog\/(ko|en)\/(.+)\.md$/);
    if (!m) return null;
    const lang = m[1] as "ko" | "en";
    const fileSlug = m[2];
    const parsed = parseFrontmatter(raw);
    const cleanSlug =
      parsed.meta.slug ||
      fileSlug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    return {
      path,
      raw,
      lang,
      cleanSlug,
      fileSlug,
      combinedSlug: `${lang}/${cleanSlug}`,
      meta: parsed.meta,
    };
  })
  .filter((e): e is BlogIndexEntry => e !== null);

export function listBlogPosts(lang?: "ko" | "en"): BlogPostMeta[] {
  return blogIndex
    .filter((e) => !lang || e.lang === lang)
    .map((e) => ({
      slug: e.combinedSlug,
      lang: e.lang,
      title: e.meta.title || e.combinedSlug,
      date: e.meta.date || "",
      description: e.meta.description || "",
      category: e.meta.category || "",
      coverImage: e.meta.coverImage || undefined,
      coverImageAlt: e.meta.coverImageAlt || undefined,
      coverImageSource: e.meta.coverImageSource || undefined,
      coverImageLicense: e.meta.coverImageLicense || undefined,
      coverImageCredit: e.meta.coverImageCredit || undefined,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * 글 로드 — slug는 `"lang/cleanSlug"` 형식.
 * 1) combinedSlug(깨끗한 슬러그) 매칭 우선
 * 2) 옛 URL 호환: fileSlug(날짜 prefix 포함) 매칭 fallback
 */
export async function loadBlogPost(slug: string): Promise<BlogPost | null> {
  let entry = blogIndex.find((e) => e.combinedSlug === slug);

  if (!entry) {
    const m = slug.match(/^(ko|en)\/(.+)$/);
    if (m) {
      const [, lang, rest] = m;
      entry = blogIndex.find((e) => e.lang === lang && e.fileSlug === rest);
    }
  }

  if (!entry) return null;
  // 본문은 eager에 이미 있으니 동기 파싱
  const parsed = parseFrontmatter(entry.raw);
  return { slug: entry.combinedSlug, meta: parsed.meta, content: parsed.content };
}

/**
 * URL slug가 옛 형식(YYYY-MM-DD-foo)이면 새 형식(foo)으로 변환.
 * 새 형식이면 그대로 반환. 찾지 못하면 null.
 * BlogPost가 옛 URL → 새 URL redirect 판단에 사용.
 */
export function resolveCleanSlug(
  lang: "ko" | "en",
  slug: string,
): string | null {
  // 이미 cleanSlug 형식이면 그대로
  const direct = blogIndex.find(
    (e) => e.lang === lang && e.cleanSlug === slug,
  );
  if (direct) return direct.cleanSlug;
  // 옛 fileSlug 형식이면 cleanSlug로 변환
  const legacy = blogIndex.find(
    (e) => e.lang === lang && e.fileSlug === slug,
  );
  if (legacy) return legacy.cleanSlug;
  return null;
}
