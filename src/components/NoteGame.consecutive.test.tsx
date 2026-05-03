import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NoteGame from "./NoteGame";

/**
 * §0.1 전역 dedup 회귀 테스트.
 *
 * 사용자 정책: "같은 음표가 연속으로 절대 안 나오게" (전역).
 *
 * 검증 invariant:
 *   - 어떤 시나리오에서도 직전 화면 음표 == 다음 화면 음표가 0건이어야 한다.
 *   - 같은 자리 유지 정책(오답 시) 때문에 "오답으로 인해 같은 자리 유지" 케이스는 제외한다.
 *     → 정답 응답 직후의 transition만 검사한다.
 *
 * 자동 플레이 패턴은 NoteGame.stress.test.tsx에서 가져왔다.
 */

const mockLogNote = vi.fn();
const mockRecordNote = vi.fn();

vi.mock("@/hooks/useNoteLogger", () => ({
  useNoteLogger: () => ({ logNote: mockLogNote }),
}));

vi.mock("@/hooks/useSessionRecorder", () => ({
  useSessionRecorder: () => ({
    isRecording: false,
    startSession: vi.fn(),
    endSession: vi.fn().mockResolvedValue(null),
    cancelSession: vi.fn(),
    recordNote: mockRecordNote,
  }),
}));

vi.mock("@/hooks/useUserMastery", () => ({
  useUserMastery: () => ({ masteryMap: new Map(), loading: false, lastAnalyzedAt: null }),
}));

vi.mock("@/lib/sound", () => ({
  playNote: vi.fn(),
  playWrong: vi.fn(),
  isSamplerReady: () => true,
  initSound: vi.fn().mockResolvedValue(undefined),
  ensureAudioReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "test-user" }, loading: false }),
}));

