// Daily Challenge — 자체 SVG 보표 (batch 5음 동시 표시 + 적응형 단일/그랜드).
// GrandStaffPractice와 공유 없음. 일반 게임의 batch 모드를 데일리 모듈 안에 복제.

import { useMemo } from "react";
import type { DailyClef, DailyLetter, DailyKeySignature } from "./dailyTypes";

// ── batch 음표 ──────────────────────────────────────────────────
export type DailyBatchNote = {
  letter: DailyLetter;
  octave: number;
  accidental: "#" | "b" | null;
  clef: DailyClef;
};

// ── SVG / 레이아웃 상수 (단일 staff 기준) ───────────────────────
const SVG_W = 800;
const STAFF_X1 = 30;
const STAFF_X2 = 790;
const STEP_H = 12;
const LINE_GAP = STEP_H * 2; // 24

// 단일/그랜드 모두 staff 본체 위치. 그랜드는 bass가 GRAND_BASS_YOFF만큼 아래.
const STAFF_TOP = 130;
const STAFF_BOT = STAFF_TOP + LINE_GAP * 4;
const GRAND_BASS_YOFF = 220;

const SVG_H_SINGLE = 320;
const SVG_H_GRAND = SVG_H_SINGLE + GRAND_BASS_YOFF;

const STAFF_COLOR = "#1c1917";
const TARGET_COLOR = "#b91c1c";   // 현재 답할 음
const ANSWERED_COLOR = "#9ca3af"; // 이미 답한 음
const WAITING_COLOR = "#1c1917";  // 대기 중인 음

type NoteRole = "target" | "answered" | "waiting";
function colorFor(role: NoteRole): string {
  if (role === "target") return TARGET_COLOR;
  if (role === "answered") return ANSWERED_COLOR;
  return WAITING_COLOR;
}

// SMuFL (Bravura) 글리프 — index.css에서 font-face 로딩됨.
const GLYPH_G_CLEF = "";
const GLYPH_F_CLEF = "";
const GLYPH_SHARP = "";
const GLYPH_FLAT = "";
const GLYPH_BRACE = "";

const SHARP_ORDER: readonly DailyLetter[] = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER: readonly DailyLetter[] = ["B", "E", "A", "D", "G", "C", "F"];

const SHARP_KEY_POS: Record<DailyClef, Record<DailyLetter, number>> = {
  treble: { F: 10, C: 7, G: 11, D: 8, A: 5, E: 9, B: 6 },
  bass:   { F: -4, C: -7, G: -2, D: -6, A: -9, E: -5, B: -8 },
};
const FLAT_KEY_POS: Record<DailyClef, Record<DailyLetter, number>> = {
  treble: { B: 6, E: 9, A: 5, D: 8, G: 4, C: 7, F: 3 },
  bass:   { B: -8, E: -5, A: -9, D: -6, G: -10, C: -7, F: -11 },
};

const LETTER_INDEX: Record<DailyLetter, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
};

function noteStep(letter: DailyLetter, octave: number): number {
  return (octave - 4) * 7 + LETTER_INDEX[letter];
}

function stepToY(step: number, clef: DailyClef, yOff: number): number {
  const bottomStep = clef === "treble" ? 2 : -10;
  return STAFF_BOT + yOff - (step - bottomStep) * STEP_H;
}

function getLedgerSteps(step: number, clef: DailyClef): number[] {
  const bottomStep = clef === "treble" ? 2 : -10;
  const topStep = clef === "treble" ? 10 : -2;
  const out: number[] = [];
  if (step <= bottomStep - 2) {
    const lo = step % 2 === 0 ? step : step + 1;
    for (let s = bottomStep - 2; s >= lo; s -= 2) out.push(s);
  } else if (step >= topStep + 2) {
    const hi = step % 2 === 0 ? step : step - 1;
    for (let s = topStep + 2; s <= hi; s += 2) out.push(s);
  }
  return out;
}

// ── staff 본체 렌더 ─────────────────────────────────────────────
function StaffLinesAt({ yOff }: { yOff: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={`sl-${yOff}-${i}`}
          x1={STAFF_X1}
          y1={STAFF_TOP + yOff + i * LINE_GAP}
          x2={STAFF_X2}
          y2={STAFF_TOP + yOff + i * LINE_GAP}
          stroke={STAFF_COLOR}
          strokeWidth={1.2}
        />
      ))}
    </>
  );
}

function BarlinesAt({ yOff }: { yOff: number }) {
  return (
    <>
      <line
        x1={STAFF_X1}
        y1={STAFF_TOP + yOff}
        x2={STAFF_X1}
        y2={STAFF_BOT + yOff}
        stroke={STAFF_COLOR}
        strokeWidth={2}
      />
      <line
        x1={STAFF_X2}
        y1={STAFF_TOP + yOff}
        x2={STAFF_X2}
        y2={STAFF_BOT + yOff}
        stroke={STAFF_COLOR}
        strokeWidth={2}
      />
    </>
  );
}

