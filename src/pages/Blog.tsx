// src/pages/Blog.tsx
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { listBlogPosts } from "@/lib/markdownLoader";
import { AdBanner } from "@/components/AdBanner";
import { InFeedAd } from "@/components/InFeedAd";
import { getSlot } from "@/lib/adsense";

const INFEED_AD_INTERVAL = 6;

const CATEGORIES: Record<"ko" | "en", string[]> = {
  ko: ["all", "초견의 정석", "실전 연습 가이드", "음악 이론 & 화성학", "뮤직 테크 & 미래"],
  en: ["all", "Sight-Reading Lab", "Practice Hub", "Theory & Harmony", "Music Tech"],
};

const UI: Record<"ko" | "en", { title: string; subtitle: string; home: string; all: string; empty: string }> = {
  ko: {
    title: "블로그",
    subtitle: "악보 독보, 음악 학습, 그리고 Noteflex 이야기",
    home: "← 홈으로",
    all: "전체",
    empty: "아직 게시된 글이 없습니다.",
  },
  en: {
    title: "Blog",
    subtitle: "Sight-reading, music learning, and Noteflex stories",
    home: "← Home",
    all: "All",
    empty: "No posts yet.",
  },
};

export default function Blog() {
  const [lang, setLang] = useState<"ko" | "en">(() => {
    return (localStorage.getItem("noteflex.blog_lang") as "ko" | "en") || "ko";
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "all";

  const t = UI[lang];
  const allPosts = listBlogPosts(lang);
  const posts =
    category === "all" ? allPosts : allPosts.filter((p) => p.category === category);

  function handleLangChange(newLang: "ko" | "en") {
    setLang(newLang);
    setSearchParams({});
    localStorage.setItem("noteflex.blog_lang", newLang);
  }

  function handleCategoryChange(cat: string) {
    if (cat === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ category: cat });
    }
  }

  const blogRight = (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => handleLangChange("ko")}
          className={
            lang === "ko"
              ? "font-bold text-foreground"
              : "text-muted-foreground hover:text-foreground transition-colors"
          }
        >
          한국어
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          onClick={() => handleLangChange("en")}
          className={
            lang === "en"
              ? "font-bold text-foreground"
              : "text-muted-foreground hover:text-foreground transition-colors"
          }
        >
          English
        </button>
      </div>
      <Link
        to="/"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {t.home}
      </Link>
    </div>
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
          <h1 className="text-3xl font-bold mb-2 text-foreground">{t.title}</h1>
          <p className="text-muted-foreground mb-6">{t.subtitle}</p>

          <div className="flex flex-wrap gap-2 mb-8">
            {CATEGORIES[lang].map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  category === cat
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                }`}
              >
                {cat === "all" ? t.all : cat}
              </button>
            ))}
          </div>

          {posts.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">{t.empty}</p>
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
                  ? [card, <InFeedAd key={`infeed-${idx}`} lang={lang} />]
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
