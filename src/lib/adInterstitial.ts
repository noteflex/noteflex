import { isAdsEnabled } from "./adsense";

const KEY = "noteflex.adGameCount";
const TRIGGER_EVERY = 3;

function getCount(): number {
  return Number(localStorage.getItem(KEY) ?? "0");
}

function saveCount(n: number): void {
  localStorage.setItem(KEY, String(n));
}

/**
 * 게임 종료마다 호출. true 반환 시 전면 광고 표시.
 * - justPassed=true (잠금 해제) → 즉시 트리거
 * - 게임 카운트가 TRIGGER_EVERY 도달 → 트리거
 * - 둘 다 동시 충족 시 1번만 (카운트 리셋)
 */
export function onAdGameEnd(justPassed: boolean): boolean {
  if (!isAdsEnabled()) return false;
  const next = getCount() + 1;
  const shouldShow = next >= TRIGGER_EVERY || justPassed;
  saveCount(shouldShow ? 0 : next);
  return shouldShow;
}

export function resetAdGameCount(): void {
  saveCount(0);
}
