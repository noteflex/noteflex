import { describe, it, expect } from "vitest";
import {
  calculateTrimmedMean,
  clampOffset,
  isSyncOutlier,
  TRIM_COUNT,
  SYNC_OUTLIER_THRESHOLD_MS,
} from "./calibrationMeasurement";

describe("calculateTrimmedMean", () => {
  it("5개 샘플 → 최고/최저 1개 제거 후 3개 평균", () => {
    // sorted: [100, 200, 300, 400, 500] → trim → [200, 300, 400]
    const result = calculateTrimmedMean([300, 100, 500, 200, 400]);
    expect(result).toBeCloseTo((200 + 300 + 400) / 3, 5);
  });

  it("3개 샘플 → 최고/최저 1개 제거 후 1개 평균 (중앙값)", () => {
    // sorted: [1, 2, 3] → trim → [2]
    const result = calculateTrimmedMean([3, 1, 2]);
    expect(result).toBe(2);
  });

  it(`샘플 수 ≤ TRIM_COUNT*2(${TRIM_COUNT * 2})이면 단순 평균`, () => {
    // TRIM_COUNT=1 → TRIM_COUNT*2=2 → 2개 이하면 단순 평균
    const result = calculateTrimmedMean([100, 300]);
    expect(result).toBe(200);
  });

  it("단일 샘플 → 그 값 반환", () => {
    expect(calculateTrimmedMean([150])).toBe(150);
  });

  it("빈 배열 → 0", () => {
    expect(calculateTrimmedMean([])).toBe(0);
  });

  it("모두 같은 값 → 그 값 반환", () => {
    expect(calculateTrimmedMean([200, 200, 200, 200, 200])).toBe(200);
  });

  it("6개 샘플 → 최고/최저 1개씩 제거 후 4개 평균", () => {
    // sorted: [10, 20, 30, 40, 50, 60] → trim → [20, 30, 40, 50]
    const result = calculateTrimmedMean([30, 10, 60, 20, 50, 40]);
    expect(result).toBeCloseTo((20 + 30 + 40 + 50) / 4, 5);
  });
});

describe("clampOffset", () => {
  it("음수 → 0 (Q-K)", () => {
    expect(clampOffset(-50)).toBe(0);
  });

  it("0 → 0", () => {
    expect(clampOffset(0)).toBe(0);
  });

  it("양수 → 그대로", () => {
    expect(clampOffset(120)).toBe(120);
  });

  it("소수점 양수 → 그대로", () => {
    expect(clampOffset(12.5)).toBe(12.5);
  });
});

describe("isSyncOutlier", () => {
  it(`양수 gap > ${SYNC_OUTLIER_THRESHOLD_MS}ms → outlier`, () => {
    expect(isSyncOutlier(25)).toBe(true);
  });

  it(`음수 gap < -${SYNC_OUTLIER_THRESHOLD_MS}ms → outlier`, () => {
    expect(isSyncOutlier(-25)).toBe(true);
  });

  it(`정확히 ${SYNC_OUTLIER_THRESHOLD_MS}ms → outlier 아님 (경계 포함)`, () => {
    expect(isSyncOutlier(20)).toBe(false);
    expect(isSyncOutlier(-20)).toBe(false);
  });

  it("0 → outlier 아님", () => {
    expect(isSyncOutlier(0)).toBe(false);
  });

  it("커스텀 threshold 적용", () => {
    expect(isSyncOutlier(10, 5)).toBe(true);
    expect(isSyncOutlier(5, 10)).toBe(false);
  });
});
