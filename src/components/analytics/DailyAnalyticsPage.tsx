import { Navigate, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { format as formatI18n } from "@/i18n/strings";
import { useDailyReport } from "@/hooks/useAnalytics";
import { isNoData, normalizeWeakNotes } from "@/types/analytics";
import DailyReport from "./DailyReport";

function ForwardReportCard({
  to,
  eyebrow,
  label,
  description,
}: {
  to: string;
  eyebrow: string;
  label: string;
  description: string;
}) {
  return (
    <Link to={to} className="block group">
      <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center justify-between gap-4 hover:border-primary/50 hover:bg-primary/5 transition-colors">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

export default function DailyAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const t = useT();
  // 캐시 재사용 — DailyReport 내부와 동일 키, 네트워크 중복 요청 없음
  const { data } = useDailyReport();
  const weakNotes = data && !isNoData(data) ? normalizeWeakNotes(data, 1) : [];
  const topWeak = weakNotes[0];

  const weeklyDescription = topWeak
    ? formatI18n(t.analytics.toWeeklyHook, {
        clef: topWeak.clef === "bass" ? t.analytics.clefBass : t.analytics.clefTreble,
        note: `${topWeak.note_key}${topWeak.octave}`,
      })
    : t.analytics.toWeeklyDesc;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">{t.dashboard.loading}</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Header right={<UserMenu />} headerClassName="bg-card/50" />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t.analytics.dailyTitle}</h1>
          <p className="text-xs text-muted-foreground">{t.analytics.dailySubtitle}</p>
        </div>

        <DailyReport />

        {/* Free 포함 전체에게 노출 — 눌러서 주간 잠금 화면이 업셀 동선 */}
        <ForwardReportCard
          to="/analytics/weekly"
          eyebrow={t.analytics.nextReport}
          label={t.analytics.toWeeklyLabel}
          description={weeklyDescription}
        />
      </main>
    </div>
  );
}
