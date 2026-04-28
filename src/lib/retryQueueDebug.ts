// [§0.1 DEBUG] — TEMPORARY retry queue tracing for §0.1 N+2 fix verification.
// 출시 전 제거 필요 — PENDING_BACKLOG §0.1 cleanup 항목 참고.
//
// 모든 export는 import.meta.env.DEV 게이트로 production build에서 no-op.
// 제거 시:
//   1. 이 파일 삭제
//   2. NoteGame.tsx에서 `// [§0.1 DEBUG]` 마커 grep으로 모두 제거
//   3. SHOW_RETRY_DEBUG 처리(현재 isAdminOrDev로 활성화) 원복

const enabled = import.meta.env.DEV;

interface NoteLike {
  key: string;
  octave: string;
  accidental?: "#" | "b";
  clef?: "treble" | "bass";
}

interface RetryEntrySnap {
  id: string;
  missCount: number;
  scheduledAtTurn: number;
}

function fmtNote(n: NoteLike | null | undefined): string {
  if (!n) return "null";
  const acc = n.accidental ?? "";
  const clef = n.clef ? `:${n.clef[0]}` : "";
  return `${n.key}${acc}${n.octave}${clef}`;
}

function fmtSnapshot(snapshot: RetryEntrySnap[]): string {
  if (snapshot.length === 0) return "[]";
  return (
    "[" +
    snapshot
      .map((e) => {
        const due =
          e.scheduledAtTurn === Number.MAX_SAFE_INTEGER
            ? "MAX"
            : String(e.scheduledAtTurn);
        return `${e.id}:miss=${e.missCount},due=${due}`;
      })
      .join(", ") +
    "]"
  );
}

export function logMarkMissed(
  turn: number,
  note: NoteLike,
  queueAfter: RetryEntrySnap[],
): void {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.log(
    `%c[TURN ${turn}] markMissed(${fmtNote(note)}) due=MAX queue=${fmtSnapshot(queueAfter)}`,
    "color:#dc2626;font-weight:bold",
  );
}

export function logMarkJustAnswered(turn: number, note: NoteLike): void {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.log(
    `%c[TURN ${turn}] markJustAnswered(${fmtNote(note)}) — 옵션 B 1턴 가드`,
    "color:#0891b2;font-weight:bold",
  );
}

export function logRescheduleAfterCorrect(
  turn: number,
  note: NoteLike,
  newDue: number,
  queueAfter: RetryEntrySnap[],
): void {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.log(
    `%c[TURN ${turn}] correct ${fmtNote(note)} → rescheduleAfterCorrect(${fmtNote(note)}, ${turn}) due=${newDue} queue=${fmtSnapshot(queueAfter)}`,
    "color:#16a34a;font-weight:bold",
  );
}

export function logResolveRetry(turn: number, note: NoteLike): void {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.log(
    `%c[TURN ${turn}] correct ${fmtNote(note)} (RETRY) → resolve(${fmtNote(note)}) — 영구 제거 (12=P)`,
    "color:#16a34a;font-weight:bold",
  );
}

export function logPrepareNextTurn(
  turn: number,
  queueSizeBefore: number,
  popped: NoteLike | null,
  displayed: NoteLike | null,
  fromBatchIndex: number | null,
): void {
  if (!enabled) return;
  const popDesc = popped
    ? `popDueOrNull(${turn})=${fmtNote(popped)} RETRY ✨`
    : `popDueOrNull(${turn})=null`;
  const source =
    popped != null
      ? "retry override"
      : fromBatchIndex != null
        ? `batch[${fromBatchIndex}]`
        : "(no display)";
  // eslint-disable-next-line no-console
  console.log(
    `%c[TURN ${turn}] prepareNextTurn (qsize=${queueSizeBefore}) → ${popDesc} → ${source}=${fmtNote(displayed)}`,
    "color:#7c3aed;font-weight:bold",
  );
}

export function logCrossBatchDedupTrigger(
  turn: number,
  attempted: NoteLike,
  lastShown: NoteLike,
): void {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.log(
    `%c[TURN ${turn}] cross-batch dedup re-pick (옵션 D): batch[0] would be ${fmtNote(attempted)} but matches lastShown ${fmtNote(lastShown)}`,
    "color:#ea580c",
  );
}
