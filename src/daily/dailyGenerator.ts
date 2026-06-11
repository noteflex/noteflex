// Daily Challenge — 날짜 시드 결정론 출제기.
// 전원 동일한 25문제 / 같은 날(로컬 자정 기준) 새로고침·다른 기기 동일.
// 5턴 × 5문제 = 25. 한 턴은 한 카테고리로 묶고, 같은 턴 5문제는 보표에 동시 표시.
//   턴1 = treble in-staff 단일 보표 (5)
//   턴2 = bass in-staff 단일 보표 (5)
//   턴3 = ledger 그랜드, treble·bass 양쪽 덧줄 혼합 (5)
//   턴4 = ledger 그랜드, treble·bass 양쪽 덧줄 혼합 (5, 분배 비율 반전)
//   턴5 = keysig 그랜드 (조표 표시 + 영향 음 2 + 비영향 음 3, 5)

import type {
  DailyQuestion,
  DailyKeySignature,
  DailyLetter,
  DailyClef,
} from "./dailyTypes";

export const TOTAL_TURNS = 5;
export const NOTES_PER_TURN = 5;
export const TOTAL_QUESTIONS = TOTAL_TURNS * NOTES_PER_TURN;

/**
 * 로컬 시간(YYYY-MM-DD) — 데일리 리셋이 현지 자정과 일치.
 * 3단계 스트릭과 일관성 유지.
 */
export function getDailySeedKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── 결정론 PRNG (FNV-1a 32 hash + mulberry32) ────────────────────
function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** batch 내 인접 중복 회피 — pool에서 마지막 음과 다른 음을 pick. */
function pickDistinctFromLast<T extends { letter: DailyLetter; octave: number }>(
  rng: () => number,
  pool: readonly T[],
  last: T | null,
): T {
  if (!last || pool.length === 1) return pick(rng, pool);
  for (let attempts = 0; attempts < 30; attempts++) {
    const cand = pick(rng, pool);
    if (cand.letter !== last.letter || cand.octave !== last.octave) return cand;
  }
  return pick(rng, pool);
}

type NoteSpec = { letter: DailyLetter; octave: number };

// 오선 안 자연음 — treble (E4..F5).
const IN_STAFF_TREBLE: readonly NoteSpec[] = [
  { letter: "E", octave: 4 },
  { letter: "F", octave: 4 },
  { letter: "G", octave: 4 },
  { letter: "A", octave: 4 },
  { letter: "B", octave: 4 },
  { letter: "C", octave: 5 },
  { letter: "D", octave: 5 },
  { letter: "E", octave: 5 },
  { letter: "F", octave: 5 },
];

// 오선 안 자연음 — bass (G2..A3).
const IN_STAFF_BASS: readonly NoteSpec[] = [
  { letter: "G", octave: 2 },
  { letter: "A", octave: 2 },
  { letter: "B", octave: 2 },
  { letter: "C", octave: 3 },
  { letter: "D", octave: 3 },
  { letter: "E", octave: 3 },
  { letter: "F", octave: 3 },
  { letter: "G", octave: 3 },
  { letter: "A", octave: 3 },
];

// 덧줄 (스태프 위/아래로 벗어나는 음).
const LEDGER_TREBLE: readonly NoteSpec[] = [
  { letter: "C", octave: 4 }, // 가운데 도, 1 덧줄 아래
  { letter: "D", octave: 4 },
  { letter: "A", octave: 5 }, // 1 덧줄 위
  { letter: "B", octave: 5 },
  { letter: "C", octave: 6 }, // 2 덧줄 위
];

const LEDGER_BASS: readonly NoteSpec[] = [
  { letter: "E", octave: 2 }, // 1 덧줄 아래
  { letter: "F", octave: 2 },
  { letter: "B", octave: 3 }, // 위로 벗어남
  { letter: "C", octave: 4 }, // 1 덧줄 위 (가운데 도)
  { letter: "D", octave: 4 },
];

// 조표 풀. 턴4에 사용.
const KEY_SIG_POOL: readonly DailyKeySignature[] = [
  { name: "G major", sharps: ["F"] },
  { name: "D major", sharps: ["F", "C"] },
  { name: "A major", sharps: ["F", "C", "G"] },
  { name: "F major", flats: ["B"] },
  { name: "Bb major", flats: ["B", "E"] },
  { name: "Eb major", flats: ["B", "E", "A"] },
];

const NO_KEY_SIG: DailyKeySignature = { name: "C major" };

function accFor(letter: DailyLetter, key: DailyKeySignature): "#" | "b" | null {
  if (key.sharps?.includes(letter)) return "#";
  if (key.flats?.includes(letter)) return "b";
  return null;
}

function isInTreble(n: NoteSpec): boolean {
  return IN_STAFF_TREBLE.some(
    (t) => t.letter === n.letter && t.octave === n.octave,
  );
}

/**
 * 결정론 출제 — 같은 dateKey면 어디서나 같은 문제 묶음.
 * 턴별 5문제씩 묶어 반환.
 */
