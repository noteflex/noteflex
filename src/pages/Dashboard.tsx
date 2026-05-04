import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { BookOpen, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import { AdBanner } from "@/components/AdBanner";
import { getSlot } from "@/lib/adsense";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
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

const VALID_TABS = ["rhythm", "diagnosis", "activity"] as const;
type HomeTab = (typeof VALID_TABS)[number];

function parseTab(value: string | null): HomeTab {
  if (value && (VALID_TABS as readonly string[]).includes(value)) {
    return value as HomeTab;
  }
  return "rhythm";
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

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
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

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

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
      locale: ko,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastActivity, tick]);

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
            "업데이트 중…"
          ) : (
            <>
              실시간 · 마지막 연습{" "}
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
        새로고침
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
  const chartData = useMemo(() => {
    if (range === "7d") {
      return weekStats.map((d) => {
        const dt = new Date(`${d.stat_date}T00:00:00`);
        return {
          label: DAY_LABELS[dt.getDay()],
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
  }, [range, weekStats, dailyStats30d]);

  const total = chartData.reduce((s, d) => s + d.xp, 0);

  if (total === 0) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-center gap-2">
        <p className="text-4xl" aria-hidden>
          📈
        </p>
        <p className="text-sm text-muted-foreground">
          {range === "7d" ? "이번 주" : "최근 30일"} 기록이 없어요
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
            formatter={(value: number) => [`${value} XP`, "획득"]}
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
          최근 30일 기록이 없어요
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-muted-foreground mb-2">정확도 (%)</p>
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
                formatter={(v: number | null) => v != null ? [`${v}%`, "정확도"] : ["—", "정확도"]}
              />
              <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2">평균 반응속도 (ms)</p>
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
                formatter={(v: number | null) => v != null ? [`${v}ms`, "평균"] : ["—", "평균"]}
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

  // 탭 상태 ↔ URL 쿼리 동기화 (?tab=rhythm|diagnosis|activity)
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab: HomeTab = parseTab(searchParams.get("tab"));

  const handleTabChange = (value: string) => {
    const next = parseTab(value);
    setSearchParams(
      next === "rhythm" ? {} : { tab: next },
      { replace: true }
    );
  };

  const isAdmin = profile?.role === "admin";

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
    toast.success("최신 데이터로 업데이트했어요");
  };

  const handleLibraryClick = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.info("📚 내 악보 (관리자 프리뷰)", {
      description: "공개 전 기능 확인용. 일반 사용자에게는 노출되지 않아요.",
    });
  };

  const handleReportClick = (type: "daily" | "weekly" | "monthly") => {
    const labels = {
      daily: "오늘의 AI 코멘트",
      weekly: "이번 주 리포트",
      monthly: "월간 성장 리포트",
    };
    toast.info(`🤖 ${labels[type]} 준비 중이에요`, {
      description:
        type === "daily"
          ? "AI가 오늘 연주를 보고 짧은 코멘트를 남겨줄 거야."
          : "AI가 너의 연주 패턴을 분석해줄 거야.",
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">불러오는 중…</p>
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
        <Link to="/">메인</Link>
      </Button>
      {isAdmin ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLibraryClick}
          aria-label="내 악보 (관리자 프리뷰)"
          title="내 악보 (관리자 전용 · 준비 중)"
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
          <h1 className="text-lg font-semibold tracking-tight">플레이그라운드</h1>
          <p className="text-xs text-muted-foreground">오늘의 연습과 진행 상황</p>
        </div>

        {/* 상단 요약 */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              icon="🔥"
              label="현재 스트릭"
              value={`${stats.currentStreak}일`}
              subtext={
                practicedToday
                  ? "오늘 연습 완료 ✓"
                  : stats.currentStreak > 0
                    ? "오늘 연습하면 이어져요"
                    : "오늘 첫 연습을 시작해요"
              }
              accentClass="text-orange-500"
            />
            <StatTile
              icon="⭐"
              label="오늘 XP"
              value={stats.todayXp}
              subtext={`총 ${stats.totalXp.toLocaleString()} XP`}
              accentClass="text-amber-500"
            />
            <StatTile
              icon="🏆"
              label="리그"
              value={stats.league?.name ?? stats.currentLeagueName ?? "—"}
              subtext={
                stats.standing
                  ? stats.standing.rank_in_group
                    ? `그룹 ${stats.standing.rank_in_group}위 · 주간 ${stats.standing.weekly_xp} XP`
                    : `주간 ${stats.standing.weekly_xp} XP`
                  : "첫 연습 후 배정"
              }
              accentClass=""
            />
            <StatTile
              icon="📅"
              label="최장 스트릭"
              value={`${stats.longestStreak}일`}
              subtext="내 최고 기록"
            />
          </div>

          {stats.error ? (
            <p className="text-xs text-destructive">
              대시보드 데이터 불러오기 실패: {stats.error}
            </p>
          ) : null}
        </section>

        {/* In-feed 광고 (통계 카드와 탭 사이) */}
        <AdBanner
          slot={getSlot("INFEED")}
          format="rectangle"
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
              value="rhythm"
              className="text-xs sm:text-sm py-2 data-[state=active]:font-semibold"
            >
              <span aria-hidden className="mr-1">📅</span>
              <span className="hidden xs:inline">학습 </span>리듬
            </TabsTrigger>
            <TabsTrigger
              value="diagnosis"
              className="text-xs sm:text-sm py-2 data-[state=active]:font-semibold"
            >
              <span aria-hidden className="mr-1">🎯</span>
              <span className="hidden xs:inline">실력 </span>진단
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="text-xs sm:text-sm py-2 data-[state=active]:font-semibold"
            >
              <span aria-hidden className="mr-1">🏆</span>
              <span className="hidden xs:inline">활동 </span>기록
            </TabsTrigger>
          </TabsList>

          {/* 📅 학습 리듬 — 시간축 분석 콘텐츠 */}
          <TabsContent value="rhythm" className="mt-4 space-y-8">
        {/* XP 그래프 (7일/30일 토글) */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">XP 추이</CardTitle>
              <CardDescription>
                {xpRange === "7d" ? "최근 7일" : "최근 30일"} 획득 XP
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
                7일
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
                30일
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.loading || myStats.loading ? (
              <div className="h-52 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">불러오는 중…</p>
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
            <CardTitle className="text-base">정확도 · 반응속도 추이</CardTitle>
            <CardDescription>최근 30일 일별 평균</CardDescription>
          </CardHeader>
          <CardContent>
            {myStats.loading ? (
              <div className="h-52 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">불러오는 중…</p>
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
              <span>약점 음표 Top 10</span>
              <InfoTooltip content="전체 게임 이력의 누적 정답률 기준 · 꾸준히 약했던 음표입니다" />
            </CardTitle>
            <CardDescription>
              5회 이상 시도한 음표 중 정답률이 낮은 순
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myStats.loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                불러오는 중…
              </p>
            ) : myStats.weakNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                분석할 데이터가 충분하지 않아요
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
                      {n.clef === "treble" ? "높은음자리" : "낮은음자리"}
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
                        평균 {n.avg_reaction_ms}ms
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI 피드백 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <span aria-hidden>🤖</span>
              AI 피드백
            </CardTitle>
            <CardDescription>
              AI가 너의 연주를 보고 코멘트와 다음 목표를 제안해요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ReportTile
                icon="💬"
                label="오늘의 코멘트"
                period="매일 · 짧은 AI 피드백"
                onClick={() => handleReportClick("daily")}
              />
              <ReportTile
                icon="📊"
                label="이번 주 리포트"
                period="주간 · 매주 월요일"
                onClick={() => handleReportClick("weekly")}
              />
              <ReportTile
                icon="🏆"
                label="월간 성장 리포트"
                period="월간 · 매월 1일"
                onClick={() => handleReportClick("monthly")}
              />
            </div>
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
                <CardTitle className="text-base">최근 세션</CardTitle>
                <CardDescription>최대 20개</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {myStats.loading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    불러오는 중…
                  </p>
                ) : myStats.sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    아직 세션 기록이 없어요
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30 text-xs text-muted-foreground">
                        <tr className="text-left">
                          <th className="px-4 py-2 font-medium">시각</th>
                          <th className="px-4 py-2 font-medium">레벨</th>
                          <th className="px-4 py-2 font-medium text-right">
                            정답/전체
                          </th>
                          <th className="px-4 py-2 font-medium text-right">
                            정확도
                          </th>
                          <th className="px-4 py-2 font-medium text-right">
                            평균 반응
                          </th>
                          <th className="px-4 py-2 font-medium text-right">
                            XP
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
                              {formatDateTime(s.started_at)}
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
          slot={getSlot("BANNER")}
          format="horizontal"
          className="w-full"
        />
      </main>
    </div>
  );
}