import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type StaffHistoryEntry = {
  id: number;
  note: string;
  accidental?: "#" | "b";
  clef?: "treble" | "bass";
};

/**
 * Batch 모드용 음표 정보.
 * NoteGame이 currentBatch를 그대로 펼쳐서 전달.
 */
export type BatchNoteEntry = {
  note: string;          // 예: "C4"
  accidental?: "#" | "b";
  clef?: "treble" | "bass";
};

type Props = {
  // ── History 모드 (batchSize=1, 기본) ──
  /** 현재 답해야 할 음표. batch 모드에선 batchNotes[batchIndex]가 자동으로 빨강. */
  targetNote?: string | null;
  targetAccidental?: "#" | "b" | null;
  /** 직전 답한 음표들 (batchSize=1 stage에서만 사용) */
  noteHistory?: StaffHistoryEntry[];

  // ── Batch 모드 (batchSize > 1) ──
  /** 현재 batch 전체 음표 배열. 제공되면 batch 모드로 작동. */
  batchNotes?: BatchNoteEntry[];
  /** 현재 답해야 할 batch 내 인덱스 (0-base). 첫 등장 시 빨강. */
  batchIndex?: number;

  // ── 공통 ──
  clef?: "treble" | "bass";
  level?: number;
  /** §0.4.2: 현재 stage의 batchSize. 음표 크기·간격 동적 조정에 사용. */
  batchSize?: number;
  keySignature?: string;
  keySharps?: string[];
  keyFlats?: string[];
  className?: string;
};

export const TOTAL_SLOTS = 8;
const MAX_HISTORY = TOTAL_SLOTS - 1;

const TARGET_COLOR  = "#b91c1c"; // 빨강 (현재 답할 음표)
const HISTORY_COLOR = "#1c1917"; // 검정 (대기 중 또는 history)
const ANSWERED_COLOR = "#9ca3af"; // 회색 (batch 모드에서 이미 답한 음표)

// ── 레이아웃 기준 상수 ────────────────────────────────────────
const SVG_W    = 800;
const STAFF_X1 = 30;
const STAFF_X2 = 790;
const STEP_H   = 12;
const LINE_GAP = STEP_H * 2;   // 24
const STAFF_H  = LINE_GAP * 4; // 96

// ── SMuFL (Bravura) 글리프 ────────────────────────────────────
const GLYPH_G_CLEF = "\uE050";
const GLYPH_F_CLEF = "\uE062";
const GLYPH_BRACE  = "\uE000";
const GLYPH_SHARP  = "\uE262";
const GLYPH_FLAT   = "\uE260";

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"] as const;
const FLAT_ORDER  = ["B", "E", "A", "D", "G", "C", "F"] as const;

const SHARP_KEY_POS: Record<"treble" | "bass", Record<string, number>> = {
  treble: { F: 10, C:  7, G: 11, D:  8, A:  5, E:  9, B:  6 },
  bass:   { F: -4, C:  0, G: -3, D:  1, A: -2, E:  2, B: -1 },
};
const FLAT_KEY_POS: Record<"treble" | "bass", Record<string, number>> = {
  treble: { B:  6, E:  9, A:  5, D:  8, G:  4, C:  7, F:  3 },
  bass:   { B: -1, E:  2, A: -2, D:  1, G: -3, C:  0, F: -4 },
};

// ═════════════════════════════════════════════════════════════
// 레벨별 스타일
// ═════════════════════════════════════════════════════════════

type LevelStyle = {
  staffTop: number;
  staffBot: number;
  svgH: number;
  bassYOff: number;

  staffSW?: number;
  barlineW?: number;
  clefFontSize?: number;
  clefOffsetX?: number;
  noteheadRX?: number;
  noteheadRY?: number;
  noteheadRotation?: number;
  stemLen?: number;
  stemW?: number;
  accidentalFontSize?: number;
  accidentalOffsetX?: number;
  keySigFontSize?: number;
  keySigSpacing?: number;
  keySigStartX?: number;
  braceFontSize?: number;
  braceOffsetX?: number;
  ledgerHalf?: number;
  ledgerW?: number;
  noteStartX?: number;
  noteSpacing?: number;
  keySigToNoteGap?: number;
};

