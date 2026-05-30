import type { MasteryFlag, MasteryMap } from "@/hooks/useUserMastery";

/**
 * 가중치 설정 (상수).
 * 나중에 A/B 테스트나 설정 화면에서 조정하고 싶으면 여기만 수정.
 */
export const MASTERY_WEIGHTS: Record<MasteryFlag, number> = {
  weakness: 3.0,   // 약점 음표는 3배 자주 출제
  normal: 1.0,     // 기본
  mastery: 0.3,    // 마스터한 음표는 가끔만
};

/**
 * 특정 음표의 가중치 조회.
 * masteryMap이 비어있으면 모두 1.0 (비로그인/데이터 없음 케이스에서 균등).
 */
export function getNoteWeight(
  masteryMap: MasteryMap,
  clef: "treble" | "bass",
  key: string,
  octave: string,
  accidental?: "#" | "b"
): number {
  if (masteryMap.size === 0) return 1.0;
  const acc = accidental ?? "";
  const noteKey = `${key}${acc}${octave}`;
  const flag = masteryMap.get(`${clef}:${noteKey}`);
  if (!flag) return MASTERY_WEIGHTS.normal;
  return MASTERY_WEIGHTS[flag];
}

/**
 * 가중 랜덤 샘플링.
 * items와 weights 배열의 길이가 같아야 함.
 * 가중치 합이 0이면 균등 랜덤.
 */
export function weightedPickIndex(weights: number[]): number {
  if (weights.length === 0) return -1;
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(Math.random() * weights.length);

  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1; // 부동소수점 오차 방어
}

// ═══════════════════════════════════════════════════════════════
// 4-D: 출제 결정용 multiplier 함수 모음
// ═══════════════════════════════════════════════════════════════
// 4-F NoteGame.tsx 통합 시 각 multiplier를 곱셈으로 조합:
//   weight = baseWeight
//          × scoreToWeakMultiplier(weakScore)
//          × getKeySignatureMultiplier(noteId, keyNotes)
//          × getSoftAvoidMultiplier(prevNotes, noteId)
// ═══════════════════════════════════════════════════════════════

/**
 * note_id에서 음명만 추출.
 *   "treble:F#4" → "F#"
 *   "bass:Bb2"   → "Bb"
 *   "treble:C4"  → "C"
 *
 * 형식: `<clef>:<letter>[#|b]<octave>`
 *   - clef prefix 제거
 *   - 끝의 octave 숫자 제거
 *   - 가운데 letter (+ accidental "#" 또는 "b") 반환
 *
 * 더블 샵·플랫은 현재 미지원 (noteTypes.Accidental = "#" | "b").
 */
export function extractNoteName(noteId: string): string {
  const colonIdx = noteId.indexOf(":");
  const body = colonIdx >= 0 ? noteId.slice(colonIdx + 1) : noteId;
  // body 끝의 숫자(octave) 제거. 결과가 음명(letter + optional accidental).
  return body.replace(/\d+$/, "");
}

/**
 * 직전 N개 음 회피용 multiplier (옥타브·clef 무관, 음명만 비교).
 *
 * prevNotes는 최근이 [0], 가장 오래된 게 [2].
 *   - [0] 매치 → ×0.2 (직전 음과 같은 음명: 거의 안 뽑힘)
 *   - [1] 매치 → ×0.5
 *   - [2] 매치 → ×0.7
 *   - 매치 없음 → 1.0
 *
 * 여러 매치 동시 발생 시 가장 가까운(가장 강한) multiplier 우선.
 *
 * 음명 비교는 옥타브·clef 무관. "treble:F#4"와 "bass:F#3"은 같은 음명("F#")으로 간주.
 */
export function getSoftAvoidMultiplier(prevNotes: string[], noteId: string): number {
  const target = extractNoteName(noteId);
  if (!target) return 1.0;

  // 가까운 매치부터 검사. 우선순위: [0] > [1] > [2].
  const factors = [0.2, 0.5, 0.7];
  for (let i = 0; i < Math.min(prevNotes.length, factors.length); i++) {
    if (extractNoteName(prevNotes[i]) === target) {
      return factors[i];
    }
  }
  return 1.0;
}

