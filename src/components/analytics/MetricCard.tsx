import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: string | number;
  /** 한 줄 보조 텍스트 (delta 등) — 색은 deltaTone로 처리 */
  sub?: string;
  /** sub 색조: up=향상(녹), down=악화(적), neutral=회색 */
  deltaTone?: "up" | "down" | "neutral";
  /** 브랜드레드 강조 (이번 핵심 지표) */
  highlight?: boolean;
}

/**
 * 분석 보고서용 compact 메트릭 카드.
 * - 배경: bg-card (전역 토큰 — 크림 #faf8f0 위 흰색 카드)
 * - 강조: text-primary (브랜드레드 #D3224E)
 */
export default function MetricCard({
  label,
  value,
  sub,
  deltaTone = "neutral",
  highlight = false,
}: MetricCardProps) {
  const subColor =
    deltaTone === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : deltaTone === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-4 py-3 transition-shadow",
        "hover:shadow-sm",
      )}
    >
      <p className="text-[11px] text-muted-foreground tracking-tight">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tracking-tight tabular-nums",
          highlight ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sub ? (
        <p className={cn("mt-1 text-[11px] tabular-nums", subColor)}>{sub}</p>
      ) : null}
    </div>
  );
}
