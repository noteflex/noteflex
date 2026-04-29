import { useCallback, useRef, useState } from "react";

/**
 * 세션 내 n+2 재출제 큐.
 *
 * 규칙:
 *  - 오답 1회차 → 2턴 뒤 재등장 (기본 n+2)
 *  - 오답 2회차 → 1턴 뒤 재등장 (단축)
 *  - 오답 3회차 → 즉시 다음 턴 (강제 교정)
 *  - 정답 시 큐에서 제거
 *
 * 식별자: note_key + octave + accidental + clef 조합으로 유일화 (같은 음이라도
 * 성부/옥타브가 다르면 다른 문제로 취급).
 *
 * 세트/스테이지 전환 시 큐는 유지된다 (같은 세션 = 같은 사용자 의도).
 * 게임오버/성공/리플레이 시에는 reset()을 호출해 초기화한다.
 */

export interface RetryNoteKey {
  key: string; // "C", "D", "F#", ...
  octave: string; // "4"
  accidental?: "#" | "b";
  clef: "treble" | "bass";
}

interface RetryEntry {
  id: string; // composed key
  note: RetryNoteKey;
  scheduledAtTurn: number; // currentTurn + N
  missCount: number; // 1, 2, 3...
}

function composeId(n: RetryNoteKey): string {
  const acc = n.accidental ?? "";
  return `${n.clef}:${n.key}${acc}${n.octave}`;
}

// 오답 횟수에 따른 간격
function intervalFor(missCount: number): number {
  if (missCount <= 1) return 2; // 첫 오답: n+2
  if (missCount === 2) return 1; // 재오답: n+1
  return 0; // 3회 이상: 즉시 다음 턴
}

export interface UseRetryQueueReturn {
  /** 현재 큐에 쌓인 항목 수 (디버그용) */
  size: number;
  /** 디버그용: 큐 스냅샷 */
  snapshot: RetryEntry[];
  /** 오답 발생 → 큐에 등록 또는 기존 항목 업데이트 (legacy API: due = currentTurn+interval) */
  scheduleRetry: (note: RetryNoteKey, currentTurn: number) => void;
  /**
   * 신규 정책용: 오답 시 마커만 등록 (같은 자리 유지 정책에서는 due가 의미 없음).
   * missCount +1, scheduledAtTurn = MAX_SAFE_INTEGER (정답 시 갱신될 때까지 popping 안 됨).
   */
  markMissed: (note: RetryNoteKey) => void;
  /**
   * 신규 정책용: 큐에 마커가 있던 음표를 정답 처리하면 due를 N+2 후로 갱신.
   * 마커가 없으면 no-op (오답 이력 없는 음표는 큐에 안 들어감 — 해석 11=X).
   */
  rescheduleAfterCorrect: (note: RetryNoteKey, currentTurn: number) => void;
  /** 정답 시 해당 음표 큐에서 제거 */
  resolve: (note: RetryNoteKey) => void;
  /**
   * 옵션 B: 방금 정답한 음표를 1턴 동안 popDueOrNull 대상에서 제외.
   * markedTurn 기준으로 currentTurn === markedTurn 또는 currentTurn === markedTurn+1
   * 일 때만 블록. 그 이후 턴부터는 자동 만료. §0.1 N+2 즉시 등장 버그 보조 안전장치.
   */
  markJustAnswered: (note: RetryNoteKey, currentTurn: number) => void;
  /**
   * 현재 턴에 출제 예정인 항목 반환 (있으면 꺼내고 큐에서 제거).
   * lastShownNote가 주어지면 해당 ID는 skip (전역 dedup §0.1 정책).
   * 모든 due 후보가 lastShownNote와 일치하면 null 반환 → caller가 일반 batch[0]로 fallback.
   */
  popDueOrNull: (
    currentTurn: number,
    lastShownNote?: RetryNoteKey | null,
  ) => RetryNoteKey | null;
  /** 세션 초기화 (게임오버/리플레이/신규 세션) */
  reset: () => void;
  /** 특정 음표가 큐에 있는지 확인 (디버그) */
  has: (note: RetryNoteKey) => boolean;
}

