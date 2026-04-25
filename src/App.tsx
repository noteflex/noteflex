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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* /play: 레벨선택 → 게임 진입 (Index가 URL로 분기) */}
            <Route path="/play" element={<Index />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/checkout/failed" element={<CheckoutFailed />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/home" element={<Home />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* 관리자 콘솔 */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/users" replace />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:id" element={<AdminUserDetail />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="batch-runs" element={<AdminBatchRuns />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;