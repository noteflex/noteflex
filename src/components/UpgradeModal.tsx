import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const navigate = useNavigate();

  const handlePricing = () => {
    navigate("/pricing");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>✨ Pro 구독으로 전체 단계 해제</DialogTitle>
          <DialogDescription>
            전체 21단계 · 상세 약점 분석 · 광고 제거
          </DialogDescription>
        </DialogHeader>

        <ul className="text-sm text-muted-foreground space-y-1.5 py-2">
          <li>🎵 Lv 1–7 전체 21단계 이용</li>
          <li>📊 음표별 약점·마스터 분석</li>
          <li>🎯 개인화 출제 가중치</li>
          <li>✨ 광고 없는 집중 연습</li>
        </ul>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={handlePricing}>
            Pricing 보기 →
          </Button>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
