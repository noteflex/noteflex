import { useEffect, useMemo, useState } from "react";
import { Download, Inbox, Mail, RefreshCw, Search, StickyNote } from "lucide-react";
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
 * 사용자 피드백 운영 페이지 — 목록 · 상태 토글 · 통계 · 필터 · 답장 link · 내부 메모 · CSV.
 * RLS off 라 anon 클라이언트로 SELECT/UPDATE 가능. AdminGuard 로 UI 차단.
 * 다른 admin 페이지 convention 따라 ko 하드코딩.
 */

type Status = "open" | "in_progress" | "closed";

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
  status: Status;
  resolved_at: string | null;
  admin_note: string | null;
}

const PREVIEW_CHARS = 80;
const PAGE_SIZE = 200;

type StatusFilter = "all" | Status;
type EmailFilter = "all" | "has" | "none";
type DateFilter = "all" | "7d" | "30d";

const STATUS_LABEL: Record<Status, string> = {
  open: "미처리",
  in_progress: "진행중",
  closed: "완료",
};

const STATUS_NEXT: Record<Status, Status> = {
  open: "in_progress",
  in_progress: "closed",
  closed: "open",
};

const STATUS_BADGE_CLASS: Record<Status, string> = {
  open: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60",
  closed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60",
};

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
    "status",
    "message",
    "email",
    "country",
    "user_id",
    "page_url",
    "locale",
    "ip_address",
    "user_agent",
    "admin_note",
    "resolved_at",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.created_at,
        r.status,
        r.message,
        r.email ?? "",
        r.country ?? "",
        r.user_id ?? "",
        r.page_url ?? "",
        r.locale ?? "",
        r.ip_address ?? "",
        r.user_agent ?? "",
        r.admin_note ?? "",
        r.resolved_at ?? "",
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

