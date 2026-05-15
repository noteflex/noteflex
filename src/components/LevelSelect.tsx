import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Home } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLevelProgress } from "@/hooks/useLevelProgress";
import { useDailyLimit } from "@/hooks/useDailyLimit";
import { getUserTier } from "@/lib/subscriptionTier";
import {
  canAccessSublevel,
  getProgressGatePrev,
  getCompletion,
  formatSublevel,
  SUBLEVEL_CONFIGS,
  type Sublevel,
  type SublevelProgress,
} from "@/lib/levelSystem";
import { Button } from "@/components/ui/button";
import UpgradeModal from "./UpgradeModal";
import DailyLimitModal from "./DailyLimitModal";
import LockedByProgressDialog from "./LockedByProgressDialog";
import MasteryScoreCard from "./MasteryScoreCard";
import { AdBanner } from "./AdBanner";
import { getSlot } from "@/lib/adsense";

// ── 레벨 메타 정보 ───────────────────────────────────────────
const LEVEL_INFO = [
  { name: "입문",        label: "높은음자리표 (C4–C6)",  emoji: "🌱" },
  { name: "기본",        label: "낮은음자리표 (C2–C4)",  emoji: "🌿" },
  { name: "중급",        label: "고급 높은음자리표",     emoji: "🔥" },
  { name: "상급",        label: "고급 낮은음자리표",     emoji: "⚡" },
  { name: "고수",        label: "Sharp Mastery (♯)",    emoji: "🎯" },
  { name: "마스터",      label: "Flat Mastery (♭)",     emoji: "💎" },
  { name: "그랜드마스터", label: "마스터 믹스 (♯♭)",   emoji: "👑" },
] as const;

// ── Props ────────────────────────────────────────────────────
interface LevelSelectProps {
  onSelectSublevel: (level: number, sublevel: Sublevel) => void;
  onBack: () => void;
  onLoginRequest?: () => void;
}

// ── Cell 상태 ─────────────────────────────────────────────────
type LockReason = "subscription" | "progress";

interface CellState {
  passed: boolean;
  inProgress: boolean;
  lockReason: LockReason | null;
  prevLabel: string | null;
  prevLevel: number | null;
  prevSublevel: Sublevel | null;
  criteriaCount: number;
}