/**
 * 조표 영향 음 출제 비율 조정용 multiplier (단순 ratio 방식).
 *
 * 풀 크기 정보 없이 호출. 정확한 비율 normalize는
 * `getKeySignatureMultiplierNormalized`를 사용.
 *
 * 단순 공식:
 *   - 영향 음 (noteId 음명 ∈ keySignatureNotes) → ×(targetRatio × 2)
 *   - 일반 음 → ×((1 - targetRatio) × 2)
 *
 * targetRatio = 0.5 → 둘 다 ×1.0 (효과 없음).
 * targetRatio = 0.6 → 영향 음 ×1.2, 일반 음 ×0.8.
 * targetRatio = 0.7 → 영향 음 ×1.4, 일반 음 ×0.6.
 *
 * keySignatureNotes는 음명 배열 (예: G major면 ["F#"], D major면 ["F#", "C#"]).
 * 비어 있으면 1.0 (조표 가중치 미적용 — Lv 1~3 같은 다장조 sublevel).
 */
export function getKeySignatureMultiplier(
  noteId: string,
  keySignatureNotes: string[],
  targetRatio: number = 0.6,
): number {
  if (keySignatureNotes.length === 0) return 1.0;

  const noteName = extractNoteName(noteId);
  const isKeyNote = keySignatureNotes.includes(noteName);

  return isKeyNote ? targetRatio * 2 : (1 - targetRatio) * 2;
}

/**
 * 조표 영향 음 출제 비율 조정용 multiplier (풀 크기 기반 정확한 normalize).
 *
 * 풀의 음 개수가 정확히 알려진 경우 권장.
 *   - 영향 음 multiplier = targetRatio / keyNotesInPool
 *   - 일반 음 multiplier = (1 - targetRatio) / (poolSize - keyNotesInPool)
 *
 * 이 multiplier들을 풀 전체에 곱하면 영향 음 그룹 가중치 합이 정확히 targetRatio가 됨.
 *
 * @param poolSize       sublevel 음 풀 전체 크기
 * @param keyNotesInPool 풀 내 조표 영향 음 개수 (K)
 *                       0이면 영향 음 없음 → 일반 음 1.0 반환, 영향 음 자체가 풀에 없음
 *                       poolSize와 같으면 모두 영향 음 → 영향 음 1.0 반환
 */
export function getKeySignatureMultiplierNormalized(
  noteId: string,
  keySignatureNotes: string[],
  poolSize: number,
  keyNotesInPool: number,
  targetRatio: number = 0.6,
): number {
  if (keySignatureNotes.length === 0) return 1.0;
  if (poolSize <= 0) return 1.0;

  const noteName = extractNoteName(noteId);
  const isKeyNote = keySignatureNotes.includes(noteName);
  const otherCount = poolSize - keyNotesInPool;

  if (isKeyNote) {
    if (keyNotesInPool <= 0) return 1.0;
    return targetRatio / keyNotesInPool;
  } else {
    if (otherCount <= 0) return 1.0;
    return (1 - targetRatio) / otherCount;
  }
}

/**
 * combined_score → 약점 가중 multiplier 변환.
 *
 * 공식: 1.0 + (combinedScore × (max - 1.0))
 *   - null/undefined → 1.0 (데이터 없는 음은 일반)
 *   - 0    → 1.0 (전부 정답·빠른 응답)
 *   - 0.5  → 2.0 (절반쯤 약점)
 *   - 1.0  → 3.0 (최대 약점, max 기본값)
 *
 * 0..1 범위 외 입력도 클램프 없이 그대로 계산 — 호출자가 보장.
 */
export function scoreToWeakMultiplier(
  combinedScore: number | null | undefined,
  max: number = 3.0,
): number {
  if (combinedScore === null || combinedScore === undefined) return 1.0;
  return 1.0 + combinedScore * (max - 1.0);
}