const DEFAULT_STYLE = {
  staffSW:            1.2,
  barlineW:           2,
  clefFontSize:       96,
  clefOffsetX:        10,
  noteheadRX:         15.5,
  noteheadRY:         11.5,
  noteheadRotation:   -20,
  stemLen:            90,
  stemW:              2.5,
  accidentalFontSize: 72,
  accidentalOffsetX:  -22,
  keySigFontSize:     64,
  keySigSpacing:      13,
  keySigStartX:       95,
  braceFontSize:      310,
  braceOffsetX:       -6,
  ledgerHalf:         22,
  ledgerW:            3.0,
  noteStartX:         180,
  noteSpacing:        0,
  keySigToNoteGap:    50,
} as const;

const LEVEL_STYLES: Record<number, LevelStyle> = {
  1: { staffTop:  98, staffBot: 194, svgH: 294, bassYOff:   0 },
  2: { staffTop:  74, staffBot: 170, svgH: 294, bassYOff:   0 },
  3: { staffTop: 182, staffBot: 278, svgH: 420, bassYOff:   0 },
  4: { staffTop: 158, staffBot: 254, svgH: 420, bassYOff:   0 },
  5: { staffTop: 182, staffBot: 278, svgH: 656, bassYOff: 220 },
  6: { staffTop: 182, staffBot: 278, svgH: 656, bassYOff: 220 },
  7: { staffTop: 182, staffBot: 278, svgH: 656, bassYOff: 220 },
};

type ResolvedStyle = Required<LevelStyle>;

/**
 * §0.4.2 batchSize별 음표 크기 scale (사용자 명세 2026-05-01).
 *  - batchSize >= 7 → 0.70 (조표 공간 확보 + 잘림 방지)
 *  - batchSize >= 5 → 0.80
 *  - 그 외 (1·3) → 1.0 표준 크기
 */
function getNoteScale(batchSize: number | undefined): number {
  if (batchSize === undefined) return 1.0;
  if (batchSize >= 7) return 0.70;
  if (batchSize >= 5) return 0.80;
  return 1.0;
}

function resolveStyle(
  level: number,
  keySigCount: number,
  batchSize?: number,
): ResolvedStyle {
  const raw = LEVEL_STYLES[level] ?? LEVEL_STYLES[1];
  const merged = { ...DEFAULT_STYLE, ...raw } as ResolvedStyle;

  // §0.4.2: batchSize별 음표·조표 크기 scale.
  const scale = getNoteScale(batchSize);
  if (scale !== 1.0) {
    merged.noteheadRX = merged.noteheadRX * scale;
    merged.noteheadRY = merged.noteheadRY * scale;
    merged.stemLen = merged.stemLen * scale;
    merged.ledgerHalf = merged.ledgerHalf * scale;
    merged.accidentalFontSize = merged.accidentalFontSize * scale;
  }

  if (keySigCount > 0) {
    const keySigEndX = STAFF_X1 + merged.keySigStartX + keySigCount * merged.keySigSpacing;
    const minStart = keySigEndX + merged.keySigToNoteGap;
    if (merged.noteStartX < minStart) merged.noteStartX = minStart;
  }

  if (merged.noteSpacing === 0) {
    // §0.4.4 (2026-05-01): batchSize 기반 동적 간격 — 오선지 전체 너비를 균등 분할.
    //  - batchSize=1 (history 누적 모드): TOTAL_SLOTS-1 = 7 gap (최대 8개 음표)
    //  - batchSize>1: batchSize-1 gap (음표가 좌·중·우 균등 분포)
    //  - batchSize 미지정: 기존 level 기반 fallback
    let gapCount: number;
    if (batchSize === undefined) {
      gapCount = level >= 5 ? 6 : 4;
    } else if (batchSize <= 1) {
      gapCount = TOTAL_SLOTS - 1;
    } else {
      gapCount = batchSize - 1;
    }
    merged.noteSpacing = (SVG_W - merged.noteStartX - 50) / gapCount;
  }
  return merged;
}

// ── 음이름 → step 변환 ────────────────────────────────────────
const NOTE_NAMES = ["C","D","E","F","G","A","B"] as const;

function noteToStep(note: string): number {
  const letter = note[0].toUpperCase();
  const octaveMatch = note.match(/-?\d+$/);
  const octave = octaveMatch ? parseInt(octaveMatch[0], 10) : 4;
  const idx = NOTE_NAMES.indexOf(letter as typeof NOTE_NAMES[number]);
  return (octave - 4) * 7 + idx;
}

