import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
  /**
   * §C1 M-등분 고정 슬롯: 이 stage·batch에서 최대로 표시될 음표 수 M.
   * batchSize=1 → totalSets, batchSize≥3 → batchSize, final-retry → batch.length.
   * 미제공 시 현재 가시 음표 수(visibleN)로 fallback (구버전 동작).
   */
  maxVisibleN?: number;
  keySignature?: string;
  keySharps?: string[];
  keyFlats?: string[];
  className?: string;
};

export const TOTAL_SLOTS = 8;
const MAX_HISTORY = TOTAL_SLOTS - 1;

const TARGET_COLOR   = "#b91c1c"; // 빨강 (현재 답할 음표)
const WAITING_COLOR  = "#1c1917"; // 검정 (대기 중 batch 음표, 구조 요소)
const ANSWERED_COLOR = "#9ca3af"; // 회색 (이미 답한 음표)

/** §0.4.3 음표 색깔 3단계 */
export type NoteRole = "target" | "answered" | "waiting";
export function getNoteColor(role: NoteRole): string {
  if (role === "target")   return TARGET_COLOR;
  if (role === "answered") return ANSWERED_COLOR;
  return WAITING_COLOR;
}

// HISTORY_COLOR alias kept for structural elements (staff lines, clef, etc.)
const HISTORY_COLOR = WAITING_COLOR;

// ── 레이아웃 기준 상수 ────────────────────────────────────────
export const SVG_W    = 800;
export const STAFF_X1 = 30;
export const STAFF_X2 = 790;
export const STEP_H   = 12;
export const LINE_GAP = STEP_H * 2;   // 24
const STAFF_H  = LINE_GAP * 4; // 96

// ── SMuFL (Bravura) 글리프 ────────────────────────────────────
const GLYPH_G_CLEF = "\uE050";
const GLYPH_F_CLEF = "\uE062";
const GLYPH_BRACE  = "\uE000";
const GLYPH_SHARP  = "\uE262";
const GLYPH_FLAT   = "\uE260";

const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"] as const;
const FLAT_ORDER  = ["B", "E", "A", "D", "G", "C", "F"] as const;

// §조표 표준 음악 표기 (stave position step values):
//   treble bottomStep=2 (E4), bass bottomStep=-10 (G2).
//   sharps 순서: F·C·G·D·A·E·B  /  flats 순서: B·E·A·D·G·C·F
export const SHARP_KEY_POS: Record<"treble" | "bass", Record<string, number>> = {
  treble: { F: 10, C:  7, G: 11, D:  8, A:  5, E:  9, B:  6 },
  //  F#=L5  C#=S3  G#=above·L5  D#=L4  A#=S2  E#=S4  B#=L3
  bass:   { F: -4, C: -7, G: -2, D: -6, A: -9, E: -5, B: -8 },
  //  F#=L4  C#=S2  G#=L5   D#=L3  A#=S1  E#=S3  B#=L2
};
export const FLAT_KEY_POS: Record<"treble" | "bass", Record<string, number>> = {
  treble: { B:  6, E:  9, A:  5, D:  8, G:  4, C:  7, F:  3 },
  //  B♭=L3  E♭=S4  A♭=S2  D♭=L4  G♭=L2  C♭=S3  F♭=L1
  bass:   { B: -8, E: -5, A: -9, D: -6, G: -10, C: -7, F: -11 },
  //  B♭=L2  E♭=S3  A♭=S1  D♭=L3  G♭=L1   C♭=S2  F♭=below·L1
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
  /** §S1 Uniform scale: 고정 0.75 (배치 무관 동일 프레임). */
  uniscale?: number;
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
  uniscale:           1,
} as const;

// 그랜드 staff bass yOff: bass bottomStep(-10)→treble bottomStep(2) = 12 step.
// 12*STEP_H(=144) 에서 두 clef의 stepToY가 동일 → C4(가온다) 단일 축 = 표준 그랜드 staff.
const GRAND_BASS_YOFF = 12 * STEP_H; // 144

const LEVEL_STYLES: Record<number, LevelStyle> = {
  1: { staffTop:  98, staffBot: 194, svgH: 294, bassYOff:              0 },
  2: { staffTop:  74, staffBot: 170, svgH: 294, bassYOff:              0 },
  3: { staffTop: 182, staffBot: 278, svgH: 420, bassYOff:              0 },
  4: { staffTop: 158, staffBot: 254, svgH: 420, bassYOff:              0 },
  5: { staffTop: 182, staffBot: 278, svgH: 656, bassYOff: GRAND_BASS_YOFF },
  6: { staffTop: 182, staffBot: 278, svgH: 656, bassYOff: GRAND_BASS_YOFF },
  7: { staffTop: 182, staffBot: 278, svgH: 656, bassYOff: GRAND_BASS_YOFF },
};