// ════════════════════════════════════════════════════════════
// LevelSelect
// ════════════════════════════════════════════════════════════
export default function LevelSelect({
  onSelectSublevel,
  onBack,
  onLoginRequest,
}: LevelSelectProps) {
  const { user, profile } = useAuth();
  const { progress, loading, getProgressFor } = useLevelProgress();
  const dailyLimit = useDailyLimit();
  const tier = getUserTier(user ?? null, profile ?? null);
  const isAdmin = profile?.role === "admin";

  const [upgradeOpen, setUpgradeOpen]   = useState(false);
  const [dailyLimitOpen, setDailyLimitOpen] = useState(false);

  // 진도 잠금 다이얼로그
  const [lockedTarget, setLockedTarget] = useState<{ level: number; sublevel: Sublevel } | null>(null);
  // 스크롤 + 하이라이트 영역
  const cellRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  const totalPassed = progress.filter((p) => p.passed).length;

  // 현재 플레이 중인 단계 = 접근 가능 + 미통과 중 첫 번째 (MasteryScoreCard 기준)
  const currentSublevel = useMemo(() => {
    for (let level = 1; level <= 7; level++) {
      for (const sub of [1, 2, 3] as Sublevel[]) {
        if (!canAccessSublevel(tier, level, sub)) continue;
        const prev = getProgressGatePrev(tier, level, sub);
        const isPrevPassed =
          prev === null
            ? true
            : (progress.find((p) => p.level === prev.level && p.sublevel === prev.sublevel)?.passed ?? false);
        if (!isPrevPassed && !isAdmin) continue;
        const prog = progress.find((p) => p.level === level && p.sublevel === sub);
        if (!prog?.passed) return { level, sublevel: sub, progress: prog ?? null };
      }
    }
    return null;
  }, [tier, isAdmin, progress]);

  // §F4 (2026-05-05, 정책 P1 보조): 21개 셀 state를 useMemo로 한 번에 계산 → SublevelCell React.memo 효과 확보.
  const cellStates = useMemo(() => {
    function compute(level: number, sub: Sublevel): CellState {
      // 1) 구독 게이트
      if (!canAccessSublevel(tier, level, sub)) {
        return {
          passed: false, inProgress: false,
          lockReason: "subscription", prevLabel: null,
          prevLevel: null, prevSublevel: null, criteriaCount: 0,
        };
      }

      // 2) 진도 게이트 (tier 인식 선행 단계 — getProgressGatePrev)
      const prev = getProgressGatePrev(tier, level, sub);
      const isPrevPassed = prev === null
        ? true
        : (getProgressFor(prev.level, prev.sublevel)?.passed ?? false);

      if (!isPrevPassed && !isAdmin) {
        const pl = formatSublevel(prev!.level, prev!.sublevel as Sublevel);
        return {
          passed: false, inProgress: false,
          lockReason: "progress", prevLabel: pl,
          prevLevel: prev!.level, prevSublevel: prev!.sublevel as Sublevel,
          criteriaCount: 0,
        };
      }

      // 3) 진도 데이터
      const prog = getProgressFor(level, sub) as SublevelProgress | null;
      const passed     = prog?.passed ?? false;
      const inProgress = !passed && (prog?.play_count ?? 0) > 0;

      let criteriaCount = 0;
      if (prog) {
        const c = getCompletion(prog);
        criteriaCount = [
          c.playCount.satisfied,
          c.bestStreak.satisfied,
          c.accuracy.satisfied,
          c.avgReactionRatio.satisfied,
        ].filter(Boolean).length;
      }

      return {
        passed, inProgress, lockReason: null, prevLabel: null,
        prevLevel: null, prevSublevel: null, criteriaCount,
      };
    }

    const map = new Map<string, CellState>();
    for (let level = 1; level <= 7; level++) {
      for (const sub of [1, 2, 3] as Sublevel[]) {
        map.set(`${level}-${sub}`, compute(level, sub));
      }
    }
    return map;
  }, [tier, isAdmin, progress, getProgressFor]);

  // §F4 (2026-05-05): handleSelect useCallback + cellStatesRef로 의존성 안정화.
  const cellStatesRef = useRef(cellStates);
  cellStatesRef.current = cellStates;

  // §B-0 daily limit gate (Fix Sprint 2026-05-09):
  //   기존 NoteGame 마운트 게이트 → LevelSelect 단계 클릭 시점으로 이동.
  //   subscription/progress 통과 후 hasReached 체크 → DailyLimitModal 노출 + onSelectSublevel 호출 X.
  const dailyLimitReachedRef = useRef(dailyLimit.hasReached);
  dailyLimitReachedRef.current = dailyLimit.hasReached;

  const handleSelect = useCallback((level: number, sub: Sublevel) => {
    const state = cellStatesRef.current.get(`${level}-${sub}`);
    if (!state) return;

    // 우선순위:
    //   1) Premium 잠금 (티어 제한)  ← 가장 외부 차단
    //   2) 이전 단계 미통과 잠금
    //   3) 일일 한도
    //   4) 진입
    if (state.lockReason === "subscription") {
      setUpgradeOpen(true);
      return;
    }

    if (state.lockReason === "progress" && state.prevLevel !== null && state.prevSublevel !== null) {
      setLockedTarget({ level: state.prevLevel, sublevel: state.prevSublevel });
      return;
    }

    // §B-0 daily limit gate (메모리 #25 — 단계 클릭 즉시 모달 노출, navigate X)
    if (dailyLimitReachedRef.current) {
      setDailyLimitOpen(true);
      return;
    }

    onSelectSublevel(level, sub);
  }, [onSelectSublevel]);

  // 진도 잠금 CTA "Lv X-Y로 이동" 클릭 시 동작.
  // 1) 해당 셀 위치로 스크롤 (smooth)
  // 2) 1.5s 동안 ring 하이라이트
  const handleGoToRequired = useCallback((level: number, sub: Sublevel) => {
    const key = `${level}-${sub}`;
    const el = cellRefs.current.get(key);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightedKey(key);
    setTimeout(() => setHighlightedKey(null), 1500);
  }, []);

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto px-2 pb-8 animate-fade-up">

      {/* 헤더 + 메인 버튼 (우측 상단) */}
      <div className="flex items-start justify-between w-full pt-2">
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-4xl">🎼</span>
          <h2 className="text-xl font-bold text-foreground tracking-tight">단계 선택</h2>
          <p className="text-sm text-muted-foreground" data-testid="progress-summary">
            내 진도:{" "}
            <span className="font-semibold text-foreground">{totalPassed}</span> / 21 통과
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 shrink-0"
          data-testid="back-to-home-btn"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          메인
        </Button>
      </div>

      {/* 로딩 */}
      {loading && (
        <p className="text-sm text-muted-foreground">진도 불러오는 중...</p>
      )}

      {/* 현재 단계 마스터리 점수 */}
      {!loading && currentSublevel && (
        <MasteryScoreCard
          tier={isAdmin ? "admin" : tier}
          progress={currentSublevel.progress}
          level={currentSublevel.level}
          sublevel={currentSublevel.sublevel}
        />
      )}

      {/* 레벨 그룹 */}
      <div className="flex flex-col gap-3 w-full">
        {LEVEL_INFO.flatMap((info, idx) => {
          const level = idx + 1;
          const card = (
            <div
              key={level}
              className="rounded-2xl border border-border bg-card/60 p-3 shadow-sm"
            >
              {/* 레벨 헤더 */}
              <div className="flex items-center gap-2 mb-2 px-0.5">
                <span className="text-base">{info.emoji}</span>
                <span className="text-sm font-bold text-foreground">
                  Lv {level} — {info.name}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {info.label}
                </span>
              </div>

              {/* 서브레벨 3개 */}
              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as Sublevel[]).map((sub) => {
                  const key = `${level}-${sub}`;
                  const state = cellStates.get(key)!;
                  return (
                    <SublevelCell
                      key={sub}
                      level={level}
                      sublevel={sub}
                      state={state}
                      onSelect={handleSelect}
                      highlighted={highlightedKey === key}
                      cellRef={(el) => { cellRefs.current.set(key, el); }}
                    />
                  );
                })}
              </div>
            </div>
          );

          // Lv4 ↔ Lv5 사이 중간 배너 (모든 폭 노출)
          if (level === 4) {
            return [
              card,
              <AdBanner
                key="play-mid-ad"
                slot={getSlot("PLAY_MID")}
                format="horizontal"
                placeholderVariant="horizontal-random"
                className="w-full my-1"
              />,
            ];
          }
          return [card];
        })}
      </div>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      {lockedTarget && (
        <LockedByProgressDialog
          open={true}
          requiredLevel={lockedTarget.level}
          requiredSublevel={lockedTarget.sublevel}
          onClose={() => setLockedTarget(null)}
          onGoToRequired={() => handleGoToRequired(lockedTarget.level, lockedTarget.sublevel)}
        />
      )}

      {dailyLimitOpen && (
        <DailyLimitModal
          open={true}
          tier={user ? "free" : "guest"}
          timeUntilResetMs={dailyLimit.timeUntilResetMs}
          onClose={() => setDailyLimitOpen(false)}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SublevelCell — §F4 (2026-05-05, 정책 P1 보조): React.memo로 21개 셀 불필요 리렌더 차단.
// onSelect는 부모에서 useCallback으로 안정화, state는 useMemo cellStates에서 안정 reference.
// ════════════════════════════════════════════════════════════
interface SublevelCellProps {
  level: number;
  sublevel: Sublevel;
  state: CellState;
  onSelect: (level: number, sublevel: Sublevel) => void;
  highlighted?: boolean;
  cellRef?: (el: HTMLButtonElement | null) => void;
}

const SublevelCell = memo(function SublevelCell({
  level,
  sublevel,
  state,
  onSelect,
  highlighted = false,
  cellRef,
}: SublevelCellProps) {
  const onClick = () => onSelect(level, sublevel);
  const config    = SUBLEVEL_CONFIGS[sublevel];
  const label     = formatSublevel(level, sublevel);
  const shortLabel = `${level}-${sublevel}`;
  const configStr = `${config.timeLimit}s · ♥${config.lives}`;

  // LockedByProgressDialog CTA로 이동 시 1.5s 동안 ring 강조 박음.
  const highlightClass = highlighted
    ? "ring-4 ring-primary ring-offset-2 animate-pulse"
    : "";

  const baseClass =
    "flex flex-col items-center gap-0.5 rounded-xl border-2 p-2 min-h-[72px] " +
    "transition-all duration-200 active:scale-95 text-center w-full " +
    highlightClass;

  // ── 구독 잠금 (Pro 전용) ────────────────────────────────────
  if (state.lockReason === "subscription") {
    return (
      <button
        ref={cellRef}
        aria-label={`${label} Pro 전용`}
        onClick={onClick}
        className={
          `${baseClass} bg-gradient-to-b from-purple-50 to-amber-50 ` +
          "border-purple-200 opacity-75 hover:opacity-90 cursor-pointer " +
          "dark:from-purple-950/30 dark:to-amber-950/30"
        }
      >
        <span className="text-sm leading-tight">🔒</span>
        <span className="text-[11px] font-bold text-foreground">{shortLabel}</span>
        <span className="text-[9px] font-bold text-purple-600 bg-purple-100 rounded px-1 dark:bg-purple-900/40 dark:text-purple-300">
          PRO
        </span>
        <span className="text-[9px] text-muted-foreground">{configStr}</span>
      </button>
    );
  }

  // ── 진도 잠금 ───────────────────────────────────────────────
  if (state.lockReason === "progress") {
    return (
      <button
        ref={cellRef}
        aria-label={`${label} 잠금`}
        onClick={onClick}
        className={
          `${baseClass} bg-muted/40 border-border/40 opacity-50 ` +
          "cursor-pointer hover:opacity-65"
        }
      >
        <span className="text-sm leading-tight">🔒</span>
        <span className="text-[11px] font-semibold text-foreground">{shortLabel}</span>
        <span className="text-[9px] text-muted-foreground">{configStr}</span>
      </button>
    );
  }

  // ── 통과 ────────────────────────────────────────────────────
  if (state.passed) {
    return (
      <button
        ref={cellRef}
        aria-label={`${label} 통과 (재플레이 가능)`}
        onClick={onClick}
        className={
          `${baseClass} bg-emerald-50 border-emerald-300 ` +
          "hover:border-emerald-400 hover:shadow-sm cursor-pointer " +
          "dark:bg-emerald-950/30 dark:border-emerald-700"
        }
      >
        <span className="text-sm leading-tight">✅</span>
        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          {shortLabel}
        </span>
        <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-500">
          통과
        </span>
        <span className="text-[9px] text-muted-foreground">{configStr}</span>
      </button>
    );
  }

  // ── 진행 중 ─────────────────────────────────────────────────
  if (state.inProgress) {
    const pct = Math.round((state.criteriaCount / 4) * 100);
    return (
      <button
        ref={cellRef}
        aria-label={`${label} 진행 중`}
        onClick={onClick}
        className={
          `${baseClass} bg-amber-50 border-amber-300 ` +
          "hover:border-amber-400 hover:shadow-sm cursor-pointer " +
          "dark:bg-amber-950/30 dark:border-amber-700"
        }
      >
        <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">
          {shortLabel}
        </span>
        <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400">
          {state.criteriaCount}/4 달성
        </span>
        <div className="w-full bg-amber-200 dark:bg-amber-800 rounded-full h-1 mt-0.5">
          <div
            className="bg-amber-500 h-1 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[9px] text-muted-foreground">{configStr}</span>
      </button>
    );
  }

  // ── 미시작 (이용 가능) ──────────────────────────────────────
  return (
    <button
      ref={cellRef}
      aria-label={`${label} 선택`}
      onClick={onClick}
      className={
        `${baseClass} bg-card border-border ` +
        "hover:border-primary/50 hover:shadow-sm cursor-pointer"
      }
    >
      <span className="text-[11px] font-semibold text-foreground">{shortLabel}</span>
      <span className="text-[9px] text-muted-foreground mt-auto">{configStr}</span>
    </button>
  );
});
