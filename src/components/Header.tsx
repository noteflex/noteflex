import { Link } from "react-router-dom";
import { PremiumBadge } from "@/components/PremiumBadge";

interface HeaderProps {
  /** Page-specific right-side content */
  right?: React.ReactNode;
  /** Extra content below the main header row (renders inside <header>) */
  below?: React.ReactNode;
  /**
   * Left-side title. Defaults to the "🎼 Noteflex" logo link.
   * Pass a ReactNode to override — PremiumBadge is automatically appended.
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
  const container = `${containerClassName ?? "max-w-3xl"} mx-auto px-4`;
  const left = title ? (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {title}
        <PremiumBadge />
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link to="/" className="flex items-center gap-2 text-base font-bold">
        <span className="text-xl">🎼</span> Noteflex
      </Link>
      <PremiumBadge />
    </div>
  );

  return (
    <header
      className={`border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10 ${headerClassName ?? ""}`}
    >
      <div className={`${container} py-4 flex items-center justify-between gap-4`}>
        {left}
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {below && <div className={`${container} pb-3`}>{below}</div>}
    </header>
  );
}
