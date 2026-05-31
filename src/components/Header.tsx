import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";

interface HeaderProps {
  /** Page-specific right-side content */
  right?: React.ReactNode;
  /** Extra content below the main header row (renders inside <header>) */
  below?: React.ReactNode;
  /**
   * Left-side title. Defaults to the "🎼 Noteflex / Premium" logo link.
   * Pass a ReactNode to override.
   */
  title?: React.ReactNode;
  /**
   * Subtitle rendered on a second line below the title row.
   * Only shown when `title` is provided.
   */
  subtitle?: string;
  /** Additional Tailwind classes for the outer <header> element. */
  headerClassName?: string;
  /** Max-width class for the inner container. Defaults to "max-w-3xl". */
  containerClassName?: string;
}

export default function Header({
  right,
  below,
  title,
  subtitle,
  headerClassName,
  containerClassName,
}: HeaderProps) {
  const { profile } = useAuth();
  const t = useT();
  const isPremium = !!profile?.is_premium;
  const container = `${containerClassName ?? "max-w-3xl"} mx-auto px-4`;
  const left = title ? (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {title}
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link to="/" className="flex items-center gap-2 text-[22px] font-bold">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[27px] h-[27px]" aria-hidden="true">
          <circle cx="6" cy="17" r="3" /><circle cx="16" cy="17" r="3" />
          <path d="M9 17V4h10v13" /><path d="M9 8h10" />
        </svg>
        {isPremium ? "Premium" : "Noteflex"}
      </Link>
    </div>
  );

  return (
    <header
      className={`border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10 ${headerClassName ?? ""}`}
    >
      {/* a11y skip link — sr-only 기본, focus 시 visible. 페이지의 id="main-content" 요소로 이동. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow"
      >
        {t.header.skipToContent}
      </a>
      <div className={`${container} py-4 flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-6 sm:gap-10 min-w-0">
          {left}
          {/* 5/31 데스크탑 헤더 nav — admin 등 below slot 있는 페이지에서는 중복 회피 위해 숨김. 모바일은 sub-step 4 햄버거로 대체. */}
          {!below && (
            <nav
              aria-label={t.header.mainNav}
              className="hidden md:flex items-center gap-6"
            >
              <NavLink
                to="/pricing"
                className={({ isActive }) =>
                  `text-sm transition-colors ${
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {t.footer.pricing}
              </NavLink>
              <NavLink
                to="/blog"
                className={({ isActive }) =>
                  `text-sm transition-colors ${
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {t.footer.blog}
              </NavLink>
              <NavLink
                to="/faq"
                className={({ isActive }) =>
                  `text-sm transition-colors ${
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {t.footer.faq}
              </NavLink>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {right}
        </div>
      </div>
      {below && <div className={`${container} pb-3`}>{below}</div>}
    </header>
  );
}