export function generateDailyQuestions(dateKey: string): DailyQuestion[] {
  const rng = mulberry32(hashSeed(dateKey));
  const out: DailyQuestion[] = [];

  // ── 턴1: treble 5 (인접 중복 회피) ──
  {
    const pool = shuffle(rng, IN_STAFF_TREBLE);
    let last: NoteSpec | null = null;
    for (let i = 0; i < NOTES_PER_TURN; i++) {
      const n = pickDistinctFromLast(rng, pool, last);
      last = n;
      out.push({
        index: 0,
        turn: 0,
        category: "treble",
        clef: "treble",
        letter: n.letter,
        octave: n.octave,
        accidental: null,
        keySignature: NO_KEY_SIG,
      });
    }
  }

  // ── 턴2: bass 5 ──
  {
    const pool = shuffle(rng, IN_STAFF_BASS);
    let last: NoteSpec | null = null;
    for (let i = 0; i < NOTES_PER_TURN; i++) {
      const n = pickDistinctFromLast(rng, pool, last);
      last = n;
      out.push({
        index: 0,
        turn: 1,
        category: "bass",
        clef: "bass",
        letter: n.letter,
        octave: n.octave,
        accidental: null,
        keySignature: NO_KEY_SIG,
      });
    }
  }

  // ── 턴3·4: ledger 그랜드, 양쪽 덧줄 골고루. 분배는 한쪽 3+2, 다른쪽 2+3. ──
  {
    const trebleFirstIsThree = rng() < 0.5; // T3가 treble 3·bass 2면 T4는 2·3 (혹은 반대)
    const splits: Array<[number, number]> = trebleFirstIsThree
      ? [[3, 2], [2, 3]]
      : [[2, 3], [3, 2]];
    for (let t = 0; t < 2; t++) {
      const [trebleCount, bassCount] = splits[t];
      const trebleShuffled = shuffle(rng, LEDGER_TREBLE);
      const bassShuffled = shuffle(rng, LEDGER_BASS);
      const turn: { spec: NoteSpec; clef: DailyClef }[] = [];
      for (let i = 0; i < trebleCount; i++) {
        turn.push({ spec: trebleShuffled[i % trebleShuffled.length], clef: "treble" });
      }
      for (let i = 0; i < bassCount; i++) {
        turn.push({ spec: bassShuffled[i % bassShuffled.length], clef: "bass" });
      }
      const ordered = shuffle(rng, turn);
      // 인접 중복 회피 — 같은 clef·letter·octave가 연속이면 한 칸 뒤로.
      for (let i = 1; i < ordered.length; i++) {
        const prev = ordered[i - 1];
        const cur = ordered[i];
        if (
          prev.clef === cur.clef &&
          prev.spec.letter === cur.spec.letter &&
          prev.spec.octave === cur.spec.octave &&
          i + 1 < ordered.length
        ) {
          [ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]];
        }
      }
      for (const p of ordered) {
        out.push({
          index: 0,
          turn: 2 + t,
          category: "ledger",
          clef: p.clef,
          letter: p.spec.letter,
          octave: p.spec.octave,
          accidental: null,
          keySignature: NO_KEY_SIG,
        });
      }
    }
  }

  // ── 턴5: keysig 5 (영향 음 2 + 비영향 음 3) ──
  {
    const keySig = pick(rng, KEY_SIG_POOL);
    const affectedLetters = new Set<DailyLetter>([
      ...((keySig.sharps ?? []) as DailyLetter[]),
      ...((keySig.flats ?? []) as DailyLetter[]),
    ]);
    const allInStaff: NoteSpec[] = [...IN_STAFF_TREBLE, ...IN_STAFF_BASS];
    const affectedAvail = shuffle(
      rng,
      allInStaff.filter((n) => affectedLetters.has(n.letter)),
    );
    const unaffectedAvail = shuffle(
      rng,
      allInStaff.filter((n) => !affectedLetters.has(n.letter)),
    );

    const picks: NoteSpec[] = [];
    for (let i = 0; i < 2 && i < affectedAvail.length; i++) picks.push(affectedAvail[i]);
    for (let i = 0; i < 3 && i < unaffectedAvail.length; i++) picks.push(unaffectedAvail[i]);
    while (picks.length < NOTES_PER_TURN) picks.push(pick(rng, allInStaff));

    const ordered = shuffle(rng, picks);
    for (const p of ordered) {
      out.push({
        index: 0,
        turn: 4,
        category: "keysig",
        clef: isInTreble(p) ? "treble" : "bass",
        letter: p.letter,
        octave: p.octave,
        accidental: accFor(p.letter, keySig),
        keySignature: keySig,
      });
    }
  }

  return out
    .slice(0, TOTAL_QUESTIONS)
    .map((q, i) => ({ ...q, index: i }));
}

/** 생성된 평탄 배열을 turn별로 묶어서 반환. */
export function groupByTurn(questions: DailyQuestion[]): DailyQuestion[][] {
  const turns: DailyQuestion[][] = Array.from({ length: TOTAL_TURNS }, () => []);
  for (const q of questions) {
    if (q.turn >= 0 && q.turn < TOTAL_TURNS) turns[q.turn].push(q);
  }
  return turns;
}

/** 문제의 정답 문자열 (DailyButtons 답안 형식과 동일: "C" | "F#" | "Bb"). */
export function answerOf(q: DailyQuestion): string {
  return q.accidental ? `${q.letter}${q.accidental}` : q.letter;
}

/** 사운드 키 ("C4" | "F#4" | "Bb3"). */
export function soundKeyOf(q: DailyQuestion): string {
  return q.accidental ? `${q.letter}${q.accidental}${q.octave}` : `${q.letter}${q.octave}`;
}
