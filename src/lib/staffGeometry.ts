/** 다이아토닉 음 이름 + 옥타브 → 가온다(C4) 기준 단계 (C4=0, 위로 +, 아래로 -) */
const LETTER_INDEX: Record<string, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

export function diatonicStepsFromC4(note: string): number {
  const m = note.match(/^([A-G])(\d+)$/);
  if (!m) return 0;
  return (Number(m[2]) - 4) * 7 + (LETTER_INDEX[m[1]] ?? 0);
}

/**
 * 그랜드 스태프 기하 (viewBox 좌표계, y 아래로 증가)
 *
 * halfLine=14 → 인접 다이아토닉 음 수직 거리 14 SVG 단위
 * midC_Y=260  → C4(가온다) 위치
 *
 * 높은음 자리표 오선:
 *   E4(step 2)  → y=232   (최하단)
 *   G4(step 4)  → y=204
 *   B4(step 6)  → y=176
 *   D5(step 8)  → y=148
 *   F5(step 10) → y=120   (최상단)
 *
 * 낮은음 자리표 오선:
 *   A3(step -2) → y=288   (최상단)
 *   F3(step -4) → y=316
 *   D3(step -6) → y=344
 *   B2(step -8) → y=372
 *   G2(step -10)→ y=400   (최하단)
 *
 * 가온다(C4) 보조선 y=260 (두 오선 사이)
 */
export const STAFF = {
  vbW: 600,
  vbH: 520,
  midC_Y: 260,
  halfLine: 14,
  staffLineStartX: 80,
  staffLineEndX: 576,
  /** 현재 음표 고정 앵커 x */
  noteAnchorX: 442,
  /** 히스토리 음 간격 */
  noteSpacing: 30,
} as const;

/** 음머리 중심 y */
export function noteCenterY(note: string): number {
  return STAFF.midC_Y - diatonicStepsFromC4(note) * STAFF.halfLine;
}

/** 높은음자리표 오선 y 목록 [E4, G4, B4, D5, F5] — 인덱스 0이 하단 */
export function trebleStaffLineYs(): number[] {
  return [2, 4, 6, 8, 10].map((s) => STAFF.midC_Y - s * STAFF.halfLine);
}

/** 낮은음자리표 오선 y 목록 [A3, F3, D3, B2, G2] — 인덱스 0이 상단 */
export function bassStaffLineYs(): number[] {
  return [-2, -4, -6, -8, -10].map((s) => STAFF.midC_Y - s * STAFF.halfLine);
}

/**
 * 음표에 필요한 보조선 y 목록.
 *
 * 규칙:
 *  - C4(step 0): 가온다 보조선 한 개
 *  - step > 10 (높은음 오선 위): 짝수 step마다 보조선 (12, 14, …)
 *  - step < -10 (낮은음 오선 아래): 짝수 step마다 보조선 (-12, -14, …)
 *  - 오선 위·아래를 벗어나지 않는 음, 두 오선 사이 공간(step -1~1 중 C4 제외): 보조선 없음
 */
export function ledgerLineYsForNote(note: string): number[] {
  const S = diatonicStepsFromC4(note);
  const { midC_Y, halfLine } = STAFF;
  const ys: number[] = [];

  if (S === 0) {
    ys.push(midC_Y);
    return ys;
  }

  if (S > 10) {
    // 높은음 오선 위 → 짝수 단계에 보조선
    const last = S % 2 === 0 ? S : S - 1;
    for (let s = 12; s <= last; s += 2) {
      ys.push(midC_Y - s * halfLine);
    }
    return ys;
  }

  if (S < -10) {
    // 낮은음 오선 아래 → 짝수 단계에 보조선
    const last = S % 2 === 0 ? S : S + 1;
    for (let s = -12; s >= last; s -= 2) {
      ys.push(midC_Y - s * halfLine);
    }
    return ys;
  }

  return ys;
}
