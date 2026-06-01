import { useEffect, useMemo, useState } from "react";
import { Download, Inbox, RefreshCw, Search } from "lucide-react";
import AdminGuard from "@/components/admin/AdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * 사용자 피드백 조회 + 검색 + CSV export.
 * RLS off라 anon 클라이언트로 SELECT 가능. AdminGuard로 UI 차단.
 * 다른 admin 페이지 convention 따라 ko 하드코딩.
 */

interface FeedbackRow {
  id: string;
  message: string;
  email: string | null;
  user_id: string | null;
  ip_address: string | null;
  country: string | null;
  user_agent: string | null;
  page_url: string | null;
  locale: string | null;
  created_at: string;
}

const PREVIEW_CHARS = 80;
const PAGE_SIZE = 100;

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

function downloadCSV(rows: FeedbackRow[]): void {
  const headers = [
    "created_at",
    "message",
    "email",
    "country",
    "user_id",
    "page_url",
    "locale",
    "ip_address",
    "user_agent",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.created_at,
        r.message,
        r.email ?? "",
        r.country ?? "",
        r.user_id ?? "",
        r.page_url ?? "",
        r.locale ?? "",
        r.ip_address ?? "",
        r.user_agent ?? "",
      ]
        .map(csvEscape)
        .join(","),
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
  a.download = `noteflex-feedback-${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function FeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [detailRow, setDetailRow] = useState<FeedbackRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    console.info("[FeedbackPage] load() start");
    try {
      const { data, error: queryError, status } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      console.info("[FeedbackPage] supabase response", {
        status,
        rowCount: data?.length ?? null,
        error: queryError ?? null,
      });
      if (queryError) {
        setError(`${queryError.code ?? ""} ${queryError.message}`.trim());
        setRows([]);
      } else {
        setRows((data ?? []) as FeedbackRow[]);
      }
    } catch (e) {
      console.error("[FeedbackPage] load() threw", e);
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.info("[FeedbackPage] mount — calling load()");
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.message.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.warning("내려받을 데이터가 없습니다.");
      return;
    }
    downloadCSV(filtered);
    toast.success(`${filtered.length}건 CSV 내려받기 완료`);
  };

  return (
    <AdminGuard>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">피드백</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading
                ? "불러오는 중…"
                : error
                  ? "조회 실패"
                  : `${filtered.length.toLocaleString("ko-KR")}건${
                      filtered.length !== rows.length
                        ? ` (전체 ${rows.length}건)`
                        : ""
                    }`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              새로고침
            </Button>
            <Button
              onClick={handleExport}
              disabled={loading || filtered.length === 0}
              size="sm"
            >
              <Download className="h-4 w-4 mr-1.5" aria-hidden="true" />
              CSV 내려받기
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="메시지·이메일 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-300">
            조회 실패: {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 ? (
          <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
            <Inbox
              className="h-10 w-10 text-muted-foreground mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              {search ? "검색 결과가 없습니다" : "아직 피드백 없음"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                      Created At
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Message
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Email
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Country
                    </th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Page
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const preview =
                      row.message.length > PREVIEW_CHARS
                        ? row.message.slice(0, PREVIEW_CHARS) + "…"
                        : row.message;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setDetailRow(row)}
                        className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-4 py-3 text-foreground break-words max-w-md">
                          {preview}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground break-all">
                          {row.email ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground uppercase">
                          {row.country ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground break-all max-w-xs">
                          {row.page_url ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      <Dialog open={!!detailRow} onOpenChange={(v) => !v && setDetailRow(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="text-base font-semibold">
            피드백 상세
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {detailRow && formatDate(detailRow.created_at)}
          </DialogDescription>
          {detailRow && (
            <div className="space-y-3 text-sm">
              <section>
                <div className="text-xs text-muted-foreground mb-1">Message</div>
                <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-foreground">
                  {detailRow.message}
                </p>
              </section>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <Field label="Email" value={detailRow.email} />
                <Field label="Country" value={detailRow.country?.toUpperCase()} />
                <Field label="Locale" value={detailRow.locale} />
                <Field label="User ID" value={detailRow.user_id} />
                <Field label="IP" value={detailRow.ip_address} />
                <Field label="Page" value={detailRow.page_url} />
              </dl>
              {detailRow.user_agent && (
                <section>
                  <div className="text-xs text-muted-foreground mb-1">
                    User-Agent
                  </div>
                  <p className="break-all rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
                    {detailRow.user_agent}
                  </p>
                </section>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminGuard>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="col-span-3 sm:col-span-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all text-foreground">{value ?? "—"}</dd>
    </div>
  );
}
