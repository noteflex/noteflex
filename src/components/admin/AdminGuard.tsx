import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, profile, loading, profileLoading } = useAuth();

  // 세션 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">권한 확인 중…</p>
      </div>
    );
  }

  // 로그인 안 됨
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // user는 있는데 profile 아직 안 옴 (또는 명시적 로딩 중)
  if (profileLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">프로필 확인 중…</p>
      </div>
    );
  }

  // 프로필 왔는데 admin 아님
  if (profile.role !== "admin") {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}