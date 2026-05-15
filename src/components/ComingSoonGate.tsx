// src/components/ComingSoonGate.tsx
import { Navigate } from "react-router-dom";
import { GAME_ENABLED } from "@/lib/featureFlags";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  children: React.ReactNode;
}

/**
 * 게임 영역 GAME_ENABLED 게이트.
 *
 * 우회 허용:
 *   - admin (role='admin') — 내부 테스트
 *   - reviewer (role='reviewer') — Paddle 심사관 게임 영역 확인
 */
export default function ComingSoonGate({ children }: Props) {
  const { profile, profileLoading } = useAuth();

  // 프로필 로딩 중에는 일단 통과 (깜빡임 방지). 로드 후 재평가.
  if (profileLoading) return <>{children}</>;

  const isPrivilegedRole =
    profile?.role === "admin" || profile?.role === "reviewer";

  if (!GAME_ENABLED && !isPrivilegedRole) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