function stepToY(
  step: number,
  clef: "treble" | "bass",
  staffBot: number,
  yOff: number
): number {
  const bottomStep = clef === "treble" ? 2 : -10;
  return staffBot + yOff - (step - bottomStep) * STEP_H;
}

function getLedgerSteps(step: number, clef: "treble" | "bass"): number[] {
  const bottomStep = clef === "treble" ? 2 : -10;
  const topStep    = clef === "treble" ? 10 : -2;
  const result: number[] = [];
  if (step <= bottomStep - 2) {
    const lo = step % 2 === 0 ? step : step + 1;
    for (let s = bottomStep - 2; s >= lo; s -= 2) result.push(s);
  } else if (step >= topStep + 2) {
    const hi = step % 2 === 0 ? step : step - 1;
    for (let s = topStep + 2; s <= hi; s += 2) result.push(s);
  }
  return result;
}

// ── 오선 / 경계선 ─────────────────────────────────────────────
function renderStaffLines(staffTop: number, yOff: number, style: ResolvedStyle) {
  return [0, 1, 2, 3, 4].map(i => (
    <line
      key={`sl-${yOff}-${i}`}
      x1={STAFF_X1} y1={staffTop + yOff + i * LINE_GAP}
      x2={STAFF_X2} y2={staffTop + yOff + i * LINE_GAP}
      stroke={HISTORY_COLOR} strokeWidth={style.staffSW}
    />
  ));
}

function renderBarlines(staffTop: number, staffBot: number, yOff: number, style: ResolvedStyle) {
  return (
    <>
      <line
        x1={STAFF_X1} y1={staffTop + yOff}
        x2={STAFF_X1} y2={staffBot + yOff}
        stroke={HISTORY_COLOR} strokeWidth={style.barlineW}
      />
      <line
        x1={STAFF_X2} y1={staffTop + yOff}
        x2={STAFF_X2} y2={staffBot + yOff}
        stroke={HISTORY_COLOR} strokeWidth={style.barlineW}
      />
    </>
  );
}

// ── 음자리표 (Bravura) ────────────────────────────────────────
function renderTrebleClef(staffBot: number, yOff: number, style: ResolvedStyle) {
  const g4Y = staffBot + yOff - LINE_GAP;
  return (
    <text
      x={STAFF_X1 + style.clefOffsetX}
      y={g4Y}
      fontSize={style.clefFontSize}
      fontFamily="Bravura, serif"
      fill={HISTORY_COLOR}
    >
      {GLYPH_G_CLEF}
    </text>
  );
}

function renderBassClef(staffTop: number, yOff: number, style: ResolvedStyle) {
  const f3Y = staffTop + yOff + LINE_GAP;
  return (
    <text
      x={STAFF_X1 + style.clefOffsetX}
      y={f3Y}
      fontSize={style.clefFontSize}
      fontFamily="Bravura, serif"
      fill={HISTORY_COLOR}
    >
      {GLYPH_F_CLEF}
    </text>
  );
}

// ── 조표 ──────────────────────────────────────────────────────
function renderKeySignature(
  clef: "treble" | "bass",
  staffBot: number,
  yOff: number,
  sharps: string[] | undefined,
  flats: string[] | undefined,
  style: ResolvedStyle
) {
  const elements: JSX.Element[] = [];
  const startX = STAFF_X1 + style.keySigStartX;
  let x = startX;

  if (sharps && sharps.length > 0) {
    for (const letter of SHARP_ORDER) {
      if (!sharps.includes(letter)) continue;
      const step = SHARP_KEY_POS[clef][letter];
      if (step === undefined) continue;
      const y = stepToY(step, clef, staffBot, yOff);
      elements.push(
        <text
          key={`ks-s-${clef}-${letter}`}
          x={x}
          y={y + style.keySigFontSize * 0.28}
          fontSize={style.keySigFontSize}
          fontFamily="Bravura, serif"
          fill={HISTORY_COLOR}
        >
          {GLYPH_SHARP}
        </text>
      );
      x += style.keySigSpacing;
    }
  } else if (flats && flats.length > 0) {
    for (const letter of FLAT_ORDER) {
      if (!flats.includes(letter)) continue;
      const step = FLAT_KEY_POS[clef][letter];
      if (step === undefined) continue;
      const y = stepToY(step, clef, staffBot, yOff);
      elements.push(
        <text
          key={`ks-f-${clef}-${letter}`}
          x={x}
          y={y + style.keySigFontSize * 0.28}
          fontSize={style.keySigFontSize}
          fontFamily="Bravura, serif"
          fill={HISTORY_COLOR}
        >
          {GLYPH_FLAT}
        </text>
      );
      x += style.keySigSpacing;
    }
  }

  return elements;
}

