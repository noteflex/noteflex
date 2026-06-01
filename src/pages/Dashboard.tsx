import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import Header from "@/components/Header";
import { AdBanner } from "@/components/AdBanner";
import UpgradeModal from "@/components/UpgradeModal";
import { getSlot } from "@/lib/adsense";
import { formatDistanceToNow } from "date-fns";
import { ko, enUS } from "date-fns/locale";
import { useLang, useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

import { useUserStats } from "@/hooks/useUserStats";
import { useMyStats } from "@/hooks/useMyStats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WeakSlowNotesCards } from "@/components/dashboard/WeakSlowNotesCards";
import { NextStepCard } from "@/components/dashboard/NextStepCard";
import { useLevelProgress } from "@/hooks/useLevelProgress";
import { getUserTier } from "@/lib/subscriptionTier";

/* ---------- 공용 helpers ---------- */

function StatTile({
  label,
  value,
  subtext,
  icon,
  accentClass,
  dimmed,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: string;
  accentClass?: string;
  /** 상태 2 (오늘 활동 X) — 회색 비활성 처리 */
  dimmed?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-card px-4 py-4 ${
        dimmed ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          {icon}
        </span>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p
        className={`mt-2 text-2xl font-bold tracking-tight ${accentClass ?? ""}`}
      >
        {value}
      </p>
      {subtext ? (
        <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
      ) : null}
    </div>
  );
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr === todayIso();
}

function isoFromIsoOrTimestamp(s: string): string {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ---------- 최신 업데이트 스트립 ---------- */

function LastUpdatedStrip({
  lastActivity,
  loading,
  onRefresh,
}: {
  lastActivity: Date | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const relative = useMemo(() => {
    if (!lastActivity) return null;
    return formatDistanceToNow(lastActivity, {
      addSuffix: true,
      locale: lang === "ko" ? ko : enUS,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastActivity, tick, lang]);

  if (!loading && !lastActivity) return null;

  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-2 min-w-0">
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${
              loading ? "bg-amber-400" : "bg-green-500"
            } opacity-75 ${loading ? "" : "animate-ping"}`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              loading ? "bg-amber-500" : "bg-green-500"
            }`}
          />
        </span>
        <span className="truncate">
          {loading ? (
            t.dashboard.updating
          ) : (
            <>
              {t.dashboard.liveLastPractice}{" "}
              <span className="text-foreground font-medium">{relative}</span>
            </>
          )}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
        className="h-7 px-2 text-xs"
      >
        <RefreshCw
          className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`}
        />
        {t.dashboard.refresh}
      </Button>
    </div>
  );
}

/* ---------- AI Feedback Card (잠금 + 신규 미니멀) ---------- */

function AiFeedbackCard({
  aiReportTier,
  onUpgrade,
  isNewUser,
}: {
  aiReportTier: "guest" | "free" | "premium" | "admin";
  onUpgrade: () => void;
  isNewUser: boolean;
}) {
  const t = useT();
  const subtitle = isNewUser
    ? t.dashboard.aiFeedbackSubtitleNew
    : t.dashboard.aiFeedbackSubtitleActive;

  return (
    <Card data-testid="ai-feedback-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span aria-hidden>🤖</span>
          {t.dashboard.aiFeedbackTitle}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 일간: Free·Guest 포함 전체 허용 — 후킹 진입로 */}
          <ReportTile
            icon="💬"
            label={t.dashboard.reportDailyLabel}
            period={t.dashboard.reportDailyPeriod}
            to="/analytics/daily"
          />
          {/* 주·월: Free·Guest는 클릭 시 업그레이드 모달, admin·premium은 정상 진입 */}
          <ReportTile
            icon="📊"
            label={t.dashboard.reportWeeklyLabel}
            period={t.dashboard.reportWeeklyPeriod}
            to={aiReportTier === "premium" || aiReportTier === "admin" ? "/analytics/weekly" : undefined}
            badge="Pro"
            locked={aiReportTier === "free" || aiReportTier === "guest"}
            onUpgrade={aiReportTier === "free" || aiReportTier === "guest" ? onUpgrade : undefined}
          />
          <ReportTile
            icon="🏆"
            label={t.dashboard.reportMonthlyLabel}
            period={t.dashboard.reportMonthlyPeriod}
            to={aiReportTier === "premium" || aiReportTier === "admin" ? "/analytics/monthly" : undefined}
            badge="Pro"
            locked={aiReportTier === "free" || aiReportTier === "guest"}
            onUpgrade={aiReportTier === "free" || aiReportTier === "guest" ? onUpgrade : undefined}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ReportTile({
  label,
  period,
  icon,
  to,
  badge,
  locked,
  onUpgrade,
}: {
  label: string;
  period: string;
  icon: string;
  to?: string;
  badge?: string;
  locked?: boolean;
  onUpgrade?: () => void;
}) {
  const inner = (
    <div
      className={`group rounded-lg border border-dashed bg-card px-4 py-4 text-left transition-colors ${
        locked
          ? "border-border/50 opacity-60 hover:opacity-80 cursor-pointer"
          : "border-border hover:border-primary/50 hover:bg-accent/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {icon}
          </span>
          <p className="text-sm font-semibold">{label}</p>
        </div>
        {badge && (
          <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{period}</p>
    </div>
  );

  if (locked && onUpgrade) {
    return (
      <button onClick={onUpgrade} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  if (to) {
    return <Link to={to} className="block">{inner}</Link>;
  }
  return inner;
}

/* ---------- Notice 영역 (상태 2: 오늘 활동 X) ---------- */

function EmptyTodayNotice({
  currentStreak,
  onStart,
}: {
  currentStreak: number;
  onStart: () => void;
}) {
  const t = useT();
  const streakHint = currentStreak > 0
    ? formatI18n(t.dashboard.emptyTodayStreakHint, { n: String(currentStreak + 1) })
    : null;

  return (
    <div className="rounded-xl border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{t.dashboard.emptyTodayTitle}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t.dashboard.emptyTodaySubtitle}</p>
        {streakHint && (
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 font-semibold">{streakHint}</p>
        )}
      </div>
      <Button size="sm" onClick={onStart} className="shrink-0">
        {t.dashboard.emptyTodayCta}
      </Button>
    </div>
  );
}

/* ---------- 마지막 활동 카드 (상태 2) ---------- */

function LastActivityCard({
  startedAt,
  accuracy,
  avgReactionMs,
  xpEarned,
}: {
  startedAt: string;
  accuracy: number | null;
  avgReactionMs: number | null;
  xpEarned: number;
}) {
  const t = useT();
  const { lang } = useLang();

  const when = useMemo(() => {
    const d = new Date(startedAt);
    const today = new Date();
    const diffMs = today.getTime() - d.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) return t.dashboard.today;
    if (days === 1) return t.dashboard.yesterday;
    return formatI18n(t.dashboard.daysAgo, { n: String(days) });
  }, [startedAt, t, lang]);

  // null → "—" 표시 (정확한 데이터 없는 fallback 경우)
  const accDisplay = accuracy != null ? `${Math.round(accuracy * 100)}%` : "—";
  const speedDisplay = avgReactionMs != null ? `${+(avgReactionMs / 1000).toFixed(2)}s` : "—";

  return (
    <div className="border-l-4 border-amber-400 bg-card rounded-r-lg px-4 py-3">
      <p className="text-xs text-muted-foreground font-semibold mb-1">
        {t.dashboard.lastActivityTitle}
      </p>
      <p className="text-sm text-foreground">
        {formatI18n(t.dashboard.lastActivityFormat, {
          when,
          acc: accDisplay,
          speed: speedDisplay,
          xp: xpEarned > 0 ? String(xpEarned) : "—",
        })}
      </p>
    </div>
  );
}

/* ---------- 신규 사용자 영역 (상태 3) ---------- */

function NewUserView({ onStart }: { onStart: () => void }) {
  const t = useT();
  return (
    <div
      className="rounded-2xl text-center"
      style={{
        backgroundColor: "#FFFFFF",
        border: "0.5px solid rgba(0,0,0,0.08)",
        padding: "40px 32px",
      }}
    >
      {/* Noteflex 브랜드 로고 — Header.tsx 인라인 SVG 동일 (16분음표 두 개) */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#D3224E"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mx-auto w-16 h-16"
        style={{ marginBottom: "20px" }}
        aria-hidden="true"
      >
        <circle cx="6" cy="17" r="3" />
        <circle cx="16" cy="17" r="3" />
        <path d="M9 17V4h10v13" />
        <path d="M9 8h10" />
      </svg>
      <p
        className="font-medium"
        style={{ fontSize: "22px", color: "#1A1A1A", margin: "0 0 8px" }}
      >
        {t.dashboard.newUserTitle}
      </p>
      <p
        className="font-normal"
        style={{ fontSize: "15px", color: "#1A1A1A", margin: "0 0 32px" }}
      >
        {t.dashboard.newUserSubtitle}
      </p>
      <button
        type="button"
        onClick={onStart}
        className="text-white font-medium transition-opacity hover:opacity-90"
        style={{
          backgroundColor: "#D3224E",
          border: "none",
          borderRadius: "12px",
          padding: "16px 40px",
          fontSize: "17px",
        }}
      >
        {t.dashboard.newUserCta}
      </button>
    </div>
  );
}

/* ---------- 페이지 ---------- */

interface SessionRow {
  id: string;
  level: number;
  started_at: string;
  total_notes: number;
  correct_notes: number;
  accuracy: number | null;
  avg_reaction_ms: number | null;
  xp_earned: number;
}

interface SessionAgg {
  count: number;
  totalCorrect: number;
  totalNotes: number;
  reactionSum: number;
  reactionCount: number;
  xpSum: number;
}

function aggregateSessions(sessions: SessionRow[]): SessionAgg {
  const agg: SessionAgg = {
    count: 0,
    totalCorrect: 0,
    totalNotes: 0,
    reactionSum: 0,
    reactionCount: 0,
    xpSum: 0,
  };
  for (const s of sessions) {
    agg.count++;
    agg.totalCorrect += s.correct_notes ?? 0;
    agg.totalNotes += s.total_notes ?? 0;
    if (s.avg_reaction_ms != null) {
      agg.reactionSum += s.avg_reaction_ms;
      agg.reactionCount++;
    }
    agg.xpSum += s.xp_earned ?? 0;
  }
  return agg;
}

export default function Dashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const stats = useUserStats(user);
  const myStats = useMyStats(user);
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        myStats.refresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  // myStats.refresh는 useCallback으로 안정화되어 있어야 하지만, 호출 빈도가 낮으므로 안전
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStats.refresh]);

  // ?upgrade=1 → UpgradeModal 자동 노출
  const upgradeOpen = searchParams.get("upgrade") === "1";
  const handleUpgradeClose = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("upgrade");
    setSearchParams(next, { replace: true });
  };

  const isAdmin = profile?.role === "admin";
  const tier = getUserTier(user ?? null, profile ?? null);
  // AI 분석 보고서 영역 권한: admin·premium → 풀, 그 외 (reviewer 포함) → blur (Paddle 심사관 결제 영역 검증)
  const aiReportTier: "guest" | "free" | "premium" | "admin" =
    isAdmin
      ? "admin"
      : tier === "pro"
        ? "premium"
        : !user
          ? "guest"
          : "free";

  const handleOpenUpgrade = () => {
    const next = new URLSearchParams(searchParams);
    next.set("upgrade", "1");
    setSearchParams(next, { replace: true });
  };

  const { progress: levelProgress } = useLevelProgress();

  // 실제 "마지막 연습 활동" 시각 계산
  const realLastActivity = useMemo(() => {
    if (myStats.sessions.length > 0) {
      return new Date(myStats.sessions[0].started_at);
    }
    if (stats.lastPracticeDate) {
      return new Date(`${stats.lastPracticeDate}T00:00:00`);
    }
    return null;
  }, [myStats.sessions, stats.lastPracticeDate]);

  // Rules of Hooks: early return 이전에 선언 (lastSessionNotToday는 내부에서 재계산)
  const lastActivityData = useMemo(() => {
    const sessions = myStats.sessions as SessionRow[];
    const hasProgress = levelProgress.length > 0;
    const lastSession = sessions.find(
      (s) => isoFromIsoOrTimestamp(s.started_at) !== todayIso(),
    );

    if (lastSession) {
      return {
        startedAt: lastSession.started_at,
        accuracy: lastSession.accuracy,
        avgReactionMs: lastSession.avg_reaction_ms,
        xpEarned: lastSession.xp_earned,
      };
    }

    const recentDaily = myStats.dailyStats30d
      .filter((d) => d.stat_date !== todayIso())
      .sort((a, b) => b.stat_date.localeCompare(a.stat_date))[0];
    if (recentDaily) {
      const acc =
        recentDaily.avg_accuracy ??
        (recentDaily.total_notes > 0
          ? recentDaily.correct_notes / recentDaily.total_notes
          : null);
      return {
        startedAt: `${recentDaily.stat_date}T12:00:00`,
        accuracy: acc,
        avgReactionMs: recentDaily.avg_reaction_ms,
        xpEarned: recentDaily.xp_earned,
      };
    }

    if (hasProgress) {
      const fallbackDate =
        stats.lastPracticeDate ??
        new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      return {
        startedAt: `${fallbackDate}T12:00:00`,
        accuracy: null,
        avgReactionMs: null,
        xpEarned: 0,
      };
    }

    return null;
  }, [myStats.sessions, myStats.dailyStats30d, stats.lastPracticeDate, levelProgress]);

  const isRefreshing = stats.loading || myStats.loading;

  const handleRefreshAll = async () => {
    await Promise.all([stats.refresh(), myStats.refresh()]);
    toast.success(t.dashboard.refreshSuccess);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">{t.dashboard.loading}</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // ── 상태 결정 ─────────────────────────────────────────────
  // 신규: 세션 데이터 X → 큰 CTA + AI 카드만
  // 오늘 없음: 세션 데이터 있음 + 오늘 활동 X → notice + KPI 비활성 + 마지막 활동 + 음표 + AI
  // 오늘 있음: 오늘 활동 O → KPI 정상 + 음표 + AI
  const sessionsTyped = myStats.sessions as SessionRow[];
  const hasAnySession = sessionsTyped.length > 0;
  // user_sessions RLS가 reviewer를 막을 경우 대비: user_sublevel_progress를 추가 게임 이력 신호로 사용
  const hasAnyProgress = levelProgress.length > 0;
  const isNewUser = !hasAnySession && !hasAnyProgress && !stats.lastPracticeDate;

  // profiles.last_practice_date 트리거 미적용 대비:
  // user_sessions에 오늘 세션이 있으면 오늘 연습 완료로 처리
  const hasSessionToday = sessionsTyped.some(
    (s) => isoFromIsoOrTimestamp(s.started_at) === todayIso(),
  );
  const practicedToday = isToday(stats.lastPracticeDate) || hasSessionToday;

  const todaySessions = sessionsTyped.filter(
    (s) => isoFromIsoOrTimestamp(s.started_at) === todayIso(),
  );
  const lastSessionNotToday = sessionsTyped.find(
    (s) => isoFromIsoOrTimestamp(s.started_at) !== todayIso(),
  );

  // 오늘 집계
  const todayAgg = aggregateSessions(todaySessions);

  const todayAcc = todayAgg.totalNotes > 0
    ? Math.round((todayAgg.totalCorrect / todayAgg.totalNotes) * 100)
    : null;
  const todaySpeed = todayAgg.reactionCount > 0
    ? +(todayAgg.reactionSum / todayAgg.reactionCount / 1000).toFixed(2)
    : null;
  const todayXp = todayAgg.xpSum;

  // 7일 평균 baseline — user_stats_daily (오늘 제외 최근 7일, 표본 ≥ 3일 필요)
  const baseline7d = myStats.dailyStats30d
    .filter((d) => d.stat_date !== todayIso())
    .slice(-7);
  const hasEnoughBaseline = baseline7d.length >= 3;

  const baselineAcc = (() => {
    if (!hasEnoughBaseline) return null;
    const totalNotes = baseline7d.reduce((s, d) => s + (d.total_notes ?? 0), 0);
    const totalCorrect = baseline7d.reduce((s, d) => s + (d.correct_notes ?? 0), 0);
    return totalNotes > 0 ? Math.round((totalCorrect / totalNotes) * 100) : null;
  })();

  const baselineSpeed = (() => {
    if (!hasEnoughBaseline) return null;
    const days = baseline7d.filter((d) => (d.avg_reaction_ms ?? 0) > 0);
    if (days.length < 3) return null;
    const avg = days.reduce((s, d) => s + (d.avg_reaction_ms ?? 0), 0) / days.length;
    return +(avg / 1000).toFixed(2);
  })();

  const baselineDailyAvgXp = (() => {
    if (!hasEnoughBaseline) return null;
    const total = baseline7d.reduce((s, d) => s + (d.xp_earned ?? 0), 0);
    return Math.round(total / baseline7d.length);
  })();

  function formatDelta(delta: number | null, suffix = "", invert = false): string {
    if (delta == null) return t.dashboard.noLastSessionYet;
    if (Math.abs(delta) < 0.5) return `${t.dashboard.vsLast} ±0${suffix}`;
    const positive = invert ? delta < 0 : delta > 0;
    const sign = delta > 0 ? "+" : "−";
    const arrow = positive ? "↑" : "↓";
    return `${t.dashboard.vsLast} ${sign}${Math.abs(delta)}${suffix} ${arrow}`;
  }

  const accSubtext = !practicedToday
    ? t.dashboard.kpiNoDataToday
    : todayAcc != null && baselineAcc != null
      ? formatDelta(todayAcc - baselineAcc, "%p")
      : t.dashboard.noLastSessionYet;
  const speedSubtext = !practicedToday
    ? t.dashboard.kpiNoDataToday
    : todaySpeed != null && baselineSpeed != null
      ? formatDelta(+(todaySpeed - baselineSpeed).toFixed(2), "s", /* invert */ true)
      : t.dashboard.noLastSessionYet;
  const xpSubtext = !practicedToday
    ? t.dashboard.kpiNotYet
    : baselineDailyAvgXp != null && todayXp > 0
      ? formatDelta(todayXp - baselineDailyAvgXp, " XP")
      : t.dashboard.noLastSessionYet;

  const handleStart = () => {
    window.location.href = "/play";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        right={<UserMenu />}
        below={
          <LastUpdatedStrip
            lastActivity={realLastActivity}
            loading={isRefreshing}
            onRefresh={handleRefreshAll}
          />
        }
        headerClassName="bg-card/50"
      />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* 페이지 제목 */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t.dashboard.pageTitle}</h1>
          <p className="text-xs text-muted-foreground">{t.dashboard.pageSubtitle}</p>
        </div>

        {/* 상태 분기 — 신규 사용자 */}
        {isNewUser ? (
          <>
            <NewUserView onStart={handleStart} />
            <AiFeedbackCard
              aiReportTier={aiReportTier}
              onUpgrade={handleOpenUpgrade}
              isNewUser={true}
            />
          </>
        ) : (
          <>
            {/* 상태 2: 오늘 활동 없음 — notice */}
            {!practicedToday && (
              <EmptyTodayNotice
                currentStreak={stats.currentStreak}
                onStart={handleStart}
              />
            )}

            {/* KPI 4 카드 — 스트릭·정답률·속도·오늘 XP */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile
                icon="🔥"
                label={t.dashboard.currentStreak}
                value={formatI18n(t.dashboard.streakValueDays, { n: String(stats.currentStreak) })}
                subtext={
                  practicedToday
                    ? t.dashboard.streakTodayDone
                    : stats.currentStreak > 0
                      ? t.dashboard.streakTodayContinues
                      : t.dashboard.streakStartFresh   // 상태 2 스트릭 끊김
                }
                accentClass="text-orange-500"
              />
              <StatTile
                icon="🎯"
                label={t.diagnosis.kpiAccuracy}
                value={todayAcc != null ? `${todayAcc}%` : "—"}
                subtext={accSubtext}
                dimmed={!practicedToday}
                accentClass="text-primary"
              />
              <StatTile
                icon="⚡"
                label={t.diagnosis.kpiAvgReaction}
                value={todaySpeed != null ? `${todaySpeed}s` : "—"}
                subtext={speedSubtext}
                dimmed={!practicedToday}
              />
              <StatTile
                icon="⭐"
                label={t.dashboard.todayXp}
                value={todayXp}
                subtext={xpSubtext}
                dimmed={!practicedToday}
                accentClass="text-amber-500"
              />
            </section>

            {/* 상태 2: 마지막 활동 카드 (오늘 X + 이전 활동 있음) */}
            {!practicedToday && lastActivityData && (
              <LastActivityCard
                startedAt={lastActivityData.startedAt}
                accuracy={lastActivityData.accuracy}
                avgReactionMs={lastActivityData.avgReactionMs}
                xpEarned={lastActivityData.xpEarned}
              />
            )}

            {/* 약점·느린 음표 Top 5 — 누적 데이터 (옥타브 + 색상) */}
            <WeakSlowNotesCards />

            {/* 다음 한 걸음 — 레벨 진행 + 졸업 임박 + 주간 성취 */}
            <NextStepCard />

            {/* AI Feedback (프리미엄 전용) */}
            <AiFeedbackCard
              aiReportTier={aiReportTier}
              onUpgrade={handleOpenUpgrade}
              isNewUser={false}
            />

            {stats.error ? (
              <p className="text-xs text-destructive">
                {formatI18n(t.dashboard.dataError, { error: stats.error })}
              </p>
            ) : null}
          </>
        )}

        {/* 하단 배너 광고 */}
        <AdBanner
          slot={getSlot("DASH_BOTTOM")}
          format="horizontal"
          placeholderVariant="horizontal-random"
          className="w-full"
        />

        <UpgradeModal open={upgradeOpen} onClose={handleUpgradeClose} />
      </main>
    </div>
  );
}
