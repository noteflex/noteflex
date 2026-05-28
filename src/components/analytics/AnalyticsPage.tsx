import { Navigate } from "react-router-dom";

// 탭 컨테이너 폐기 — 독립 3페이지(DailyAnalyticsPage, WeeklyAnalyticsPage, MonthlyAnalyticsPage)로 분리됨
export default function AnalyticsPage() {
  return <Navigate to="/analytics/daily" replace />;
}
