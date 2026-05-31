import { useEffect, useState } from "react";
import { Download, Inbox, RefreshCw } from "lucide-react";
import AdminGuard from "@/components/admin/AdminGuard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * 가오픈(5/31) Premium 대기 명단 조회·CSV export.
 * RLS: admin role만 SELECT 가능 — 비-admin은 빈 결과만 받음.
 * 다른 admin 페이지 convention 따라 ko 하드코딩 (admin i18n은 별도 sprint).
 */

interface WaitlistRow {
  id: string;
  email: string;
  locale: string;
  source: string;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvEscape(value: string): string {
  if (/[,"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCSV(rows: WaitlistRow[]): void {
  const headers = ["email", "locale", "source", "created_at"];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [r.email, r.locale, r.source, r.created_at].map(csvEscape).join(","),
    ),
  ];
  // Excel UTF-8 호환 BOM
  const blob = new Blob(["﻿" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  a.download = `noteflex-waitlist-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function WaitlistPage() {
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("premium_waitlist")
      .select("id, email, locale, source, created_at")
      .order("created_at", { ascending: false });
    if (queryError) {
      setError(queryError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as WaitlistRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleExport = () => {
    if (rows.length === 0) {
      toast.warning("내려받을 데이터가 없습니다.");
      return;
    }
    downloadCSV(rows);
    toast.success(`${rows.length}건 CSV 내려받기 완료`);
  };

  return (
    <AdminGuard>
      <div className="p-6 space-y-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Premium 대기 명단
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading
                ? "불러오는 중…"
                : error
                  ? "조회 실패"
                  : `${rows.length.toLocaleString("ko-KR")}명 대기 중`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              새로고침
            </Button>
            <Button
              onClick={handleExport}
              disabled={loading || rows.length === 0}
              size="sm"
            >
              <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
              CSV 내려받기
            </Button>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-300">
            조회 실패: {error}
          </div>
        )}

        {/* 본문 */}
        {!loading && !error && rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
            <Inbox
              className="h-10 w-10 text-muted-foreground mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">아직 신청자 없음</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Email
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Locale
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Source
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground break-all">
                        {row.email}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground uppercase">
                        {row.locale}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {row.source}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
