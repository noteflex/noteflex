// src/components/ComingSoonGate.tsx
import { Navigate } from "react-router-dom";
import { GAME_ENABLED } from "@/lib/featureFlags";

interface Props {
  children: React.ReactNode;
}

export default function ComingSoonGate({ children }: Props) {
  if (!GAME_ENABLED) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}