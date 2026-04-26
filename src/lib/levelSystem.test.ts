import { describe, it, expect } from "vitest";
import { getStagesFor, totalNotesInStages, CUSTOM_SCORE_STAGES } from "./levelSystem";

import {
  SUBLEVEL_CONFIGS,
  PASS_CRITERIA,
  TOTAL_SUBLEVELS,
  calculateAccuracy,
  checkPassed,
  getCompletion,
  canAccessSublevel,
  getAllSublevels,
  formatSublevel,
  getNextSublevel,
  getPreviousSublevel,
  isValidSublevel,
  type SublevelProgress,
  type Sublevel,
} from "./levelSystem";

// 헬퍼: 기본 progress 객체 생성
function makeProgress(overrides: Partial<SublevelProgress> = {}): SublevelProgress {
  return {
    level: 1,
    sublevel: 1 as Sublevel,
    play_count: 0,
    best_streak: 0,
    total_attempts: 0,
    total_correct: 0,
    passed: false,
    ...overrides,
  };
}

describe("SUBLEVEL_CONFIGS", () => {
  it("서브레벨 1: 7초 / 목숨 5", () => {
    expect(SUBLEVEL_CONFIGS[1].timeLimit).toBe(7);
    expect(SUBLEVEL_CONFIGS[1].lives).toBe(5);
    expect(SUBLEVEL_CONFIGS[1].label).toBe("입문");
  });

  it("서브레벨 2: 5초 / 목숨 4", () => {
    expect(SUBLEVEL_CONFIGS[2].timeLimit).toBe(5);
    expect(SUBLEVEL_CONFIGS[2].lives).toBe(4);
    expect(SUBLEVEL_CONFIGS[2].label).toBe("숙련");
  });

  it("서브레벨 3: 3초 / 목숨 3", () => {
    expect(SUBLEVEL_CONFIGS[3].timeLimit).toBe(3);
    expect(SUBLEVEL_CONFIGS[3].lives).toBe(3);
    expect(SUBLEVEL_CONFIGS[3].label).toBe("마스터");
  });
});

describe("PASS_CRITERIA", () => {
  it("통과 조건 상수값", () => {
    expect(PASS_CRITERIA.MIN_PLAY_COUNT).toBe(5);
    expect(PASS_CRITERIA.MIN_BEST_STREAK).toBe(5);
    expect(PASS_CRITERIA.MIN_ACCURACY).toBe(0.8);
  });
});

describe("calculateAccuracy", () => {
  it("시도 0회면 0", () => {
    expect(calculateAccuracy(makeProgress())).toBe(0);
  });

  it("정답률 80% 정확히", () => {
    const p = makeProgress({ total_attempts: 10, total_correct: 8 });
    expect(calculateAccuracy(p)).toBeCloseTo(0.8);
  });

  it("정답률 100%", () => {
    const p = makeProgress({ total_attempts: 5, total_correct: 5 });
    expect(calculateAccuracy(p)).toBe(1);
  });

  it("정답률 0% (모두 오답)", () => {
    const p = makeProgress({ total_attempts: 10, total_correct: 0 });
    expect(calculateAccuracy(p)).toBe(0);
  });
});

describe("checkPassed - 3개 조건 모두 충족 검증", () => {
  it("모든 조건 충족 → passed=true", () => {
    const p = makeProgress({
      play_count: 5,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 8, // 80%
    });
    expect(checkPassed(p)).toBe(true);
  });

  it("play_count 부족 → passed=false", () => {
    const p = makeProgress({
      play_count: 4, // 미달
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9,
    });
    expect(checkPassed(p)).toBe(false);
  });

  it("best_streak 부족 → passed=false", () => {
    const p = makeProgress({
      play_count: 5,
      best_streak: 4, // 미달
      total_attempts: 10,
      total_correct: 9,
    });
    expect(checkPassed(p)).toBe(false);
  });

  it("accuracy 부족 → passed=false", () => {
    const p = makeProgress({
      play_count: 5,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 7, // 70%
    });
    expect(checkPassed(p)).toBe(false);
  });

  it("정확히 경계값 (5, 5, 80%) → passed=true", () => {
    const p = makeProgress({
      play_count: 5,
      best_streak: 5,
      total_attempts: 100,
      total_correct: 80, // 80% 정확히
    });
    expect(checkPassed(p)).toBe(true);
  });
});

