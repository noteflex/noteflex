// src/components/AccidentalSwipeTutorial.tsx
// 5/2 (2026-05-02): controlled 변경 — NoteGame이 isOpen·onClose 직접 제어.
// 사용자 정책 (메모리 #18): 모달 → 카운트다운 → 첫 음표 순서 보장.

const STORAGE_KEY_PREFIX = "noteflex.swipe_tutorial_seen.lv";

function getStorageKey(level: number) {
  return `${STORAGE_KEY_PREFIX}${level}`;
}

export function hasSeenSwipeTutorial(level: number): boolean {
  try {
    return localStorage.getItem(getStorageKey(level)) === "true";
  } catch {
    return false;
  }
}

export function markSwipeTutorialSeen(level: number) {
  try {
    localStorage.setItem(getStorageKey(level), "true");
  } catch {
    /* ignore */
  }
}

interface Props {
  isOpen: boolean;
  /** markAsSeen=true면 localStorage에 "본 적 있음" 기록 (다음부터 모달 X) */
  onClose: (markAsSeen: boolean) => void;
}

export default function AccidentalSwipeTutorial({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

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
            onClick={() => onClose(false)}
            className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors active:scale-[0.98]"
          >
            확인했습니다
          </button>
          <button
            onClick={() => onClose(true)}
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
