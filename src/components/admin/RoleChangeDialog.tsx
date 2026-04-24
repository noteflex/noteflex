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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RoleChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetEmail: string | null;
  currentRole: string | null;
  onSuccess: () => void;
}

export default function RoleChangeDialog({
  open,
  onOpenChange,
  targetUserId,
  targetEmail,
  currentRole,
  onSuccess,
}: RoleChangeDialogProps) {
  const [newRole, setNewRole] = useState<"user" | "admin">(
    currentRole === "admin" ? "user" : "admin"
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setNewRole(currentRole === "admin" ? "user" : "admin");
      setReason("");
      setSubmitting(false);
    }
  }, [open, currentRole]);

  const handleSubmit = async () => {
    if (reason.trim().length < 3) {
      toast.error("사유를 3자 이상 입력해주세요");
      return;
    }
    if (newRole === currentRole) {
      toast.error("현재 권한과 동일합니다");
      return;
    }

    setSubmitting(true);
    const result = await callAdminAction({
      action_type: "update_role",
      target_user_id: targetUserId,
      role: newRole,
      reason: reason.trim(),
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? "권한 변경 실패");
      return;
    }

    toast.success(
      `권한을 ${newRole === "admin" ? "관리자" : "일반"}로 변경했어요`
    );
    if (result.warning) {
      toast.warning(result.warning);
    }
    onOpenChange(false);
    onSuccess();
  };

  const isDangerous = newRole === "admin";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>권한 변경</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              {targetEmail ?? "사용자"}
            </span>
            의 권한을 변경합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>현재 권한</Label>
            <p className="text-sm text-muted-foreground">
              {currentRole === "admin" ? "🔴 관리자 (admin)" : "👤 일반 (user)"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-role">변경할 권한</Label>
            <Select
              value={newRole}
              onValueChange={(v) => setNewRole(v as "user" | "admin")}
            >
              <SelectTrigger id="new-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">👤 일반 (user)</SelectItem>
                <SelectItem value="admin">🔴 관리자 (admin)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isDangerous ? (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
              ⚠️ 관리자로 승격하면 모든 사용자 데이터에 접근할 수 있어요.
              신중히 결정해주세요.
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="reason">사유 (필수, 3자 이상)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 운영팀 합류, CS 응대용 승격"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 · 모든 액션은 감사 로그에 기록됩니다
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
            disabled={submitting || reason.trim().length < 3}
            className={isDangerous ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {submitting ? "변경 중…" : "권한 변경"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}