describe("getCompletion - UI 진행률", () => {
  it("아무것도 안 했을 때", () => {
    const c = getCompletion(makeProgress());
    expect(c.playCount.satisfied).toBe(false);
    expect(c.bestStreak.satisfied).toBe(false);
    expect(c.accuracy.satisfied).toBe(false);
    expect(c.allSatisfied).toBe(false);
  });

  it("정답률만 미달", () => {
    const p = makeProgress({
      play_count: 5,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 7, // 70%
    });
    const c = getCompletion(p);
    expect(c.playCount.satisfied).toBe(true);
    expect(c.bestStreak.satisfied).toBe(true);
    expect(c.accuracy.satisfied).toBe(false);
    expect(c.allSatisfied).toBe(false);
  });

  it("모두 충족", () => {
    const p = makeProgress({
      play_count: 5,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9,
    });
    const c = getCompletion(p);
    expect(c.allSatisfied).toBe(true);
  });
});

describe("canAccessSublevel - 구독 게이트", () => {
  describe("guest (미가입)", () => {
    it("Lv 1 모든 서브레벨 접근 가능", () => {
      expect(canAccessSublevel("guest", 1, 1)).toBe(true);
      expect(canAccessSublevel("guest", 1, 2)).toBe(true);
      expect(canAccessSublevel("guest", 1, 3)).toBe(true);
    });

    it("Lv 2 이상은 접근 불가", () => {
      expect(canAccessSublevel("guest", 2, 1)).toBe(false);
      expect(canAccessSublevel("guest", 3, 1)).toBe(false);
      expect(canAccessSublevel("guest", 7, 3)).toBe(false);
    });
  });

  describe("free (일반 가입)", () => {
    it("Lv 1·2 모두 접근 가능", () => {
      expect(canAccessSublevel("free", 1, 1)).toBe(true);
      expect(canAccessSublevel("free", 1, 3)).toBe(true);
      expect(canAccessSublevel("free", 2, 1)).toBe(true);
      expect(canAccessSublevel("free", 2, 3)).toBe(true);
    });

    it("Lv 3-1, Lv 4-1만 접근 가능 (맛보기)", () => {
      expect(canAccessSublevel("free", 3, 1)).toBe(true);
      expect(canAccessSublevel("free", 4, 1)).toBe(true);
    });

    it("Lv 3-2, 3-3, 4-2, 4-3은 접근 불가", () => {
      expect(canAccessSublevel("free", 3, 2)).toBe(false);
      expect(canAccessSublevel("free", 3, 3)).toBe(false);
      expect(canAccessSublevel("free", 4, 2)).toBe(false);
      expect(canAccessSublevel("free", 4, 3)).toBe(false);
    });

    it("Lv 5 이상은 접근 불가", () => {
      expect(canAccessSublevel("free", 5, 1)).toBe(false);
      expect(canAccessSublevel("free", 6, 2)).toBe(false);
      expect(canAccessSublevel("free", 7, 3)).toBe(false);
    });
  });

  describe("pro (구독)", () => {
    it("21단계 모두 접근 가능", () => {
      for (let level = 1; level <= 7; level++) {
        for (const sublevel of [1, 2, 3] as Sublevel[]) {
          expect(canAccessSublevel("pro", level, sublevel)).toBe(true);
        }
      }
    });
  });
});

describe("getAllSublevels", () => {
  it("총 21단계 반환", () => {
    expect(getAllSublevels()).toHaveLength(TOTAL_SUBLEVELS);
  });

  it("첫 번째는 Lv 1-1", () => {
    const all = getAllSublevels();
    expect(all[0].level).toBe(1);
    expect(all[0].sublevel).toBe(1);
  });

  it("마지막은 Lv 7-3", () => {
    const all = getAllSublevels();
    expect(all[20].level).toBe(7);
    expect(all[20].sublevel).toBe(3);
  });

  it("순서: 1-1, 1-2, 1-3, 2-1, ...", () => {
    const all = getAllSublevels();
    expect(all[1]).toMatchObject({ level: 1, sublevel: 2 });
    expect(all[2]).toMatchObject({ level: 1, sublevel: 3 });
    expect(all[3]).toMatchObject({ level: 2, sublevel: 1 });
  });
});

describe("formatSublevel", () => {
  it("'Lv 2-3' 포맷", () => {
    expect(formatSublevel(2, 3)).toBe("Lv 2-3");
  });

  it("'Lv 1-1'", () => {
    expect(formatSublevel(1, 1)).toBe("Lv 1-1");
  });
});

describe("getNextSublevel", () => {
  it("Lv 1-1 다음은 Lv 1-2", () => {
    expect(getNextSublevel(1, 1)).toEqual({ level: 1, sublevel: 2 });
  });

  it("Lv 1-3 다음은 Lv 2-1", () => {
    expect(getNextSublevel(1, 3)).toEqual({ level: 2, sublevel: 1 });
  });

  it("Lv 7-3 다음은 null (최종)", () => {
    expect(getNextSublevel(7, 3)).toBe(null);
  });
});