export function useRetryQueue(): UseRetryQueueReturn {
  // 활성 큐: 현재 재출제 대기 중인 항목
  const queueRef = useRef<Map<string, RetryEntry>>(new Map());

  // 누적 오답 카운터: pop되어도 resolve 전까지 유지
  // (같은 음표를 pop 후 또 틀렸을 때 missCount가 제대로 누적되도록)
  const missCountRef = useRef<Map<string, number>>(new Map());

  // 옵션 B: 방금 정답한 음표 1턴 pop 제외 마커
  const justAnsweredRef = useRef<{ id: string; turn: number } | null>(null);

  // 디버그 패널용으로 크기·스냅샷만 state에 반영
  const [size, setSize] = useState(0);
  const [snapshot, setSnapshot] = useState<RetryEntry[]>([]);

  const syncDebug = useCallback(() => {
    const list = Array.from(queueRef.current.values()).sort(
      (a, b) => a.scheduledAtTurn - b.scheduledAtTurn
    );
    setSize(list.length);
    setSnapshot(list);
  }, []);

  const scheduleRetry = useCallback(
    (note: RetryNoteKey, currentTurn: number) => {
      const id = composeId(note);
      // 누적 missCount 사용 (queueRef에서 사라진 뒤에도 유지됨)
      const prevMissCount = missCountRef.current.get(id) ?? 0;
      const newMissCount = prevMissCount + 1;
      missCountRef.current.set(id, newMissCount);

      const interval = intervalFor(newMissCount);
      const entry: RetryEntry = {
        id,
        note,
        scheduledAtTurn: currentTurn + interval,
        missCount: newMissCount,
      };
      queueRef.current.set(id, entry);
      syncDebug();
    },
    [syncDebug]
  );

  const markMissed = useCallback(
    (note: RetryNoteKey) => {
      const id = composeId(note);
      const prevMissCount = missCountRef.current.get(id) ?? 0;
      const newMissCount = prevMissCount + 1;
      missCountRef.current.set(id, newMissCount);

      const entry: RetryEntry = {
        id,
        note,
        scheduledAtTurn: Number.MAX_SAFE_INTEGER,
        missCount: newMissCount,
      };
      queueRef.current.set(id, entry);
      syncDebug();
    },
    [syncDebug]
  );

  const rescheduleAfterCorrect = useCallback(
    (note: RetryNoteKey, currentTurn: number) => {
      const id = composeId(note);
      const existing = queueRef.current.get(id);
      if (!existing) return; // 오답 이력 없음 (해석 11=X) → no-op

      const updated: RetryEntry = {
        ...existing,
        scheduledAtTurn: currentTurn + 2,
      };
      queueRef.current.set(id, updated);
      syncDebug();
    },
    [syncDebug]
  );

  const resolve = useCallback(
    (note: RetryNoteKey) => {
      const id = composeId(note);
      // 정답이면 누적 오답 기록도 초기화 (다음에 또 틀리면 1회차부터)
      const hadMiss = missCountRef.current.delete(id);
      const wasInQueue = queueRef.current.delete(id);
      if (hadMiss || wasInQueue) {
        syncDebug();
      }
    },
    [syncDebug]
  );

  const markJustAnswered = useCallback(
    (note: RetryNoteKey, currentTurn: number) => {
      justAnsweredRef.current = { id: composeId(note), turn: currentTurn };
    },
    []
  );

  const popDueOrNull = useCallback(
    (
      currentTurn: number,
      lastShownNote?: RetryNoteKey | null,
    ): RetryNoteKey | null => {
      const ja = justAnsweredRef.current;
      const lastId = lastShownNote ? composeId(lastShownNote) : null;
      // scheduledAtTurn이 작은 것 우선 (가장 오래 기다린 것)
      let bestId: string | null = null;
      let bestTurn = Infinity;
      for (const [id, entry] of queueRef.current) {
        // 옵션 B: 방금 정답한 음표는 markedTurn 또는 markedTurn+1 턴에선 skip
        if (ja && id === ja.id && currentTurn - ja.turn <= 1) continue;
        // §0.1 전역 dedup: 직전 표시 음표와 같은 ID skip (1턴 지연 fallback)
        if (lastId && id === lastId) continue;
        if (entry.scheduledAtTurn <= currentTurn && entry.scheduledAtTurn < bestTurn) {
          bestId = id;
          bestTurn = entry.scheduledAtTurn;
        }
      }
      if (!bestId) return null;
      const entry = queueRef.current.get(bestId)!;
      queueRef.current.delete(bestId);
      syncDebug();
      return entry.note;
    },
    [syncDebug]
  );

  const reset = useCallback(() => {
    queueRef.current.clear();
    missCountRef.current.clear();
    justAnsweredRef.current = null;
    syncDebug();
  }, [syncDebug]);

  const has = useCallback((note: RetryNoteKey): boolean => {
    return queueRef.current.has(composeId(note));
  }, []);

  return {
    size,
    snapshot,
    scheduleRetry,
    markMissed,
    rescheduleAfterCorrect,
    resolve,
    markJustAnswered,
    popDueOrNull,
    reset,
    has,
  };
}