function ClefAt({ clef, yOff }: { clef: DailyClef; yOff: number }) {
  if (clef === "treble") {
    const g4Y = STAFF_BOT + yOff - LINE_GAP;
    return (
      <text x={STAFF_X1 + 10} y={g4Y} fontSize={96} fontFamily="Bravura, serif" fill={STAFF_COLOR}>
        {GLYPH_G_CLEF}
      </text>
    );
  }
  const f3Y = STAFF_TOP + yOff + LINE_GAP;
  return (
    <text x={STAFF_X1 + 10} y={f3Y} fontSize={96} fontFamily="Bravura, serif" fill={STAFF_COLOR}>
      {GLYPH_F_CLEF}
    </text>
  );
}

function KeySigAt({
  clef,
  yOff,
  keySig,
}: {
  clef: DailyClef;
  yOff: number;
  keySig: DailyKeySignature;
}) {
  const startX = STAFF_X1 + 95;
  const spacing = 13;
  let x = startX;
  const elements: JSX.Element[] = [];

  if (keySig.sharps && keySig.sharps.length > 0) {
    for (const letter of SHARP_ORDER) {
      if (!keySig.sharps.includes(letter)) continue;
      const step = SHARP_KEY_POS[clef][letter];
      const y = stepToY(step, clef, yOff);
      elements.push(
        <text
          key={`ks-s-${clef}-${letter}`}
          x={x}
          y={y}
          fontSize={64}
          fontFamily="Bravura, serif"
          fill={STAFF_COLOR}
        >
          {GLYPH_SHARP}
        </text>,
      );
      x += spacing;
    }
  } else if (keySig.flats && keySig.flats.length > 0) {
    for (const letter of FLAT_ORDER) {
      if (!keySig.flats.includes(letter)) continue;
      const step = FLAT_KEY_POS[clef][letter];
      const y = stepToY(step, clef, yOff);
      elements.push(
        <text
          key={`ks-f-${clef}-${letter}`}
          x={x}
          y={y}
          fontSize={64}
          fontFamily="Bravura, serif"
          fill={STAFF_COLOR}
        >
          {GLYPH_FLAT}
        </text>,
      );
      x += spacing;
    }
  }
  return <>{elements}</>;
}

function Brace({ bassYOff }: { bassYOff: number }) {
  const centerY = (STAFF_TOP + STAFF_BOT + bassYOff) / 2;
  return (
    <text
      x={STAFF_X1 - 6}
      y={centerY + 310 * 0.38 + 35}
      fontSize={310}
      fontFamily="Bravura, serif"
      fill={STAFF_COLOR}
      textAnchor="end"
    >
      {GLYPH_BRACE}
    </text>
  );
}

// ── 음표 렌더 ───────────────────────────────────────────────────
type RenderNote = {
  x: number;
  step: number;
  color: string;
  acc: "#" | "b" | null;
  clef: DailyClef;
};

