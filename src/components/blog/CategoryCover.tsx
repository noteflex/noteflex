import { cn } from "@/lib/utils";
import { getCategoryStyle } from "@/lib/categoryStyle";

interface CategoryCoverProps {
  category: string;
  variant: "card" | "hero";
  className?: string;
}

export function CategoryCover({ category, variant, className }: CategoryCoverProps) {
  const style = getCategoryStyle(category);

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-lg",
          "aspect-[16/10] w-full",
          "bg-gradient-to-br transition-colors",
          style.gradient,
          style.darkGradient,
          style.hoverGradient,
          className,
        )}
        aria-hidden="true"
      >
        <span className="text-2xl leading-none">{style.icon}</span>
        <span className={cn("text-[10px] font-medium text-center px-1 leading-tight", style.textColor)}>
          {category}
        </span>
      </div>
    );
  }

  // hero variant
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl",
        "aspect-video w-full",
        "bg-gradient-to-br",
        style.gradient,
        style.darkGradient,
        className,
      )}
      aria-hidden="true"
    >
      <span className="text-5xl leading-none">{style.icon}</span>
      <span className={cn("text-sm font-semibold text-center px-4", style.textColor)}>
        {category}
      </span>
    </div>
  );
}
