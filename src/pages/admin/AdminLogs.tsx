import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import {
  useAdminLogs,
  ACTION_TYPE_LABELS,
  type AdminActionLog,
} from "@/hooks/useAdminLogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatAbs(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ActionBadge({ type }: { type: string }) {
  const label = ACTION_TYPE_LABELS[type] ?? type;
  const color =
    type.includes("premium")
      ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
      : type === "update_profile"
        ? "bg-red-500/10 text-red-700 border-red-500/20"
        : type === "grant_xp"
          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
          : type === "reset_streak"
            ? "bg-orange-500/10 text-orange-700 border-orange-500/20"
            : type === "ban_user" || type === "delete_data"
              ? "bg-red-500/10 text-red-700 border-red-500/20"
              : "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${color}`}
    >
      {label}
    </span>
  );
}

function LogRow({ log }: { log: AdminActionLog }) {
  const [expanded, setExpanded] = useState(false);
  const reason = (log.details as any)?.reason ?? null;

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-accent/20 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-3 py-2 text-xs whitespace-nowrap">
          <div>{formatAbs(log.created_at)}</div>
          <div className="text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(log.created_at), {
              addSuffix: true,
              locale: ko,
            })}
          </div>
        </td>
        <td className="px-3 py-2">
          <ActionBadge type={log.action_type} />
        </td>
        <td className="px-3 py-2 text-xs">
          <div className="font-medium truncate max-w-[160px]">
            {log.admin_name ?? log.admin_email ?? log.admin_id.slice(0, 8)}
          </div>
          {log.admin_email && log.admin_name ? (
            <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
              {log.admin_email}
            </div>
          ) : null}
        </td>
        <td className="px-3 py-2 text-xs">
          {log.target_user_id ? (
            <>
              <div className="font-medium truncate max-w-[160px]">
                {log.target_name ??
                  log.target_email ??
                  log.target_user_id.slice(0, 8)}
              </div>
              {log.target_email && log.target_name ? (
                <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                  {log.target_email}
                </div>
              ) : null}
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs max-w-[280px]">
          <div className="truncate text-muted-foreground">
            {reason ?? <span className="text-muted-foreground/60">—</span>}
          </div>
        </td>
        <td className="px-3 py-2 text-right">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground inline" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground inline" />
          )}
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-muted/30 border-b border-border/50">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {log.details ? (
                <div>
                  <p className="font-semibold mb-1">변경 내역</p>
                  <pre className="bg-background rounded border border-border p-2 overflow-x-auto text-[11px]">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              ) : null}
              <div className="space-y-1 text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Action ID:</span>{" "}
                  <code className="text-[11px]">{log.id}</code>
                </p>
                {log.target_user_id ? (
                  <p>
                    <span className="font-semibold text-foreground">
                      Target ID:
                    </span>{" "}
                    <Link
                      to={`/admin/users/${log.target_user_id}`}
                      className="text-primary underline text-[11px]"
                    >
                      {log.target_user_id}
                    </Link>
                  </p>
                ) : null}
                {log.ip_address ? (
                  <p>
                    <span className="font-semibold text-foreground">IP:</span>{" "}
                    <code className="text-[11px]">{log.ip_address}</code>
                  </p>
                ) : null}
                {log.user_agent ? (
                  <p className="truncate">
                    <span className="font-semibold text-foreground">UA:</span>{" "}
                    <span className="text-[11px]">{log.user_agent}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function AdminLogs() {
  const {
    logs,
    total,
    page,
    setPage,
    pageSize,
    loading,
    error,
    filters,
    updateFilter,
    admins,
    distinctActionTypes,
    refresh,
  } = useAdminLogs();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select
              value={filters.action_type}
              onValueChange={(v) => updateFilter("action_type", v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="액션 유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 액션</SelectItem>
                {distinctActionTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACTION_TYPE_LABELS[t] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.admin_id}
              onValueChange={(v) => updateFilter("admin_id", v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="관리자" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">관리자 전체</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.display_name ?? a.email ?? a.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(filters.days)}
              onValueChange={(v) => updateFilter("days", Number(v) as any)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="기간" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">최근 7일</SelectItem>
                <SelectItem value="30">최근 30일</SelectItem>
                <SelectItem value="90">최근 90일</SelectItem>
                <SelectItem value="0">전체 기간</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                총 <span className="font-semibold text-foreground">{total}</span>건
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
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
                  <th className="px-3 py-3 font-medium">시각</th>
                  <th className="px-3 py-3 font-medium">액션</th>
                  <th className="px-3 py-3 font-medium">관리자</th>
                  <th className="px-3 py-3 font-medium">대상</th>
                  <th className="px-3 py-3 font-medium">사유</th>
                  <th className="px-3 py-3 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      불러오는 중…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-destructive"
                    >
                      {error}
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      조건에 맞는 액션 로그가 없어요
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => <LogRow key={log.id} log={log} />)
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