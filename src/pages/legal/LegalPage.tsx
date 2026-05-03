// src/pages/legal/LegalPage.tsx
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
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
      <Header
        right={
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← 홈으로
          </Link>
        }
      />

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