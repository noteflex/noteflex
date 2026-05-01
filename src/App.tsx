import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Home from "./pages/Home.tsx";
import NotFound from "./pages/NotFound.tsx";
import CheckoutSuccess from "./pages/CheckoutSuccess.tsx";
import CheckoutFailed from "./pages/CheckoutFailed.tsx";
import Pricing from "./pages/Pricing.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminUserDetail from "./pages/admin/AdminUserDetail.tsx";
import AdminLogs from "./pages/admin/AdminLogs.tsx";
import AdminBatchRuns from "./pages/admin/AdminBatchRuns.tsx";
import ProfilePage from "./pages/ProfilePage.tsx";
import LegalPage from "./pages/legal/LegalPage.tsx";
import Blog from "./pages/Blog.tsx";
import BlogPost from "./pages/BlogPost.tsx";
import CookieBanner from "./components/CookieBanner.tsx";
import ComingSoonGate from "./components/ComingSoonGate.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* 항상 노출되는 정적 페이지 */}
            <Route path="/" element={<Index />} />

            {/* 법적 페이지 (항상 노출) */}
            <Route path="/terms" element={<LegalPage slug="terms" title="이용약관" />} />
            <Route path="/privacy" element={<LegalPage slug="privacy" title="개인정보처리방침" />} />
            <Route path="/refund" element={<LegalPage slug="refund" title="환불 정책" />} />
            <Route path="/cookies" element={<LegalPage slug="cookies" title="쿠키 정책" />} />

            {/* 블로그 (항상 노출) */}
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:lang/:slug" element={<BlogPost />} />
            <Route path="/blog/:slug" element={<Navigate to="/blog" replace />} />

            {/* 게임·인증·결제 라우트 — Coming Soon 모드에서 차단 */}
            <Route
              path="/play"
              element={
                <ComingSoonGate>
                  <Index />
                </ComingSoonGate>
              }
            />
            <Route
              path="/pricing"
              element={
                <ComingSoonGate>
                  <Pricing />
                </ComingSoonGate>
              }
            />
            <Route
              path="/checkout/failed"
              element={
                <ComingSoonGate>
                  <CheckoutFailed />
                </ComingSoonGate>
              }
            />
            <Route
              path="/checkout/success"
              element={
                <ComingSoonGate>
                  <CheckoutSuccess />
                </ComingSoonGate>
              }
            />
            <Route
              path="/home"
              element={
                <ComingSoonGate>
                  <Home />
                </ComingSoonGate>
              }
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
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieBanner />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;