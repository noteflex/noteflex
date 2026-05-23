import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

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
      <Link to="/" className="flex items-center gap-2 text-base font-bold">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
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
      <div className={`${container} py-4 flex items-center justify-between gap-4`}>
        {left}
        <div className="flex items-center gap-4 shrink-0">
          {right}
        </div>
      </div>
      {below && <div className={`${container} pb-3`}>{below}</div>}
    </header>
  );
}
