/**
 * Canonical note data structure for OMR (Optical Music Recognition).
 * This is the exact JSON format the AI Vision API must return.
 *
 * Example API response:
 * {
 *   "notes": [
 *     { "key": "C", "octave": "4" },
 *     { "key": "E", "octave": "4", "accidental": "#" },
 *     { "key": "G", "octave": "4" },
 *     { "key": "B", "octave": "4", "accidental": "b" }
 *   ]
 * }
 */

export type Accidental = "#" | "b";

export interface OMRNote {
  /** Note letter: C, D, E, F, G, A, B */
  key: string;
  /** Octave number as string: "1" through "7" */
  octave: string;
  /** Optional accidental: "#" for sharp, "b" for flat */
  accidental?: Accidental;
}

/** Internal game note type (extends OMR with display info) */
export interface GameNote extends OMRNote {
  /** Korean solfège name: 도, 레, 미, 파, 솔, 라, 시 */
  name: string;
  /** Y position on staff (computed at render time) */
  y: number;
}

const KOREAN_NAMES: Record<string, string> = {
  C: "도", D: "레", E: "미", F: "파", G: "솔", A: "라", B: "시",
};

/** Convert OMR notes (from AI or manual input) to GameNote[] */
export function omrToGameNotes(notes: OMRNote[]): GameNote[] {
  return notes.map((n) => ({
    key: n.key,
    octave: n.octave,
    name: KOREAN_NAMES[n.key] || n.key,
    y: 0,
    ...(n.accidental ? { accidental: n.accidental } : {}),
  }));
}

/**
 * Parse a manual note string into OMR notes.
 * Accepted formats: "C4, E4, G4#, Bb3, F#5"
 * Each token: <NoteLetter>[#|b]<Octave> or <NoteLetter><Octave>[#|b]
 */
export function parseNoteString(input: string): OMRNote[] {
  const tokens = input.split(/[,\s]+/).filter(Boolean);
  const notes: OMRNote[] = [];

  for (const token of tokens) {
    const trimmed = token.trim().toUpperCase();
    // Match: C4, C#4, Cb4, C4#, C4b
    const match = trimmed.match(/^([A-G])([#B]?)(\d)([#B]?)$/);
    if (!match) continue;

    const key = match[1];
    const acc1 = match[2];
    const octave = match[3];
    const acc2 = match[4];

    const rawAcc = acc1 || acc2;
    const accidental: Accidental | undefined =
      rawAcc === "#" ? "#" : rawAcc === "B" ? "b" : undefined;

    notes.push({ key, octave, ...(accidental ? { accidental } : {}) });
  }

  return notes;
}
