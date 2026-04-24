import { describe, it, expect } from "vitest";
import {
  getNoteWeight,
  weightedPickIndex,
  MASTERY_WEIGHTS,
} from "./noteWeighting";
import type { MasteryMap } from "@/hooks/useUserMastery";

describe("noteWeighting", () => {
  describe("getNoteWeight", () => {
    it("빈 맵이면 모든 음표 1.0", () => {
      const empty: MasteryMap = new Map();
      expect(getNoteWeight(empty, "treble", "F", "4")).toBe(1.0);
      expect(getNoteWeight(empty, "bass", "C", "3")).toBe(1.0);
    });

    it("맵에 없는 음표는 normal(1.0)", () => {
      const map: MasteryMap = new Map([["treble:F4", "weakness"]]);
      expect(getNoteWeight(map, "treble", "G", "4")).toBe(1.0);
    });

    it("weakness 플래그는 3.0", () => {
      const map: MasteryMap = new Map([["treble:F4", "weakness"]]);
      expect(getNoteWeight(map, "treble", "F", "4")).toBe(3.0);
    });

    it("mastery 플래그는 0.3", () => {
      const map: MasteryMap = new Map([["treble:G4", "mastery"]]);
      expect(getNoteWeight(map, "treble", "G", "4")).toBe(0.3);
    });

    it("같은 key라도 clef 다르면 별개", () => {
      const map: MasteryMap = new Map([["treble:F4", "weakness"]]);
      expect(getNoteWeight(map, "treble", "F", "4")).toBe(3.0);
      expect(getNoteWeight(map, "bass", "F", "4")).toBe(1.0); // normal
    });

    it("조표(accidental) 포함 키로 조회", () => {
      const map: MasteryMap = new Map([["treble:F#4", "weakness"]]);
      expect(getNoteWeight(map, "treble", "F", "4", "#")).toBe(3.0);
      expect(getNoteWeight(map, "treble", "F", "4")).toBe(1.0); // 조표 없음 → 다른 음
    });
  });

  describe("weightedPickIndex", () => {
    it("빈 배열이면 -1", () => {
      expect(weightedPickIndex([])).toBe(-1);
    });

    it("가중치 모두 0이면 균등 랜덤", () => {
      const results = new Set<number>();
      for (let i = 0; i < 100; i++) {
        const idx = weightedPickIndex([0, 0, 0, 0]);
        results.add(idx);
      }
      // 균등이면 4가지 모두 나올 가능성이 매우 높음
      expect(results.size).toBeGreaterThan(1);
    });

    it("단일 항목은 0 반환", () => {
      expect(weightedPickIndex([1])).toBe(0);
      expect(weightedPickIndex([100])).toBe(0);
    });

    it("가중치 비율만큼 분포 (통계 테스트, N=10000)", () => {
      // weights: [3, 1, 1, 1] → 합 6 → 각 확률 50%, 16.7%, 16.7%, 16.7%
      const weights = [3, 1, 1, 1];
      const counts = [0, 0, 0, 0];
      const N = 10000;

      for (let i = 0; i < N; i++) {
        const idx = weightedPickIndex(weights);
        counts[idx]++;
      }

      // 이론값: [5000, 1667, 1667, 1667]
      // 오차 ±5% 허용 (대규모 샘플이라 실제로는 훨씬 좁음)
      expect(counts[0]).toBeGreaterThan(4500);
      expect(counts[0]).toBeLessThan(5500);
      expect(counts[1]).toBeGreaterThan(1400);
      expect(counts[1]).toBeLessThan(1900);
      expect(counts[2]).toBeGreaterThan(1400);
      expect(counts[2]).toBeLessThan(1900);
      expect(counts[3]).toBeGreaterThan(1400);
      expect(counts[3]).toBeLessThan(1900);
    });

    it("weakness × mastery 혼합 분포 검증", () => {
      // 실전 시나리오: [weakness(3), normal(1), mastery(0.3)]
      // 합: 4.3
      // 확률: weakness 69.8%, normal 23.3%, mastery 7.0%
      const weights = [
        MASTERY_WEIGHTS.weakness,
        MASTERY_WEIGHTS.normal,
        MASTERY_WEIGHTS.mastery,
      ];
      const counts = [0, 0, 0];
      const N = 10000;

      for (let i = 0; i < N; i++) {
        counts[weightedPickIndex(weights)]++;
      }

      // weakness가 normal보다 ~3배 많이 나와야 함
      expect(counts[0] / counts[1]).toBeGreaterThan(2.5);
      expect(counts[0] / counts[1]).toBeLessThan(3.5);

      // mastery는 normal보다 ~3.3배 적게
      expect(counts[1] / counts[2]).toBeGreaterThan(2.5);
      expect(counts[1] / counts[2]).toBeLessThan(4.5);
    });
  });

  describe("MASTERY_WEIGHTS 상수", () => {
    it("weakness=3.0, normal=1.0, mastery=0.3", () => {
      expect(MASTERY_WEIGHTS.weakness).toBe(3.0);
      expect(MASTERY_WEIGHTS.normal).toBe(1.0);
      expect(MASTERY_WEIGHTS.mastery).toBe(0.3);
    });
  });
});