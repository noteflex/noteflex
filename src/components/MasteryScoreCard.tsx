import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PremiumBlurCard from "./PremiumBlurCard";
import {
  formatSublevel,
  getCompletion,
  PASS_CRITERIA,
  type SublevelCompletion,
  type SublevelProgress,
  type SubscriptionTier,
} from "@/lib/levelSystem";
import { useLang } from "@/contexts/LanguageContext";

// ── Score formula (mirrors SQL get_mastery_score) ─────────────
export function computeMasteryScore(prog: SublevelProgress | null): number {
  if (!prog) return 0;
  if (prog.fast_track) return 100;
  const accuracy =
    prog.total_attempts > 0 ? prog.total_correct / prog.total_attempts : 0;
  const reaction = prog.avg_reaction_ratio ?? 99;
  const accScore = Math.min(accuracy / PASS_CRITERIA.MIN_ACCURACY, 1) * 25;
  const reactScore =
    reaction > 0
      ? Math.min(PASS_CRITERIA.MIN_AVG_REACTION_RATIO / reaction, 1) * 25
      : 0;
  const countScore = Math.min(prog.play_count / PASS_CRITERIA.MIN_PLAY_COUNT, 1) * 25;
  const streakScore = Math.min(
    prog.best_streak / PASS_CRITERIA.MIN_BEST_STREAK,
    1
  ) * 25;
  return Math.round(accScore + reactScore + countScore + streakScore);
}

const ZERO_COMPLETION: SublevelCompletion = {
  accuracy: { current: 0, required: PASS_CRITERIA.MIN_ACCURACY, satisfied: false },
  avgReactionRatio: { current: null, required: PASS_CRITERIA.MIN_AVG_REACTION_RATIO, satisfied: false },
  playCount: { current: 0, required: PASS_CRITERIA.MIN_PLAY_COUNT, satisfied: false },
  bestStreak: { current: 0, required: PASS_CRITERIA.MIN_BEST_STREAK, satisfied: false },
  allSatisfied: false,
};

// ── i18n ──────────────────────────────────────────────────────
const STRINGS = {
  ko: {
    masteryScore: "마스터리",
    collapse: "접기",
    expand: "상세 보기",
    accuracy: "정확도",
    reaction: "반응 비율",
    playCount: "플레이 수",
    bestStreak: "최고 연속",
    noDataHint: "첫 세션을 시작해보세요",
    upgrade: "Premium으로 보기",
  },
  en: {
    masteryScore: "Mastery",
    collapse: "Collapse",
    expand: "Show details",
    accuracy: "Accuracy",
    reaction: "Reaction ratio",
    playCount: "Play count",
    bestStreak: "Best streak",
    noDataHint: "Start your first session",
    upgrade: "Unlock with Premium",
  },
} as const;

// ── Props ──────────────────────────────────────────────────────
interface MasteryScoreCardProps {
  tier: SubscriptionTier | "premium" | "admin";
  progress: SublevelProgress | null;
  level: number;
  sublevel: number;
  onUpgrade?: () => void;
}

// ── Component ─────────────────────────────────────────────────
export default function MasteryScoreCard({
  tier,
  progress,
  level,
  sublevel,
  onUpgrade,
}: MasteryScoreCardProps) {
  // default 펼침 — 첫 진입 시 4지표 blur 즉시 인지 (메모리 #18 + #25)
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();
  const { lang } = useLang();
  const s = STRINGS[lang as keyof typeof STRINGS] ?? STRINGS.ko;

  const score = computeMasteryScore(progress);
  const label = formatSublevel(level, sublevel as 1 | 2 | 3);
  const hasData = !!progress;

  // map SubscriptionTier "pro" → "premium" for PremiumBlurCard
  const blurTier =
    tier === "pro" || tier === "premium" || tier === "admin"
      ? ("premium" as const)
      : (tier as "guest" | "free");

  const handleUpgrade = onUpgrade ?? (() => navigate("/pricing"));

  const completion = hasData ? getCompletion(progress) : ZERO_COMPLETION;

  return (
    <div
      className="rounded-2xl border border-border bg-card/70 p-4 w-full shadow-sm"
      data-testid="mastery-score-card"
    >
      {/* ── Layer 1: score + progress bar + toggle ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{label} {s.masteryScore}</span>
          <span
            className="text-4xl font-bold tabular-nums text-foreground leading-none"
            data-testid="score-number"
          >
            {hasData ? score : "—"}
          </span>
          {!hasData && (
            <span className="text-xs text-muted-foreground" data-testid="no-data-hint">
              {s.noDataHint}
            </span>
          )}
        </div>

        {/* progress bar — always shown (0% when no data) */}
        <div className="flex-1 flex flex-col gap-1">
          <div
            className="w-full bg-muted rounded-full h-2 overflow-hidden"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${s.masteryScore} ${score}/100`}
            data-testid="score-progress-bar"
          >
            <div
              className="h-2 rounded-full transition-all bg-primary"
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground text-right">
            {hasData ? score : 0} / 100
          </span>
        </div>

        {/* toggle — always visible */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          data-testid="expand-toggle"
        >
          {expanded ? s.collapse : s.expand}
        </Button>
      </div>

      {/* ── Layer 2: 4 metrics (blur for free/guest, always shown when expanded) ── */}
      {expanded && (
        <div className="mt-3" data-testid="metrics-layer">
          <PremiumBlurCard
            tier={blurTier}
            ctaText={s.upgrade}
            onUpgrade={handleUpgrade}
          >
            <div className="grid grid-cols-2 gap-2 pt-1">
              <MetricRow
                label={s.accuracy}
                value={`${Math.round(completion.accuracy.current * 100)}%`}
                required={`${Math.round(completion.accuracy.required * 100)}%`}
                satisfied={completion.accuracy.satisfied}
              />
              <MetricRow
                label={s.reaction}
                value={
                  completion.avgReactionRatio.current !== null
                    ? String(completion.avgReactionRatio.current.toFixed(2))
                    : "—"
                }
                required={String(completion.avgReactionRatio.required)}
                satisfied={completion.avgReactionRatio.satisfied}
              />
              <MetricRow
                label={s.playCount}
                value={String(completion.playCount.current)}
                required={String(completion.playCount.required)}
                satisfied={completion.playCount.satisfied}
              />
              <MetricRow
                label={s.bestStreak}
                value={String(completion.bestStreak.current)}
                required={String(completion.bestStreak.required)}
                satisfied={completion.bestStreak.satisfied}
              />
            </div>
          </PremiumBlurCard>
        </div>
      )}
    </div>
  );
}

// ── MetricRow ─────────────────────────────────────────────────
function MetricRow({
  label,
  value,
  required,
  satisfied,
}: {
  label: string;
  value: string;
  required: string;
  satisfied: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-lg bg-muted/50 px-2 py-1.5"
      data-testid="metric-row"
    >
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-sm font-semibold ${satisfied ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
        >
          {value}
        </span>
        <span className="text-[9px] text-muted-foreground">/{required}</span>
      </div>
    </div>
  );
}
