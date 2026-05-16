import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { BookOpen, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import { AdBanner } from "@/components/AdBanner";
import UpgradeModal from "@/components/UpgradeModal";
import PremiumBlurCard from "@/components/PremiumBlurCard";
import { getSlot } from "@/lib/adsense";
import { formatDistanceToNow } from "date-fns";
import { ko, enUS } from "date-fns/locale";
import { useLang, useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

import { useUserStats, type DailyStat } from "@/hooks/useUserStats";
import { useMyStats } from "@/hooks/useMyStats";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import DiagnosisTab from "@/components/home/DiagnosisTab";
import InfoTooltip from "@/components/ui/info-tooltip";
import MasteryHeroCard, { MasteryHeroCardSkeleton } from "@/components/dashboard/MasteryHeroCard";
import { useLevelProgress } from "@/hooks/useLevelProgress";
import { getUserTier } from "@/lib/subscriptionTier";
import {
  canAccessSublevel,
  getProgressGatePrev,
  type Sublevel,
} from "@/lib/levelSystem";
import { computeMasteryScore } from "@/components/MasteryScoreCard";

const VALID_TABS = ["diagnosis", "rhythm", "activity"] as const;
type HomeTab = (typeof VALID_TABS)[number];

function parseTab(value: string | null): HomeTab {
  if (value && (VALID_TABS as readonly string[]).includes(value)) {
    return value as HomeTab;
  }
  return "diagnosis";
}

/* ---------- 공용 ---------- */

function StatTile({
  label,
  value,
  subtext,
  icon,
  accentClass,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  icon: string;
  accentClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4">
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

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return dateStr === `${y}-${m}-${day}`;
}

function formatDateTime(iso: string | null, lang: "ko" | "en" | "ja" | "zh"): string {
  if (!iso) return "—";
  const localeTag = lang === "ko" ? "ko-KR" : "en-US";
  return new Date(iso).toLocaleString(localeTag, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function trendIcon(trend: string | null): string {
  if (trend === "improving" || trend === "up") return "📈";
  if (trend === "declining" || trend === "down") return "📉";
  if (trend === "stable" || trend === "flat") return "➡️";
  return "";
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
  // 1분마다 상대 시간 재렌더 (tick이 바뀌어야 useMemo가 재평가됨)
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

  // 로딩도 아니고 활동 기록도 없으면 완전히 숨김
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

/* ---------- XP 막대 그래프 (7일/30일) ---------- */

function XpBarChart({
  range,
  weekStats,
  dailyStats30d,
}: {
  range: "7d" | "30d";
  weekStats: DailyStat[];
  dailyStats30d: { stat_date: string; xp_earned: number }[];
}) {
  const t = useT();
  const dayLabels = t.dashboard.dayLabels;
  const chartData = useMemo(() => {
    if (range === "7d") {
      return weekStats.map((d) => {
        const dt = new Date(`${d.stat_date}T00:00:00`);
        return {
          label: dayLabels[dt.getDay()],
          xp: d.xp_earned,
          date: d.stat_date,
        };
      });
    } else {
      const map = new Map<string, number>();
      dailyStats30d.forEach((d) => map.set(d.stat_date, d.xp_earned));
      const out: { label: string; xp: number; date: string }[] = [];
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const iso = `${y}-${m}-${day}`;
        out.push({
          label: `${m}-${day}`,
          xp: map.get(iso) ?? 0,
          date: iso,
        });
      }
      return out;
    }
  }, [range, weekStats, dailyStats30d, dayLabels]);

  const total = chartData.reduce((s, d) => s + d.xp, 0);

  if (total === 0) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-center gap-2">
        <p className="text-4xl" aria-hidden>
          📈
        </p>
        <p className="text-sm text-muted-foreground">
          {range === "7d" ? t.dashboard.noRecordWeek : t.dashboard.noRecord30d}
        </p>
      </div>
    );
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: range === "7d" ? 12 : 9 }}
            axisLine={false}
            tickLine={false}
            interval={range === "7d" ? 0 : "preserveStartEnd"}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
            formatter={(value: number) => [`${value} XP`, t.dashboard.xpEarnedLabel]}
            labelFormatter={(_, payload) => {
              const date = payload?.[0]?.payload?.date;
              return date ?? "";
            }}
          />
          <Bar dataKey="xp" fill="#f59e0b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- 정확도/반응속도 라인 차트 ---------- */

function AccuracyReactionChart({
  dailyStats30d,
}: {
  dailyStats30d: {
    stat_date: string;
    avg_accuracy: number | null;
    avg_reaction_ms: number | null;
  }[];
}) {
  const t = useT();
  const data = useMemo(
    () =>
      dailyStats30d.map((d) => ({
        label: d.stat_date.slice(5),
        accuracy:
          d.avg_accuracy != null
            ? Number((Number(d.avg_accuracy) * 100).toFixed(1))
            : null,
        reaction: d.avg_reaction_ms != null ? d.avg_reaction_ms : null,
      })),
    [dailyStats30d]
  );

  if (data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {t.dashboard.noRecord30d}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2">{t.dashboard.accuracyAxis}</p>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={32} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                formatter={(v: number | null) => v != null ? [`${v}%`, t.dashboard.accuracyTooltip] : ["—", t.dashboard.accuracyTooltip]}
              />
              <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">{t.dashboard.reactionAxis}</p>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                formatter={(v: number | null) => v != null ? [`${v}ms`, t.dashboard.avgTooltip] : ["—", t.dashboard.avgTooltip]}
              />
              <Line type="monotone" dataKey="reaction" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ---------- AI 보고서 타일 ---------- */

function ReportTile({
  label,
  period,
  icon,
  onClick,
}: {
  label: string;
  period: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border border-dashed border-border bg-card px-4 py-4 text-left transition hover:border-solid hover:border-primary/40 hover:bg-accent/30"
    >
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
    </button>
  );
}

/* ---------- 페이지 ---------- */

export default function Dashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const stats = useUserStats(user);
  const myStats = useMyStats(user);
  const [xpRange, setXpRange] = useState<"7d" | "30d">("7d");
  const t = useT();
  const { lang } = useLang();

  // 탭 상태 ↔ URL 쿼리 동기화 (?tab=rhythm|diagnosis|activity)
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab: HomeTab = parseTab(searchParams.get("tab"));

  const handleTabChange = (value: string) => {
    const next = parseTab(value);
    setSearchParams(
      next === "diagnosis" ? {} : { tab: next },
      { replace: true }
    );
  };

  // ?upgrade=1 → UpgradeModal 자동 노출 (AdPlaceholder 프리미엄 CTA 영역)
  const upgradeOpen = searchParams.get("upgrade") === "1";
  const handleUpgradeClose = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("upgrade");
    setSearchParams(next, { replace: true });
  };

  const isAdmin = profile?.role === "admin";
  const tier = getUserTier(user ?? null, profile ?? null);
  // AI 분석 보고서 영역 권한: admin·premium → 풀 노출. 그 외 (reviewer 포함) → blur + CTA.
  // reviewer = Free tier 동등 잠금 박음 (Paddle 심사관 결제 흐름 검증 영역).
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
  const { progress: levelProgress, getProgressFor, loading: progressLoading } = useLevelProgress();

  // 현재 진행 단계 + 마스터리 점수 계산
  const currentMastery = useMemo(() => {
    for (let lv = 1; lv <= 7; lv++) {
      for (const sub of [1, 2, 3] as Sublevel[]) {
        if (!canAccessSublevel(tier, lv, sub)) continue;
        const prev = getProgressGatePrev(tier, lv, sub);
        const isPrevPassed =
          prev === null
            ? true
            : (getProgressFor(prev.level, prev.sublevel)?.passed ?? false);
        if (!isPrevPassed && !isAdmin) continue;
        const prog = getProgressFor(lv, sub);
        if (!prog?.passed) {
          return {
            level: lv,
            sublevel: sub,
            progress: prog ?? null,
            score: computeMasteryScore(prog ?? null),
            accuracy: prog && prog.total_attempts > 0 ? prog.total_correct / prog.total_attempts : undefined,
            // DB 영역 null → undefined 정합 (MasteryHeroCard null 가드는 박혀있음, 방어 박음)
            avgReactionRatio: prog?.avg_reaction_ratio ?? undefined,
            playCount: prog?.play_count ?? undefined,
            bestStreak: prog?.best_streak ?? undefined,
          };
        }
      }
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, isAdmin, levelProgress, getProgressFor]);

  // 실제 "마지막 연습 활동" 시각 계산
  //  - 최근 세션의 started_at (가장 정확)
  //  - 없으면 profile.last_practice_date (날짜만)
  //  - 둘 다 없으면 null → 스트립 숨김
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

  const handleLibraryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.info(t.dashboard.libraryPreviewTitle, {
      description: t.dashboard.libraryPreviewDesc,
    });
  };

  const handleReportClick = (type: "daily" | "weekly" | "monthly") => {
    const labels = {
      daily: t.dashboard.reportDailyLabel,
      weekly: t.dashboard.reportWeeklyLabel,
      monthly: t.dashboard.reportMonthlyLabel,
    };
    toast.info(formatI18n(t.dashboard.reportComingSoon, { label: labels[type] }), {
      description:
        type === "daily"
          ? t.dashboard.reportDailyDesc
          : t.dashboard.reportNotDailyDesc,
    });
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

  const practicedToday = isToday(stats.lastPracticeDate);

  const homeNav = (
    <nav className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link to="/">{t.dashboard.backToHome}</Link>
      </Button>
      {isAdmin ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLibraryClick}
          aria-label={t.dashboard.libraryPreviewTitle}
          title={t.dashboard.libraryPreviewTitle}
        >
          <BookOpen className="h-5 w-5" />
        </Button>
      ) : null}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header
        right={homeNav}
        below={
          <LastUpdatedStrip
            lastActivity={realLastActivity}
            loading={isRefreshing}
            onRefresh={handleRefreshAll}
          />
        }
        headerClassName="bg-card/50"
      />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* 페이지 제목 */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t.dashboard.pageTitle}</h1>
          <p className="text-xs text-muted-foreground">{t.dashboard.pageSubtitle}</p>
        </div>

        {/* 상단 요약 */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              icon="🔥"
              label={t.dashboard.currentStreak}
              value={formatI18n(t.dashboard.streakValueDays, { n: String(stats.currentStreak) })}
              subtext={
                practicedToday
                  ? t.dashboard.streakTodayDone
                  : stats.currentStreak > 0
                    ? t.dashboard.streakTodayContinues
                    : t.dashboard.streakTodayFirst
              }
              accentClass="text-orange-500"
            />
            <StatTile
              icon="⭐"
              label={t.dashboard.todayXp}
              value={stats.todayXp}
              subtext={formatI18n(t.dashboard.totalXp, { n: stats.totalXp.toLocaleString() })}
              accentClass="text-amber-500"
            />
            <StatTile
              icon="🏆"
              label={t.dashboard.league}
              value={stats.league?.name ?? stats.currentLeagueName ?? "—"}
              subtext={
                stats.standing
                  ? stats.standing.rank_in_group
                    ? formatI18n(t.dashboard.leagueGroupRank, {
                        rank: String(stats.standing.rank_in_group),
                        xp: String(stats.standing.weekly_xp),
                      })
                    : formatI18n(t.dashboard.leagueWeekly, { xp: String(stats.standing.weekly_xp) })
                  : t.dashboard.leagueAfterFirst
              }
              accentClass=""
            />
            <StatTile
              icon="📅"
              label={t.dashboard.longestStreak}
              value={formatI18n(t.dashboard.streakValueDays, { n: String(stats.longestStreak) })}
              subtext={t.dashboard.bestRecord}
            />
          </div>

          {stats.error ? (
            <p className="text-xs text-destructive">
              {formatI18n(t.dashboard.dataError, { error: stats.error })}
            </p>
          ) : null}
        </section>

        {/* 마스터리 히어로 카드 — 로딩 중 Skeleton 박음 (사용자 인지: "고장 X, 로딩 중") */}
        {progressLoading && !currentMastery ? (
          <MasteryHeroCardSkeleton />
        ) : currentMastery ? (
          <MasteryHeroCard
            tier={isAdmin ? "admin" : tier}
            bestScore={currentMastery.score}
            level={currentMastery.level}
            sublevel={currentMastery.sublevel}
            accuracy={currentMastery.accuracy}
            avgReactionRatio={currentMastery.avgReactionRatio}
            playCount={currentMastery.playCount}
            bestStreak={currentMastery.bestStreak}
          />
        ) : null}

        {/* In-feed 광고 (통계 카드와 탭 사이) */}
        <AdBanner
          slot={getSlot("DASH_INFEED")}
          format="rectangle"
          placeholderVariant="horizontal-random"
          className="w-full"
        />

        {/* 탭 네비게이션: 학습 리듬 / 실력 진단 / 활동 기록 */}
        <Tabs
          value={currentTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger
              value="diagnosis"
              className="text-xs sm:text-sm py-2 data-[state=active]:font-semibold"
            >
              <span aria-hidden className="mr-1">🎯</span>
              {t.dashboard.tabDiagnosis}
            </TabsTrigger>
            <TabsTrigger
              value="rhythm"
              className="text-xs sm:text-sm py-2 data-[state=active]:font-semibold"
            >
              <span aria-hidden className="mr-1">📅</span>
              {t.dashboard.tabRhythm}
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="text-xs sm:text-sm py-2 data-[state=active]:font-semibold"
            >
              <span aria-hidden className="mr-1">🏆</span>
              {t.dashboard.tabActivity}
            </TabsTrigger>
          </TabsList>

          {/* 📅 학습 리듬 — 시간축 분석 콘텐츠 */}
          <TabsContent value="rhythm" className="mt-4 space-y-8">
        {/* XP 그래프 (7일/30일 토글) */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{t.dashboard.xpChartTitle}</CardTitle>
              <CardDescription>
                {formatI18n(t.dashboard.xpRangeEarned, {
                  range: xpRange === "7d" ? t.dashboard.xpRangeRecent7d : t.dashboard.xpRangeRecent30d,
                })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setXpRange("7d")}
                className={`text-xs px-2.5 py-1 rounded ${
                  xpRange === "7d"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {t.dashboard.xpRange7d}
              </button>
              <button
                type="button"
                onClick={() => setXpRange("30d")}
                className={`text-xs px-2.5 py-1 rounded ${
                  xpRange === "30d"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {t.dashboard.xpRange30d}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.loading || myStats.loading ? (
              <div className="h-52 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{t.dashboard.loading}</p>
              </div>
            ) : (
              <XpBarChart
                range={xpRange}
                weekStats={stats.weekStats}
                dailyStats30d={myStats.dailyStats30d}
              />
            )}
          </CardContent>
        </Card>

        {/* 정확도 + 반응속도 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.accuracyReactionTitle}</CardTitle>
            <CardDescription>{t.dashboard.accuracyReactionDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {myStats.loading ? (
              <div className="h-52 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">{t.dashboard.loading}</p>
              </div>
            ) : (
              <AccuracyReactionChart dailyStats30d={myStats.dailyStats30d} />
            )}
          </CardContent>
        </Card>

        {/* 약점 음표 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <span>{t.dashboard.weakNotesTitle}</span>
              <InfoTooltip content={t.dashboard.weakNotesTooltip} />
            </CardTitle>
            <CardDescription>
              {t.dashboard.weakNotesDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myStats.loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t.dashboard.loading}
              </p>
            ) : myStats.weakNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t.dashboard.weakNotesInsufficient}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {myStats.weakNotes.map((n, idx) => (
                  <div
                    key={`${n.note_key}-${n.clef}`}
                    className="rounded-lg border border-border bg-card px-3 py-3"
                  >
                    <p className="text-xs text-muted-foreground">
                      #{idx + 1} ·{" "}
                      {n.clef === "treble" ? t.dashboard.clefTreble : t.dashboard.clefBass}
                    </p>
                    <p className="text-lg font-bold mt-1">
                      {n.note_key}{" "}
                      <span className="text-sm">{trendIcon(n.trend)}</span>
                    </p>
                    <p className="text-xs text-destructive mt-1">
                      {(Number(n.recent_accuracy) * 100).toFixed(0)}% (
                      {n.correct_count}/{n.total_attempts})
                    </p>
                    {n.avg_reaction_ms != null ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatI18n(t.dashboard.avgMs, { n: String(n.avg_reaction_ms) })}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI 피드백 — 프리미엄 전용 (admin·reviewer·premium 풀, Free blur + CTA) */}
        <Card data-testid="ai-feedback-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span aria-hidden>🤖</span>
              {t.dashboard.aiFeedbackTitle}
            </CardTitle>
            <CardDescription>
              {t.dashboard.aiFeedbackDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PremiumBlurCard tier={aiReportTier} onUpgrade={handleOpenUpgrade}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ReportTile
                  icon="💬"
                  label={t.dashboard.reportDailyLabel}
                  period={t.dashboard.reportDailyPeriod}
                  onClick={() => handleReportClick("daily")}
                />
                <ReportTile
                  icon="📊"
                  label={t.dashboard.reportWeeklyLabel}
                  period={t.dashboard.reportWeeklyPeriod}
                  onClick={() => handleReportClick("weekly")}
                />
                <ReportTile
                  icon="🏆"
                  label={t.dashboard.reportMonthlyLabel}
                  period={t.dashboard.reportMonthlyPeriod}
                  onClick={() => handleReportClick("monthly")}
                />
              </div>
            </PremiumBlurCard>
          </CardContent>
        </Card>
          </TabsContent>

          {/* 🎯 실력 진단 — 노트별 정확도/반응 + 공식 학습 분석 */}
          <TabsContent value="diagnosis" className="mt-4">
            <DiagnosisTab />
          </TabsContent>

          {/* 🏆 활동 기록 — 세션 로그 · 리그 · 배지 */}
          <TabsContent value="activity" className="mt-4 space-y-8">
            {/* 최근 세션 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.dashboard.recentSessionsTitle}</CardTitle>
                <CardDescription>{t.dashboard.recentSessionsDesc}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {myStats.loading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    {t.dashboard.loading}
                  </p>
                ) : myStats.sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    {t.dashboard.noSessions}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-xs text-muted-foreground">
                        <tr className="text-left">
                          <th className="px-4 py-2 font-medium">{t.dashboard.tableTime}</th>
                          <th className="px-4 py-2 font-medium">{t.dashboard.tableLevel}</th>
                          <th className="px-4 py-2 font-medium text-right">
                            {t.dashboard.tableCorrectTotal}
                          </th>
                          <th className="px-4 py-2 font-medium text-right">
                            {t.dashboard.tableAccuracy}
                          </th>
                          <th className="px-4 py-2 font-medium text-right">
                            {t.dashboard.tableAvgReaction}
                          </th>
                          <th className="px-4 py-2 font-medium text-right">
                            {t.dashboard.tableXp}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {myStats.sessions.map((s) => (
                          <tr
                            key={s.id}
                            className="border-b border-border/50 hover:bg-accent/20"
                          >
                            <td className="px-4 py-2 text-xs">
                              {formatDateTime(s.started_at, lang)}
                            </td>
                            <td className="px-4 py-2">Lv.{s.level}</td>
                            <td className="px-4 py-2 text-right">
                              {s.correct_notes}/{s.total_notes}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {s.accuracy != null
                                ? `${(Number(s.accuracy) * 100).toFixed(1)}%`
                                : "—"}
                            </td>
                            <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                              {s.avg_reaction_ms != null
                                ? `${s.avg_reaction_ms}ms`
                                : "—"}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-amber-600">
                              +{s.xp_earned}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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