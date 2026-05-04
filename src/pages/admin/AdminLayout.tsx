import { NavLink, Outlet } from "react-router-dom";
import { Users, ScrollText, BarChart3 } from "lucide-react";
import Header from "@/components/Header";
import AdminGuard from "@/components/admin/AdminGuard";

const navTabs = [
  { to: "/admin/users", label: "사용자", icon: Users, end: false },
  { to: "/admin/logs", label: "액션 로그", icon: ScrollText, end: false },
  { to: "/admin/batch-runs", label: "배치 이력", icon: BarChart3, end: false },
];

export default function AdminLayout() {
  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        <Header
          containerClassName="max-w-6xl"
          headerClassName="bg-card/50"
          right={
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">관리자 콘솔</span>
              <span className="text-[10px] font-semibold bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded">
                ADMIN
              </span>
            </div>
          }
          below={
            <nav className="flex gap-1 border-t border-border/50">
              {navTabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          }
        />

        <main className="max-w-6xl mx-auto px-4 py-8">
          <Outlet />
        </main>
      </div>
    </AdminGuard>
  );
}