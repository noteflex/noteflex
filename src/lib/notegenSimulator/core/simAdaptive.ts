import { computeAdaptiveWeakRatio, type AdaptiveMode } from "@/lib/noteWeighting";

/**
 * 5-A: useAdaptiveDifficulty hook의 React-free 복제.
 *
 * 정책 parity:
 *   - 누적 정답·전체 시도 추적
 *   - computeAdaptiveWeakRatio 헬퍼 공유 → 판정 로직 단일화
 *   - Free 사용자 → ratio=0
 *   - warmup 5턴, boost(>0.92)=0.8, reduce(<0.55)=0.3, normal=0.6
 *
 * useAdaptiveDifficulty.ts 변경 시 함께 갱신해야 한다.
 */
export class SimAdaptive {
  private correct = 0;
  private total = 0;

  constructor(private isPremium: boolean) {}

  recordAttempt = (isCorrect: boolean): void => {
    this.total += 1;
    if (isCorrect) this.correct += 1;
  };

  private accuracy(): number {
    return this.total > 0 ? this.correct / this.total : 0;
  }

  getWeakSlotRatio = (): number => {
    return computeAdaptiveWeakRatio(this.accuracy(), this.total, this.isPremium).ratio;
  };

  getAdaptiveMode = (): AdaptiveMode => {
    return computeAdaptiveWeakRatio(this.accuracy(), this.total, this.isPremium).mode;
  };

  /** 디버그·메트릭용: 현재 누적 통계 스냅샷. */
  getStats(): { correct: number; total: number; accuracy: number } {
    return { correct: this.correct, total: this.total, accuracy: this.accuracy() };
  }

  reset = (): void => {
    this.correct = 0;
    this.total = 0;
  };
}
