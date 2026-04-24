import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminUserDetail } from "@/hooks/useAdminUserDetail";
import RoleChangeDialog from "@/components/admin/RoleChangeDialog";
import PremiumDialog from "@/components/admin/PremiumDialog";
import XpAdjustDialog from "@/components/admin/XpAdjustDialog";
import StreakAdjustDialog from "@/components/admin/StreakAdjustDialog";
import { Button } from "@/components/ui/button";
import InfoTooltip from "@/components/ui/info-tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/* ---------- 공용 ---------- */

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "admin" | "premium" | "minor" | "muted";
}) {
  const variants: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    admin: "bg-red-500/10 text-red-600 border border-red-500/20",
    premium: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
    minor: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function trendIcon(trend: string | null): string {
  if (trend === "improving" || trend === "up") return "📈";
  if (trend === "declining" || trend === "down") return "📉";
  if (trend === "stable" || trend === "flat") return "➡️";
  return "";
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">
        {value ?? <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}

/* ---------- 그래프 ---------- */

function DailyStatsChart({
  data,
}: {
  data: { stat_date: string; xp_earned: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          최근 30일 기록이 없어요
        </p>
      </div>
    );
  }
  const chartData = data.map((d) => ({
    date: d.stat_date.slice(5),
    xp: d.xp_earned,
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
            formatter={(value: number) => [`${value} XP`, "획득"]}
          />
          <Bar dataKey="xp" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- 페이지 ---------- */

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const { profile, sessions, dailyStats, weakNotes, loading, error, refresh } =
    useAdminUserDetail(id);

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [xpDialogOpen, setXpDialogOpen] = useState(false);
  const [streakDialogOpen, setStreakDialogOpen] = useState(false);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        사용자 정보 불러오는 중…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin">
            <ArrowLeft className="h-4 w-4 mr-1" />
            목록으로
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-destructive">
              {error ?? "사용자를 찾을 수 없어요"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSelf = me?.id === profile.id;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link to="/admin">
          <ArrowLeft className="h-4 w-4 mr-1" />
          목록으로
        </Link>
      </Button>

      {/* 프로필 요약 */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="h-16 w-16 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl shrink-0">
                👤
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg">
                  {profile.nickname ?? profile.display_name ?? "(이름없음)"}
                </CardTitle>
                {profile.role === "admin" ? (
                  <Badge variant="admin">ADMIN</Badge>
                ) : null}
                {profile.is_premium ? (
                  <Badge variant="premium">PREMIUM</Badge>
                ) : null}
                {profile.is_minor ? <Badge variant="minor">아동</Badge> : null}
                {isSelf ? (
                  <Badge variant="muted">본인</Badge>
                ) : null}
              </div>
              <CardDescription className="mt-1">
                {profile.email ?? "이메일 없음"}
              </CardDescription>
              <p className="text-xs text-muted-foreground mt-1">
                가입 {formatDate(profile.created_at)} · 최근 연습{" "}
                {formatDate(profile.last_practice_date)}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 기본 + 게임 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            <Field label="이메일" value={profile.email} />
            <Field label="표시 이름" value={profile.display_name} />
            <Field label="닉네임" value={profile.nickname} />
            <Field
              label="생년월일"
              value={
                profile.birth_year
                  ? `${profile.birth_year}-${String(profile.birth_month ?? "?").padStart(2, "0")}-${String(profile.birth_day ?? "?").padStart(2, "0")}`
                  : null
              }
            />
            <Field label="국가" value={profile.country_code} />
            <Field label="언어" value={profile.locale} />
            <Field label="Stripe 고객 ID" value={profile.stripe_customer_id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">게임 데이터</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            <Field
              label="현재 스트릭"
              value={<span>🔥 {profile.current_streak}일</span>}
            />
            <Field label="최장 스트릭" value={`${profile.longest_streak}일`} />
            <Field
              label="총 XP"
              value={profile.total_xp.toLocaleString()}
            />
            <Field label="현재 리그" value={profile.current_league} />
            <Field
              label="프리미엄 만료"
              value={
                profile.premium_until
                  ? formatDateTime(profile.premium_until)
                  : null
              }
            />
            <Field
              label="온보딩 완료"
              value={profile.onboarding_completed ? "예" : "아니오"}
            />
            <Field
              label="프로필 완성"
              value={profile.profile_completed ? "예" : "아니오"}
            />
          </CardContent>
        </Card>
      </div>

      {/* 약관 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">약관 동의</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="이용약관" value={formatDateTime(profile.tos_agreed_at)} />
          <Field
            label="개인정보"
            value={formatDateTime(profile.privacy_agreed_at)}
          />
          <Field
            label="마케팅"
            value={formatDateTime(profile.marketing_agreed_at)}
          />
        </CardContent>
      </Card>

      {/* 30일 XP 그래프 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 30일 XP</CardTitle>
          <CardDescription>일일 획득 XP 추이</CardDescription>
        </CardHeader>
        <CardContent>
          <DailyStatsChart data={dailyStats} />
        </CardContent>
      </Card>

      {/* 세션 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 세션</CardTitle>
          <CardDescription>최대 20개</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              세션 기록이 없어요
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-4 py-2 font-medium">시작 시각</th>
                    <th className="px-4 py-2 font-medium">레벨</th>
                    <th className="px-4 py-2 font-medium text-right">
                      정답/전체
                    </th>
                    <th className="px-4 py-2 font-medium text-right">정확도</th>
                    <th className="px-4 py-2 font-medium text-right">
                      평균 반응
                    </th>
                    <th className="px-4 py-2 font-medium text-right">XP</th>
                    <th className="px-4 py-2 font-medium text-right">시간</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
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
                      <td className="px-4 py-2 text-right font-medium">
                        {s.xp_earned}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                        {s.duration_seconds != null
                          ? `${s.duration_seconds}s`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          {weakNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              분석할 데이터가 충분하지 않아요
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {weakNotes.map((n, idx) => (
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

      {/* 수정 액션 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span aria-hidden>⚙️</span>
            수정 액션
          </CardTitle>
          <CardDescription>
            모든 변경은 admin_actions 테이블에 자동 기록됩니다
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border/50">
          {/* 1. 권한 변경 - 활성 */}
          <div className="py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">권한 변경</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                일반 ↔ 관리자 {isSelf ? "(본인은 변경 불가)" : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoleDialogOpen(true)}
              disabled={isSelf}
            >
              변경
            </Button>
          </div>

          {/* 2. 프리미엄 관리 - 활성 */}
          <div className="py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">프리미엄 관리</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile.is_premium
                  ? `✨ 활성 · ${
                      profile.premium_until
                        ? formatDate(profile.premium_until) + " 까지"
                        : "기한 없음"
                    }`
                  : "무료 · 수동 부여 가능"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPremiumDialogOpen(true)}
            >
              {profile.is_premium ? "연장/해제" : "부여"}
            </Button>
          </div>

          {/* 3. XP 조정 - 활성 */}
          <div className="py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">XP 조정</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                현재 ⭐ {profile.total_xp.toLocaleString()} · 증감 (사유 필수)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setXpDialogOpen(true)}
            >
              조정
            </Button>
          </div>

          {/* 4. 스트릭 조정 - 활성 */}
          <div className="py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">스트릭 조정</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                현재 🔥 {profile.current_streak}일 · 최장 {profile.longest_streak}일
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStreakDialogOpen(true)}
            >
              조정
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <RoleChangeDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        targetUserId={profile.id}
        targetEmail={profile.email}
        currentRole={profile.role}
        onSuccess={refresh}
      />
      <PremiumDialog
        open={premiumDialogOpen}
        onOpenChange={setPremiumDialogOpen}
        targetUserId={profile.id}
        targetEmail={profile.email}
        currentIsPremium={profile.is_premium}
        currentPremiumUntil={profile.premium_until}
        onSuccess={refresh}
      />
      <XpAdjustDialog
        open={xpDialogOpen}
        onOpenChange={setXpDialogOpen}
        targetUserId={profile.id}
        targetEmail={profile.email}
        currentXp={profile.total_xp}
        onSuccess={refresh}
      />
      <StreakAdjustDialog
        open={streakDialogOpen}
        onOpenChange={setStreakDialogOpen}
        targetUserId={profile.id}
        targetEmail={profile.email}
        currentStreak={profile.current_streak}
        longestStreak={profile.longest_streak}
        onSuccess={refresh}
      />
    </div>
  );
}