function buildMailto(row: FeedbackRow): string {
  if (!row.email) return "";
  const isKo = row.locale?.startsWith("ko");
  const subject = isKo
    ? "Noteflex 피드백에 답변드립니다"
    : "Re: Your Noteflex feedback";
  const greeting = isKo
    ? "안녕하세요,\n\nNoteflex에 피드백 남겨주셔서 감사합니다.\n\n---\n원본 피드백:\n"
    : "Hello,\n\nThank you for sharing your feedback with Noteflex.\n\n---\nOriginal feedback:\n";
  const body = greeting + row.message;
  return `mailto:${row.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function withinDays(iso: string, days: number): boolean {
  const t = new Date(iso).getTime();
  return Date.now() - t <= days * 24 * 60 * 60 * 1000;
}

export default function FeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [emailFilter, setEmailFilter] = useState<EmailFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [detailRow, setDetailRow] = useState<FeedbackRow | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (queryError) {
        setError(`${queryError.code ?? ""} ${queryError.message}`.trim());
        setRows([]);
      } else {
        setRows((data ?? []) as FeedbackRow[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // 상세 모달 열릴 때 메모 draft 초기화
  useEffect(() => {
    setDraftNote(detailRow?.admin_note ?? "");
  }, [detailRow]);

  const stats = useMemo(() => {
    const total = rows.length;
    const open = rows.filter((r) => r.status === "open").length;
    const withEmail = rows.filter((r) => !!r.email).length;
    const last7d = rows.filter((r) => withinDays(r.created_at, 7)).length;
    return { total, open, withEmail, last7d };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (emailFilter === "has" && !r.email) return false;
      if (emailFilter === "none" && r.email) return false;
      if (dateFilter === "7d" && !withinDays(r.created_at, 7)) return false;
      if (dateFilter === "30d" && !withinDays(r.created_at, 30)) return false;
      if (q && !(
        r.message.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [rows, search, statusFilter, emailFilter, dateFilter]);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.warning("내려받을 데이터가 없습니다.");
      return;
    }
    downloadCSV(filtered);
    toast.success(`${filtered.length}건 CSV 내려받기 완료`);
  };

  const updateRow = async (
    id: string,
    patch: Partial<Pick<FeedbackRow, "status" | "admin_note" | "resolved_at">>,
  ) => {
    const { error: updateError } = await supabase
      .from("feedback")
      .update(patch)
      .eq("id", id);
    if (updateError) {
      toast.error(`업데이트 실패: ${updateError.message}`);
      return false;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (detailRow?.id === id) {
      setDetailRow((prev) => (prev ? { ...prev, ...patch } : prev));
    }
    return true;
  };

  const cycleStatus = async (row: FeedbackRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = STATUS_NEXT[row.status];
    const patch: Partial<FeedbackRow> = {
      status: next,
      resolved_at: next === "closed" ? new Date().toISOString() : null,
    };
    const ok = await updateRow(row.id, patch);
    if (ok) toast.success(`${STATUS_LABEL[next]}로 변경`);
  };

  const handleSaveNote = async () => {
    if (!detailRow) return;
    setSavingNote(true);
    const ok = await updateRow(detailRow.id, {
      admin_note: draftNote.trim() || null,
    });
    setSavingNote(false);
    if (ok) toast.success("메모 저장 완료");
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

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="총" value={stats.total} />
          <StatCard label="미처리" value={stats.open} accent="amber" />
          <StatCard label="이메일 있음" value={stats.withEmail} />
          <StatCard label="최근 7일" value={stats.last7d} />
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-2 items-center">
          <SegGroup
            label="상태"
            value={statusFilter}
            options={[
              { value: "all", label: "전체" },
              { value: "open", label: "미처리" },
              { value: "in_progress", label: "진행중" },
              { value: "closed", label: "완료" },
            ]}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
          />
          <SegGroup
            label="이메일"
            value={emailFilter}
            options={[
              { value: "all", label: "전체" },
              { value: "has", label: "있음" },
              { value: "none", label: "없음" },
            ]}
            onChange={(v) => setEmailFilter(v as EmailFilter)}
          />
          <SegGroup
            label="기간"
            value={dateFilter}
            options={[
              { value: "all", label: "전체" },
              { value: "7d", label: "7일" },
              { value: "30d", label: "30일" },
            ]}
            onChange={(v) => setDateFilter(v as DateFilter)}
          />
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
              {search || statusFilter !== "all" || emailFilter !== "all" || dateFilter !== "all"
                ? "조건에 맞는 피드백이 없습니다"
                : "아직 피드백 없음"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                      Status
                    </th>
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
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => cycleStatus(row, e)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors ${STATUS_BADGE_CLASS[row.status]}`}
                            title="클릭으로 상태 변경"
                          >
                            {STATUS_LABEL[row.status]}
                            {row.admin_note && (
                              <StickyNote className="h-3 w-3 ml-0.5" aria-hidden="true" />
                            )}
                          </button>
                        </td>
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
            <div className="space-y-4 text-sm">
              {/* 상태 + 답장 액션 */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => cycleStatus(detailRow)}
                  className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${STATUS_BADGE_CLASS[detailRow.status]}`}
                  title="클릭으로 상태 변경"
                >
                  {STATUS_LABEL[detailRow.status]}
                </button>
                {detailRow.email && (
                  <a
                    href={buildMailto(detailRow)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    이메일 답장
                  </a>
                )}
                {detailRow.resolved_at && (
                  <span className="text-[11px] text-muted-foreground">
                    완료: {formatDate(detailRow.resolved_at)}
                  </span>
                )}
              </div>

              <section>
                <div className="text-xs text-muted-foreground mb-1">Message</div>
                <p className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-foreground">
                  {detailRow.message}
                </p>
              </section>

              <section>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">내부 메모</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveNote}
                    disabled={savingNote || draftNote === (detailRow.admin_note ?? "")}
                  >
                    {savingNote ? "저장 중…" : "저장"}
                  </Button>
                </div>
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  rows={3}
                  placeholder="운영자 메모 (이용자 비노출)"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                />
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

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "amber";
}) {
  const valueClass = accent === "amber" ? "text-amber-700 dark:text-amber-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${valueClass}`}>
        {value.toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

interface SegOption {
  value: string;
  label: string;
}

function SegGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SegOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{label}</span>
      <div className="inline-flex rounded-md border border-border bg-card overflow-hidden">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
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
