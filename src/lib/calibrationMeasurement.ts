export const TRIM_COUNT = 1; // 절사 평균: 최고/최저 각 1개 제거
export const ENV_TRIAL_COUNT = 5;
export const SYNC_TRIAL_COUNT = 3;
export const SYNC_OUTLIER_THRESHOLD_MS = 20;

/**
 * 절사 평균 (최고/최저 TRIM_COUNT개씩 제거 후 평균).
 * 샘플 수가 TRIM_COUNT*2 이하면 단순 평균.
 */
export function calculateTrimmedMean(measurements: number[]): number {
  if (measurements.length === 0) return 0;
  if (measurements.length <= TRIM_COUNT * 2) {
    return measurements.reduce((a, b) => a + b, 0) / measurements.length;
  }
  const sorted = [...measurements].sort((a, b) => a - b);
  const trimmed = sorted.slice(TRIM_COUNT, sorted.length - TRIM_COUNT);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

/** Q-K: clamp 0 (음수 offset → 0) */
export function clampOffset(offsetMs: number): number {
  return Math.max(0, offsetMs);
}

/** Q-F: sync outlier 감지 (gap > ±threshold) */
export function isSyncOutlier(
  gapMs: number,
  thresholdMs = SYNC_OUTLIER_THRESHOLD_MS
): boolean {
  return Math.abs(gapMs) > thresholdMs;
}
