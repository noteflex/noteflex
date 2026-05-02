/**
 * §4 Step B — Simulator event logger.
 *
 * 시뮬레이터 모든 이벤트를 JSON Lines 형식으로 기록 → 분석 스크립트가 invariant 검증.
 * 메모리 백엔드 (in-memory array) + 파일 백엔드 (JSONL append) 지원.
 *
 * 정책 (Q-B3 결정 2026-05-02):
 *  - 큐 snapshot은 markMissed/rescheduleAfterCorrect/popDueOrNull/resolve 4개 시점만.
 *  - snapshot 형식: { size, ids: string[], dueByQuery?: number[] }.
 *  - 매 이벤트 큐 전체 entries 직렬화 X (용량 폭증 방지).
 *
 * 호환성:
 *  - simulateGame({ ..., logger? }) 옵셔널 — 미지정 시 logger 호출 X (기존 호환).
 *  - SimRetryQueue 생성자 logger? 옵셔널.
 */
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SimEventKind =
  | "session-start"
  | "session-end"
  | "phase-transition"
  | "stage-transition"
  | "compose-batch"
  | "compose-final-retry-batch"
  | "note-shown"
  | "answer-correct"
  | "answer-wrong"
  | "mark-missed"
  | "reschedule-after-correct"
  | "pop-due"
  | "resolve"
  | "lives-change";

export interface QueueSnapshot {
  size: number;
  ids: string[];
}

export interface SimLogEvent {
  kind: SimEventKind;
  turn: number;
  /** session 식별자 — runMany 내 다중 게임 구분용 */
  session: number;
  /** 이벤트별 페이로드 (kind에 따라 필드 다름) */
  payload: Record<string, unknown>;
}

export interface SimLogSession {
  session: number;
  level: number;
  sublevel: number;
  scenario: string;
  correctRate?: number;
  seed: number;
}

/**
 * 로거 인터페이스 — game.ts/retryQueue.ts가 의존하는 추상.
 * 구현체: MemorySimLogger (테스트용), FileSimLogger (대용량 fuzz용).
 */
export interface SimLogger {
  startSession(meta: SimLogSession): void;
  endSession(
    session: number,
    turn: number,
    result: { endReason: string; lives: number; missedRemaining: number },
  ): void;
  log(event: SimLogEvent): void;
  /** drain — 파일 logger는 flush, memory logger는 events 반환 */
  flush(): SimLogEvent[];
}

// ─────────────────────────────────────────────
// MemorySimLogger — 단위 테스트·소규모 fuzz용
// ─────────────────────────────────────────────

export class MemorySimLogger implements SimLogger {
  private events: SimLogEvent[] = [];
  private sessions: SimLogSession[] = [];

  startSession(meta: SimLogSession): void {
    this.sessions.push(meta);
    this.events.push({
      kind: "session-start",
      turn: 0,
      session: meta.session,
      payload: { ...meta },
    });
  }

  endSession(
    session: number,
    turn: number,
    result: { endReason: string; lives: number; missedRemaining: number },
  ): void {
    this.events.push({
      kind: "session-end",
      turn,
      session,
      payload: { ...result },
    });
  }

  log(event: SimLogEvent): void {
    this.events.push(event);
  }

  flush(): SimLogEvent[] {
    return this.events.slice();
  }

  getSessions(): SimLogSession[] {
    return this.sessions.slice();
  }
}

// ─────────────────────────────────────────────
// FileSimLogger — 대용량 fuzz용 (JSONL append)
// ─────────────────────────────────────────────

export class FileSimLogger implements SimLogger {
  private buffer: string[] = [];
  private readonly bufferLimit: number;

  constructor(
    private readonly path: string,
    bufferLimit: number = 1000,
  ) {
    this.bufferLimit = bufferLimit;
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (existsSync(path)) writeFileSync(path, ""); // truncate
  }

  startSession(meta: SimLogSession): void {
    this.log({
      kind: "session-start",
      turn: 0,
      session: meta.session,
      payload: { ...meta },
    });
  }

  endSession(
    session: number,
    turn: number,
    result: { endReason: string; lives: number; missedRemaining: number },
  ): void {
    this.log({
      kind: "session-end",
      turn,
      session,
      payload: { ...result },
    });
    this.flushBuffer();
  }

  log(event: SimLogEvent): void {
    this.buffer.push(JSON.stringify(event));
    if (this.buffer.length >= this.bufferLimit) this.flushBuffer();
  }

  flush(): SimLogEvent[] {
    this.flushBuffer();
    return [];
  }

  private flushBuffer(): void {
    if (this.buffer.length === 0) return;
    appendFileSync(this.path, this.buffer.join("\n") + "\n");
    this.buffer = [];
  }
}

// ─────────────────────────────────────────────
// 헬퍼 — JSONL 파일 읽기 (analyze 스크립트용)
// ─────────────────────────────────────────────

export function parseLogLines(text: string): SimLogEvent[] {
  const out: SimLogEvent[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as SimLogEvent);
    } catch {
      // skip malformed
    }
  }
  return out;
}
