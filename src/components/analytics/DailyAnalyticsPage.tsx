import { useMemo, useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { ChevronRight, Lock } from "lucide-react";
import Header from "@/components/Header";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { getUserTier } from "@/lib/subscriptionTier";
import DailyReport from "./DailyReport";
import PeriodSelector from "./PeriodSelector";

function kstTodayIso(): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function PastReportLockHint({ body, ctaLabel }: { body: string; ctaLabel: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
        <Lock className="h-4 w-4 text-primary" aria-hidden />
      </div>
      <p className="flex-1 text-xs text-foreground leading-snug">{body}</p>
      <button
        type="button"
        onClick={() => navigate("/dashboard?upgrade=1")}
        className="shrink-0 inline-flex items-center h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

function NavPillForward({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
    >
      {label}
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

export default function DailyAnalyticsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const t = useT();

  const today = useMemo(() => kstTodayIso(), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">{t.dashboard.loading}</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  const isAdmin = profile?.role === "admin";
  const tier = getUserTier(user ?? null, profile ?? null);
  const isPro = isAdmin || tier === "pro";

  const dateProp = selectedDate === today ? undefined : isoToDate(selectedDate);

  return (
    <div className="min-h-screen bg-background">
      <Header right={<UserMenu />} headerClassName="bg-card/50" />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t.analytics.dailyTitle}</h1>
          <p className="text-xs text-muted-foreground">{t.analytics.dailySubtitle}</p>
        </div>

        <PeriodSelector
          periodType="day"
          value={selectedDate}
          onChange={setSelectedDate}
          isPro={isPro}
        />

        {!isPro && (
          <PastReportLockHint
            body={t.analytics.pastReportProLockBody}
            ctaLabel={t.analytics.proLockCta}
          />
        )}

        <DailyReport date={dateProp} />

        <div className="flex items-center justify-end pt-1">
          <NavPillForward to="/analytics/weekly" label={t.analytics.toWeeklyLabel} />
        </div>
      </main>
    </div>
  );
}
