import { Navigate, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Lock } from "lucide-react";
import Header from "@/components/Header";
import UserMenu from "@/components/UserMenu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/LanguageContext";
import { getUserTier } from "@/lib/subscriptionTier";
import PeriodReport from "./PeriodReport";

/* ── 뒤로 가는 카드 (보조, 연함) ── */
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

/* ── Free/Guest 잠금 화면 ── */
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

export default function MonthlyAnalyticsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const t = useT();

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
          <h1 className="text-lg font-semibold tracking-tight">{t.analytics.monthlyTitle}</h1>
          <p className="text-xs text-muted-foreground">{t.analytics.monthlySubtitle}</p>
        </div>

        {/* 뒤로 — 항상 노출 */}
        <BackReportCard to="/analytics/weekly" label={t.analytics.backToWeekly} />

        {isPro ? (
          <PeriodReport periodType="month" />
        ) : (
          <ProLockScreen reportLabel={t.analytics.monthlyTitle} />
        )}
      </main>
    </div>
  );
}