describe("getPreviousSublevel", () => {
  it("Lv 1-2 이전은 Lv 1-1", () => {
    expect(getPreviousSublevel(1, 2)).toEqual({ level: 1, sublevel: 1 });
  });

  it("Lv 2-1 이전은 Lv 1-3", () => {
    expect(getPreviousSublevel(2, 1)).toEqual({ level: 1, sublevel: 3 });
  });

  it("Lv 1-1 이전은 null (최초)", () => {
    expect(getPreviousSublevel(1, 1)).toBe(null);
  });
});

describe("isValidSublevel", () => {
  it("유효한 입력", () => {
    expect(isValidSublevel(1, 1)).toBe(true);
    expect(isValidSublevel(7, 3)).toBe(true);
    expect(isValidSublevel(4, 2)).toBe(true);
  });

  it("범위 밖 level", () => {
    expect(isValidSublevel(0, 1)).toBe(false);
    expect(isValidSublevel(8, 1)).toBe(false);
    expect(isValidSublevel(-1, 1)).toBe(false);
  });

  it("범위 밖 sublevel", () => {
    expect(isValidSublevel(1, 0)).toBe(false);
    expect(isValidSublevel(1, 4)).toBe(false);
  });

  it("정수가 아닌 입력", () => {
    expect(isValidSublevel(1.5, 1)).toBe(false);
    expect(isValidSublevel(1, 1.5)).toBe(false);
  });
});

describe("SUBLEVEL_CONFIGS — stage 구성", () => {
  it("sublevel 1 (입문): 27노트, 3 stages", () => {
    const stages = SUBLEVEL_CONFIGS[1].stages;
    expect(stages).toHaveLength(3);
    expect(totalNotesInStages(stages)).toBe(27);
  });

  it("sublevel 2 (숙련): 40노트, 3 stages", () => {
    const stages = SUBLEVEL_CONFIGS[2].stages;
    expect(stages).toHaveLength(3);
    expect(totalNotesInStages(stages)).toBe(40);
  });

  it("sublevel 3 (마스터): 66노트, 4 stages", () => {
    const stages = SUBLEVEL_CONFIGS[3].stages;
    expect(stages).toHaveLength(4);
    expect(totalNotesInStages(stages)).toBe(66);
  });

  it("모든 sublevel의 stage는 batchSize, totalSets, notesPerSet > 0", () => {
    for (const sublevel of [1, 2, 3] as const) {
      for (const stage of SUBLEVEL_CONFIGS[sublevel].stages) {
        expect(stage.batchSize).toBeGreaterThan(0);
        expect(stage.totalSets).toBeGreaterThan(0);
        expect(stage.notesPerSet).toBeGreaterThan(0);
      }
    }
  });

  it("stage 번호는 1부터 순차", () => {
    for (const sublevel of [1, 2, 3] as const) {
      const stages = SUBLEVEL_CONFIGS[sublevel].stages;
      stages.forEach((s, i) => {
        expect(s.stage).toBe(i + 1);
      });
    }
  });
});

describe("getStagesFor", () => {
  it("sublevel 1·2·3 → SUBLEVEL_CONFIGS[sublevel].stages", () => {
    expect(getStagesFor(1)).toBe(SUBLEVEL_CONFIGS[1].stages);
    expect(getStagesFor(2)).toBe(SUBLEVEL_CONFIGS[2].stages);
    expect(getStagesFor(3)).toBe(SUBLEVEL_CONFIGS[3].stages);
  });

  it("isCustom=true → CUSTOM_SCORE_STAGES (sublevel 무관)", () => {
    expect(getStagesFor(1, true)).toBe(CUSTOM_SCORE_STAGES);
    expect(getStagesFor(2, true)).toBe(CUSTOM_SCORE_STAGES);
    expect(getStagesFor(3, true)).toBe(CUSTOM_SCORE_STAGES);
  });

  it("isCustom=false (기본) → sublevel 따라 다름", () => {
    expect(getStagesFor(1, false)).toBe(SUBLEVEL_CONFIGS[1].stages);
    expect(getStagesFor(3, false)).toBe(SUBLEVEL_CONFIGS[3].stages);
  });
});

describe("totalNotesInStages", () => {
  it("빈 배열은 0", () => {
    expect(totalNotesInStages([])).toBe(0);
  });

  it("단일 stage: totalSets × notesPerSet", () => {
    expect(totalNotesInStages([
      { stage: 1, batchSize: 1, totalSets: 3, notesPerSet: 5 },
    ])).toBe(15);
  });

  it("여러 stage 합산", () => {
    expect(totalNotesInStages([
      { stage: 1, batchSize: 1, totalSets: 2, notesPerSet: 3 }, // 6
      { stage: 2, batchSize: 3, totalSets: 3, notesPerSet: 5 }, // 15
    ])).toBe(21);
  });
});
