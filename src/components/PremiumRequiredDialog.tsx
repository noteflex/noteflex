import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PremiumRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 진입하려던 레벨 번호 (안내 문구용) */
  attemptedLevel?: number;
  /** 취소(=레벨 선택 화면 복귀) 핸들러 */
  onCancel: () => void;
}

export default function PremiumRequiredDialog({
  open,
  onOpenChange,
  attemptedLevel,
  onCancel,
}: PremiumRequiredDialogProps) {
  const navigate = useNavigate();

  const handleSubscribe = () => {
    onOpenChange(false);
    navigate("/pricing");
  };

  const handleCancel = () => {
    onOpenChange(false);
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleCancel();
        else onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl" aria-hidden>
              ✨
            </span>
            <DialogTitle>Premium 전용 레벨</DialogTitle>
          </div>
          <DialogDescription>
            {attemptedLevel
              ? `Level ${attemptedLevel}은 Premium 구독자만 이용할 수 있어요.`
              : "이 레벨은 Premium 구독자만 이용할 수 있어요."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 px-4 py-3 my-2">
          <p className="text-sm font-semibold text-amber-900 mb-1">
            Premium 혜택
          </p>
          <ul className="text-xs text-amber-800 space-y-1">
            <li>• 모든 레벨 잠금 해제 (Lv1 ~ Lv7)</li>
            <li>• 악보 업로드 및 커스텀 연습</li>
            <li>• 약점 음표 집중 훈련 모드</li>
            <li>• 광고 없이 학습 집중</li>
          </ul>
          <p className="text-xs text-amber-700 mt-2 font-medium">
            연간 $19.99 · 44% 할인
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            취소
          </Button>
          <Button
            onClick={handleSubscribe}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
          >
            구독하러 가기 →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}