import { describe, it, expect } from "vitest";
import { generateBatch, generateKeyBatch } from "./NoteGame";

/**
 * Cross-batch dedup 테스트 (옵션 D, §0.1 N+2 즉시 등장 버그 수정).
 *
 * 기존 generateBatch/generateKeyBatch는 "같은 batch 안에서" 인접 중복만 막았다.
 * batchSize=1인 stage(Lv1~4 초반)에서는 매 advance마다 새 batch를 생성하므로
 * batch[0]이 직전 정답 음표와 같은 음표로 픽될 수 있어 사용자가 "바로 다음 음표가 같다"고 체감.
 * lastShownNote 인자를 받아 batch[0]도 그것과 다르게 픽하도록 한다.
 */

const NOTE_G4 = { name: "솔", key: "G", y: 0, octave: "4" };
const NOTE_A4 = { name: "라", key: "A", y: 0, octave: "4" };
const NOTE_F4 = { name: "파", key: "F", y: 0, octave: "4" };

describe("generateBatch — cross-batch dedup (옵션 D)", () => {
  it("lastShownNote와 같은 음표는 batch[0]으로 나오지 않음 (size=1, 100회)", () => {
    const pool = [NOTE_G4, NOTE_A4, NOTE_F4];
    const lastShown = { ...NOTE_G4, clef: "treble" as const };

    for (let i = 0; i < 100; i++) {
      const batch = generateBatch(pool, 1, "treble", new Map(), lastShown);
      const same =
        batch[0].key === lastShown.key && batch[0].octave === lastShown.octave;
      expect(same).toBe(false);
    }
  });

  it("lastShownNote 미제공 시 기존 동작 유지", () => {
    const pool = [NOTE_G4];
    const batch = generateBatch(pool, 1, "treble", new Map());
    expect(batch[0].key).toBe("G");
    expect(batch[0].octave).toBe("4");
  });

  it("pool에 lastShownNote뿐이면 fallback 반환 (무한 루프 방지)", () => {
    const pool = [NOTE_G4];
    const lastShown = { ...NOTE_G4, clef: "treble" as const };
    const batch = generateBatch(pool, 1, "treble", new Map(), lastShown);
    expect(batch[0].key).toBe("G");
  });

  it("size>1: 첫 슬롯도 lastShownNote 회피", () => {
    const pool = [NOTE_G4, NOTE_A4, NOTE_F4];
    const lastShown = { ...NOTE_G4, clef: "treble" as const };

    for (let i = 0; i < 50; i++) {
      const batch = generateBatch(pool, 3, "treble", new Map(), lastShown);
      const sameFirst =
        batch[0].key === lastShown.key && batch[0].octave === lastShown.octave;
      expect(sameFirst).toBe(false);
    }
  });
});

describe("generateKeyBatch — cross-batch dedup (옵션 D)", () => {
  it("lastShownNote와 같은 음표는 batch[0]으로 나오지 않음 (key=C, size=1, 100회)", () => {
    // size=1인 경우 pickBalancedCount(1)=1 → 항상 treble로 픽 (현 구현).
    const keySig = { key: "C", abcKey: "C" };
    // GRAND_TREBLE_NOTES에 포함된 음표를 lastShown으로 사용 (dedup 경로 활성화)
    const lastShown = {
      name: "솔",
      key: "G",
      y: 0,
      octave: "4",
      clef: "treble" as const,
    };

    let duplicateCount = 0;
    for (let i = 0; i < 100; i++) {
      const result = generateKeyBatch(5, 1, keySig, new Map(), lastShown);
      const first = result.notes[0];
      if (
        first.clef === lastShown.clef &&
        first.key === lastShown.key &&
        first.octave === lastShown.octave
      ) {
        duplicateCount++;
      }
    }
    expect(duplicateCount).toBe(0);
  });
});
