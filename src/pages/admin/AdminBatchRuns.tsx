import { useState } from "react";
import { useBatchRuns, type BatchRun } from "@/hooks/useBatchRuns";
import AdminGuard from "@/components/admin/AdminGuard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function StatusBadge({ status }: { status: BatchRun["status"] }) {
  const colors = {
    success: "bg-green-100 text-green-800 border-green-200",
    partial: "bg-amber-100 text-amber-800 border-amber-200",
    failed: "bg-red-100 text-red-800 border-red-200",
  };
  const labels = {
    success: "✅ 성공",
    partial: "⚠️ 일부",
    failed: "❌ 실패",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded border font-medium ${colors[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function AdminBatchRuns() {
  const { runs, summary, loading, error, reload, triggerManualRun } =
    useBatchRuns();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const handleManualRun = async () => {
    setRunning(true);
    const result = await triggerManualRun();
    setRunning(false);
    setConfirmOpen(false);

    if (result.success) {
      toast.success("배치 실행 완료", { description: result.message });
    } else {
      toast.error("배치 실행 실패", { description: result.message });
    }
  };

  const toggleError = (id: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AdminGuard>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">일일 배치 실행 이력</h1>
            <p className="text-sm text-muted-foreground mt-1">
              매일 UTC 15:00 (한국 자정)에 자동 실행됨 · 최근 30일
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => reload()}
              disabled={loading}
            >
              🔄 새로고침
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              className="bg-amber-500 hover:bg-amber-600"
            >
              ⚡ 지금 실행
            </Button>
          </div>
        </div>

        {/* 요약 카드 */}
        {!loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1">최근 실행</p>
              <p className="text-lg font-bold">
                {summary.lastRunDate
                  ? formatDate(summary.lastRunDate)
                  : "없음"}
              </p>
              {summary.lastRunStatus && (
                <StatusBadge status={summary.lastRunStatus} />
              )}
            </div>
            <div className="rounded-lg border p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1">총 실행</p>
              <p className="text-2xl font-bold">{summary.totalRuns}</p>
              <p className="text-xs text-muted-foreground mt-1">
                최근 30일 기준
              </p>
            </div>
            <div className="rounded-lg border p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1">성공 / 실패</p>
              <p className="text-2xl font-bold">
                <span className="text-green-600">{summary.successCount}</span>
                {" / "}
                <span className="text-red-600">{summary.failedCount}</span>
              </p>
            </div>
            <div className="rounded-lg border p-4 bg-card">
              <p className="text-xs text-muted-foreground mb-1">
                평균 소요시간 (최근 7일)
              </p>
              <p className="text-2xl font-bold">
                {summary.last7DaysAvgDurationMs > 0
                  ? formatDuration(summary.last7DaysAvgDurationMs)
                  : "—"}
              </p>
            </div>
          </div>
        )}

        {/* 에러 표시 */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            ❌ 로드 실패: {error}
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="text-center py-12 text-muted-foreground">
            로딩 중...
          </div>
        )}

        {/* 테이블 */}
        {!loading && !error && runs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            아직 배치 실행 기록이 없습니다.
          </div>
        )}

        {!loading && !error && runs.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">날짜</th>
                  <th className="text-center px-4 py-3 font-medium">상태</th>
                  <th className="text-right px-4 py-3 font-medium">유저</th>
                  <th className="text-right px-4 py-3 font-medium">약점↑</th>
                  <th className="text-right px-4 py-3 font-medium">약점↓</th>
                  <th className="text-right px-4 py-3 font-medium">마스터</th>
                  <th className="text-right px-4 py-3 font-medium">프리미엄 만료</th>
                  <th className="text-right px-4 py-3 font-medium">소요</th>
                </tr>
              </thead>
              <tbody>
                {runs.flatMap((run) => {
                  const rows = [
                    <tr
                      key={run.id}
                      className={`border-t ${
                        run.status === "failed"
                          ? "bg-red-50 cursor-pointer hover:bg-red-100"
                          : "hover:bg-muted/30"
                      }`}
                      onClick={() =>
                        run.status === "failed" && toggleError(run.id)
                      }
                    >
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {formatDate(run.run_date)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {run.users_analyzed}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-600">
                        {run.weakness_flagged > 0
                          ? `+${run.weakness_flagged}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-600">
                        {run.weakness_released > 0
                          ? `-${run.weakness_released}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-600">
                        {run.mastery_flagged > 0
                          ? `★${run.mastery_flagged}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {run.premium_expired > 0 ? (
                          <span className="text-blue-600 font-medium">
                            {run.premium_expired}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatDuration(run.duration_ms)}
                      </td>
                    </tr>,
                  ];
                  if (
                    run.status === "failed" &&
                    expandedErrors.has(run.id) &&
                    run.error_message
                  ) {
                    rows.push(
                      <tr
                        key={`${run.id}-error`}
                        className="bg-red-50 border-t"
                      >
                        <td colSpan={8} className="px-4 py-3">
                          <div className="text-xs font-mono text-red-800 whitespace-pre-wrap">
                            <span className="font-semibold">에러:</span>{" "}
                            {run.error_message}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 수동 실행 확인 다이얼로그 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚡ 배치 분석 수동 실행</DialogTitle>
            <DialogDescription>
              <code>run_daily_batch_analysis()</code>을 지금 바로 실행합니다.
              <br />
              오늘 이미 실행된 경우 건너뜁니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={running}
            >
              취소
            </Button>
            <Button
              onClick={handleManualRun}
              disabled={running}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {running ? "실행 중..." : "실행"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminGuard>
  );
}
