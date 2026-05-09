import { Navigate, useLocation } from "react-router-dom";

interface Props { children: React.ReactNode; }

export default function NavOnlyRoute({ children }: Props) {
  const { state } = useLocation();
  if (!(state as { fromNav?: boolean } | null)?.fromNav) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
