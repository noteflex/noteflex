// src/components/Footer.tsx
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background/50 mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎼</span>
            <span className="font-semibold text-foreground">Noteflex</span>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Link to="/blog" className="text-muted-foreground hover:text-foreground transition-colors">
              블로그
            </Link>
            <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              이용약관
            </Link>
            <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              개인정보처리방침
            </Link>
            <Link to="/refund" className="text-muted-foreground hover:text-foreground transition-colors">
              환불 정책
            </Link>
            <Link to="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">
              쿠키 정책
            </Link>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center justify-between text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} Noteflex. All rights reserved.</div>
          <a href="mailto:admin@noteflex.app" className="hover:text-foreground transition-colors">admin@noteflex.app</a>
        </div>
      </div>
    </footer>
  );
}