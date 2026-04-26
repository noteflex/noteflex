// src/pages/legal/LegalPage.tsx
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import MarkdownContent from "@/components/MarkdownContent";
import { loadLegalContent } from "@/lib/markdownLoader";

interface Props {
  slug: "terms" | "privacy" | "refund" | "cookies";
  title: string;
}

export default function LegalPage({ slug, title }: Props) {
  const { meta, content } = loadLegalContent(slug);

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
        <h1 className="text-3xl font-bold mb-2 text-foreground">{title}</h1>
        {meta.effective && (
          <p className="text-sm text-muted-foreground mb-10">
            시행일: {meta.effective}
          </p>
        )}
        {!meta.effective && <div className="mb-10" />}
        <MarkdownContent>{content}</MarkdownContent>
      </main>

      <Footer />
    </div>
  );
}