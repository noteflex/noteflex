import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  calculateAccuracy,
  calculateReactionRatio,
  formatSublevel,
  getCompletion,
  MIN_RECENT_SAMPLE,
  PASS_CRITERIA,
  RECENT_WINDOW_SIZE,
  type SublevelCompletion,
  type SublevelProgress,
  type SubscriptionTier,
} from "@/lib/levelSystem";
import { useLang, useT } from "@/contexts/LanguageContext";

// ── Score formula (mirrors SQL get_mastery_score) ─────────────
// v2 (2026-05-30): accuracy·reaction은 최근 7판 윈도우 기반.
//   표본 < MIN_RECENT_SAMPLE(=3) → acc·react 점수 0 (play_count·streak 점수만 부분).
//   표본 ≥ 3 → 윈도우 합계 평균으로 정상 25점 만점 계산.
//   play_count·best_streak·fast_track 분기는 누적 기준 유지.
export function computeMasteryScore(prog: SublevelProgress | null): number {
  if (!prog) return 0;
  if (prog.fast_track) return 100;

  const sampleCount = (prog.recent_plays ?? []).length;
  const hasEnoughSample = sampleCount >= MIN_RECENT_SAMPLE;

  let accScore = 0;
  let reactScore = 0;
  if (hasEnoughSample) {
    const accuracy = calculateAccuracy(prog);
    const reaction = calculateReactionRatio(prog);
    accScore = Math.min(accuracy / PASS_CRITERIA.MIN_ACCURACY, 1) * 25;
    reactScore =
      reaction != null && reaction > 0
        ? Math.min(PASS_CRITERIA.MIN_AVG_REACTION_RATIO / reaction, 1) * 25
        : 0;
  }

  const countScore = Math.min(prog.play_count / PASS_CRITERIA.MIN_PLAY_COUNT, 1) * 25;
  const streakScore = Math.min(
    prog.best_streak / PASS_CRITERIA.MIN_BEST_STREAK,
    1,
  ) * 25;
  return Math.round(accScore + reactScore + countScore + streakScore);
}

const ZERO_COMPLETION: SublevelCompletion = {
  accuracy: { current: 0, required: PASS_CRITERIA.MIN_ACCURACY, satisfied: false },
  avgReactionRatio: { current: null, required: PASS_CRITERIA.MIN_AVG_REACTION_RATIO, satisfied: false },
  playCount: { current: 0, required: PASS_CRITERIA.MIN_PLAY_COUNT, satisfied: false },
  bestStreak: { current: 0, required: PASS_CRITERIA.MIN_BEST_STREAK, satisfied: false },
  sampleCount: 0,
  sampleInsufficient: true,
  allSatisfied: false,
};

