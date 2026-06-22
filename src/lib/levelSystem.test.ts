import { describe, it, expect } from "vitest";
import { getStagesFor, totalNotesInStages, CUSTOM_SCORE_STAGES } from "./levelSystem";

import {
  SUBLEVEL_CONFIGS,
  LV5_SUBLEVEL_STAGES,
  PASS_CRITERIA,
  TOTAL_SUBLEVELS,
  calculateAccuracy,
  checkPassed,
  getCompletion,
  canAccessSublevel,
  getProgressGatePrev,
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
    expect(PASS_CRITERIA.MIN_ACCURACY).toBe(0.85);
    expect(PASS_CRITERIA.MIN_AVG_REACTION_RATIO).toBe(0.35);
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

describe("checkPassed - 4개 조건 모두 충족 검증", () => {
  it("모든 조건 충족 → passed=true", () => {
    const p = makeProgress({
      play_count: 10,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9, // 90%
    });
    expect(checkPassed(p)).toBe(true);
  });

  it("play_count 부족 → passed=false", () => {
    const p = makeProgress({
      play_count: 9, // 미달
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9,
    });
    expect(checkPassed(p)).toBe(false);
  });

  it("best_streak 부족 → passed=false", () => {
    const p = makeProgress({
      play_count: 10,
      best_streak: 4, // 미달
      total_attempts: 10,
      total_correct: 9,
    });
    expect(checkPassed(p)).toBe(false);
  });

  it("accuracy 부족 → passed=false", () => {
    const p = makeProgress({
      play_count: 10,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 7, // 70%
    });
    expect(checkPassed(p)).toBe(false);
  });

  it("정확히 경계값 (10, 5, 85%) → passed=true", () => {
    const p = makeProgress({
      play_count: 10,
      best_streak: 5,
      total_attempts: 100,
      total_correct: 85, // 85% 정확히
    });
    expect(checkPassed(p)).toBe(true);
  });

  it("avg_reaction_ratio 없음 (undefined) → 통과 처리", () => {
    const p = makeProgress({
      play_count: 10,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9,
      // avg_reaction_ratio 미기록
    });
    expect(checkPassed(p)).toBe(true);
  });

  it("avg_reaction_ratio 기준 이하 (0.34 < 0.35) → passed=true", () => {
    const p = makeProgress({
      sublevel: 1,
      play_count: 10,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9,
      avg_reaction_ratio: 0.34,
    });
    expect(checkPassed(p)).toBe(true);
  });

  it("avg_reaction_ratio 초과 (0.36 > 0.35) → passed=false", () => {
    const p = makeProgress({
      sublevel: 1,
      play_count: 10,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9,
      avg_reaction_ratio: 0.36,
    });
    expect(checkPassed(p)).toBe(false);
  });

  it("avg_reaction_ratio 경계값 (0.35 = 기준) → passed=true", () => {
    const ok = makeProgress({
      sublevel: 3,
      play_count: 10,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9,
      avg_reaction_ratio: 0.35,
    });
    const fail = makeProgress({
      sublevel: 3,
      play_count: 10,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9,
      avg_reaction_ratio: 0.351,
    });
    expect(checkPassed(ok)).toBe(true);
    expect(checkPassed(fail)).toBe(false);
  });
});

describe("getCompletion - UI 진행률", () => {
  it("아무것도 안 했을 때", () => {
    const c = getCompletion(makeProgress());
    expect(c.playCount.satisfied).toBe(false);
    expect(c.bestStreak.satisfied).toBe(false);
    expect(c.accuracy.satisfied).toBe(false);
    expect(c.avgReactionRatio.satisfied).toBe(true); // 미기록 → 통과 처리
    expect(c.allSatisfied).toBe(false);
  });

  it("정답률만 미달", () => {
    const p = makeProgress({
      play_count: 10,
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

  it("모두 충족 (avg_reaction_ratio 없음)", () => {
    const p = makeProgress({
      play_count: 10,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9,
    });
    const c = getCompletion(p);
    expect(c.allSatisfied).toBe(true);
  });

  it("avgReactionRatio required = 0.35 (서브레벨 무관)", () => {
    const c1 = getCompletion(makeProgress({ sublevel: 1 }));
    expect(c1.avgReactionRatio.required).toBeCloseTo(0.35);

    const c3 = getCompletion(makeProgress({ sublevel: 3 }));
    expect(c3.avgReactionRatio.required).toBeCloseTo(0.35);
  });

  it("avg_reaction_ratio 기록 있을 때 current 반영", () => {
    const p = makeProgress({ sublevel: 1, avg_reaction_ratio: 0.3 });
    const c = getCompletion(p);
    expect(c.avgReactionRatio.current).toBe(0.3);
    expect(c.avgReactionRatio.satisfied).toBe(true);
  });

  it("avg_reaction_ratio 초과 시 allSatisfied=false", () => {
    const p = makeProgress({
      sublevel: 1,
      play_count: 10,
      best_streak: 5,
      total_attempts: 10,
      total_correct: 9,
      avg_reaction_ratio: 0.4, // > 0.35
    });
    const c = getCompletion(p);
    expect(c.avgReactionRatio.satisfied).toBe(false);
    expect(c.allSatisfied).toBe(false);
  });
});

describe("canAccessSublevel - 구독 게이트 (2026-06-13 결정)", () => {
  describe("guest (미가입)", () => {
    it("Lv 1-1만 접근 가능", () => {
      expect(canAccessSublevel("guest", 1, 1)).toBe(true);
    });

    it("Lv 1-2, 1-3은 접근 불가 (Sub2·Sub3 영구 잠금)", () => {
      expect(canAccessSublevel("guest", 1, 2)).toBe(false);
      expect(canAccessSublevel("guest", 1, 3)).toBe(false);
    });

    it("Lv 2 이상은 접근 불가", () => {
      expect(canAccessSublevel("guest", 2, 1)).toBe(false);
      expect(canAccessSublevel("guest", 3, 1)).toBe(false);
      expect(canAccessSublevel("guest", 7, 3)).toBe(false);
    });
  });

  describe("free (일반 가입)", () => {
    it("Lv 1~2 전체 (6단계) + Lv 3 Sub1 접근 가능", () => {
      // Lv 1 전체
      expect(canAccessSublevel("free", 1, 1)).toBe(true);
      expect(canAccessSublevel("free", 1, 2)).toBe(true);
      expect(canAccessSublevel("free", 1, 3)).toBe(true);
      // Lv 2 전체
      expect(canAccessSublevel("free", 2, 1)).toBe(true);
      expect(canAccessSublevel("free", 2, 2)).toBe(true);
      expect(canAccessSublevel("free", 2, 3)).toBe(true);
      // Lv 3 Sub1
      expect(canAccessSublevel("free", 3, 1)).toBe(true);
    });

    it("Lv 3 Sub2·Sub3는 잠금 (Premium 전용)", () => {
      expect(canAccessSublevel("free", 3, 2)).toBe(false);
      expect(canAccessSublevel("free", 3, 3)).toBe(false);
    });

    it("Lv 4 이상 전체 잠금 (Premium 전용)", () => {
      expect(canAccessSublevel("free", 4, 1)).toBe(false);
      expect(canAccessSublevel("free", 5, 1)).toBe(false);
      expect(canAccessSublevel("free", 6, 1)).toBe(false);
      expect(canAccessSublevel("free", 7, 1)).toBe(false);
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

describe("getProgressGatePrev - tier 인식 진도 게이트", () => {
  describe("guest", () => {
    it("항상 null (Lv 1-1 이 유일한 진입점)", () => {
      expect(getProgressGatePrev("guest", 1, 1)).toBeNull();
    });
  });

  describe("free (2026-06-13: 표준 21단계 순서로 위임)", () => {
    it("Lv 1-1 선행 없음 → null", () => {
      expect(getProgressGatePrev("free", 1, 1)).toBeNull();
    });

    it("Lv 1-2 선행 = Lv 1-1 (Sub 내 순차)", () => {
      expect(getProgressGatePrev("free", 1, 2)).toEqual({ level: 1, sublevel: 1 });
    });

    it("Lv 2-1 선행 = Lv 1-3 (레벨 경계)", () => {
      expect(getProgressGatePrev("free", 2, 1)).toEqual({ level: 1, sublevel: 3 });
    });

    it("Lv 2-3 선행 = Lv 2-2", () => {
      expect(getProgressGatePrev("free", 2, 3)).toEqual({ level: 2, sublevel: 2 });
    });

    it("Lv 3-1 선행 = Lv 2-3 (Free 최대 도달 직전)", () => {
      expect(getProgressGatePrev("free", 3, 1)).toEqual({ level: 2, sublevel: 3 });
    });
  });

  describe("pro", () => {
    it("Lv 1-1 선행 없음 → null (표준 21단계)", () => {
      expect(getProgressGatePrev("pro", 1, 1)).toBeNull();
    });

    it("Lv 1-2 선행 = Lv 1-1 (표준 21단계)", () => {
      expect(getProgressGatePrev("pro", 1, 2)).toEqual({ level: 1, sublevel: 1 });
    });

    it("Lv 2-1 선행 = Lv 1-3 (표준 21단계, 레벨 경계)", () => {
      expect(getProgressGatePrev("pro", 2, 1)).toEqual({ level: 1, sublevel: 3 });
    });

    it("Lv 7-3 선행 = Lv 7-2 (표준 21단계, 최종 직전)", () => {
      expect(getProgressGatePrev("pro", 7, 3)).toEqual({ level: 7, sublevel: 2 });
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
  it("sublevel 1 (입문): 30노트, 1 stage", () => {
    const stages = SUBLEVEL_CONFIGS[1].stages;
    expect(stages).toHaveLength(1);
    expect(totalNotesInStages(stages)).toBe(30);
  });

  it("sublevel 2 (숙련): 36노트, 2 stages", () => {
    const stages = SUBLEVEL_CONFIGS[2].stages;
    expect(stages).toHaveLength(2);
    expect(totalNotesInStages(stages)).toBe(36);
  });

  it("sublevel 3 (마스터): 42노트, 3 stages", () => {
    const stages = SUBLEVEL_CONFIGS[3].stages;
    expect(stages).toHaveLength(3);
    expect(totalNotesInStages(stages)).toBe(42);
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

  it("Sub 1: stage[0] batchSize=3·totalSets=10·notesPerSet=3 (단일 stage)", () => {
    const stages = SUBLEVEL_CONFIGS[1].stages;
    expect(stages[0]).toMatchObject({ batchSize: 3, totalSets: 10, notesPerSet: 3 });
  });

  it("Sub 2: stage[0] batchSize=3·totalSets=2, stage[1] batchSize=5·totalSets=6", () => {
    const stages = SUBLEVEL_CONFIGS[2].stages;
    expect(stages[0]).toMatchObject({ batchSize: 3, totalSets: 2, notesPerSet: 3 });
    expect(stages[1]).toMatchObject({ batchSize: 5, totalSets: 6, notesPerSet: 5 });
  });

  it("Sub 3: stage[0] batchSize=3·totalSets=2, stage[1] batchSize=5·totalSets=3, stage[2] batchSize=7·totalSets=3", () => {
    const stages = SUBLEVEL_CONFIGS[3].stages;
    expect(stages[0]).toMatchObject({ batchSize: 3, totalSets: 2, notesPerSet: 3 });
    expect(stages[1]).toMatchObject({ batchSize: 5, totalSets: 3, notesPerSet: 5 });
    expect(stages[2]).toMatchObject({ batchSize: 7, totalSets: 3, notesPerSet: 7 });
  });

  it("SUBLEVEL_CONFIGS에 batchSize=1 stage 없음", () => {
    for (const sublevel of [1, 2, 3] as const) {
      for (const s of SUBLEVEL_CONFIGS[sublevel].stages) {
        expect(s.batchSize).not.toBe(1);
      }
    }
  });

  it("LV5_SUBLEVEL_STAGES는 모두 batchSize ≥ 3", () => {
    for (const sublevel of [1, 2, 3] as const) {
      for (const s of LV5_SUBLEVEL_STAGES[sublevel]) {
        expect(s.batchSize).toBeGreaterThanOrEqual(3);
      }
    }
    expect(totalNotesInStages(LV5_SUBLEVEL_STAGES[1])).toBe(48);
    expect(totalNotesInStages(LV5_SUBLEVEL_STAGES[2])).toBe(54);
    expect(totalNotesInStages(LV5_SUBLEVEL_STAGES[3])).toBe(60);
  });
});

describe("getStagesFor", () => {
  it("level 미지정(기본 Lv1) → SUBLEVEL_CONFIGS stages 반환", () => {
    expect(getStagesFor(1)).toBe(SUBLEVEL_CONFIGS[1].stages);
    expect(getStagesFor(2)).toBe(SUBLEVEL_CONFIGS[2].stages);
    expect(getStagesFor(3)).toBe(SUBLEVEL_CONFIGS[3].stages);
  });

  it("isCustom=true → CUSTOM_SCORE_STAGES (level·sublevel 무관)", () => {
    expect(getStagesFor(1, true)).toBe(CUSTOM_SCORE_STAGES);
    expect(getStagesFor(2, true, 5)).toBe(CUSTOM_SCORE_STAGES);
    expect(getStagesFor(3, true, 7)).toBe(CUSTOM_SCORE_STAGES);
  });

  it("Lv 1~4 → SUBLEVEL_CONFIGS stages", () => {
    expect(getStagesFor(1, false, 1)).toBe(SUBLEVEL_CONFIGS[1].stages);
    expect(getStagesFor(3, false, 4)).toBe(SUBLEVEL_CONFIGS[3].stages);
  });

  it("Lv 5~7 → LV5_SUBLEVEL_STAGES", () => {
    expect(getStagesFor(1, false, 5)).toBe(LV5_SUBLEVEL_STAGES[1]);
    expect(getStagesFor(2, false, 6)).toBe(LV5_SUBLEVEL_STAGES[2]);
    expect(getStagesFor(3, false, 7)).toBe(LV5_SUBLEVEL_STAGES[3]);
  });

  it("Lv 5 경계: Lv4와 Lv5 stages가 다름", () => {
    expect(getStagesFor(1, false, 4)).not.toBe(getStagesFor(1, false, 5));
    expect(getStagesFor(1, false, 4)).toBe(SUBLEVEL_CONFIGS[1].stages);
    expect(getStagesFor(1, false, 5)).toBe(LV5_SUBLEVEL_STAGES[1]);
  });
});

describe("LV5_SUBLEVEL_STAGES — Lv5~7 stage 구성", () => {
  it("sublevel 1 (입문): 48노트, 3 stages (batchSize 3·5·7)", () => {
    const stages = LV5_SUBLEVEL_STAGES[1];
    expect(stages).toHaveLength(3);
    expect(totalNotesInStages(stages)).toBe(48);
    expect(stages[0].batchSize).toBe(3);
    expect(stages[1].batchSize).toBe(5);
    expect(stages[2].batchSize).toBe(7);
  });

  it("sublevel 2 (숙련): 54노트, 3 stages (batchSize 3·5·7)", () => {
    const stages = LV5_SUBLEVEL_STAGES[2];
    expect(stages).toHaveLength(3);
    expect(totalNotesInStages(stages)).toBe(54);
    expect(stages[0].batchSize).toBe(3);
    expect(stages[1].batchSize).toBe(5);
    expect(stages[2].batchSize).toBe(7);
  });

  it("sublevel 3 (마스터): 60노트, 3 stages (batchSize 3·5·7)", () => {
    const stages = LV5_SUBLEVEL_STAGES[3];
    expect(stages).toHaveLength(3);
    expect(totalNotesInStages(stages)).toBe(60);
    expect(stages[0].batchSize).toBe(3);
    expect(stages[1].batchSize).toBe(5);
    expect(stages[2].batchSize).toBe(7);
  });

  it("모든 stage: batchSize=notesPerSet, batchSize ≥ 3", () => {
    for (const sublevel of [1, 2, 3] as const) {
      for (const stage of LV5_SUBLEVEL_STAGES[sublevel]) {
        expect(stage.batchSize).toBeGreaterThanOrEqual(3);
        expect(stage.batchSize).toBe(stage.notesPerSet);
        expect(stage.totalSets).toBeGreaterThan(0);
      }
    }
  });

  it("stage 번호는 1부터 순차", () => {
    for (const sublevel of [1, 2, 3] as const) {
      LV5_SUBLEVEL_STAGES[sublevel].forEach((s, i) => {
        expect(s.stage).toBe(i + 1);
      });
    }
  });

  it("getStagesFor로 얻은 Lv5 stages = 직접 LV5_SUBLEVEL_STAGES 동일", () => {
    for (const lv of [5, 6, 7]) {
      for (const sub of [1, 2, 3] as const) {
        expect(getStagesFor(sub, false, lv)).toBe(LV5_SUBLEVEL_STAGES[sub]);
      }
    }
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
