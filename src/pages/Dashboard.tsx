import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import UserMenu from "@/components/UserMenu";
import Header from "@/components/Header";
import { AdBanner } from "@/components/AdBanner";
import UpgradeModal from "@/components/UpgradeModal";
import PremiumBlurCard from "@/components/PremiumBlurCard";
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
        <PremiumBlurCard tier={aiReportTier} onUpgrade={onUpgrade}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ReportTile
              icon="💬"
              label={t.dashboard.reportDailyLabel}
              period={t.dashboard.reportDailyPeriod}
            />
            <ReportTile
              icon="📊"
              label={t.dashboard.reportWeeklyLabel}
              period={t.dashboard.reportWeeklyPeriod}
            />
            <ReportTile
              icon="🏆"
              label={t.dashboard.reportMonthlyLabel}
              period={t.dashboard.reportMonthlyPeriod}
            />
          </div>
        </PremiumBlurCard>
      </CardContent>
    </Card>
  );
}

function ReportTile({
  label,
  period,
  icon,
}: {
  label: string;
  period: string;
  icon: string;
}) {
  return (
    <div className="group rounded-lg border border-dashed border-border bg-card px-4 py-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {icon}
          </span>
          <p className="text-sm font-semibold">{label}</p>
        </div>
        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          SOON
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{period}</p>
    </div>
  );
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
    <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
      <p className="text-2xl font-bold text-foreground mb-2">{t.dashboard.newUserTitle}</p>
      <p className="text-sm text-muted-foreground mb-6">{t.dashboard.newUserSubtitle}</p>
      <Button size="lg" onClick={onStart}>
        {t.dashboard.newUserCta}
      </Button>
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

  // 비교 기준 — 오늘 활동 있으면 마지막 세션 (오늘 X), 없으면 가장 최근 세션
  const todayAgg = aggregateSessions(todaySessions);
  const lastAgg = lastSessionNotToday ? aggregateSessions([lastSessionNotToday]) : null;

  const todayAcc = todayAgg.totalNotes > 0
    ? Math.round((todayAgg.totalCorrect / todayAgg.totalNotes) * 100)
    : null;
  const lastAcc = lastAgg && lastAgg.totalNotes > 0
    ? Math.round((lastAgg.totalCorrect / lastAgg.totalNotes) * 100)
    : null;

  const todaySpeed = todayAgg.reactionCount > 0
    ? +(todayAgg.reactionSum / todayAgg.reactionCount / 1000).toFixed(2)
    : null;
  const lastSpeed = lastAgg && lastAgg.reactionCount > 0
    ? +(lastAgg.reactionSum / lastAgg.reactionCount / 1000).toFixed(2)
    : null;

  const todayXp = todayAgg.xpSum;
  const lastXp = lastAgg ? lastAgg.xpSum : null;

  function formatDelta(delta: number | null, suffix = "", invert = false): string {
    if (delta == null) return t.dashboard.noLastSessionYet;
    if (Math.abs(delta) < 0.5) return `${t.dashboard.vsLast} ±0${suffix}`;
    const positive = invert ? delta < 0 : delta > 0;
    const sign = delta > 0 ? "+" : "−";
    const arrow = positive ? "↑" : "↓";
    const abs = invert ? Math.abs(delta) : Math.abs(delta);
    return `${t.dashboard.vsLast} ${sign}${abs}${suffix} ${arrow}`;
  }

  const accSubtext = todayAcc != null && lastAcc != null
    ? formatDelta(todayAcc - lastAcc, "%p")
    : todayAcc != null
      ? t.dashboard.noLastSessionYet   // 오늘 연습 있음, 비교 기준 없음
      : t.dashboard.kpiNoDataToday;    // 상태 2: 오늘 연습 없음
  const speedSubtext = todaySpeed != null && lastSpeed != null
    ? formatDelta(+(todaySpeed - lastSpeed).toFixed(2), "s", /* invert */ true)
    : todaySpeed != null
      ? t.dashboard.noLastSessionYet
      : t.dashboard.kpiNoDataToday;
  const xpSubtext = lastXp != null && todayXp > 0
    ? formatDelta(todayXp - lastXp, " XP")
    : !practicedToday
      ? t.dashboard.kpiNotYet          // 상태 2: 아직 시작 전
      : t.dashboard.noLastSessionYet;

  // 마지막 활동 데이터 — 3단계 fallback (reviewer RLS·트리거 미적용 대비)
  const lastActivityData = useMemo(() => {
    // [진단 로그] 각 데이터 소스 현황 — 콘솔에서 어느 영역 비었는지 확인
    console.log("[Dashboard][lastActivity] sessions:", sessionsTyped.length,
      "| dailyStats30d:", myStats.dailyStats30d.length,
      "| lastPracticeDate:", stats.lastPracticeDate,
      "| practicedToday:", practicedToday,
      "| hasAnyProgress:", hasAnyProgress,
    );

    // 1순위: user_sessions의 가장 최근 비오늘 세션
    if (lastSessionNotToday) {
      console.log("[Dashboard][lastActivity] source=user_sessions", lastSessionNotToday.started_at);
      return {
        startedAt: lastSessionNotToday.started_at,
        accuracy: lastSessionNotToday.accuracy,
        avgReactionMs: lastSessionNotToday.avg_reaction_ms,
        xpEarned: lastSessionNotToday.xp_earned,
      };
    }

    // 2순위: user_stats_daily 최신 항목 (오늘 제외, lastPracticeDate 요구 X)
    const recentDaily = myStats.dailyStats30d
      .filter((d) => d.stat_date !== todayIso())
      .sort((a, b) => b.stat_date.localeCompare(a.stat_date))[0];
    if (recentDaily) {
      console.log("[Dashboard][lastActivity] source=dailyStats30d", recentDaily.stat_date);
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

    // 3순위: hasAnyProgress = true면 "활동 기록 있음" 카드 표시 (정확한 stats 없음)
    // profiles.last_practice_date로 날짜 추정, 없으면 어제로 fallback
    if (hasAnyProgress) {
      const fallbackDate = stats.lastPracticeDate
        ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      console.log("[Dashboard][lastActivity] source=progress_fallback date:", fallbackDate);
      return {
        startedAt: `${fallbackDate}T12:00:00`,
        accuracy: null,
        avgReactionMs: null,
        xpEarned: 0,
      };
    }

    console.log("[Dashboard][lastActivity] source=null (no data found)");
    return null;
  }, [
    lastSessionNotToday, practicedToday, stats.lastPracticeDate,
    myStats.dailyStats30d, sessionsTyped.length, hasAnyProgress,
  ]);

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
