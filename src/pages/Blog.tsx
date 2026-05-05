// src/pages/Blog.tsx
import { Link, useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { useLang, useT } from "@/contexts/LanguageContext";
import { listBlogPosts } from "@/lib/markdownLoader";
import { AdBanner } from "@/components/AdBanner";
import { InFeedAd } from "@/components/InFeedAd";
import { getSlot } from "@/lib/adsense";

const INFEED_AD_INTERVAL = 6;

export default function Blog() {
  const { lang } = useLang();
  const t = useT();
  // ja·zh = en fallback (마크다운 영어 콘텐츠 노출, Phase 3 영역)
  const docLang: "ko" | "en" = lang === "ko" ? "ko" : "en";

  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "all";

  const allPosts = listBlogPosts(docLang);
  const posts =
    category === "all" ? allPosts : allPosts.filter((p) => p.category === category);

  function handleCategoryChange(cat: string) {
    if (cat === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ category: cat });
    }
  }

  const blogRight = (
    <Link
      to="/"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      {t.blog.home}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header right={blogRight} />

      {/* 데스크톱: 좌/우 사이드바 광고 | 모바일: 없음 (하단 배너로 대체) */}
      <div className="flex-1 flex justify-center">
        <aside className="hidden lg:flex flex-col items-end pt-10 pr-4 w-40 shrink-0 sticky top-16 self-start">
          <AdBanner slot={getSlot("SIDEBAR_LEFT")} format="vertical" />
        </aside>

        <main className="flex-1 max-w-3xl min-w-0 px-4 py-10">
          <h1 className="text-3xl font-bold mb-2 text-foreground">{t.blog.title}</h1>
          <p className="text-muted-foreground mb-6">{t.blog.subtitle}</p>

          <div className="flex flex-wrap gap-2 mb-8">
            {t.blog.categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  category === cat
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                }`}
              >
                {cat === "all" ? t.blog.all : cat}
              </button>
            ))}
          </div>

          {posts.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">{t.blog.empty}</p>
          ) : (
            <ul className="space-y-6">
              {posts.flatMap((post, idx) => {
                const card = (
                  <li
                    key={post.slug}
                    className="border-b border-border pb-6 last:border-b-0"
                  >
                    <Link to={`/blog/${post.slug}`} className="block group">
                      {post.category && (
                        <span className="text-xs text-muted-foreground mb-1 block">
                          {post.category}
                        </span>
                      )}
                      <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                        {post.title}
                      </h2>
                      {post.date && (
                        <p className="text-xs text-muted-foreground mb-2">{post.date}</p>
                      )}
                      {post.description && (
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {post.description}
                        </p>
                      )}
                    </Link>
                  </li>
                );
                const showAdAfter = (idx + 1) % INFEED_AD_INTERVAL === 0;
                return showAdAfter
                  ? [card, <InFeedAd key={`infeed-${idx}`} />]
                  : [card];
              })}
            </ul>
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
