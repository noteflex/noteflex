// src/pages/legal/LegalPage.tsx
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import MarkdownContent from "@/components/MarkdownContent";
import { useLang, useT } from "@/contexts/LanguageContext";
import { loadLegalContent } from "@/lib/markdownLoader";

export type LegalSlug = "terms" | "privacy" | "refund" | "cookies";

interface Props {
  slug: LegalSlug;
}

export default function LegalPage({ slug }: Props) {
  const { lang } = useLang();
  const t = useT();
  // ja·zh = en fallback (strings.ts와 일관, Phase 3 영역)
  const docLang = lang === "ko" ? "ko" : "en";
  const { meta, content } = loadLegalContent(slug, docLang);

  const titleMap: Record<LegalSlug, string> = {
    terms: t.legal.terms,
    privacy: t.legal.privacy,
    refund: t.legal.refund,
    cookies: t.legal.cookies,
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        right={
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.legal.home}
          </Link>
        }
      />

      <main className="flex-1 max-w-3xl mx-auto px-4 py-10 w-full">
        <h1 className="text-3xl font-bold mb-2 text-foreground">
          {titleMap[slug]}
        </h1>
        {meta.effective && (
          <p className="text-sm text-muted-foreground mb-10">
            {t.legal.effectiveDate} {meta.effective}
          </p>
        )}
        {!meta.effective && <div className="mb-10" />}
        <MarkdownContent>{content}</MarkdownContent>
      </main>

      <Footer />
    </div>
  );
}
