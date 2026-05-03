import * as Tone from "tone";
import { ensureAudioReady } from "@/lib/sound";

export const OUTLIER_THRESHOLD_MS = 20;

export interface SyncMeasureResult {
  averageMs: number;
  measurements: number[];
  outlierCount: number;
}

/**
 * rAF 콜백 진입 시점에서 두 클록을 동시 샘플링해 sync gap 측정.
 * gap = AudioContext.currentTime(ms) - performance.now()
 * 양수 = audio clock이 visual clock보다 앞서 있음.
 */
export async function measureSyncGap(): Promise<number> {
  await ensureAudioReady();

  return new Promise<number>((resolve) => {
    requestAnimationFrame(() => {
      const rafMs = performance.now();
      const audioMs = Tone.getContext().rawContext.currentTime * 1000;
      resolve(audioMs - rafMs);
    });
  });
}

/**
 * count회 측정 → outlier(±OUTLIER_THRESHOLD_MS 초과) 제외 후 평균.
 * measureFn 파라미터는 테스트 주입용 (기본값: measureSyncGap).
 */
export async function measureSyncGapAverage(
  count = 3,
  measureFn: () => Promise<number> = measureSyncGap
): Promise<SyncMeasureResult> {
  const measurements: number[] = [];

  for (let i = 0; i < count; i++) {
    const gap = await measureFn();
    measurements.push(gap);
    if (i < count - 1) {
      await new Promise<void>((r) => setTimeout(r, 50));
    }
  }

  const outlierCount = measurements.filter(
    (m) => Math.abs(m) > OUTLIER_THRESHOLD_MS
  ).length;

  const valid = measurements.filter(
    (m) => Math.abs(m) <= OUTLIER_THRESHOLD_MS
  );

  const averageMs =
    valid.length > 0
      ? valid.reduce((a, b) => a + b, 0) / valid.length
      : measurements.reduce((a, b) => a + b, 0) / measurements.length;

  return { averageMs, measurements, outlierCount };
}
