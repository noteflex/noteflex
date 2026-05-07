import { Link } from "react-router-dom";
import { useT } from "@/contexts/LanguageContext";

export default function Footer() {
  const t = useT();

  return (
    <footer className="border-t border-border bg-background/50 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* 4섹션 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {t.footer.product}
            </p>
            <ul className="space-y-2">
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
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {t.footer.company}
            </p>
            <ul className="space-y-2">
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
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {t.footer.support}
            </p>
            <ul className="space-y-2">
              <li>
                <Link to="/faq" className="text-sm text-foreground/70 hover:text-foreground transition-colors">
                  {t.footer.faq}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {t.footer.legalSection}
            </p>
            <ul className="space-y-2">
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
            </ul>
          </div>
        </div>

        {/* Company Info + Copyright */}
        <div className="border-t border-border/50 pt-6 space-y-1 text-xs text-muted-foreground">
          <p>{t.footer.companyName} · {t.footer.ceo}</p>
          <p>{t.footer.bizReg} · {t.footer.ecommerceReg}</p>
          <p>{t.footer.address}</p>
          <p>{t.footer.email}</p>
          <p className="mt-3">{t.footer.copyright}</p>
        </div>

      </div>
    </footer>
  );
}