export type ResolvedStyle = Required<LevelStyle>;

// 모바일 오선지 확대 배율 (인게임에서 Lv1 고음/Lv7 그랜드staff 안 잘리면 1.1까지 상향 가능)
export const MOBILE_UNISCALE = 1.1;

/** §S1 Uniform scale: 고정 0.75 (배치 무관 동일 프레임). 모바일은 MOBILE_UNISCALE. */
export function computeScale(_M: number, isMobile = false): number {
  return isMobile ? MOBILE_UNISCALE : 0.75;
}

/**
 * §C1 M-등분 고정 슬롯: stage·phase·batchSize 기반 M 결정.
 * @param isFinalRetry  final-retry phase 여부
 * @param batchSize     stage batchSize (1·3·5·7)
 * @param maxNotes      batchSize=1 stage일 때 최대 등장 음표 수 (totalSets × notesPerSet, TOTAL_SLOTS cap)
 * @param currentBatchLength  final-retry 현재 batch 길이
 */
export function computeMaxVisibleN(
  isFinalRetry: boolean,
  batchSize: number,
  maxNotes: number,
  currentBatchLength: number,
): number {
  if (isFinalRetry) return currentBatchLength;
  if (batchSize <= 1) return maxNotes;
  return batchSize;
}

export function resolveStyle(
  level: number,
  keySigCount: number,
  batchSize?: number,
  maxN?: number,
  isMobile = false,
): ResolvedStyle {
  const raw = LEVEL_STYLES[level] ?? LEVEL_STYLES[1];
  const merged = { ...DEFAULT_STYLE, ...raw } as ResolvedStyle;

  // §C1 M-등분: maxN = M (stage 고정 슬롯 수), fallback = batchSize
  const M = maxN ?? (batchSize ?? 1);

  // §S1 Uniform scale: 음표·오선·음자리표·조표 모두 동일 비율.
  const uniscale = computeScale(M, isMobile);
  merged.uniscale = uniscale;

  if (uniscale !== 1.0) {
    // ── 음표 치수 ──────────────────────────────────────────
    merged.noteheadRX        *= uniscale;
    merged.noteheadRY        *= uniscale;
    merged.stemLen           *= uniscale;
    merged.stemW             *= uniscale;
    merged.ledgerHalf        *= uniscale;
    merged.ledgerW           *= uniscale;
    merged.accidentalFontSize *= uniscale;

    // ── 음자리표·조표·중괄호 ────────────────────────────────
    merged.clefFontSize      *= uniscale;
    merged.keySigFontSize    *= uniscale;
    merged.keySigSpacing     *= uniscale;
    merged.keySigStartX      *= uniscale;
    merged.braceFontSize     *= uniscale;

    // ── 오선 Y 좌표: staffCenter 고정, LINE_GAP 축소 ────────
    const lineGap    = LINE_GAP * uniscale;
    const staffCenter = (merged.staffTop + merged.staffBot) / 2;
    merged.staffTop  = staffCenter - 2 * lineGap;
    merged.staffBot  = staffCenter + 2 * lineGap;
    if (merged.bassYOff !== 0) {
      merged.bassYOff = merged.bassYOff * uniscale;
    }
    // svgH: viewBox 높이 유지 (extra whitespace — preserveAspectRatio meet이 처리)
  }

  // §C1 keySig → noteStartX 보정 (scaled keySigSpacing 반영)
  if (keySigCount > 0) {
    const keySigEndX = STAFF_X1 + merged.keySigStartX + keySigCount * merged.keySigSpacing;
    const minStart = keySigEndX + merged.keySigToNoteGap;
    if (merged.noteStartX < minStart) merged.noteStartX = minStart;
  }

  // §C1 M-등분 배치: M개 슬롯으로 유효 영역 고정 분할.
  //   effectiveWidth = STAFF_X2 - noteStartX
  //   segmentWidth   = effectiveWidth / M   (stage 시작 시 고정)
  //   noteX(i)       = noteStartX + segmentWidth × (i + 0.25)  (등분 1/4 위치)
  //   ↔ (noteStartX + segmentWidth/4) + i × segmentWidth  (호환 공식)
  const effectiveWidth = STAFF_X2 - merged.noteStartX;
  const segmentWidth   = effectiveWidth / M;
  merged.noteSpacing = segmentWidth;
  merged.noteStartX  = merged.noteStartX + segmentWidth / 4;

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

export function stepToY(
  step: number,
  clef: "treble" | "bass",
  staffBot: number,
  yOff: number,
  stepH: number = STEP_H,
): number {
  const bottomStep = clef === "treble" ? 2 : -10;
  return staffBot + yOff - (step - bottomStep) * stepH;
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
  const lineGap = LINE_GAP * style.uniscale;
  return [0, 1, 2, 3, 4].map(i => (
    <line
      key={`sl-${yOff}-${i}`}
      x1={STAFF_X1} y1={staffTop + yOff + i * lineGap}
      x2={STAFF_X2} y2={staffTop + yOff + i * lineGap}
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
  const lineGap = LINE_GAP * style.uniscale;
  const g4Y = staffBot + yOff - lineGap;
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
  const lineGap = LINE_GAP * style.uniscale;
  const f3Y = staffTop + yOff + lineGap;
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
  const stepH = STEP_H * style.uniscale;
  const elements: JSX.Element[] = [];
  const startX = STAFF_X1 + style.keySigStartX;
  let x = startX;

  if (sharps && sharps.length > 0) {
    for (const letter of SHARP_ORDER) {
      if (!sharps.includes(letter)) continue;
      const step = SHARP_KEY_POS[clef][letter];
      if (step === undefined) continue;
      const y = stepToY(step, clef, staffBot, yOff, stepH);
      elements.push(
        <text
          key={`ks-s-${clef}-${letter}`}
          x={x}
          y={y}
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
      const y = stepToY(step, clef, staffBot, yOff, stepH);
      elements.push(
        <text
          key={`ks-f-${clef}-${letter}`}
          x={x}
          y={y}
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
  const stepH      = STEP_H * style.uniscale;
  const bottomStep = clef === "treble" ? 2 : -10;
  const topStep    = clef === "treble" ? 10 : -2;
  const midStep    = (bottomStep + topStep) / 2;

  const rotRad   = (style.noteheadRotation * Math.PI) / 180;
  const attachDX = style.noteheadRX * Math.cos(rotRad);
  const attachDY = style.noteheadRX * Math.sin(rotRad);

  return notes.map((n, i) => {
    const step   = noteToStep(n.note);
    const y      = stepToY(step, clef, staffBot, yOff, stepH);
    const leds   = getLedgerSteps(step, clef);
    const stemUp = step <= midStep;

    const STD_STEM = 7 * stepH;                              // 3.5칸(1옥타브)=7 step
    const midY     = stepToY(midStep, clef, staffBot, yOff, stepH);

    const stemX  = stemUp ? n.x + attachDX - 0.3 : n.x - attachDX + 0.3;
    const stemY1 = stemUp ? y + attachDY        : y - attachDY;
    const stemY2 = stemUp
      ? Math.min(y - STD_STEM, midY)   // 위로: 기본 또는 중앙선까지(더 먼 쪽)
      : Math.max(y + STD_STEM, midY);  // 아래로: 기본 또는 중앙선까지(더 먼 쪽)

    return (
      <g key={`note-${clef}-${i}-${n.note}`}>
        {leds.map(ls => {
          const ly = stepToY(ls, clef, staffBot, yOff, stepH);
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
  maxVisibleN,
  keySignature: _keySignature,
  keySharps,
  keyFlats,
  className,
}: Props) {
  const isGrand = level >= 5;

  const keySigCount = (keySharps?.length ?? 0) + (keyFlats?.length ?? 0);
  const hasKeySignature = keySigCount > 0;

  // batch 모드 판별: batchNotes 배열 있고 길이 > 0이면 batch 모드
  const isBatchMode = !!batchNotes && batchNotes.length > 0;

  // §C1 M-등분: 현재 가시 음표 수(fallback), 실제 M = maxVisibleN prop 우선
  const visibleN = isBatchMode
    ? batchNotes!.length
    : Math.min((noteHistory ?? []).length + 1, TOTAL_SLOTS);
  const M = maxVisibleN ?? visibleN;

  const isMobile = useIsMobile();
  const style = resolveStyle(level, keySigCount, batchSize, M, isMobile);

  const notes = useMemo((): NoteEntry[] => {
    // ── Batch 모드: 한 batch 전체를 동시에 그림, 인덱스에 따라 색상 분기 ──
    if (isBatchMode && batchNotes) {
      const idx = batchIndex ?? 0;
      return batchNotes.map((n, i) => {
        const role: NoteRole = i < idx ? "answered" : i === idx ? "target" : "waiting";
        const color = getNoteColor(role);

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
        color: getNoteColor("answered"),
        clef: (h.clef ?? clef) as "treble" | "bass",
      })),
      {
        x:    style.noteStartX + visible.length * style.noteSpacing,
        note: targetNote,
        acc:  targetAccidental ?? null,
        color: getNoteColor("target"),
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