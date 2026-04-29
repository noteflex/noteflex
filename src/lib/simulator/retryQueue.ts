/**
 * Simulator-internal RetryQueue.
 *
 * useRetryQueue.ts의 React-free 버전. 1만 게임 fuzz 시뮬레이션용.
 * 동일한 로직을 plain class로 복제 — production hook과 동기화 유지에 주의.
 *
 * §0.1 정책 검증을 위해 popDueOrNull(turn, lastShown?)에 lastShown skip 포함.
 */

export interface RetryNoteKey {
  key: string;
  octave: string;
  accidental?: "#" | "b";
  clef: "treble" | "bass";
}

interface RetryEntry {
  id: string;
  note: RetryNoteKey;
  scheduledAtTurn: number;
  missCount: number;
}

export function composeId(n: RetryNoteKey): string {
  const acc = n.accidental ?? "";
  return `${n.clef}:${n.key}${acc}${n.octave}`;
}

export class SimRetryQueue {
  private q = new Map<string, RetryEntry>();
  private miss = new Map<string, number>();
  private ja: { id: string; turn: number } | null = null;

  get size(): number {
    return this.q.size;
  }

  markMissed(note: RetryNoteKey): void {
    const id = composeId(note);
    const newMiss = (this.miss.get(id) ?? 0) + 1;
    this.miss.set(id, newMiss);
    this.q.set(id, {
      id,
      note,
      scheduledAtTurn: Number.MAX_SAFE_INTEGER,
      missCount: newMiss,
    });
  }

  rescheduleAfterCorrect(note: RetryNoteKey, currentTurn: number): void {
    const id = composeId(note);
    const existing = this.q.get(id);
    if (!existing) return;
    this.q.set(id, { ...existing, scheduledAtTurn: currentTurn + 2 });
  }

  resolve(note: RetryNoteKey): void {
    const id = composeId(note);
    this.miss.delete(id);
    this.q.delete(id);
  }

  markJustAnswered(note: RetryNoteKey, currentTurn: number): void {
    this.ja = { id: composeId(note), turn: currentTurn };
  }

  popDueOrNull(
    currentTurn: number,
    lastShown?: RetryNoteKey | null,
  ): RetryNoteKey | null {
    const lastId = lastShown ? composeId(lastShown) : null;
    let bestId: string | null = null;
    let bestTurn = Infinity;
    for (const [id, entry] of this.q) {
      if (this.ja && id === this.ja.id && currentTurn - this.ja.turn <= 1) continue;
      if (lastId && id === lastId) continue;
      if (entry.scheduledAtTurn <= currentTurn && entry.scheduledAtTurn < bestTurn) {
        bestId = id;
        bestTurn = entry.scheduledAtTurn;
      }
    }
    if (!bestId) return null;
    const entry = this.q.get(bestId)!;
    this.q.delete(bestId);
    return entry.note;
  }

  reset(): void {
    this.q.clear();
    this.miss.clear();
    this.ja = null;
  }

  has(note: RetryNoteKey): boolean {
    return this.q.has(composeId(note));
  }

  /** 디버그용: 마커가 등록된 turn (pendingScheduleTurn). 통계 분석에 활용 가능. */
  getMissCount(note: RetryNoteKey): number {
    return this.miss.get(composeId(note)) ?? 0;
  }
}
