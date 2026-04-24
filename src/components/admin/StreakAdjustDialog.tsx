import { useEffect, useState } from "react";
import { toast } from "sonner";
import { callAdminAction } from "@/lib/adminActions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface StreakAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetEmail: string | null;
  currentStreak: number;
  longestStreak: number;
  onSuccess: () => void;
}

const MAX_STREAK = 3650; // 10년. 그 이상은 비정상

export default function StreakAdjustDialog({
  open,
  onOpenChange,
  targetUserId,
  targetEmail,
  currentStreak,
  longestStreak,
  onSuccess,
}: StreakAdjustDialogProps) {
  const [value, setValue] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(String(currentStreak));
      setReason("");
      setSubmitting(false);
    }
  }, [open, currentStreak]);

  const parsed = parseInt(value, 10);
  const valid =
    !Number.isNaN(parsed) && parsed >= 0 && parsed <= MAX_STREAK;
  const overMax = !Number.isNaN(parsed) && parsed > MAX_STREAK;
  const changed = valid && parsed !== currentStreak;

  const canSubmit =
    valid && changed && reason.trim().length >= 3 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    const result = await callAdminAction({
      action_type: "adjust_streak",
      target_user_id: targetUserId,
      current_streak: parsed,
      reason: reason.trim(),
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "스트릭 조정 실패");
      return;
    }

    toast.success(
      `스트릭을 ${currentStreak}일 → ${parsed}일로 변경했어요`
    );
    if (result.warning) {
      toast.warning(result.warning);
    }
    onOpenChange(false);
    onSuccess();
  };

  const setQuick = (v: number) => setValue(String(v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>스트릭 조정</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              {targetEmail ?? "사용자"}
            </span>
            의 현재 스트릭 값을 변경합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 현재 값 */}
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground">현재 스트릭</p>
              <p className="mt-1 text-lg font-bold">🔥 {currentStreak}일</p>
            </div>
            <div>
              <p className="text-muted-foreground">최장 스트릭</p>
              <p className="mt-1 text-lg font-bold text-muted-foreground">
                {longestStreak}일
              </p>
            </div>
          </div>

          {/* 빠른 선택 */}
          <div className="space-y-2">
            <Label>빠른 선택</Label>
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => setQuick(0)}
                className={`text-xs py-2 rounded border transition ${
                  parsed === 0
                    ? "border-red-500 bg-red-500/5 text-red-600 font-medium"
                    : "border-border hover:bg-accent/30"
                }`}
              >
                0 (초기화)
              </button>
              <button
                type="button"
                onClick={() => setQuick(currentStreak + 1)}
                className="text-xs py-2 rounded border border-border hover:bg-accent/30 transition"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => setQuick(Math.max(0, currentStreak - 1))}
                className="text-xs py-2 rounded border border-border hover:bg-accent/30 transition"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => setQuick(longestStreak)}
                disabled={longestStreak === currentStreak}
                className="text-xs py-2 rounded border border-border hover:bg-accent/30 transition disabled:opacity-40"
              >
                최장값
              </button>
            </div>
          </div>

          {/* 직접 입력 */}
          <div className="space-y-2">
            <Label htmlFor="streak-value">
              새 스트릭 값 (0 ~ {MAX_STREAK.toLocaleString()})
            </Label>
            <Input
              id="streak-value"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_STREAK}
              step={1}
              value={value}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "" || /^\d+$/.test(raw)) {
                  setValue(raw);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "-" || e.key === "e" || e.key === ".") {
                  e.preventDefault();
                }
              }}
              className={overMax ? "border-destructive" : ""}
            />
            {overMax ? (
              <p className="text-xs text-destructive font-medium">
                ⚠️ 최대 {MAX_STREAK.toLocaleString()}일까지만 설정 가능합니다.
              </p>
            ) : null}
          </div>

          {/* 미리보기 */}
          {changed ? (
            <div className="rounded-md border border-orange-500/30 bg-orange-500/5 px-3 py-2.5 text-sm">
              <p className="text-xs text-muted-foreground mb-1">변경 후</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground line-through">
                  🔥 {currentStreak}일
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="text-lg font-bold text-orange-600">
                  🔥 {parsed}일
                </span>
              </div>
              {parsed === 0 ? (
                <p className="mt-2 text-xs text-red-600">
                  ⚠️ 스트릭이 0으로 초기화됩니다.
                </p>
              ) : null}
              {parsed > longestStreak ? (
                <p className="mt-2 text-xs text-amber-700">
                  💡 최장 스트릭({longestStreak}일)을 초과합니다.
                  DB 트리거가 최장값도 자동 갱신할 수 있어요.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* 사유 */}
          <div className="space-y-2">
            <Label htmlFor="reason">사유 (필수, 3자 이상)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 버그로 스트릭 끊김 복구, 치팅 회수"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 · 감사 로그에 기록됩니다 · user_streaks 테이블도 함께 동기화
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "처리 중…" : "스트릭 변경"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}