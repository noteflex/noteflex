import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang, useT } from "@/contexts/LanguageContext";
import { useLevelProgress } from "@/hooks/useLevelProgress";
import { useDailyLimit } from "@/hooks/useDailyLimit";
import { getUserTier } from "@/lib/subscriptionTier";
import {
  canAccessSublevel,
  getProgressGatePrev,
  getCompletion,
  formatSublevel,
  findFirstUnpassedAccessibleSublevel,
  SUBLEVEL_CONFIGS,
  type Sublevel,
  type SublevelProgress,
} from "@/lib/levelSystem";
import UpgradeModal from "./UpgradeModal";
import DailyLimitModal from "./DailyLimitModal";
import LockedByProgressDialog from "./LockedByProgressDialog";
import MasteryScoreCard from "./MasteryScoreCard";
import { AdBanner } from "./AdBanner";
import { getSlot } from "@/lib/adsense";

// ── 레벨 메타 (언어 중립: 이모지만) ────────────────────────────
const LEVEL_META = ["🌱", "⭐", "⭐⭐", "⭐⭐⭐", "🔥", "💎", "👑"] as const;

// ── Props ────────────────────────────────────────────────────
interface LevelSelectProps {
  onSelectSublevel: (level: number, sublevel: Sublevel) => void;
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
  onLoginRequest,
}: LevelSelectProps) {
  const { user, profile } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
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

  // findFirstUnpassedAccessibleSublevel 호출용 ref (handleSelect 의존성 안정).
  const tierRef = useRef(tier);
  tierRef.current = tier;
  const getProgressForRef = useRef(getProgressFor);
  getProgressForRef.current = getProgressFor;

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

    if (state.lockReason === "progress") {
      // 클릭한 단계 바로 직전이 아니라, 티어 영역 내 첫 미통과 단계로 이동.
      // 사용자가 한 번에 여러 단계 건너뛰어 잠금 클릭한 경우에도 시작 지점 적용됨.
      const target = findFirstUnpassedAccessibleSublevel(
        tierRef.current,
        (lv, sub) => getProgressForRef.current(lv, sub)?.passed ?? false,
      );
      // 모든 영역 통과 시 target=null — 그땐 잠금 자체 안 적용된야 정상.
      // 폴백: prevLevel·prevSublevel 적용된 영역 사용.
      if (target) {
        setLockedTarget(target);
      } else if (state.prevLevel !== null && state.prevSublevel !== null) {
        setLockedTarget({ level: state.prevLevel, sublevel: state.prevSublevel });
      }
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

      {/* 상단 여백 */}
      <div className="w-full pt-2" />

      {/* 로딩 */}
      {loading && (
        <p className="text-sm text-muted-foreground">{t.levelSelect.loading}</p>
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

      {/* 데일리 챌린지 진입 카드 — clear 조건표 바로 아래, 레벨 그룹 위 */}
      <button
        type="button"
        onClick={() => navigate("/daily")}
        aria-label="daily-challenge-enter"
        className="w-full rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-700 p-4 shadow-sm hover:shadow-md hover:border-amber-400 active:scale-[0.98] transition-all flex items-center gap-3 text-left"
      >
        <span className="text-2xl" aria-hidden="true">📅</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-amber-800 dark:text-amber-200">
            {lang === "ko" ? "오늘의 챌린지" : "Today's challenge"}
          </div>
          <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
            {lang === "ko" ? "단 한 번뿐인 오늘의 도전" : "Your one shot, today only"}
          </div>
        </div>
        <span className="text-amber-700 dark:text-amber-300 text-sm font-semibold">
          {lang === "ko" ? "시작하기 →" : "Start →"}
        </span>
      </button>

      {/* 레벨 그룹 */}
      <div className="flex flex-col gap-3 w-full">
        {LEVEL_META.flatMap((emoji, idx) => {
          const level = idx + 1;
          const levelInfo = t.levelSelect.levels[idx];
          const card = (
            <div
              key={level}
              className="rounded-2xl border border-border bg-card/60 p-3 shadow-sm"
            >
              {/* 레벨 헤더 */}
              <div className="flex items-center gap-2 mb-2 px-0.5 flex-wrap">
                <span className="text-base leading-none" aria-hidden="true">{emoji}</span>
                <span className="text-sm font-bold text-foreground">{levelInfo.name}</span>
                <span className="text-xs text-muted-foreground">{levelInfo.label}</span>
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
                      t={t.levelSelect}
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
  t: {
    passed: string;
    proBadge: string;
    achieved: string;
    aria: { proOnly: string; locked: string; select: string; passedReplay: string; inProgress: string };
  };
}

const SublevelCell = memo(function SublevelCell({
  level,
  sublevel,
  state,
  onSelect,
  highlighted = false,
  cellRef,
  t,
}: SublevelCellProps) {
  const onClick = () => onSelect(level, sublevel);
  const config    = SUBLEVEL_CONFIGS[sublevel];
  const label     = formatSublevel(level, sublevel);
  const shortLabel = `${level}-${sublevel}`;
  const configStr = `${config.timeLimit}s · ♥${config.lives}`;

  // LockedByProgressDialog CTA로 이동 시 1.5s 동안 ring 강조 완료.
  const highlightClass = highlighted
    ? "ring-4 ring-primary ring-offset-2 animate-pulse"
    : "";

  const baseClass =
    "flex flex-col items-center gap-0.5 rounded-xl border-2 p-2 min-h-[76px] " +
    "transition-all duration-200 active:scale-95 text-center w-full " +
    highlightClass;

  // ── 구독 잠금 (Pro 전용) ────────────────────────────────────
  if (state.lockReason === "subscription") {
    return (
      <button
        ref={cellRef}
        aria-label={`${label} ${t.aria.proOnly}`}
        onClick={onClick}
        className={
          `${baseClass} bg-muted/30 border-border/50 opacity-70 ` +
          "hover:opacity-90 cursor-pointer"
        }
      >
        <span className="text-sm leading-tight">🔒</span>
        <span className="text-[11px] font-bold text-foreground">{shortLabel}</span>
        <span className="text-[10px] font-bold text-amber-600 bg-amber-100 rounded px-1 dark:bg-amber-900/40 dark:text-amber-300">
          {t.proBadge}
        </span>
        <span className="text-[10px] text-muted-foreground">{configStr}</span>
      </button>
    );
  }

  // ── 진도 잠금 ───────────────────────────────────────────────
  if (state.lockReason === "progress") {
    return (
      <button
        ref={cellRef}
        aria-label={`${label} ${t.aria.locked}`}
        onClick={onClick}
        className={
          `${baseClass} bg-muted/40 border-border/40 opacity-50 ` +
          "cursor-pointer hover:opacity-65"
        }
      >
        <span className="text-sm leading-tight">🔒</span>
        <span className="text-[11px] font-semibold text-foreground">{shortLabel}</span>
        <span className="text-[10px] text-muted-foreground">{configStr}</span>
      </button>
    );
  }

  // ── 통과 ────────────────────────────────────────────────────
  if (state.passed) {
    return (
      <button
        ref={cellRef}
        aria-label={`${label} ${t.aria.passedReplay}`}
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
        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500">
          {t.passed}
        </span>
        <span className="text-[10px] text-muted-foreground">{configStr}</span>
      </button>
    );
  }

  // ── 진행 중 ─────────────────────────────────────────────────
  if (state.inProgress) {
    const pct = Math.round((state.criteriaCount / 4) * 100);
    return (
      <button
        ref={cellRef}
        aria-label={`${label} ${t.aria.inProgress}`}
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
        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          {t.achieved.replace("{n}", String(state.criteriaCount))}
        </span>
        <div className="w-full bg-amber-200 dark:bg-amber-800 rounded-full h-1 mt-0.5">
          <div
            className="bg-amber-500 h-1 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">{configStr}</span>
      </button>
    );
  }

  // ── 미시작 (이용 가능) ──────────────────────────────────────
  return (
    <button
      ref={cellRef}
      aria-label={`${label} ${t.aria.select}`}
      onClick={onClick}
      className={
        `${baseClass} bg-card border-border ` +
        "hover:border-primary/50 hover:shadow-sm cursor-pointer"
      }
    >
      <span className="text-[11px] font-semibold text-foreground">{shortLabel}</span>
      <span className="text-[10px] text-muted-foreground mt-auto">{configStr}</span>
    </button>
  );
});
