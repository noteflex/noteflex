import { describe, it, expect, vi, beforeEach } from "vitest";
import { measureSyncGapAverage, OUTLIER_THRESHOLD_MS } from "./audioVisualSync";

vi.mock("tone", () => ({
  default: {},
  getContext: vi.fn(),
}));
vi.mock("@/lib/sound", () => ({
  ensureAudioReady: vi.fn().mockResolvedValue(undefined),
}));

describe("measureSyncGapAverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("측정값 모두 정상 → outlierCount=0, 평균 반환", async () => {
    const mockMeasure = vi
      .fn()
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3);

    const result = await measureSyncGapAverage(3, mockMeasure);

    expect(result.measurements).toEqual([5, 8, 3]);
    expect(result.outlierCount).toBe(0);
    expect(result.averageMs).toBeCloseTo((5 + 8 + 3) / 3, 5);
  });

  it("outlier 1개 → outlierCount=1, valid만 평균", async () => {
    const mockMeasure = vi
      .fn()
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(25)   // outlier (> 20ms)
      .mockResolvedValueOnce(7);

    const result = await measureSyncGapAverage(3, mockMeasure);

    expect(result.outlierCount).toBe(1);
    expect(result.averageMs).toBeCloseTo((5 + 7) / 2, 5); // valid만 평균
  });

  it("음수 outlier → outlierCount에 포함", async () => {
    const mockMeasure = vi
      .fn()
      .mockResolvedValueOnce(-25)  // outlier
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(6);

    const result = await measureSyncGapAverage(3, mockMeasure);

    expect(result.outlierCount).toBe(1);
    expect(result.averageMs).toBeCloseTo((4 + 6) / 2, 5);
  });

  it("모두 outlier → valid 없으면 전체 평균 사용", async () => {
    const mockMeasure = vi
      .fn()
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(40);

    const result = await measureSyncGapAverage(2, mockMeasure);

    expect(result.outlierCount).toBe(2);
    expect(result.averageMs).toBeCloseTo((30 + 40) / 2, 5);
  });

  it("정확히 OUTLIER_THRESHOLD_MS 경계값은 outlier 아님", async () => {
    const mockMeasure = vi
      .fn()
      .mockResolvedValueOnce(OUTLIER_THRESHOLD_MS)
      .mockResolvedValueOnce(-OUTLIER_THRESHOLD_MS);

    const result = await measureSyncGapAverage(2, mockMeasure);

    expect(result.outlierCount).toBe(0);
  });

  it("count=1 단일 측정", async () => {
    const mockMeasure = vi.fn().mockResolvedValueOnce(12);

    const result = await measureSyncGapAverage(1, mockMeasure);

    expect(result.measurements).toHaveLength(1);
    expect(result.averageMs).toBe(12);
  });

  it("measurements 배열 순서 보존", async () => {
    const mockMeasure = vi
      .fn()
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(15);

    const result = await measureSyncGapAverage(3, mockMeasure);

    expect(result.measurements).toEqual([10, 5, 15]);
  });
});
