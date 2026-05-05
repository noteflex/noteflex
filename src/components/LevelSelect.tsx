import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLevelProgress } from "@/hooks/useLevelProgress";
import { getUserTier } from "@/lib/subscriptionTier";
import {
  canAccessSublevel,
  getCompletion,
  getPreviousSublevel,
  formatSublevel,
  SUBLEVEL_CONFIGS,
  type Sublevel,
  type SublevelProgress,
} from "@/lib/levelSystem";
import UpgradeModal from "./UpgradeModal";

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
  const tier = getUserTier(user ?? null, profile ?? null);
  const isAdmin = profile?.role === "admin";

  const [upgradeOpen, setUpgradeOpen]   = useState(false);
  const [lockMsg,     setLockMsg]       = useState<string | null>(null);

  const totalPassed = progress.filter((p) => p.passed).length;

  // §F4 (2026-05-05, 정책 P1 보조): 21개 셀 state를 useMemo로 한 번에 계산 → SublevelCell React.memo 효과 확보.
  const cellStates = useMemo(() => {
    function compute(level: number, sub: Sublevel): CellState {
      // 1) 구독 게이트
      if (!canAccessSublevel(tier, level, sub)) {
        return {
          passed: false, inProgress: false,
          lockReason: "subscription", prevLabel: null, criteriaCount: 0,
        };
      }

      // 2) 진도 게이트 (이전 서브레벨 통과 필요)
      const prev = getPreviousSublevel(level, sub);
      const isPrevPassed = prev === null
        ? true
        : (getProgressFor(prev.level, prev.sublevel)?.passed ?? false);

      if (!isPrevPassed && !isAdmin) {
        const pl = formatSublevel(prev!.level, prev!.sublevel as Sublevel);
        return {
          passed: false, inProgress: false,
          lockReason: "progress", prevLabel: pl, criteriaCount: 0,
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
          c.avgReactionTime.satisfied,
        ].filter(Boolean).length;
      }

      return { passed, inProgress, lockReason: null, prevLabel: null, criteriaCount };
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

  const handleSelect = useCallback((level: number, sub: Sublevel) => {
    const state = cellStatesRef.current.get(`${level}-${sub}`);
    if (!state) return;

    if (state.lockReason === "subscription") {
      setUpgradeOpen(true);
      return;
    }

    if (state.lockReason === "progress") {
      setLockMsg(`${state.prevLabel} 먼저 통과해주세요`);
      setTimeout(() => setLockMsg(null), 3000);
      return;
    }

    onSelectSublevel(level, sub);
  }, [onSelectSublevel]);

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-lg mx-auto px-2 pb-8 animate-fade-up">

      {/* 헤더 */}
      <div className="flex flex-col items-center gap-1 pt-2">
        <span className="text-4xl">🎼</span>
        <h2 className="text-xl font-bold text-foreground tracking-tight">단계 선택</h2>
        <p className="text-sm text-muted-foreground">
          내 진도:{" "}
          <span className="font-semibold text-foreground">{totalPassed}</span> / 21 통과
        </p>
      </div>

      {/* 구독 상태 뱃지 */}
      {tier === "guest" && (
        <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full text-center">
          로그인하면 더 많은 단계를 이용할 수 있어요
          {onLoginRequest && (
            <button
              onClick={onLoginRequest}
              className="ml-2 text-primary font-semibold hover:underline"
            >
              로그인
            </button>
          )}
        </div>
      )}
      {tier === "pro" && (
        <div className="text-xs text-primary font-semibold bg-primary/10 px-3 py-1.5 rounded-full">
          ✨ Pro — 전 단계 이용 중
        </div>
      )}

      {/* 진도 잠금 메시지 (inline) */}
      {lockMsg && (
        <div
          role="alert"
          className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 w-full text-center"
        >
          🔒 {lockMsg}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <p className="text-sm text-muted-foreground">진도 불러오는 중...</p>
      )}

      {/* 레벨 그룹 */}
      <div className="flex flex-col gap-3 w-full">
        {LEVEL_INFO.map((info, idx) => {
          const level = idx + 1;
          return (
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
                  const state = cellStates.get(`${level}-${sub}`)!;
                  return (
                    <SublevelCell
                      key={sub}
                      level={level}
                      sublevel={sub}
                      state={state}
                      onSelect={handleSelect}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 뒤로가기 */}
      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        ← 메인으로 돌아가기
      </button>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
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
}

const SublevelCell = memo(function SublevelCell({ level, sublevel, state, onSelect }: SublevelCellProps) {
  const onClick = () => onSelect(level, sublevel);
  const config    = SUBLEVEL_CONFIGS[sublevel];
  const label     = formatSublevel(level, sublevel);
  const shortLabel = `${level}-${sublevel}`;
  const configStr = `${config.timeLimit}s · ♥${config.lives}`;

  const baseClass =
    "flex flex-col items-center gap-0.5 rounded-xl border-2 p-2 min-h-[72px] " +
    "transition-all duration-200 active:scale-95 text-center w-full";

  // ── 구독 잠금 (Pro 전용) ────────────────────────────────────
  if (state.lockReason === "subscription") {
    return (
      <button
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
