import { useEffect, useMemo, useState } from "react";
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

interface XpAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetEmail: string | null;
  currentXp: number;
  onSuccess: () => void;
}

const PRESETS: number[] = [10, 50, 100, 500];
const MAX_AMOUNT = 100_000; // 한 번에 조정 가능한 최대값

export default function XpAdjustDialog({
  open,
  onOpenChange,
  targetUserId,
  targetEmail,
  currentXp,
  onSuccess,
}: XpAdjustDialogProps) {
  const [sign, setSign] = useState<"+" | "-">("+");
  const [amountText, setAmountText] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSign("+");
      setAmountText("");
      setReason("");
      setSubmitting(false);
    }
  }, [open]);

  const amount = useMemo(() => {
    const n = parseInt(amountText, 10);
    if (Number.isNaN(n) || n < 0) return 0;
    return n;
  }, [amountText]);

  const overAmount = amount > MAX_AMOUNT;
  const effectiveAmount = overAmount ? 0 : amount; // 초과 시 제출 차단용

  const delta = sign === "+" ? effectiveAmount : -effectiveAmount;
  const projectedXp = Math.max(0, currentXp + delta);
  const willClamp = delta < 0 && currentXp + delta < 0;

  const canSubmit =
    effectiveAmount > 0 && reason.trim().length >= 3 && !submitting && !overAmount;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    const result = await callAdminAction({
      action_type: "adjust_xp",
      target_user_id: targetUserId,
      delta,
      reason: reason.trim(),
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "XP 조정 실패");
      return;
    }

    toast.success(
      `XP를 ${delta > 0 ? "+" : ""}${delta} 조정했어요 (${currentXp.toLocaleString()} → ${projectedXp.toLocaleString()})`
    );
    if (result.warning) {
      toast.warning(result.warning);
    }
    onOpenChange(false);
    onSuccess();
  };

  const isNegative = sign === "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>XP 조정</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              {targetEmail ?? "사용자"}
            </span>
            의 총 XP를 증감합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 현재 XP */}
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
            <p className="text-muted-foreground">현재 총 XP</p>
            <p className="mt-1 text-lg font-bold">
              ⭐ {currentXp.toLocaleString()}
            </p>
          </div>

          {/* 증감 토글 */}
          <div className="space-y-2">
            <Label>증감 방향</Label>
            <div className="grid grid-cols-2 gap-1 bg-muted rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setSign("+")}
                className={`text-sm py-1.5 rounded ${
                  sign === "+"
                    ? "bg-background shadow-sm font-medium text-emerald-600"
                    : "text-muted-foreground"
                }`}
              >
                ＋ 증가
              </button>
              <button
                type="button"
                onClick={() => setSign("-")}
                className={`text-sm py-1.5 rounded ${
                  sign === "-"
                    ? "bg-background shadow-sm font-medium text-red-600"
                    : "text-muted-foreground"
                }`}
              >
                － 감소
              </button>
            </div>
          </div>

          {/* 프리셋 */}
          <div className="space-y-2">
            <Label>빠른 선택</Label>
            <div className="grid grid-cols-4 gap-1">
              {PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmountText(String(v))}
                  className={`text-xs py-2 rounded border transition ${
                    effectiveAmount === v
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:bg-accent/30"
                  }`}
                >
                  {sign}
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* 직접 입력 */}
          <div className="space-y-2">
            <Label htmlFor="xp-amount">
              수량 (직접 입력, 최대 {MAX_AMOUNT.toLocaleString()})
            </Label>
            <Input
              id="xp-amount"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_AMOUNT}
              step={1}
              value={amountText}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setAmountText("");
                  return;
                }
                // 숫자만 허용 + MAX 초과 시 입력 자체 차단
                if (!/^\d+$/.test(raw)) return;
                const n = parseInt(raw, 10);
                if (Number.isNaN(n) || n > MAX_AMOUNT) return;
                setAmountText(raw);
              }}
              onKeyDown={(e) => {
                if (e.key === "-" || e.key === "e" || e.key === ".") {
                  e.preventDefault();
                }
              }}
              placeholder="예: 100"
              className={overAmount ? "border-destructive" : ""}
            />
            {overAmount ? (
              <p className="text-xs text-destructive font-medium">
                ⚠️ 한 번에 최대 {MAX_AMOUNT.toLocaleString()} XP까지만 조정
                가능합니다.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                최대 {MAX_AMOUNT.toLocaleString()} · 대규모 지급은 배치
                시스템으로 · 차감하려면 위에서 <b>− 감소</b>
              </p>
            )}
          </div>

          {/* 결과 미리보기 */}
          {effectiveAmount > 0 ? (
            <div
              className={`rounded-md border px-3 py-2.5 text-sm ${
                isNegative
                  ? "border-red-500/30 bg-red-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5"
              }`}
            >
              <p className="text-xs text-muted-foreground mb-1">변경 후</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground line-through">
                  {currentXp.toLocaleString()}
                </span>
                <span className="text-muted-foreground">→</span>
                <span
                  className={`text-lg font-bold ${
                    isNegative ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  {projectedXp.toLocaleString()} XP
                </span>
                <span
                  className={`text-xs font-medium ${
                    isNegative ? "text-red-600" : "text-emerald-600"
                  }`}
                >
                  ({delta > 0 ? "+" : ""}
                  {delta})
                </span>
              </div>
              {willClamp ? (
                <p className="mt-2 text-xs text-amber-700">
                  ⚠️ 계산값이 음수라서 0으로 클램프됩니다.
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
              placeholder={
                isNegative
                  ? "예: 치팅 회수, 버그 보정"
                  : "예: CS 보상, 이벤트 당첨"
              }
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 · 감사 로그에 기록됩니다
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
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={
              isNegative ? "bg-red-600 hover:bg-red-700" : ""
            }
          >
            {submitting
              ? "처리 중…"
              : isNegative
                ? "XP 차감"
                : "XP 부여"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}