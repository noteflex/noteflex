// src/components/Footer.tsx
import { Link } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";

export default function Footer() {
  const t = useT();

  return (
    <footer className="border-t border-border bg-background/50 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎼</span>
            <span className="font-semibold text-foreground">Noteflex</span>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              {t.legal.terms}
            </Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              {t.legal.privacy}
            </Link>
            <Link to="/refund" className="text-muted-foreground hover:text-foreground transition-colors">
              {t.legal.refund}
            </Link>
            <Link to="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">
              {t.legal.cookies}
            </Link>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-border/50 text-xs text-muted-foreground">
          {t.footer.copyright}
        </div>
      </div>
    </footer>
  );
}
