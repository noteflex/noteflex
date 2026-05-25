// note_key + octave → 절대 반음 수 (MIDI 유사).
// note_key 형식: "C" | "C#" | "Db" | "D" | ... (getNoteAnswer 반환값 그대로).

const NOTE_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3,
  E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8,
  Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export function noteKeyToSemitone(noteKey: string, octave: number): number | null {
  const base = NOTE_SEMITONES[noteKey];
  if (base === undefined) return null;
  return octave * 12 + base;
}
