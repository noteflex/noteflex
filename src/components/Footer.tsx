import { Link } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";

export default function Footer() {
  const t = useT();

  return (
    <footer className="border-t border-border bg-background/50 mt-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* 4섹션 그리드 — Company → Product → Support → Legal */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {t.footer.company}
            </p>
            <ul className="space-y-1.5">
              <li>
                <Link to="/about" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.footer.about}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.footer.contact}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {t.footer.product}
            </p>
            <ul className="space-y-1.5">
              <li>
                <Link to="/pricing" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.footer.pricing}
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.footer.blog}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {t.footer.support}
            </p>
            <ul className="space-y-1.5">
              <li>
                <Link to="/faq" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.footer.faq}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              {t.footer.legalSection}
            </p>
            <ul className="space-y-1.5">
              <li>
                <Link to="/terms" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.legal.terms}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.legal.privacy}
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.legal.cookies}
                </Link>
              </li>
              <li>
                <Link to="/refund" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.legal.refund}
                </Link>
              </li>
              <li>
                <Link to="/business-info" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.legal.businessInfo}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-border/50 pt-4 text-xs text-muted-foreground">
          <p>{t.footer.copyright}</p>
        </div>

      </div>
    </footer>
  );
}
