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

function NavPillBack({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-muted text-foreground text-sm font-medium hover:bg-muted/70 transition-colors"
    >
      <ChevronLeft className="h-4 w-4" />
      {label}
    </Link>
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

        {isPro ? (
          <>
            <PeriodSelector
              periodType="week"
              value={selectedWeekStart}
              onChange={setSelectedWeekStart}
              isPro={isPro}
            />
            <WeeklyReport weekStart={selectedWeekStart} />
            <div className="flex items-center justify-between pt-1">
              <NavPillBack to="/analytics/daily" label={t.analytics.backToDaily} />
              <NavPillForward to="/analytics/monthly" label={t.analytics.toMonthlyLabel} />
            </div>
          </>
        ) : (
          <>
            <ProLockScreen reportLabel={t.analytics.weeklyTitle} />
            <div className="flex items-center justify-start pt-1">
              <NavPillBack to="/analytics/daily" label={t.analytics.backToDaily} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
