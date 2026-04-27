// src/components/AccidentalSwipeTutorial.tsx
import { useEffect, useState } from "react";

interface Props {
  level: number;
  /** Lv5+ 진입 시 부모가 true로 트리거 */
  triggerOpen: boolean;
}

const STORAGE_KEY_PREFIX = "noteflex.swipe_tutorial_seen.lv";

function getStorageKey(level: number) {
  return `${STORAGE_KEY_PREFIX}${level}`;
}

function hasSeen(level: number): boolean {
  try {
    return localStorage.getItem(getStorageKey(level)) === "true";
  } catch {
    return false;
  }
}

function markSeen(level: number) {
  try {
    localStorage.setItem(getStorageKey(level), "true");
  } catch {
    /* ignore */
  }
}

export default function AccidentalSwipeTutorial({ level, triggerOpen }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!triggerOpen) return;
    if (level < 5) return;
    if (hasSeen(level)) return;
    setOpen(true);
  }, [triggerOpen, level]);

  if (!open) return null;

  const handleClose = () => {
    setOpen(false);
  };

  const handleDontShowAgain = () => {
    markSeen(level);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="조표 입력 사용법"
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-fade-up">
        <div className="flex flex-col items-center gap-4 mb-6">
          <span className="text-5xl">✨</span>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground text-center">
            새로운 조작법 안내
          </h2>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            이 레벨부터는 조표(♯, ♭)가 등장합니다.
            <br />
            아래 방식으로 답을 입력해 주세요.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          <TutorialRow
            icon="↑"
            title="샵(♯) 음표"
            description="해당 음 버튼을 위로 끌어올려 주세요"
          />
          <TutorialRow
            icon="↓"
            title="플랫(♭) 음표"
            description="해당 음 버튼을 아래로 내려 주세요"
          />
          <TutorialRow
            icon="•"
            title="자연음 (♯, ♭ 없음)"
            description="해당 음 버튼을 그냥 클릭해 주세요"
          />
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleClose}
            className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            확인했습니다
          </button>
          <button
            onClick={handleDontShowAgain}
            className="w-full px-6 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            앞으로 더 이상 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}

function TutorialRow({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary text-2xl font-bold shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-foreground text-sm mb-0.5">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}