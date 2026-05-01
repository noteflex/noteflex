// src/pages/Blog.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import { listBlogPosts } from "@/lib/markdownLoader";

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
  const [category, setCategory] = useState<string>("all");

  const t = UI[lang];
  const allPosts = listBlogPosts(lang);
  const posts =
    category === "all" ? allPosts : allPosts.filter((p) => p.category === category);

  function handleLangChange(newLang: "ko" | "en") {
    setLang(newLang);
    setCategory("all");
    localStorage.setItem("noteflex.blog_lang", newLang);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-base font-bold">
            <span className="text-xl">🎼</span> Noteflex
          </Link>
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
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 w-full">
        <h1 className="text-3xl font-bold mb-2 text-foreground">{t.title}</h1>
        <p className="text-muted-foreground mb-6">{t.subtitle}</p>

        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES[lang].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
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
            {posts.map((post) => (
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
            ))}
          </ul>
        )}
      </main>

      <Footer />
    </div>
  );
}
