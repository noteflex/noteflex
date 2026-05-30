import { describe, it, expect } from "vitest";
import {
  getNoteWeight,
  weightedPickIndex,
  MASTERY_WEIGHTS,
  extractNoteName,
  getSoftAvoidMultiplier,
  getKeySignatureMultiplier,
  getKeySignatureMultiplierNormalized,
  scoreToWeakMultiplier,
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

  // ─────────────────────────────────────────────────────────
  // 4-D: 신규 multiplier 함수 테스트
  // ─────────────────────────────────────────────────────────

  describe("extractNoteName", () => {
    it("clef prefix 제거 + 옥타브 숫자 제거", () => {
      expect(extractNoteName("treble:F#4")).toBe("F#");
      expect(extractNoteName("bass:Bb2")).toBe("Bb");
      expect(extractNoteName("treble:C4")).toBe("C");
      expect(extractNoteName("bass:G3")).toBe("G");
    });

    it("두 자리 옥타브도 처리", () => {
      expect(extractNoteName("treble:C10")).toBe("C");
      expect(extractNoteName("bass:F#12")).toBe("F#");
    });

    it("clef prefix 없는 입력도 음명 추출", () => {
      expect(extractNoteName("F#4")).toBe("F#");
      expect(extractNoteName("C4")).toBe("C");
    });
  });

  describe("getSoftAvoidMultiplier", () => {
    it("prevNotes 비어있으면 1.0", () => {
      expect(getSoftAvoidMultiplier([], "treble:F#4")).toBe(1.0);
    });

    it("직전 음([0]) 같은 음명 → 0.2", () => {
      expect(getSoftAvoidMultiplier(["treble:F#4"], "treble:F#4")).toBe(0.2);
    });

    it("[1] 같은 음명 → 0.5", () => {
      expect(getSoftAvoidMultiplier(["treble:C4", "treble:F#4"], "treble:F#4")).toBe(0.5);
    });

    it("[2] 같은 음명 → 0.7", () => {
      expect(
        getSoftAvoidMultiplier(
          ["treble:C4", "treble:G4", "treble:F#4"],
          "treble:F#4",
        ),
      ).toBe(0.7);
    });

    it("옥타브 다른 같은 음명도 매치", () => {
      // 직전 음 "F#4" vs 비교 대상 "F#5" → 같은 음명 F#
      expect(getSoftAvoidMultiplier(["treble:F#4"], "treble:F#5")).toBe(0.2);
    });

    it("clef 다른 같은 음명도 매치", () => {
      expect(getSoftAvoidMultiplier(["treble:F#4"], "bass:F#3")).toBe(0.2);
    });

    it("매치 없으면 1.0", () => {
      expect(
        getSoftAvoidMultiplier(
          ["treble:C4", "treble:D4", "treble:E4"],
          "treble:F#4",
        ),
      ).toBe(1.0);
    });

    it("여러 매치 동시 발생 시 가까운(가장 강한) multiplier 우선", () => {
      // [0]=F#, [1]=F#, [2]=F# 모두 매치 → 가장 강한 [0] = 0.2
      expect(
        getSoftAvoidMultiplier(
          ["treble:F#4", "treble:F#5", "bass:F#3"],
          "treble:F#4",
        ),
      ).toBe(0.2);

      // [0]=C, [1]=F#, [2]=F# → [1] 매치 = 0.5
      expect(
        getSoftAvoidMultiplier(
          ["treble:C4", "treble:F#5", "bass:F#3"],
          "treble:F#4",
        ),
      ).toBe(0.5);
    });

    it("4번째 이상 prevNotes는 무시", () => {
      // 4번째 항목과 매치 → 1.0
      expect(
        getSoftAvoidMultiplier(
          ["treble:C4", "treble:D4", "treble:E4", "treble:F#4"],
          "treble:F#4",
        ),
      ).toBe(1.0);
    });
  });

  describe("getKeySignatureMultiplier", () => {
    it("keySignatureNotes 비어있으면 1.0 (다장조)", () => {
      expect(getKeySignatureMultiplier("treble:F#4", [])).toBe(1.0);
      expect(getKeySignatureMultiplier("treble:C4", [])).toBe(1.0);
    });

    it("targetRatio=0.6: 영향 음 ×1.2, 일반 음 ×0.8", () => {
      expect(getKeySignatureMultiplier("treble:F#4", ["F#"])).toBeCloseTo(1.2);
      expect(getKeySignatureMultiplier("treble:C4", ["F#"])).toBeCloseTo(0.8);
    });

    it("targetRatio=0.5: 영향 음·일반 음 모두 1.0 (효과 없음)", () => {
      expect(getKeySignatureMultiplier("treble:F#4", ["F#"], 0.5)).toBe(1.0);
      expect(getKeySignatureMultiplier("treble:C4", ["F#"], 0.5)).toBe(1.0);
    });

    it("targetRatio=0.7: 영향 음 ×1.4, 일반 음 ×0.6", () => {
      expect(getKeySignatureMultiplier("treble:F#4", ["F#"], 0.7)).toBeCloseTo(1.4);
      expect(getKeySignatureMultiplier("treble:C4", ["F#"], 0.7)).toBeCloseTo(0.6);
    });

    it("여러 keySignatureNotes 처리 (D major: F#, C#)", () => {
      expect(getKeySignatureMultiplier("treble:F#4", ["F#", "C#"])).toBeCloseTo(1.2);
      expect(getKeySignatureMultiplier("treble:C#4", ["F#", "C#"])).toBeCloseTo(1.2);
      expect(getKeySignatureMultiplier("treble:G4", ["F#", "C#"])).toBeCloseTo(0.8);
    });
  });

  describe("getKeySignatureMultiplierNormalized", () => {
    it("keySignatureNotes 비어있으면 1.0", () => {
      expect(
        getKeySignatureMultiplierNormalized("treble:F#4", [], 10, 0),
      ).toBe(1.0);
    });

    it("poolSize=10, keyNotesInPool=2, targetRatio=0.6", () => {
      // 영향 음 = 0.6 / 2 = 0.3
      // 일반 음 = 0.4 / 8 = 0.05
      expect(
        getKeySignatureMultiplierNormalized("treble:F#4", ["F#"], 10, 2),
      ).toBeCloseTo(0.3);
      expect(
        getKeySignatureMultiplierNormalized("treble:C4", ["F#"], 10, 2),
      ).toBeCloseTo(0.05);
    });

    it("keyNotesInPool=0 → 영향 음 1.0", () => {
      // 풀에 영향 음 자체가 없는 경우 (0 나누기 방지)
      expect(
        getKeySignatureMultiplierNormalized("treble:F#4", ["F#"], 10, 0),
      ).toBe(1.0);
    });

    it("모두 영향 음 (otherCount=0) → 일반 음 분기 1.0", () => {
      expect(
        getKeySignatureMultiplierNormalized("treble:C4", ["F#"], 5, 5),
      ).toBe(1.0);
    });

    it("poolSize=0 → 1.0 (방어)", () => {
      expect(
        getKeySignatureMultiplierNormalized("treble:F#4", ["F#"], 0, 0),
      ).toBe(1.0);
    });

    it("targetRatio=0.5 (균등): 영향 음 ratio = 1/poolSize", () => {
      // poolSize=10, keyNotesInPool=2
      // 영향 음 = 0.5/2 = 0.25, 일반 음 = 0.5/8 = 0.0625
      // 합 = 2*0.25 + 8*0.0625 = 0.5 + 0.5 = 1.0 ✓
      expect(
        getKeySignatureMultiplierNormalized("treble:F#4", ["F#"], 10, 2, 0.5),
      ).toBeCloseTo(0.25);
      expect(
        getKeySignatureMultiplierNormalized("treble:C4", ["F#"], 10, 2, 0.5),
      ).toBeCloseTo(0.0625);
    });
  });

  describe("scoreToWeakMultiplier", () => {
    it("null/undefined → 1.0", () => {
      expect(scoreToWeakMultiplier(null)).toBe(1.0);
      expect(scoreToWeakMultiplier(undefined)).toBe(1.0);
    });

    it("0 → 1.0 (약점 X)", () => {
      expect(scoreToWeakMultiplier(0)).toBe(1.0);
    });

    it("0.5 → 2.0 (절반 약점, max=3.0)", () => {
      expect(scoreToWeakMultiplier(0.5)).toBe(2.0);
    });

    it("1.0 → 3.0 (최대 약점, max=3.0 기본)", () => {
      expect(scoreToWeakMultiplier(1.0)).toBe(3.0);
    });

    it("max 인자 변경 시 상한 변경", () => {
      // max=2.0 → 1.0 + 1.0*(2.0-1.0) = 2.0
      expect(scoreToWeakMultiplier(1.0, 2.0)).toBe(2.0);
      // max=5.0 → 1.0 + 0.5*(5.0-1.0) = 3.0
      expect(scoreToWeakMultiplier(0.5, 5.0)).toBe(3.0);
    });

    it("중간값 보간 (0.25 → 1.5)", () => {
      // 1.0 + 0.25*(3.0-1.0) = 1.5
      expect(scoreToWeakMultiplier(0.25)).toBe(1.5);
    });
  });
});