// ── 중괄호 ────────────────────────────────────────────────────
function renderBrace(staffTop: number, staffBot: number, bassYOff: number, style: ResolvedStyle) {
  const centerY = (staffTop + staffBot + bassYOff) / 2;
  return (
    <text
      x={STAFF_X1 + style.braceOffsetX}
      y={centerY + style.braceFontSize * 0.38 + 35}
      fontSize={style.braceFontSize}
      fontFamily="Bravura, serif"
      fill={HISTORY_COLOR}
      textAnchor="end"
    >
      {GLYPH_BRACE}
    </text>
  );
}

// ── 음표 ──────────────────────────────────────────────────────
type NoteEntry = {
  x: number;
  note: string;
  acc: "#" | "b" | null;
  color: string;
  clef: "treble" | "bass";
};

function renderNotes(
  notes: NoteEntry[],
  clef: "treble" | "bass",
  staffBot: number,
  yOff: number,
  style: ResolvedStyle,
  hasKeySignature: boolean
) {
  const bottomStep = clef === "treble" ? 2 : -10;
  const topStep    = clef === "treble" ? 10 : -2;
  const midStep    = (bottomStep + topStep) / 2;

  const rotRad   = (style.noteheadRotation * Math.PI) / 180;
  const attachDX = style.noteheadRX * Math.cos(rotRad);
  const attachDY = style.noteheadRX * Math.sin(rotRad);

  return notes.map((n, i) => {
    const step   = noteToStep(n.note);
    const y      = stepToY(step, clef, staffBot, yOff);
    const leds   = getLedgerSteps(step, clef);
    const stemUp = step <= midStep;

    const stemX  = stemUp ? n.x + attachDX - 0.3 : n.x - attachDX + 0.3;
    const stemY1 = stemUp ? y + attachDY        : y - attachDY;
    const stemY2 = stemUp ? y - style.stemLen   : y + style.stemLen;

    return (
      <g key={`note-${clef}-${i}-${n.note}`}>
        {leds.map(ls => {
          const ly = stepToY(ls, clef, staffBot, yOff);
          return (
            <line
              key={`led-${ls}`}
              x1={n.x - style.ledgerHalf} y1={ly}
              x2={n.x + style.ledgerHalf} y2={ly}
              stroke={n.color} strokeWidth={style.ledgerW}
              strokeLinecap="round"
            />
          );
        })}
        <line
          x1={stemX} y1={stemY1}
          x2={stemX} y2={stemY2}
          stroke={n.color} strokeWidth={style.stemW}
          strokeLinecap="round"
        />
        <ellipse
          cx={n.x} cy={y}
          rx={style.noteheadRX} ry={style.noteheadRY}
          fill={n.color}
          transform={`rotate(${style.noteheadRotation}, ${n.x}, ${y})`}
        />
        {n.acc && !hasKeySignature && (
          <text
            x={n.x - style.noteheadRX + style.accidentalOffsetX}
            y={y + style.accidentalFontSize * 0.25}
            fontSize={style.accidentalFontSize}
            fontFamily="Bravura, serif"
            fill={n.color}
          >
            {n.acc === "#" ? GLYPH_SHARP : GLYPH_FLAT}
          </text>
        )}
      </g>
    );
  });
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export function GrandStaffPractice({
  targetNote,
  targetAccidental,
  noteHistory,
  batchNotes,
  batchIndex,
  clef = "treble",
  level = 1,
  batchSize,
  keySignature: _keySignature,
  keySharps,
  keyFlats,
  className,
}: Props) {
  const isGrand = level >= 5;

  const keySigCount = (keySharps?.length ?? 0) + (keyFlats?.length ?? 0);
  const hasKeySignature = keySigCount > 0;
  const style = resolveStyle(level, keySigCount, batchSize);

  // batch 모드 판별: batchNotes 배열 있고 길이 > 0이면 batch 모드
  const isBatchMode = !!batchNotes && batchNotes.length > 0;

  const notes = useMemo((): NoteEntry[] => {
    // ── Batch 모드: 한 batch 전체를 동시에 그림, 인덱스에 따라 색상 분기 ──
    if (isBatchMode && batchNotes) {
      const idx = batchIndex ?? 0;
      return batchNotes.map((n, i) => {
        let color: string;
        if (i < idx) color = ANSWERED_COLOR;       // 회색 (답한 것)
        else if (i === idx) color = TARGET_COLOR;  // 빨강 (현재)
        else color = HISTORY_COLOR;                // 검정 (대기)

        return {
          x:    style.noteStartX + i * style.noteSpacing,
          note: n.note,
          acc:  n.accidental ?? null,
          color,
          clef: (n.clef ?? clef) as "treble" | "bass",
        };
      });
    }

    // ── History 모드 (기존): targetNote + noteHistory ──
    if (!targetNote) return [];
    const visible = (noteHistory ?? []).slice(-MAX_HISTORY);
    return [
      ...visible.map((h, i) => ({
        x:    style.noteStartX + i * style.noteSpacing,
        note: h.note,
        acc:  h.accidental ?? null,
        color: ANSWERED_COLOR,
        clef: (h.clef ?? clef) as "treble" | "bass",
      })),
      {
        x:    style.noteStartX + visible.length * style.noteSpacing,
        note: targetNote,
        acc:  targetAccidental ?? null,
        color: TARGET_COLOR,
        clef,
      },
    ];
  }, [
    isBatchMode,
    batchNotes,
    batchIndex,
    targetNote,
    targetAccidental,
    noteHistory,
    clef,
    style.noteStartX,
    style.noteSpacing,
  ]);

  const trebleNotes = isGrand
    ? notes.filter(n => n.clef === "treble")
    : (clef === "treble" ? notes : []);
  const bassNotes = isGrand
    ? notes.filter(n => n.clef === "bass")
    : (clef === "bass" ? notes : []);

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-xl", className)}
      style={{
        background: "#ffffff",
        paddingBottom: `${(style.svgH / SVG_W) * 100}%`,
      }}
    >
      <svg
        viewBox={`0 0 ${SVG_W} ${style.svgH}`}
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
            {renderStaffLines(style.staffTop, 0, style)}
            {renderBarlines(style.staffTop, style.staffBot, 0, style)}
            {renderTrebleClef(style.staffBot, 0, style)}
            {renderKeySignature("treble", style.staffBot, 0, keySharps, keyFlats, style)}
            {renderNotes(trebleNotes, "treble", style.staffBot, 0, style, hasKeySignature)}

            {renderStaffLines(style.staffTop, style.bassYOff, style)}
            {renderBarlines(style.staffTop, style.staffBot, style.bassYOff, style)}
            {renderBassClef(style.staffTop, style.bassYOff, style)}
            {renderKeySignature("bass", style.staffBot, style.bassYOff, keySharps, keyFlats, style)}
            {renderNotes(bassNotes, "bass", style.staffBot, style.bassYOff, style, hasKeySignature)}

            <line
              x1={STAFF_X1} y1={style.staffTop}
              x2={STAFF_X1} y2={style.staffBot + style.bassYOff}
              stroke={HISTORY_COLOR} strokeWidth={style.barlineW}
            />
            {renderBrace(style.staffTop, style.staffBot, style.bassYOff, style)}
          </>
        ) : (
          <>
            {renderStaffLines(style.staffTop, 0, style)}
            {renderBarlines(style.staffTop, style.staffBot, 0, style)}
            {clef === "treble"
              ? renderTrebleClef(style.staffBot, 0, style)
              : renderBassClef(style.staffTop, 0, style)
            }
            {renderKeySignature(clef, style.staffBot, 0, keySharps, keyFlats, style)}
            {renderNotes(
              clef === "treble" ? trebleNotes : bassNotes,
              clef,
              style.staffBot,
              0,
              style,
              hasKeySignature
            )}
          </>
        )}
      </svg>
    </div>
  );
}