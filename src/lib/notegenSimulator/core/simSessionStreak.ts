import { computeStreakMultiplier } from "@/lib/noteWeighting";

/**
 * 5-A: useSessionStreakMastery hook의 React-free 복제.
 *
 * 정책 parity:
 *   - RECENT_BUFFER = 5
 *   - MIN_STREAK    = 5
 *   - MAX_AVG_TIME  = 1.5s
 *   - 오답 1회 즉시 리셋
 *   - 정답 시 FIFO 누적
 *   - computeStreakMultiplier 헬퍼 공유 → 판정 로직 단일화
 *
 * useSessionStreakMastery.ts 변경 시 함께 갱신해야 한다.
 */

const RECENT_BUFFER = 5;
const MIN_STREAK = 5;
const MAX_AVG_TIME = 1.5;

interface NoteStreakState {
  streak: number;
  recentResponseTimes: number[];
}

function avgOf(times: number[]): number | null {
  if (times.length === 0) return null;
  return times.reduce((a, b) => a + b, 0) / times.length;
}

export class SimSessionStreak {
  private state = new Map<string, NoteStreakState>();

  recordAttempt = (noteId: string, isCorrect: boolean, responseTimeSec: number): void => {
    const prev = this.state.get(noteId);
    if (!isCorrect) {
      this.state.set(noteId, { streak: 0, recentResponseTimes: [] });
      return;
    }
    const recent = prev ? [...prev.recentResponseTimes, responseTimeSec] : [responseTimeSec];
    while (recent.length > RECENT_BUFFER) recent.shift();
    this.state.set(noteId, {
      streak: (prev?.streak ?? 0) + 1,
      recentResponseTimes: recent,
    });
  };

  getMasteryMultiplier = (noteId: string): number => {
    const s = this.state.get(noteId);
    if (!s) return 1.0;
    return computeStreakMultiplier(
      s.streak,
      avgOf(s.recentResponseTimes),
      MIN_STREAK,
      MAX_AVG_TIME,
    );
  };

  isMastered = (noteId: string): boolean => {
    return this.getMasteryMultiplier(noteId) < 1.0;
  };

  reset = (): void => {
    this.state.clear();
  };
}
