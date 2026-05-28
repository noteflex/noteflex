import { useMemo } from "react";

/**
 * 미니 오선지 — 음표 1개를 작은 SVG로 정확한 음높이에 렌더.
 *
 * 좌표/글리프 로직은 게임의 GrandStaffPractice.tsx와 동일:
 *   - noteToStep / stepToY (treble bottomStep=2, bass bottomStep=-10)
 *   - 덧줄 = 오선 밖이면 일정 간격으로 가로선
 *   - 클레프·액시덴탈 = SMuFL Bravura 글리프 ( treble,  bass,
 *      sharp,  flat). Bravura 폰트는 src/index.css에 @font-face로 전역 로드됨.
 *
 * vexflow 의존성 없음 — 순수 React + SVG primitive.
 */

const NOTE_NAMES = ["C", "D", "E", "F", "G", "A", "B"] as const;
type Letter = (typeof NOTE_NAMES)[number];

const GLYPH_G_CLEF = "";
const GLYPH_F_CLEF = "";
const GLYPH_SHARP = "";
const GLYPH_FLAT = "";

function noteToStep(letter: string, octave: number): number {
  const idx = NOTE_NAMES.indexOf(letter.toUpperCase() as Letter);
  if (idx === -1) throw new Error(`invalid note letter: ${letter}`);
  return (octave - 4) * 7 + idx;
}

function stepToY(
  step: number,
  clef: "treble" | "bass",
  staffBot: number,
  stepH: number,
): number {
  const bottomStep = clef === "treble" ? 2 : -10;
  return staffBot - (step - bottomStep) * stepH;
}