function renderNote(
  rn: RenderNote,
  yOff: number,
  hasKeySignature: boolean,
  key: string,
): JSX.Element {
  const y = stepToY(rn.step, rn.clef, yOff);
  const leds = getLedgerSteps(rn.step, rn.clef);

  const bottomStep = rn.clef === "treble" ? 2 : -10;
  const topStep = rn.clef === "treble" ? 10 : -2;
  const midStep = (bottomStep + topStep) / 2;
  const stemUp = rn.step <= midStep;

  const noteheadRX = 15.5;
  const noteheadRY = 11.5;
  const noteheadRotation = -20;
  const stemLen = 7 * STEP_H;

  const rotRad = (noteheadRotation * Math.PI) / 180;
  const attachDX = noteheadRX * Math.cos(rotRad);
  const attachDY = noteheadRX * Math.sin(rotRad);

  const stemX = stemUp ? rn.x + attachDX - 0.3 : rn.x - attachDX + 0.3;
  const stemY1 = stemUp ? y + attachDY : y - attachDY;
  const midY = stepToY(midStep, rn.clef, yOff);
  const stemY2 = stemUp
    ? Math.min(y - stemLen, midY)
    : Math.max(y + stemLen, midY);

  const showInlineAcc = !hasKeySignature && rn.acc !== null;

  return (
    <g key={key}>
      {leds.map((ls) => {
        const ly = stepToY(ls, rn.clef, yOff);
        return (
          <line
            key={`led-${ls}`}
            x1={rn.x - 22}
            y1={ly}
            x2={rn.x + 22}
            y2={ly}
            stroke={rn.color}
            strokeWidth={3}
            strokeLinecap="round"
          />
        );
      })}
      <line
        x1={stemX}
        y1={stemY1}
        x2={stemX}
        y2={stemY2}
        stroke={rn.color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <ellipse
        cx={rn.x}
        cy={y}
        rx={noteheadRX}
        ry={noteheadRY}
        fill={rn.color}
        transform={`rotate(${noteheadRotation}, ${rn.x}, ${y})`}
      />
      {showInlineAcc && (
        <text
          x={rn.x - noteheadRX - 22}
          y={y + 18}
          fontSize={72}
          fontFamily="Bravura, serif"
          fill={rn.color}
        >
          {rn.acc === "#" ? GLYPH_SHARP : GLYPH_FLAT}
        </text>
      )}
    </g>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────
interface DailyStaffProps {
  notes: DailyBatchNote[];
  activeIndex: number;
  keySignature: DailyKeySignature;
  /** 카운트다운 중에는 음표만 숨김 (staff/clef/조표는 유지) → 마운트 안정. */
  notesHidden?: boolean;
}

export function DailyStaff({
  notes,
  activeIndex,
  keySignature,
  notesHidden = false,
}: DailyStaffProps) {
  const clefsInBatch = useMemo(() => {
    const s = new Set<DailyClef>();
    for (const n of notes) s.add(n.clef);
    return s;
  }, [notes]);
  const isGrand = clefsInBatch.has("treble") && clefsInBatch.has("bass");
  const soloClef: DailyClef = clefsInBatch.has("bass") && !clefsInBatch.has("treble")
    ? "bass"
    : "treble";

  const keySigCount = (keySignature.sharps?.length ?? 0) + (keySignature.flats?.length ?? 0);
  const hasKeySignature = keySigCount > 0;

  // §C1 M-등분 슬롯 — batch.length로 고정 분할.
  const M = Math.max(1, notes.length);
  const keySigEndX = STAFF_X1 + 95 + keySigCount * 13;
  const baseNoteStartX = Math.max(180, hasKeySignature ? keySigEndX + 50 : 180);
  const effectiveWidth = STAFF_X2 - baseNoteStartX;
  const segmentWidth = effectiveWidth / M;
  const slotX = (i: number) => baseNoteStartX + segmentWidth * (i + 0.25);

  // 색상 결정 (target / answered / waiting).
  const renderNotes: RenderNote[] = useMemo(() => {
    return notes.map((n, i) => {
      const role: NoteRole =
        i < activeIndex ? "answered" : i === activeIndex ? "target" : "waiting";
      return {
        x: slotX(i),
        step: noteStep(n.letter, n.octave),
        color: colorFor(role),
        acc: n.accidental,
        clef: n.clef,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, activeIndex, M, hasKeySignature, baseNoteStartX]);

  const svgH = isGrand ? SVG_H_GRAND : SVG_H_SINGLE;

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      style={{
        background: "#ffffff",
        paddingBottom: `${(svgH / SVG_W) * 100}%`,
      }}
    >
      <svg
        viewBox={`0 0 ${SVG_W} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      >
        {isGrand ? (
          <>
            {/* Treble */}
            <StaffLinesAt yOff={0} />
            <BarlinesAt yOff={0} />
            <ClefAt clef="treble" yOff={0} />
            {hasKeySignature && <KeySigAt clef="treble" yOff={0} keySig={keySignature} />}

            {/* Bass */}
            <StaffLinesAt yOff={GRAND_BASS_YOFF} />
            <BarlinesAt yOff={GRAND_BASS_YOFF} />
            <ClefAt clef="bass" yOff={GRAND_BASS_YOFF} />
            {hasKeySignature && (
              <KeySigAt clef="bass" yOff={GRAND_BASS_YOFF} keySig={keySignature} />
            )}

            {/* 좌측 두 staff 연결 + 중괄호 */}
            <line
              x1={STAFF_X1}
              y1={STAFF_TOP}
              x2={STAFF_X1}
              y2={STAFF_BOT + GRAND_BASS_YOFF}
              stroke={STAFF_COLOR}
              strokeWidth={2}
            />
            <Brace bassYOff={GRAND_BASS_YOFF} />

            {!notesHidden &&
              renderNotes.map((rn, i) =>
                renderNote(
                  rn,
                  rn.clef === "bass" ? GRAND_BASS_YOFF : 0,
                  hasKeySignature,
                  `n-${i}`,
                ),
              )}
          </>
        ) : (
          <>
            <StaffLinesAt yOff={0} />
            <BarlinesAt yOff={0} />
            <ClefAt clef={soloClef} yOff={0} />
            {hasKeySignature && <KeySigAt clef={soloClef} yOff={0} keySig={keySignature} />}
            {!notesHidden &&
              renderNotes.map((rn, i) => renderNote(rn, 0, hasKeySignature, `n-${i}`))}
          </>
        )}
      </svg>
    </div>
  );
}
