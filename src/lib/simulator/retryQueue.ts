/**
 * Simulator-internal RetryQueue.
 *
 * useRetryQueue.ts의 React-free 버전. 1만 게임 fuzz 시뮬레이션용.
 * 동일한 로직을 plain class로 복제 — production hook과 동기화 유지에 주의.
 *
 * §0.1 정책 검증을 위해 popDueOrNull(turn, lastShown?)에 lastShown skip 포함.
 *
 * §4 Step B (2026-05-02): logger 옵셔널 통합. 큐 변경 시점만 snapshot (size + ID 리스트).
 */
import type { SimLogger, QueueSnapshot } from "./simLogger";

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

export interface SimRetryQueueOpts {
  logger?: SimLogger | null;
  session?: number;
}

export class SimRetryQueue {
  private q = new Map<string, RetryEntry>();
  private miss = new Map<string, number>();
  private ja: { id: string; turn: number } | null = null;
  private logger: SimLogger | null;
  private session: number;

  constructor(opts: SimRetryQueueOpts = {}) {
    this.logger = opts.logger ?? null;
    this.session = opts.session ?? 0;
  }

  private snapshot(): QueueSnapshot {
    return { size: this.q.size, ids: Array.from(this.q.keys()) };
  }

  get size(): number {
    return this.q.size;
  }

  markMissed(note: RetryNoteKey, currentTurn: number = 0): void {
    const id = composeId(note);
    const newMiss = (this.miss.get(id) ?? 0) + 1;
    this.miss.set(id, newMiss);
    // §4 fix (2026-05-01): 큐에 reschedule된 due 보존 — useRetryQueue.ts와 parity.
    const existing = this.q.get(id);
    const scheduledAtTurn = existing?.scheduledAtTurn ?? Number.MAX_SAFE_INTEGER;
    this.q.set(id, { id, note, scheduledAtTurn, missCount: newMiss });
    this.logger?.log({
      kind: "mark-missed",
      turn: currentTurn,
      session: this.session,
      payload: {
        noteId: id,
        missCount: newMiss,
        duePreserved: existing != null,
        scheduledAtTurn,
        queue: this.snapshot(),
      },
    });
  }

  rescheduleAfterCorrect(note: RetryNoteKey, currentTurn: number): void {
    const id = composeId(note);
    const existing = this.q.get(id);
    if (!existing) return;
    const newDue = currentTurn + 2;
    this.q.set(id, { ...existing, scheduledAtTurn: newDue });
    this.logger?.log({
      kind: "reschedule-after-correct",
      turn: currentTurn,
      session: this.session,
      payload: {
        noteId: id,
        scheduledAtTurn: newDue,
        queue: this.snapshot(),
      },
    });
  }

  resolve(note: RetryNoteKey, currentTurn: number = 0, source: "main" | "final-retry" = "main"): void {
    const id = composeId(note);
    const had = this.q.has(id);
    this.miss.delete(id);
    this.q.delete(id);
    this.logger?.log({
      kind: "resolve",
      turn: currentTurn,
      session: this.session,
      payload: {
        noteId: id,
        source,
        wasInQueue: had,
        queue: this.snapshot(),
      },
    });
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
    let skippedJustAnswered = false;
    let skippedLastShown = false;
    for (const [id, entry] of this.q) {
      if (this.ja && id === this.ja.id && currentTurn - this.ja.turn <= 1) {
        skippedJustAnswered = true;
        continue;
      }
      if (lastId && id === lastId) {
        skippedLastShown = true;
        continue;
      }
      if (entry.scheduledAtTurn <= currentTurn && entry.scheduledAtTurn < bestTurn) {
        bestId = id;
        bestTurn = entry.scheduledAtTurn;
      }
    }
    if (!bestId) {
      this.logger?.log({
        kind: "pop-due",
        turn: currentTurn,
        session: this.session,
        payload: {
          popped: null,
          lastShownId: lastId,
          skippedJustAnswered,
          skippedLastShown,
          queue: this.snapshot(),
        },
      });
      return null;
    }
    const entry = this.q.get(bestId)!;
    this.q.delete(bestId);
    this.logger?.log({
      kind: "pop-due",
      turn: currentTurn,
      session: this.session,
      payload: {
        popped: bestId,
        scheduledAtTurn: entry.scheduledAtTurn,
        lastShownId: lastId,
        skippedJustAnswered,
        skippedLastShown,
        queue: this.snapshot(),
      },
    });
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
