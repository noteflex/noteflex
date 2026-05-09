import { useNavigate } from "react-router-dom";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { formatSublevel, type SubscriptionTier } from "@/lib/levelSystem";
import { useLang } from "@/contexts/LanguageContext";

export interface ChartPoint {
  date: string;   // "MM/DD"
  score: number;  // 0–100
}

export interface MasteryHeroCardProps {
  tier: SubscriptionTier | "premium" | "admin";
  bestScore: number;
  level: number;
  sublevel: number;
  /** Premium only — 4 metrics */
  accuracy?: number;
  avgReactionRatio?: number;
  playCount?: number;
  bestStreak?: number;
  /** Premium only — 7-day trend */
  chartData?: ChartPoint[];
  coachingLine?: string;
  onUpgrade?: () => void;
}

const STRINGS = {
  ko: {
    title: "마스터리 점수",
    noData: "아직 플레이 기록이 없어요.",
    accuracy: "정확도",
    reaction: "반응 비율",
    playCount: "플레이 수",
    bestStreak: "최고 연속",
    ctaLine: "Premium으로 전체 지표와 7일 추이를 확인하세요.",
    cta: "Premium 시작하기",
    trend: "7일 추이",
  },
  en: {
    title: "Mastery Score",
    noData: "No play history yet.",
    accuracy: "Accuracy",
    reaction: "Reaction ratio",
    playCount: "Play count",
    bestStreak: "Best streak",
    ctaLine: "Upgrade to Premium to see all metrics and 7-day trend.",
    cta: "Start Premium",
    trend: "7-day trend",
  },
} as const;

export default function MasteryHeroCard({
  tier,
  bestScore,
  level,
  sublevel,
  accuracy,
  avgReactionRatio,
  playCount,
  bestStreak,
  chartData,
  coachingLine,
  onUpgrade,
}: MasteryHeroCardProps) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const s = STRINGS[lang as keyof typeof STRINGS] ?? STRINGS.ko;

  const isPremium = tier === "premium" || tier === "admin" || tier === "pro";
  const label = formatSublevel(level, sublevel as 1 | 2 | 3);

  const handleUpgrade = onUpgrade ?? (() => navigate("/pricing"));

  return (
    <div
      className="rounded-2xl border border-border bg-card p-5 shadow-sm w-full"
      data-testid="mastery-hero-card"
    >
      {/* Header: score + label */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            {label} {s.title}
          </p>
          <span
            className="text-5xl font-bold tabular-nums text-foreground leading-none"
            data-testid="hero-score"
          >
            {bestScore}
          </span>
          <span className="text-sm text-muted-foreground ml-1">/100</span>
        </div>

        {/* Premium: 4 metric tiles */}
        {isPremium && (
          <div
            className="grid grid-cols-2 gap-1.5"
            data-testid="premium-metrics"
          >
            <MetricTile label={s.accuracy} value={accuracy !== undefined ? `${Math.round(accuracy * 100)}%` : "—"} />
            <MetricTile label={s.reaction} value={avgReactionRatio !== undefined ? avgReactionRatio.toFixed(2) : "—"} />
            <MetricTile label={s.playCount} value={playCount !== undefined ? String(playCount) : "—"} />
            <MetricTile label={s.bestStreak} value={bestStreak !== undefined ? String(bestStreak) : "—"} />
          </div>
        )}
      </div>

      {/* Premium: 7-day chart */}
      {isPremium && chartData && chartData.length > 0 && (
        <div className="mt-4" data-testid="trend-chart">
          <p className="text-xs text-muted-foreground mb-1">{s.trend}</p>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 11, padding: "2px 6px" }}
                formatter={(v: number) => [`${v}`, s.title]}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Coaching / motivational line */}
      {coachingLine && (
        <p
          className="mt-3 text-sm text-muted-foreground"
          data-testid="coaching-line"
        >
          {coachingLine}
        </p>
      )}

      {/* Free: 1-line CTA */}
      {!isPremium && (
        <div className="mt-4 flex flex-col gap-2" data-testid="free-cta">
          <p className="text-xs text-muted-foreground">{s.ctaLine}</p>
          <Button size="sm" className="w-fit" onClick={handleUpgrade}>
            {s.cta}
          </Button>
        </div>
      )}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg bg-muted/50 px-2 py-1.5 text-center"
      data-testid="metric-tile"
    >
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}
