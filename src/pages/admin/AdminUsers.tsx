import { Link } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "admin" | "premium" | "minor" | "muted";
}) {
  const variants: Record<string, string> = {
    default: "bg-muted text-muted-foreground",
    admin: "bg-red-500/10 text-red-600 border border-red-500/20",
    premium: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
    minor: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function AdminUsers() {
  const {
    users,
    total,
    page,
    setPage,
    pageSize,
    loading,
    error,
    filters,
    updateFilter,
  } = useAdminUsers();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder="이메일 / 닉네임 검색"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={filters.role}
              onValueChange={(v) => updateFilter("role", v as any)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="권한" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">권한 전체</SelectItem>
                <SelectItem value="user">일반</SelectItem>
                <SelectItem value="admin">관리자</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.premium}
              onValueChange={(v) => updateFilter("premium", v as any)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="플랜" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">플랜 전체</SelectItem>
                <SelectItem value="premium">프리미엄</SelectItem>
                <SelectItem value="free">무료</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.minor}
              onValueChange={(v) => updateFilter("minor", v as any)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="연령" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">연령 전체</SelectItem>
                <SelectItem value="adult">성인</SelectItem>
                <SelectItem value="minor">아동</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-muted-foreground self-center">
              총 <span className="font-semibold text-foreground">{total}</span>명
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">사용자</th>
                  <th className="px-4 py-3 font-medium">권한/플랜</th>
                  <th className="px-4 py-3 font-medium text-right">스트릭</th>
                  <th className="px-4 py-3 font-medium text-right">총 XP</th>
                  <th className="px-4 py-3 font-medium">리그</th>
                  <th className="px-4 py-3 font-medium">가입일</th>
                  <th className="px-4 py-3 font-medium">최근 연습</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      불러오는 중…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-destructive"
                    >
                      {error}
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      조건에 맞는 사용자가 없어요
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium truncate max-w-[220px]">
                          {u.nickname ??
                            u.display_name ??
                            u.email ??
                            "(이름없음)"}
                        </div>
                        {u.email ? (
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {u.email}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.role === "admin" ? (
                            <Badge variant="admin">ADMIN</Badge>
                          ) : null}
                          {u.is_premium ? (
                            <Badge variant="premium">PREMIUM</Badge>
                          ) : null}
                          {u.is_minor ? (
                            <Badge variant="minor">아동</Badge>
                          ) : null}
                          {!u.role ||
                          (u.role === "user" &&
                            !u.is_premium &&
                            !u.is_minor) ? (
                            <Badge variant="muted">일반</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        🔥 {u.current_streak}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {u.total_xp.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {u.current_league ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(u.last_practice_date)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8"
                        >
                          <Link to={`/admin/users/${u.id}`}>상세</Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 페이지네이션 */}
      {total > 0 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {page + 1} / {totalPages} 페이지
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              다음
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}