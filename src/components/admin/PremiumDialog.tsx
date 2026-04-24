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

interface PremiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetEmail: string | null;
  currentIsPremium: boolean;
  currentPremiumUntil: string | null;
  onSuccess: () => void;
}

type Mode = "grant" | "revoke";
type Preset = 7 | 30 | 90 | 365 | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: 7, label: "7일" },
  { value: 30, label: "30일" },
  { value: 90, label: "90일" },
  { value: 365, label: "1년" },
  { value: "custom", label: "직접 입력" },
];

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PremiumDialog({
  open,
  onOpenChange,
  targetUserId,
  targetEmail,
  currentIsPremium,
  currentPremiumUntil,
  onSuccess,
}: PremiumDialogProps) {
  const [mode, setMode] = useState<Mode>(currentIsPremium ? "revoke" : "grant");
  const [preset, setPreset] = useState<Preset>(30);
  // customDate는 preset === "custom"일 때만 직접 쓰임.
  // 프리셋 선택 시엔 매번 오늘 기준으로 새로 계산한다.
  const [customDate, setCustomDate] = useState<string>(
    toDateInputValue(addDays(new Date(), 30))
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 모달 열릴 때마다 완전 초기화
  useEffect(() => {
    if (open) {
      setMode(currentIsPremium ? "revoke" : "grant");
      setPreset(30);
      setCustomDate(toDateInputValue(addDays(new Date(), 30)));
      setReason("");
      setSubmitting(false);
    }
  }, [open, currentIsPremium]);

  // 실제 만료일: 항상 "오늘 기준으로" 계산
  //   - preset이 숫자면 오늘 + preset일
  //   - preset이 'custom'이면 customDate 파싱
  const untilDate: Date | null = useMemo(() => {
    if (mode !== "grant") return null;

    if (preset === "custom") {
      const parts = customDate.split("-").map(Number);
      if (parts.length !== 3 || parts.some((n) => !n || Number.isNaN(n))) {
        return null;
      }
      const [y, m, d] = parts;
      return new Date(y, m - 1, d, 23, 59, 59, 0);
    }

    // 프리셋: 오늘의 23:59:59 기준에서 preset일 뒤
    const base = new Date();
    base.setHours(23, 59, 59, 0);
    return addDays(base, preset);
  }, [mode, preset, customDate]);

  const untilValid = untilDate != null && untilDate.getTime() > Date.now();

  // preset이 바뀌면 customDate input도 보기 좋게 동기화 (시각적 힌트용)
  useEffect(() => {
    if (preset !== "custom" && untilDate) {
      setCustomDate(toDateInputValue(untilDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const handleSubmit = async () => {
    if (reason.trim().length < 3) {
      toast.error("사유를 3자 이상 입력해주세요");
      return;
    }

    setSubmitting(true);
    let result;
    if (mode === "grant") {
      if (!untilDate || !untilValid) {
        toast.error("만료일은 미래 날짜여야 합니다");
        setSubmitting(false);
        return;
      }
      result = await callAdminAction({
        action_type: "grant_premium",
        target_user_id: targetUserId,
        until: untilDate.toISOString(),
        reason: reason.trim(),
      });
    } else {
      result = await callAdminAction({
        action_type: "revoke_premium",
        target_user_id: targetUserId,
        reason: reason.trim(),
      });
    }
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "처리 실패");
      return;
    }

    toast.success(
      mode === "grant"
        ? `프리미엄을 ${untilDate!.toLocaleDateString("ko-KR")}까지 부여했어요`
        : "프리미엄을 해제했어요"
    );
    if (result.warning) {
      toast.warning(result.warning);
    }
    onOpenChange(false);
    onSuccess();
  };

  // "연장" 안내용: 현재 만료일 vs 새 만료일 비교
  const isExtending = currentIsPremium && mode === "grant" && untilDate != null;
  const currentUntilMs = currentPremiumUntil
    ? new Date(currentPremiumUntil).getTime()
    : 0;
  const willShorten =
    isExtending && currentUntilMs > 0 && untilDate!.getTime() < currentUntilMs;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>프리미엄 관리</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              {targetEmail ?? "사용자"}
            </span>
            의 프리미엄 상태를 변경합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 현재 상태 */}
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs">
            <p className="text-muted-foreground">현재 상태</p>
            <p className="mt-1 font-medium">
              {currentIsPremium ? (
                <>
                  ✨ 프리미엄{" "}
                  <span className="text-muted-foreground font-normal">
                    · {formatDateTime(currentPremiumUntil)} 까지
                  </span>
                </>
              ) : (
                "무료"
              )}
            </p>
          </div>

          {/* 모드 토글 */}
          <div className="grid grid-cols-2 gap-1 bg-muted rounded-md p-0.5">
            <button
              type="button"
              onClick={() => setMode("grant")}
              className={`text-sm py-1.5 rounded ${
                mode === "grant"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground"
              }`}
            >
              부여 / 연장
            </button>
            <button
              type="button"
              onClick={() => setMode("revoke")}
              disabled={!currentIsPremium}
              className={`text-sm py-1.5 rounded ${
                mode === "revoke"
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              해제
            </button>
          </div>

          {/* 부여 모드 */}
          {mode === "grant" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>기간 프리셋 (오늘부터)</Label>
                <div className="grid grid-cols-5 gap-1">
                  {PRESETS.map((p) => (
                    <button
                      key={String(p.value)}
                      type="button"
                      onClick={() => setPreset(p.value)}
                      className={`text-xs py-2 rounded border transition ${
                        preset === p.value
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border hover:bg-accent/30"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="until-date">
                  만료일 {preset === "custom" ? "(직접 입력)" : "(자동 계산)"}
                </Label>
                <Input
                  id="until-date"
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value);
                    setPreset("custom");
                  }}
                  min={toDateInputValue(addDays(new Date(), 1))}
                />
                {untilDate ? (
                  <p className="text-xs text-muted-foreground">
                    → {untilDate.toLocaleDateString("ko-KR")} 23:59까지
                  </p>
                ) : null}
              </div>

              {/* 연장 시 경고 */}
              {isExtending && willShorten ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                  ⚠️ 기존 만료일(
                  {currentPremiumUntil
                    ? new Date(currentPremiumUntil).toLocaleDateString("ko-KR")
                    : "—"}
                  )보다 <b>앞당겨집니다</b>. 의도한 변경인지 확인해주세요.
                </div>
              ) : null}
              {isExtending && !willShorten ? (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700">
                  ℹ️ 기존 만료일(
                  {currentPremiumUntil
                    ? new Date(currentPremiumUntil).toLocaleDateString("ko-KR")
                    : "—"}
                  )을 새 날짜로 <b>덮어씁니다</b>.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-xs text-orange-700">
              ⚠️ 프리미엄을 즉시 해제합니다. 환불 처리는 별도로 진행해주세요.
            </div>
          )}

          {/* 사유 */}
          <div className="space-y-2">
            <Label htmlFor="reason">사유 (필수, 3자 이상)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                mode === "grant"
                  ? "예: 이벤트 당첨, 체험판 연장, CS 보상"
                  : "예: 환불 완료, 약관 위반"
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
            disabled={
              submitting ||
              reason.trim().length < 3 ||
              (mode === "grant" && !untilValid)
            }
            className={
              mode === "revoke" ? "bg-orange-600 hover:bg-orange-700" : ""
            }
          >
            {submitting
              ? "처리 중…"
              : mode === "grant"
                ? "프리미엄 부여"
                : "프리미엄 해제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}