vi.mock("@/hooks/useLevelProgress", () => ({
  useLevelProgress: () => ({
    progress: [],
    loading: false,
    fetchProgress: vi.fn(),
    recordAttempt: vi.fn().mockResolvedValue(null),
    getProgressFor: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock("@/hooks/useUserEnvOffset", () => ({
  useUserEnvOffset: () => ({
    offsetMs: 0,
    isCalibrated: true,
    needsCalibration: false,
    isLoading: false,
    canSkip: true,
    deviceChanged: false,
    setOffset: vi.fn().mockResolvedValue(undefined),
    clearOffset: vi.fn().mockResolvedValue(undefined),
    skipCalibration: vi.fn(),
    resetDeviceChanged: vi.fn(),
  }),
}));

vi.mock("@/components/practice/GrandStaffPractice", () => ({
  TOTAL_SLOTS: 10,
  GrandStaffPractice: ({ targetNote }: { targetNote: string | null }) => (
    <div data-testid="staff">{targetNote ?? "none"}</div>
  ),
}));

interface CurrentQuestion {
  key: string;
  octave: string;
  accidental?: "#" | "b";
  clef?: "treble" | "bass";
}

function getCurrentQuestion(): CurrentQuestion | null {
  const el = screen.queryByText(/현재 정답:/);
  if (!el) return null;
  const text = el.textContent ?? "";
  const m = text.match(/현재 정답:\s*([A-G])([#b]?)(\d+)\s*([#b])?/);
  if (!m) return null;
  return {
    key: m[1],
    accidental: ((m[2] || m[4]) as "#" | "b" | undefined) || undefined,
    octave: m[3],
  };
}

function noteId(q: CurrentQuestion): string {
  // clef는 DOM에서 직접 못 읽음 → octave 기반 근사: octave≥4 = treble, 3 이하 = bass.
  // 충돌 시 일부 false negative는 있을 수 있지만, 대부분의 invariant 위반은 잡힘.
  const acc = q.accidental ?? "";
  return `${q.key}${acc}${q.octave}`;
}

function getCorrectButton(q: CurrentQuestion): HTMLElement | null {
  return screen.queryByLabelText(`${q.key} 선택`);
}

function makePointerEvent(type: string, init: PointerEventInit & { clientX: number; clientY: number }): Event {
  try {
    return new PointerEvent(type, { ...init, bubbles: true, cancelable: true });
  } catch {
    const e = new MouseEvent(type, { ...init, bubbles: true, cancelable: true });
    Object.defineProperty(e, "pointerId", { value: init.pointerId ?? 1 });
    return e;
  }
}

async function swipeAccidental(btn: HTMLElement, accidental: "#" | "b") {
  const dy = accidental === "#" ? -80 : 80;
  await act(async () => {
    btn.dispatchEvent(makePointerEvent("pointerdown", { pointerId: 1, button: 0, clientX: 50, clientY: 100 }));
    btn.dispatchEvent(makePointerEvent("pointermove", { pointerId: 1, clientX: 50, clientY: 100 + dy }));
    btn.dispatchEvent(makePointerEvent("pointerup", { pointerId: 1, clientX: 50, clientY: 100 + dy }));
  });
}

async function answerCorrectFor(
  user: ReturnType<typeof userEvent.setup>,
  q: CurrentQuestion,
): Promise<boolean> {
  const naturalBtn = getCorrectButton(q);
  if (naturalBtn && !(naturalBtn as HTMLButtonElement).disabled) {
    if (q.accidental === "#" || q.accidental === "b") {
      await swipeAccidental(naturalBtn, q.accidental);
    } else {
      await user.click(naturalBtn);
    }
    return true;
  }
  if (q.accidental) {
    const labelled = screen.queryByLabelText(
      `${q.key}${q.accidental === "#" ? "♯" : "♭"} 선택`,
    );
    if (labelled && !(labelled as HTMLButtonElement).disabled) {
      await user.click(labelled);
      return true;
    }
  }
  return false;
}

async function answerWrongFor(
  user: ReturnType<typeof userEvent.setup>,
  q: CurrentQuestion,
): Promise<boolean> {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const wrongLetter = letters.find((l) => l !== q.key);
  if (!wrongLetter) return false;
  const btn = screen.queryByLabelText(`${wrongLetter} 선택`);
  if (!btn || (btn as HTMLButtonElement).disabled) return false;
  await user.click(btn);
  return true;
}

function isGameEnded(): boolean {
  return (
    screen.queryByText(/Mission Success/) !== null ||
    screen.queryByText(/모든 레벨 완료/) !== null ||
    screen.queryByText(/게임 오버/) !== null
  );
}

interface ConsecutiveViolation {
  turn: number;
  prev: string;
  next: string;
  context: string;
}

interface PlayResult {
  turns: number;
  violations: ConsecutiveViolation[];
}

const MAX_TURNS = 600;

/**
 * 자동 플레이하면서 정답 응답 직후의 prev→next 음표 transition을 모두 기록.
 * 같은 ID 두 번 연속 등장 시 violation으로 표시.
 *
 * 오답으로 인한 "같은 자리 유지"는 제외해야 invariant가 의미가 있음.
 * → 답한 결과(정답/오답)을 알고 있고, 정답일 때만 prev→next pair를 검사한다.
 */
async function playAndCheckConsecutive(
  user: ReturnType<typeof userEvent.setup>,
  strategy: "all-correct" | "random-70",
  seed0: number,
): Promise<PlayResult> {
  const violations: ConsecutiveViolation[] = [];
  let prevAnsweredId: string | null = null;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (isGameEnded()) {
      return { turns: turn, violations };
    }
    const q = getCurrentQuestion();
    if (!q) return { turns: turn, violations };
    const currentId = noteId(q);

    let shouldCorrect: boolean;
    if (strategy === "all-correct") {
      shouldCorrect = true;
    } else {
      const x = Math.sin(seed0 + turn) * 10000;
      shouldCorrect = x - Math.floor(x) >= 0.3; // 70% 정답
    }

    const ok = shouldCorrect
      ? await answerCorrectFor(user, q)
      : await answerWrongFor(user, q);
    if (!ok) return { turns: turn, violations };

    if (shouldCorrect) {
      // 답 직후 React state 안정화 대기 (setPhase 등 batched updates)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      // 마지막 음표 답한 후엔 currentTarget이 그대로 남아있으나 modal로 가려짐.
      // 게임 종료 시점은 invariant 검사 X (다음 출제가 없으므로).
      if (isGameEnded()) {
        return { turns: turn + 1, violations };
      }
      const nextQ = getCurrentQuestion();
      if (nextQ && prevAnsweredId !== null) {
        const nextId = noteId(nextQ);
        if (nextId === currentId) {
          const isRetry = !!screen.queryByText(/재출제/);
          violations.push({
            turn,
            prev: currentId,
            next: nextId,
            context: `직전 정답 ${currentId} → 다음 출제 ${nextId} (retry=${isRetry})`,
          });
        }
      }
      prevAnsweredId = currentId;
    }
    // 오답 시: 같은 자리 유지 → prev 갱신하지 않음
  }
  return { turns: MAX_TURNS, violations };
}

describe("§0.1 전역 dedup invariant — 같은 음표 연속 등장 0건", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("noteflex.solfege_system", "en");
  });

  describe.each([1, 2, 3, 4] as const)("Level %d", (level) => {
    it(`전부 정답: 정답 직후 다음 출제가 같은 음표인 경우 0건`, async () => {
      const user = userEvent.setup();
      render(<NoteGame level={level} sublevel={1} skipCountdown />);

      const { violations, turns } = await playAndCheckConsecutive(user, "all-correct", level * 100);

      expect(turns).toBeGreaterThan(0);
      if (violations.length > 0) {
        const summary = violations.slice(0, 5).map((v) => `t=${v.turn}: ${v.context}`).join("\n");
        throw new Error(`Lv${level} all-correct: ${violations.length} violation(s)\n${summary}`);
      }
    });

    it(`70% 정답 (retry queue 활성): 같은 음표 연속 등장 0건`, async () => {
      const user = userEvent.setup();
      render(<NoteGame level={level} sublevel={1} skipCountdown />);

      const { violations, turns } = await playAndCheckConsecutive(user, "random-70", level * 7);

      expect(turns).toBeGreaterThan(0);
      if (violations.length > 0) {
        const summary = violations.slice(0, 10).map((v) => `t=${v.turn}: ${v.context}`).join("\n");
        throw new Error(`Lv${level} random-70: ${violations.length} violation(s)\n${summary}`);
      }
    });
  });

  it("Lv1 sublevel 2: set/stage 전환 사각지대 검사", async () => {
    const user = userEvent.setup();
    render(<NoteGame level={1} sublevel={2} skipCountdown />);

    const { violations } = await playAndCheckConsecutive(user, "random-70", 9999);

    if (violations.length > 0) {
      const summary = violations.slice(0, 10).map((v) => `t=${v.turn}: ${v.context}`).join("\n");
      throw new Error(`Lv1 sub2 random-70: ${violations.length} violation(s)\n${summary}`);
    }
  });
});