// ── i18n ──────────────────────────────────────────────────────
const STRINGS = {
  ko: {
    masteryScore: "숙련도",
    collapse: "접기",
    expand: "상세 보기",
    accuracy: "정확도",
    reaction: "반응 비율",
    playCount: "플레이 수",
    bestStreak: "최고 연속",
    noDataHint: "첫 세션을 시작해보세요",
    upgrade: "프리미엄 혜택 보기 →",
    /** 1줄 — 공통 메인 안내 */
    masteryWindowMain: `정확도·반응속도 = 최근 ${RECENT_WINDOW_SIZE}판 평균`,
    /** N < 3 — 측정 시작 전 */
    masteryWindowSubBefore3: (n: number) =>
      `${MIN_RECENT_SAMPLE}판 이상 쳐야 측정 시작 (현재 ${n}/${MIN_RECENT_SAMPLE})`,
    /** 3 ≤ N < 7 — 누적 중 */
    masteryWindowSubBuilding: (n: number) =>
      `지금은 최근 ${n}판 데이터로 계산 중 (${RECENT_WINDOW_SIZE}판 누적 중)`,
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
    upgrade: "View Premium Benefits →",
    masteryWindowMain: `Accuracy and reaction = average of last ${RECENT_WINDOW_SIZE} plays`,
    masteryWindowSubBefore3: (n: number) =>
      `Need at least ${MIN_RECENT_SAMPLE} plays to start (currently ${n}/${MIN_RECENT_SAMPLE})`,
    masteryWindowSubBuilding: (n: number) =>
      `Currently calculated from last ${n} plays (building up to ${RECENT_WINDOW_SIZE})`,
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
  // default 접힘 (2026-05-30 변경) — 4지표 상세는 토글로 펼침
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const { lang } = useLang();
  const t = useT();
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

  // 표본 안내 분기:
  //   N < 3            → amber 박스 + 메인 + "측정 시작 전 (n/3)"
  //   3 ≤ N < 7        → amber 박스 + 메인 + "최근 n판 계산 중 (7판 누적)"
  //   N = 7            → muted 한 줄 (메인만)
  const showWindowNotice = hasData;
  const isWindowBuilding = showWindowNotice && completion.sampleCount < RECENT_WINDOW_SIZE;

  return (
    <div
      className="rounded-2xl border border-border bg-card/70 p-4 w-full shadow-sm"
      data-testid="mastery-score-card"
    >
      {/* ── Layer 1: score + progress bar + toggle ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Trophy
              className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0"
              aria-hidden
              strokeWidth={2.5}
            />
            {label} {s.masteryScore}
          </span>
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
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm font-semibold text-foreground leading-tight">
              {t.masteryCard.clearAt100}
            </span>
            <span className="text-xs font-semibold tabular-nums text-foreground leading-tight shrink-0">
              {hasData ? score : 0} / 100
            </span>
          </div>
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

      {/* ── 표본 안내 — N=7이면 1줄 muted, 그 외엔 amber 박스 2줄 ── */}
      {showWindowNotice && !isWindowBuilding && (
        <p
          className="mt-2 text-xs text-muted-foreground"
          data-testid="sample-notice"
        >
          {s.masteryWindowMain}
        </p>
      )}
      {showWindowNotice && isWindowBuilding && (
        <div
          className="mt-2 rounded-md border border-amber-200/70 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 px-3 py-2"
          data-testid="sample-notice"
        >
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {s.masteryWindowMain}
          </p>
          <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/80 tabular-nums">
            {completion.sampleCount < MIN_RECENT_SAMPLE
              ? s.masteryWindowSubBefore3(completion.sampleCount)
              : s.masteryWindowSubBuilding(completion.sampleCount)}
          </p>
        </div>
      )}

      {/* ── Layer 2: 4 metrics — 이름·달성여부는 전 티어 공개, 수치만 비Pro 블러 ── */}
      {expanded && (
        <div className="mt-3" data-testid="metrics-layer">
          <div className="grid grid-cols-2 gap-2 pt-1">
            <MetricRow
              label={s.accuracy}
              value={
                completion.sampleInsufficient
                  ? "—"
                  : `${Math.round(completion.accuracy.current * 100)}%`
              }
              required={`${Math.round(completion.accuracy.required * 100)}%`}
              satisfied={completion.accuracy.satisfied}
              blurred={blurTier !== "premium"}
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
              blurred={blurTier !== "premium"}
            />
            <MetricRow
              label={s.playCount}
              value={String(completion.playCount.current)}
              required={String(completion.playCount.required)}
              satisfied={completion.playCount.satisfied}
              blurred={blurTier !== "premium"}
            />
            <MetricRow
              label={s.bestStreak}
              value={String(completion.bestStreak.current)}
              required={String(completion.bestStreak.required)}
              satisfied={completion.bestStreak.satisfied}
              blurred={blurTier !== "premium"}
            />
          </div>
          {blurTier !== "premium" && (
            <div className="mt-2 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUpgrade}
                data-testid="upgrade-cta"
              >
                {s.upgrade}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MetricRow ─────────────────────────────────────────────────
// 이름·달성여부(✓/–)는 항상 노출. 수치 영역만 blurred=true 시 흐림 처리.
function MetricRow({
  label,
  value,
  required,
  satisfied,
  blurred,
}: {
  label: string;
  value: string;
  required: string;
  satisfied: boolean;
  blurred: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-0.5 rounded-lg bg-muted/50 px-2 py-1.5"
      data-testid="metric-row"
    >
      {/* 항목명 + 달성여부 — 전 티어 공개 */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span
          className={`text-[11px] font-bold leading-none ${
            satisfied
              ? "text-emerald-500 dark:text-emerald-400"
              : "text-muted-foreground/50"
          }`}
        >
          {satisfied ? "✓" : "–"}
        </span>
      </div>
      {/* 수치 — 비Pro 블러 */}
      <div
        className={blurred ? "blur-sm select-none pointer-events-none" : ""}
        aria-hidden={blurred}
      >
        <div className="flex items-baseline gap-1">
          <span
            className={`text-sm font-semibold ${satisfied ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
          >
            {value}
          </span>
          <span className="text-[9px] text-muted-foreground">/{required}</span>
        </div>
      </div>
    </div>
  );
}
