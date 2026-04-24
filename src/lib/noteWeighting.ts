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