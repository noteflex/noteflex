/**
 * 5-A: 시뮬레이터 사용자 행동 모델.
 *
 * 시나리오 매핑:
 *   - 'perfect'  : 항상 정답, 빠른 응답 (기본 0.8s)
 *   - 'random'   : 균일 correctRate, 평균 응답 (기본 1.5s)
 *   - 'weak_on'  : weakIds 음표는 낮은 정답률, 그 외 높은 정답률
 *   - 'slow'     : 응답 시간이 길어 timeout/streak 미발동 검증용
 *
 * RNG는 외부 주입 — runSimSession이 SeededRng로 호출.
 */

export type SimUserModel =
  | { kind: "perfect"; responseTimeSec?: number }
  | { kind: "random"; correctRate: number; responseTimeSec?: number }
  | {
      kind: "weak_on";
      weakIds: Set<string>;
      weakCorrectRate?: number;
      baseCorrectRate?: number;
      responseTimeSec?: number;
    }
  | { kind: "slow"; responseTimeSec: number; correctRate?: number };

export interface SimUserAnswer {
  correct: boolean;
  responseTimeSec: number;
}

export class SimUser {
  constructor(
    private model: SimUserModel,
    private rng: () => number,
  ) {}

  answer(noteId: string): SimUserAnswer {
    switch (this.model.kind) {
      case "perfect":
        return {
          correct: true,
          responseTimeSec: this.model.responseTimeSec ?? 0.8,
        };

      case "random":
        return {
          correct: this.rng() < this.model.correctRate,
          responseTimeSec: this.model.responseTimeSec ?? 1.5,
        };

      case "weak_on": {
        const onWeak = this.model.weakIds.has(noteId);
        const rate = onWeak
          ? (this.model.weakCorrectRate ?? 0.3)
          : (this.model.baseCorrectRate ?? 0.95);
        return {
          correct: this.rng() < rate,
          responseTimeSec: this.model.responseTimeSec ?? 1.2,
        };
      }

      case "slow":
        return {
          correct: this.rng() < (this.model.correctRate ?? 0.7),
          responseTimeSec: this.model.responseTimeSec,
        };
    }
  }
}
