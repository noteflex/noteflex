// src/pages/BlogPost.tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import MarkdownContent from "@/components/MarkdownContent";
import { useT } from "@/contexts/LanguageContext";
import { loadBlogPost, type BlogPost as BlogPostType } from "@/lib/markdownLoader";
import { AdBanner } from "@/components/AdBanner";
import { getSlot } from "@/lib/adsense";

export default function BlogPost() {
  // URL :lang 유지 — 콘텐츠 lang은 URL 박힌 값 사용 (SEO·linkability 영역)
  const { lang, slug } = useParams<{ lang: string; slug: string }>();
  const t = useT();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!lang || !slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadBlogPost(`${lang}/${slug}`).then((p) => {
      if (cancelled) return;
      if (!p) {
        setNotFound(true);
      } else {
        setPost(p);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [lang, slug]);

  const postCategory = post?.meta.category || "";
  const backUrl = postCategory
    ? `/blog?category=${encodeURIComponent(postCategory)}`
    : "/blog";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        right={
          <Link
            to={backUrl}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.blog.backToList}
          </Link>
        }
      />

      {/* 데스크톱: 좌/우 사이드바 광고 | 모바일: 없음 (하단 배너로 대체) */}
      <div className="flex-1 flex justify-center">
        <aside className="hidden lg:flex flex-col items-end pt-10 pr-4 w-40 shrink-0 sticky top-16 self-start">
          <AdBanner slot={getSlot("SIDEBAR_LEFT")} format="vertical" />
        </aside>

        <main className="flex-1 max-w-3xl min-w-0 px-4 py-10">
          {loading ? (
            <p className="text-muted-foreground">{t.blog.loading}</p>
          ) : notFound || !post ? (
            <div className="py-12 text-center">
              <h1 className="text-2xl font-bold mb-2">{t.blog.notFound}</h1>
              <p className="text-muted-foreground mb-6">{t.blog.notFoundBody}</p>
              <Link to={backUrl} className="text-primary underline">
                {t.blog.backToBlog}
              </Link>
            </div>
          ) : (
            <>
              {post.meta.category && (
                <p className="text-xs text-muted-foreground mb-2">{post.meta.category}</p>
              )}
              <h1 className="text-3xl font-bold mb-2 text-foreground">
                {post.meta.title || post.slug}
              </h1>
              {post.meta.date && (
                <p className="text-sm text-muted-foreground mb-10">{post.meta.date}</p>
              )}
              <MarkdownContent>{post.content}</MarkdownContent>
            </>
          )}
        </main>

        <aside className="hidden lg:flex flex-col items-start pt-10 pl-4 w-40 shrink-0 sticky top-16 self-start">
          <AdBanner slot={getSlot("SIDEBAR_RIGHT")} format="vertical" />
        </aside>
      </div>

      {/* 모바일 하단 배너 (데스크톱에서는 사이드바가 대신함) */}
      <AdBanner
        slot={getSlot("BANNER")}
        format="horizontal"
        className="lg:hidden max-w-3xl mx-auto w-full px-4 py-4"
      />

      <Footer />
    </div>
  );
}
