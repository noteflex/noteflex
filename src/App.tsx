import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index.tsx";
import PlayPage from "./pages/PlayPage.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import DailyAnalyticsPage from "./components/analytics/DailyAnalyticsPage.tsx";
import WeeklyAnalyticsPage from "./components/analytics/WeeklyAnalyticsPage.tsx";
import MonthlyAnalyticsPage from "./components/analytics/MonthlyAnalyticsPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import CheckoutSuccess from "./pages/CheckoutSuccess.tsx";
import CheckoutFailed from "./pages/CheckoutFailed.tsx";
import Pricing from "./pages/Pricing.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminUserDetail from "./pages/admin/AdminUserDetail.tsx";
import AdminLogs from "./pages/admin/AdminLogs.tsx";
import AdminBatchRuns from "./pages/admin/AdminBatchRuns.tsx";
import WaitlistPage from "./pages/admin/WaitlistPage.tsx";
import FeedbackPage from "./pages/admin/FeedbackPage.tsx";
import StaffPreview from "./pages/admin/StaffPreview.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import LegalPage from "./pages/legal/LegalPage.tsx";
import Blog from "./pages/Blog.tsx";
import BlogPost from "./pages/BlogPost.tsx";
import FAQ from "./pages/FAQ.tsx";
import About from "./pages/About.tsx";
import Contact from "./pages/Contact.tsx";
import CookieBanner from "./components/CookieBanner.tsx";
import AnalyticsTracker from "./components/AnalyticsTracker.tsx";
import FeedbackFab from "./components/feedback/FeedbackFab.tsx";
import ComingSoonGate from "./components/ComingSoonGate.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import ReviewerLogin from "./pages/ReviewerLogin.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { UpdateBanner } from "./components/UpdateBanner.tsx";
import { HelmetProvider } from "react-helmet-async";

const queryClient = new QueryClient();

// Magic Link 콜백 탭이 전송한 AUTH_COMPLETE 신호를 원본 탭에서 수신
// 이중 채널: BroadcastChannel(Primary) + localStorage storage event(Fallback)
function AuthBroadcastListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthComplete = async () => {
      await supabase.auth.refreshSession();
      navigate("/", { replace: true });
    };

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel("noteflex_auth");
      channel.onmessage = async (e: MessageEvent) => {
        if (e.data.type === "AUTH_COMPLETE") await handleAuthComplete();
      };
    }

    const onStorage = async (e: StorageEvent) => {
      if (e.key === "noteflex_auth_complete") await handleAuthComplete();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      channel?.close();
      window.removeEventListener("storage", onStorage);
    };
  }, [navigate]);

  return null;
}

const App = () => (
  <HelmetProvider>
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
              {/* 항상 노출되는 정적 페이지 */}
              <Route path="/" element={<Index />} />

              {/* 법적 페이지 (항상 노출) */}
              <Route path="/terms" element={<LegalPage slug="terms" />} />
              <Route path="/privacy" element={<LegalPage slug="privacy" />} />
              <Route path="/refund" element={<LegalPage slug="refund" />} />
              <Route path="/cookies" element={<LegalPage slug="cookies" />} />
              <Route path="/business-info" element={<LegalPage slug="business-info" />} />

              {/* 블로그 (항상 노출) */}
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:lang/:slug" element={<BlogPost />} />
              <Route path="/blog/:slug" element={<Navigate to="/blog" replace />} />

              {/* 정적 정보 페이지 (항상 노출) */}
              <Route path="/faq" element={<FAQ />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />

              {/* 비밀번호 재설정 / 인증 콜백 — Coming Soon 차단 없음 */}
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Paddle 심사관 전용 진입 URL — ComingSoonGate 외부 (가드 X) */}
              <Route path="/reviewer-login" element={<ReviewerLogin />} />

              {/* 게임·인증·결제 라우트 — Coming Soon 모드에서 차단 */}
              <Route
                path="/play"
                element={
                  <ComingSoonGate>
                    <PlayPage />
                  </ComingSoonGate>
                }
              />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/checkout/failed" element={<CheckoutFailed />} />
              <Route path="/checkout/success" element={<CheckoutSuccess />} />
              <Route
                path="/dashboard"
                element={
                  <ComingSoonGate>
                    <Dashboard />
                  </ComingSoonGate>
                }
              />
              <Route
                path="/analytics"
                element={<Navigate to="/analytics/daily" replace />}
              />
              <Route
                path="/analytics/daily"
                element={
                  <ComingSoonGate>
                    <DailyAnalyticsPage />
                  </ComingSoonGate>
                }
              />
              <Route
                path="/analytics/weekly"
                element={<WeeklyAnalyticsPage />}
              />
              <Route
                path="/analytics/monthly"
                element={<MonthlyAnalyticsPage />}
              />
              <Route
                path="/profile"
                element={
                  <ComingSoonGate>
                    <ProfilePage />
                  </ComingSoonGate>
                }
              />

              {/* 관리자 콘솔 — feature flag 무시, 항상 접근 가능 */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/users" replace />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:id" element={<AdminUserDetail />} />
                <Route path="logs" element={<AdminLogs />} />
                <Route path="batch-runs" element={<AdminBatchRuns />} />
                <Route path="waitlist" element={<WaitlistPage />} />
                <Route path="feedback" element={<FeedbackPage />} />
                <Route path="staff-preview" element={<StaffPreview />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            <CookieBanner />
            <FeedbackFab />
            <UpdateBanner />
            <AuthBroadcastListener />
            <AnalyticsTracker />
            <Analytics />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  </HelmetProvider>
);

export default App;
