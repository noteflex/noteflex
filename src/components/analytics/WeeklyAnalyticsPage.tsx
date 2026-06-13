import { useMemo, useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import Header from "@/components/Header";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { getUserTier } from "@/lib/subscriptionTier";
import WeeklyReport from "./WeeklyReport";
import PeriodSelector from "./PeriodSelector";

function kstTodayIso(): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function latestCompletedWeekStart(): string {
  const today = kstTodayIso();
  const d = parseIso(today);
  const isoDow = d.getDay() === 0 ? 7 : d.getDay();
  const mondayThis = addDays(today, -(isoDow - 1));
  return addDays(mondayThis, -7);
}

function BackReportCard({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors group"
    >
      <ChevronLeft className="h-3.5 w-3.5 shrink-0 group-hover:-translate-x-0.5 transition-transform" />
      {label}
    </Link>
  );
}

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

function ProLockScreen({ reportLabel }: { reportLabel: string }) {
  const navigate = useNavigate();
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
        <Lock className="h-7 w-7 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-base font-semibold text-foreground">
        {reportLabel} {t.analytics.proLockSuffix}
      </p>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs">{t.analytics.proLockBody}</p>
      <Button className="mt-6" onClick={() => navigate("/dashboard?upgrade=1")}>
        {t.analytics.proLockCta}
      </Button>
    </div>
  );
}

export default function WeeklyAnalyticsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const t = useT();
  const navigate = useNavigate();

  const initialWeekStart = useMemo(() => latestCompletedWeekStart(), []);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(initialWeekStart);

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

  return (
    <div className="min-h-screen bg-background">
      <Header right={<UserMenu />} headerClassName="bg-card/50" />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t.analytics.weeklyTitle}</h1>
          <p className="text-xs text-muted-foreground">{t.analytics.weeklySubtitle}</p>
        </div>

        <BackReportCard to="/analytics/daily" label={t.analytics.backToDaily} />

        {isPro ? (
          <>
            <PeriodSelector
              periodType="week"
              value={selectedWeekStart}
              onChange={setSelectedWeekStart}
              isPro={isPro}
              onProLockHit={() => navigate("/dashboard?upgrade=1")}
            />
            <WeeklyReport weekStart={selectedWeekStart} />
            <ForwardReportCard
              to="/analytics/monthly"
              eyebrow={t.analytics.nextReport}
              label={t.analytics.toMonthlyLabel}
              description={t.analytics.toMonthlyDesc}
            />
          </>
        ) : (
          <ProLockScreen reportLabel={t.analytics.weeklyTitle} />
        )}
      </main>
    </div>
  );
}
