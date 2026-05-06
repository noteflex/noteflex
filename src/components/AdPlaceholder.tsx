import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLang, useT } from "@/contexts/LanguageContext";
import { listBlogPosts, type BlogPostMeta } from "@/lib/markdownLoader";

export type AdPlaceholderVariant = "horizontal-random" | "vertical-blog";

interface AdPlaceholderProps {
  variant: AdPlaceholderVariant;
  excludeSlug?: string;
  className?: string;
}

function pickRandomPost(
  posts: BlogPostMeta[],
  excludeSlug?: string
): BlogPostMeta | null {
  const pool = excludeSlug
    ? posts.filter((p) => p.slug !== excludeSlug)
    : posts;
  if (pool.length === 0) return null;
  // 최신 5개 중 무작위 — 최신 영역 우선 노출 (메모리 #28 부합)
  const recent = pool.slice(0, 5);
  return recent[Math.floor(Math.random() * recent.length)];
}

export function AdPlaceholder({
  variant,
  excludeSlug,
  className,
}: AdPlaceholderProps): JSX.Element | null {
  const { lang } = useLang();
  const t = useT();
  const docLang: "ko" | "en" = lang === "ko" ? "ko" : "en";

  // 마운트 시점에 한 번 결정 — 같은 페이지 내 재렌더에도 고정
  const decision = useMemo(() => {
    const posts = listBlogPosts(docLang);
    const post = pickRandomPost(posts, excludeSlug);
    if (variant === "vertical-blog") {
      return { kind: "blog" as const, post };
    }
    // horizontal-random: 50/50 (블로그 글 없으면 프리미엄 강제)
    if (!post) return { kind: "premium" as const };
    return Math.random() < 0.5
      ? { kind: "premium" as const }
      : { kind: "blog" as const, post };
  }, [variant, excludeSlug, docLang]);

  if (variant === "vertical-blog") {
    if (decision.kind !== "blog" || !decision.post) {
      return renderPremiumVertical(t, className);
    }
    return renderBlogVertical(decision.post, t, className);
  }

  // horizontal-random
  if (decision.kind === "premium") {
    return renderPremiumHorizontal(t, className);
  }
  if (!decision.post) return renderPremiumHorizontal(t, className);
  return renderBlogHorizontal(decision.post, t, className);
}

// ─── 수평형 (프리미엄) ────────────────────────────────
function renderPremiumHorizontal(
  t: ReturnType<typeof useT>,
  className?: string
): JSX.Element {
  const copy = t.adPlaceholder.premium;
  return (
    <Link
      to="/dashboard?upgrade=1"
      className={`block w-full rounded-lg border border-primary/40 bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-4 hover:border-primary/60 hover:from-primary/10 hover:to-primary/20 transition-colors ${className ?? ""}`}
      style={{ minHeight: 90 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {copy.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {copy.subtitle}
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-primary border border-primary/40 rounded-md px-3 py-1.5">
          {copy.cta}
        </span>
      </div>
    </Link>
  );
}

// ─── 수평형 (블로그 추천) ──────────────────────────────
function renderBlogHorizontal(
  post: BlogPostMeta,
  t: ReturnType<typeof useT>,
  className?: string
): JSX.Element {
  const copy = t.adPlaceholder.blog;
  return (
    <Link
      to={`/blog/${post.slug}`}
      className={`block w-full rounded-lg border border-border bg-card px-4 py-4 hover:border-foreground/40 transition-colors ${className ?? ""}`}
      style={{ minHeight: 90 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {post.category && (
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              {post.category}
            </p>
          )}
          <p className="text-sm font-semibold text-foreground line-clamp-2">
            {post.title}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {copy.readMore} →
        </span>
      </div>
    </Link>
  );
}

// ─── 수직형 (블로그 카드) ──────────────────────────────
function renderBlogVertical(
  post: BlogPostMeta,
  t: ReturnType<typeof useT>,
  className?: string
): JSX.Element {
  const copy = t.adPlaceholder.blog;
  return (
    <Link
      to={`/blog/${post.slug}`}
      className={`flex flex-col rounded-lg border border-border bg-card p-3 hover:border-foreground/40 transition-colors w-full ${className ?? ""}`}
      style={{ minHeight: 240 }}
    >
      {post.category && (
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          {post.category}
        </p>
      )}
      <p className="text-sm font-semibold text-foreground leading-snug mb-2 line-clamp-3">
        {post.title}
      </p>
      {post.description && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 mb-3">
          {post.description}
        </p>
      )}
      <span className="mt-auto text-xs text-primary">
        {copy.readMore} →
      </span>
    </Link>
  );
}

// ─── 수직형 (프리미엄 fallback) ────────────────────────
function renderPremiumVertical(
  t: ReturnType<typeof useT>,
  className?: string
): JSX.Element {
  const copy = t.adPlaceholder.premium;
  return (
    <Link
      to="/dashboard?upgrade=1"
      className={`flex flex-col rounded-lg border border-primary/40 bg-gradient-to-b from-primary/5 to-primary/10 p-3 hover:border-primary/60 transition-colors w-full ${className ?? ""}`}
      style={{ minHeight: 240 }}
    >
      <p className="text-sm font-semibold text-foreground leading-snug mb-2">
        {copy.title}
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
        {copy.subtitle}
      </p>
      <span className="mt-auto inline-block text-xs font-medium text-primary border border-primary/40 rounded-md px-3 py-1.5 text-center">
        {copy.cta}
      </span>
    </Link>
  );
}
