/**
 * 5-B: 시나리오 정의 타입.
 *
 * 각 시나리오는 SimConfig + 사람-친화 메타데이터(name, description) + 5-C에서 검사할
 * expectedMetrics 임계값 목록을 묶는다.
 */

import type { SimConfig } from "../core/simSession";

/** 메트릭 판정 predicate. */
export type ScenarioPredicate =
  | { kind: "lt"; max: number }
  | { kind: "lte"; max: number }
  | { kind: "gt"; min: number }
  | { kind: "gte"; min: number }
  | { kind: "approx"; target: number; tolerance: number }
  | { kind: "eq"; value: number };

export interface ScenarioExpectedMetric {
  /** 메트릭 ID — 5-C metrics.ts에서 이 ID로 검사 함수 매핑. */
  id: string;
  /** 사람-친화 라벨 (리포트용). */
  label: string;
  predicate: ScenarioPredicate;
}

export interface Scenario {
  /** 시나리오 식별자 (A, B, C, D, E). */
  name: string;
  description: string;
  simConfig: SimConfig;
  expectedMetrics: ScenarioExpectedMetric[];
}