function getLedgerSteps(step: number, clef: "treble" | "bass"): number[] {
  const bottomStep = clef === "treble" ? 2 : -10;
  const topStep = clef === "treble" ? 10 : -2;
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

interface SizeCfg {
  w: number;
  h: number;
  stepH: number;
  staffBot: number; // 오선 최하단 줄 y
  noteX: number;
  clefX: number;
  clefFontSize: number;
  accidentalFontSize: number;
  accidentalOffsetX: number;
  noteheadRX: number;
  noteheadRY: number;
  noteheadRotation: number;
  stemW: number;
  ledgerHalf: number;
  ledgerW: number;
  staffSW: number;
  stemLen: number; // STD_STEM = 7 * stepH (게임 동일)
}

/**
 * 게임 DEFAULT_STYLE 비례를 mini 사이즈로 축소.
 * 기준: stepH 12 → md 5.5, sm 3.0 → 비례 계수 md=0.458, sm=0.25.
 * (clefFontSize 등은 staff height와 1:1 관계를 유지)
 */
const SIZES: Record<"sm" | "md", SizeCfg> = {
  md: {
    w: 150,
    h: 88,
    stepH: 5.5,
    staffBot: 64, // staff height = 8*stepH = 44 → top = 20
    noteX: 100,
    clefX: 8,
    clefFontSize: 44,
    accidentalFontSize: 32,
    accidentalOffsetX: -10,
    noteheadRX: 7,
    noteheadRY: 5.3,
    noteheadRotation: -20,
    stemW: 1.4,
    ledgerHalf: 10,
    ledgerW: 1.4,
    staffSW: 0.7,
    stemLen: 7 * 5.5,
  },
  sm: {
    w: 78,
    h: 56,
    stepH: 3.0,
    staffBot: 42, // staff height = 24 → top = 18
    noteX: 52,
    clefX: 4,
    clefFontSize: 24,
    accidentalFontSize: 18,
    accidentalOffsetX: -6,
    noteheadRX: 4,
    noteheadRY: 3,
    noteheadRotation: -20,
    stemW: 1.1,
    ledgerHalf: 6,
    ledgerW: 1.1,
    staffSW: 0.55,
    stemLen: 7 * 3.0,
  },
};

export interface MiniStaffProps {
  /** 예: "C", "F", "Bb", "F#" */
  noteKey: string;
  octave: number;
  clef: "treble" | "bass";
  /** sm = 78×56 (우측 박스용), md = 150×88 (좌 박스용) */
  size?: "sm" | "md";
  /** 음표·오선 색 (라이트 모드 기준 검정 톤) */
  color?: string;
}

/**
 * 게임과 동일한 좌표계산으로 1개 음표를 그리는 미니 오선지.
 * vexflow 의존성 없음. 비정상 음표일 때 음이름 텍스트 폴백.
 */
export function MiniStaff({
  noteKey,
  octave,
  clef,
  size = "md",
  color = "#1c1917",
}: MiniStaffProps) {
  const cfg = SIZES[size];

  const layout = useMemo(() => {
    try {
      // accidental 분리: "Bb"·"F#"·"Eb" 마지막 글자
      let letter = noteKey;
      let acc: "#" | "b" | null = null;
      if (noteKey.length > 1) {
        const last = noteKey[noteKey.length - 1];
        if (last === "#" || last === "♯") {
          letter = noteKey.slice(0, -1);
          acc = "#";
        } else if (last === "b" || last === "♭") {
          letter = noteKey.slice(0, -1);
          acc = "b";
        }
      }

      const step = noteToStep(letter, octave);
      const y = stepToY(step, clef, cfg.staffBot, cfg.stepH);
      const ledgers = getLedgerSteps(step, clef);

      // 줄기 방향 — 게임과 동일: stemUp = step ≤ midStep
      const bottomStep = clef === "treble" ? 2 : -10;
      const topStep = clef === "treble" ? 10 : -2;
      const midStep = (bottomStep + topStep) / 2;
      const stemUp = step <= midStep;

      const rotRad = (cfg.noteheadRotation * Math.PI) / 180;
      const attachDX = cfg.noteheadRX * Math.cos(rotRad);
      const attachDY = cfg.noteheadRX * Math.sin(rotRad);

      const midY = stepToY(midStep, clef, cfg.staffBot, cfg.stepH);
      const stemX = stemUp
        ? cfg.noteX + attachDX - 0.3
        : cfg.noteX - attachDX + 0.3;
      const stemY1 = stemUp ? y + attachDY : y - attachDY;
      const stemY2 = stemUp
        ? Math.min(y - cfg.stemLen, midY)
        : Math.max(y + cfg.stemLen, midY);

      // 음표 머리가 SVG viewBox 밖으로 멀리 벗어나면 (B1·G1 bass, Gb3 treble 등
      // 극단 음역대 + 작은 사이즈 조합) 시각이 잘려 오히려 혼란 — 폴백 텍스트로.
      const yMargin = cfg.stepH * 2;
      if (y < -yMargin || y > cfg.h + yMargin) {
        return null;
      }

      return { y, ledgers, acc, stemX, stemY1, stemY2 };
    } catch {
      return null;
    }
  }, [noteKey, octave, clef, cfg]);

  // 폴백: 비정상 음표면 음이름만
  if (!layout) {
    return (
      <div
        className="bg-white rounded-md inline-flex items-center justify-center shrink-0"
        style={{ width: cfg.w, height: cfg.h }}
        aria-hidden
      >
        <span className="font-mono text-sm font-bold text-foreground">
          {noteKey}
          {octave}
        </span>
      </div>
    );
  }

  const { y, ledgers, acc, stemX, stemY1, stemY2 } = layout;
  const lineGap = cfg.stepH * 2;
  const lineXStart = 4;
  const lineXEnd = cfg.w - 4;

  // 클레프 baseline — 게임과 동일:
  //   treble: G4 step (위에서 두번째 줄) = bottomStep+4 = 6 → y at staffBot - 4*stepH
  //   bass:   F3 step = topStep - 4 = -6 (위에서 두번째 줄) = staffTop + lineGap
  const clefBaselineY =
    clef === "treble"
      ? cfg.staffBot - 3 * lineGap // staffBot - 2*lineGap = G4 줄
      : cfg.staffBot - 4 * lineGap + lineGap; // staffTop + lineGap = F3 줄

  return (
    <div
      className="bg-white rounded-md inline-block shrink-0"
      style={{ width: cfg.w, height: cfg.h }}
      aria-hidden
    >
      <svg
        width={cfg.w}
        height={cfg.h}
        viewBox={`0 0 ${cfg.w} ${cfg.h}`}
        style={{ display: "block" }}
      >
        {/* 오선 5줄 */}
        {[0, 1, 2, 3, 4].map((i) => {
          const ly = cfg.staffBot - i * lineGap;
          return (
            <line
              key={`staff-${i}`}
              x1={lineXStart}
              y1={ly}
              x2={lineXEnd}
              y2={ly}
              stroke={color}
              strokeWidth={cfg.staffSW}
            />
          );
        })}

        {/* 클레프 (Bravura SMuFL 글리프) */}
        <text
          x={cfg.clefX}
          y={clefBaselineY}
          fontSize={cfg.clefFontSize}
          fontFamily="Bravura, serif"
          fill={color}
        >
          {clef === "treble" ? GLYPH_G_CLEF : GLYPH_F_CLEF}
        </text>

        {/* 덧줄 */}
        {ledgers.map((ls) => {
          const ly = stepToY(ls, clef, cfg.staffBot, cfg.stepH);
          return (
            <line
              key={`led-${ls}`}
              x1={cfg.noteX - cfg.ledgerHalf}
              y1={ly}
              x2={cfg.noteX + cfg.ledgerHalf}
              y2={ly}
              stroke={color}
              strokeWidth={cfg.ledgerW}
              strokeLinecap="round"
            />
          );
        })}

        {/* 액시덴탈 */}
        {acc && (
          <text
            x={cfg.noteX - cfg.noteheadRX + cfg.accidentalOffsetX}
            y={y + cfg.accidentalFontSize * 0.25}
            fontSize={cfg.accidentalFontSize}
            fontFamily="Bravura, serif"
            fill={color}
          >
            {acc === "#" ? GLYPH_SHARP : GLYPH_FLAT}
          </text>
        )}

        {/* 줄기 */}
        <line
          x1={stemX}
          y1={stemY1}
          x2={stemX}
          y2={stemY2}
          stroke={color}
          strokeWidth={cfg.stemW}
          strokeLinecap="round"
        />

        {/* 음표 머리 (게임과 동일하게 -20° 회전 ellipse) */}
        <ellipse
          cx={cfg.noteX}
          cy={y}
          rx={cfg.noteheadRX}
          ry={cfg.noteheadRY}
          fill={color}
          transform={`rotate(${cfg.noteheadRotation}, ${cfg.noteX}, ${y})`}
        />
      </svg>
    </div>
  );
}
