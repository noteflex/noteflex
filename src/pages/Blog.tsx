// src/pages/Blog.tsx
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import { listBlogPosts } from "@/lib/markdownLoader";

export default function Blog() {
  const posts = listBlogPosts();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-base font-bold">
            <span className="text-xl">🎼</span> Noteflex
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← 홈으로
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 w-full">
        <h1 className="text-3xl font-bold mb-2 text-foreground">블로그</h1>
        <p className="text-muted-foreground mb-10">
          악보 독보, 음악 학습, 그리고 Noteflex 이야기
        </p>

        {posts.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center">
            아직 게시된 글이 없습니다.
          </p>
        ) : (
          <ul className="space-y-6">
            {posts.map((post) => (
              <li
                key={post.slug}
                className="border-b border-border pb-6 last:border-b-0"
              >
                <Link to={`/blog/${post.slug}`} className="block group">
                  <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                    {post.title}
                  </h2>
                  {post.date && (
                    <p className="text-xs text-muted-foreground mb-2">{post.date}</p>
                  )}
                  {post.excerpt && (
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {post.excerpt}
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