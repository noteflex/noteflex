/**
 * 5-C: 시뮬레이션 결과 메트릭 + pass/fail 판정 + 의심 케이스 자동 추출.
 *
 * 모든 메트릭은 PickDecision 또는 SimEvent 배열에서 derive — 시드/시나리오 무관 generic.
 * evaluateScenario는 Scenario.expectedMetrics 임계값 기준 자동 판정.
 */

import type { PickDecision } from "@/lib/pickDecision";
import { extractNoteName, type AdaptiveMode } from "@/lib/noteWeighting";
import type { KeySignatureType } from "@/components/NoteGame";
import type { SimEvent, SimResult } from "./core/simSession";
import type { Scenario, ScenarioPredicate } from "./scenarios/types";

// ─────────────────────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────────────────────

export interface MetricResult {
  name: string;
  value: number;
  detail?: Record<string, number | string>;
}

export interface EvaluatedMetric {
  /** scenario.expectedMetrics[i].id. */
  id: string;
  /** scenario.expectedMetrics[i].label — 사람 친화 라벨. */
  label: string;
  value: number;
  /** predicate human-readable. */
  expected: string;
  passed: boolean;
  detail?: Record<string, number | string>;
}

export interface SuspiciousCase {
  turn: number;
  type: string;
  description: string;
  /** 원본 decision (디버깅용 — 리포터에서 reasonText 표시). */
  decision?: PickDecision;
}

export interface ScenarioEvaluation {
  scenarioName: string;
  metrics: EvaluatedMetric[];
  suspiciousCases: SuspiciousCase[];
  allPassed: boolean;
  /** noteId → 출제 횟수. ASCII bar 그래프 입력. */
  noteDistribution: Record<string, number>;
  /** adaptive 모드별 누적 (시도 단위). */
  adaptiveModeHistogram: Record<AdaptiveMode, number>;
}

// ─────────────────────────────────────────────────────────────
// 메트릭 함수
// ─────────────────────────────────────────────────────────────

/**
 * Soft 회피 위반 비율.
 *   - 대상: weak_weighted/general source 결정 중 previousNotes[0] 존재한 결정
 *   - 위반: 출제 음표 음명이 previousNotes[0] 음명과 동일
 */
export function metricSoftAvoidViolationRate(decisions: PickDecision[]): MetricResult {
  let total = 0;
  let violations = 0;
  for (const d of decisions) {
    if (d.source === "n_plus_2_recovery") continue;
    if (d.context.previousNotes.length === 0) continue;
    total++;
    const pickedName = extractNoteName(d.pickedNote.noteId);
    const prevName = extractNoteName(d.context.previousNotes[0]);
    if (pickedName === prevName) violations++;
  }
  return {
    name: "softAvoidViolationRate",
    value: total > 0 ? violations / total : 0,
    detail: { violations, total },
  };
}

/** N+2 회복(N+2 큐 pop) source 결정의 건수. */
export function metricN2RecoveryCount(decisions: PickDecision[]): MetricResult {
  const count = decisions.filter((d) => d.source === "n_plus_2_recovery").length;
  return { name: "n2RecoveryCount", value: count, detail: { count, total: decisions.length } };
}

/** 전체 결정 대비 N+2 회복 source 비율. */
export function metricN2RecoveryHitRate(decisions: PickDecision[]): MetricResult {
  if (decisions.length === 0) {
    return { name: "n2RecoveryHitRate", value: 0, detail: { total: 0 } };
  }
  const count = decisions.filter((d) => d.source === "n_plus_2_recovery").length;
  return {
    name: "n2RecoveryHitRate",
    value: count / decisions.length,
    detail: { count, total: decisions.length },
  };
}

/** weak_weighted source 결정의 건수. Free 시나리오 검증용. */
export function metricWeakWeightedCount(decisions: PickDecision[]): MetricResult {
  const count = decisions.filter((d) => d.source === "weak_weighted").length;
  return { name: "weakWeightedDecisionCount", value: count };
}

/**
 * N+2 큐 상한(3) 위반 횟수.
 *   - context.queueState.length > 3인 결정 카운트
 *   - 올바른 구현이면 항상 0
 */
export function metricQueueMaxViolations(decisions: PickDecision[]): MetricResult {
  const violations = decisions.filter((d) => d.context.queueState.length > 3).length;
  return { name: "queueMaxViolations", value: violations };
}

/** Streak 마스터 상태 도달한 distinct noteId 수. */
export function metricStreakMasteredNoteCount(decisions: PickDecision[]): MetricResult {
  const masteredIds = new Set<string>();
  for (const d of decisions) {
    for (const c of d.candidates) {
      if (c.streakMastered) masteredIds.add(c.noteId);
    }
  }
  return {
    name: "streakMasteredNoteCount",
    value: masteredIds.size,
    detail: { noteIds: Array.from(masteredIds).join(",") || "(none)" },
  };
}

/**
 * 조표 영향 음 출제 비율.
 *   - keySig의 sharps/flats가 비었으면 0 (Lv1-4 무의미).
 *   - 영향 음 = shown.accidental 존재 AND shown.key가 키 영향 letter set에 포함.
 */
export function metricAccidentalRatio(events: SimEvent[], keySig: KeySignatureType): MetricResult {
  const accidentalLetters = new Set<string>([
    ...(keySig.sharps ?? []),
    ...(keySig.flats ?? []),
  ]);
  if (accidentalLetters.size === 0) {
    return { name: "accidentalRatio", value: 0, detail: { reason: "no accidentals" } };
  }
  let total = 0;
  let withAcc = 0;
  for (const e of events) {
    total++;
    if (e.shown.accidental !== undefined && accidentalLetters.has(e.shown.key)) {
      withAcc++;
    }
  }
  return {
    name: "accidentalRatio",
    value: total > 0 ? withAcc / total : 0,
    detail: { withAcc, total },
  };
}

/**
 * weak_weighted 슬롯에서 특정 ID 집합이 출제된 비율.
 * 시나리오 B의 F#4·F#5 weakIds 검증용.
 */
export function metricWeakSlotPickRateOnIds(
  decisions: PickDecision[],
  targetIds: Set<string>,
): MetricResult {
  const weakSlotDecisions = decisions.filter((d) => d.source === "weak_weighted");
  if (weakSlotDecisions.length === 0) {
    return {
      name: "weakSlotPickRateOnIds",
      value: 0,
      detail: { reason: "no weak_weighted decisions" },
    };
  }
  const onTarget = weakSlotDecisions.filter((d) =>
    targetIds.has(d.pickedNote.noteId),
  ).length;
  return {
    name: "weakSlotPickRateOnIds",
    value: onTarget / weakSlotDecisions.length,
    detail: { onTarget, weakSlot: weakSlotDecisions.length },
  };
}

/** noteId → 출제 횟수 분포 (events 기준 — 시도 단위). */
export function metricNoteDistribution(events: SimEvent[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const e of events) {
    dist[e.shownId] = (dist[e.shownId] ?? 0) + 1;
  }
  return dist;
}

// ─────────────────────────────────────────────────────────────
// 의심 케이스 자동 추출
// ─────────────────────────────────────────────────────────────

/**
 * 자동 의심 케이스 추출 (limit개까지).
 *
 * 추출 규칙:
 *   1. soft 회피 multiplier < 0.5인 음표가 picked (재귀 회피 무효화 의심)
 *   2. weak_weighted 슬롯이지만 picked 음표의 weak_scores 행 없음 (시드 누락 의심)
 *   3. streakMastered=true 음표가 picked (정상이지만 빈도 추적)
 *   4. pickProbability < 1%인 후보가 hit (저확률 hit — 추적)
 *   5. 직전 정답 음표와 같은 음표가 곧바로 재출제 (cross-batch dedup 회귀)
 */
export function detectSuspiciousCases(
  decisions: PickDecision[],
  events: SimEvent[],
  limit = 5,
): SuspiciousCase[] {
  const out: SuspiciousCase[] = [];

  for (const d of decisions) {
    if (out.length >= limit) break;
    if (d.source === "n_plus_2_recovery") continue;
    const picked = d.candidates.find((c) => c.noteId === d.pickedNote.noteId);
    if (!picked) continue;

    if (picked.softAvoidMultiplier < 0.5) {
      out.push({
        turn: d.turn,
        type: "soft-avoid-low-mult-picked",
        description: `softAvoidMult=${picked.softAvoidMultiplier.toFixed(2)} 인데 ${picked.noteId} 선택`,
        decision: d,
      });
      continue;
    }
    if (d.source === "weak_weighted" && picked.combinedWeakScore === null) {
      out.push({
        turn: d.turn,
        type: "weak-slot-no-score",
        description: `weak_weighted 슬롯에서 ${picked.noteId} 선택 — weak_scores 행 없음`,
        decision: d,
      });
      continue;
    }
    if (picked.streakMastered) {
      out.push({
        turn: d.turn,
        type: "streak-mastered-picked",
        description: `streak 마스터 음표 ${picked.noteId} 선택 (streakMult=${picked.streakMultiplier.toFixed(2)})`,
        decision: d,
      });
      continue;
    }
    if (picked.pickProbability > 0 && picked.pickProbability < 0.01) {
      out.push({
        turn: d.turn,
        type: "low-probability-pick",
        description: `${picked.noteId} pickProbability=${(picked.pickProbability * 100).toFixed(2)}% hit`,
        decision: d,
      });
    }
  }

  // 5. consecutive violation (이벤트 기반)
  for (let i = 1; i < events.length; i++) {
    if (out.length >= limit) break;
    const prev = events[i - 1];
    const cur = events[i];
    if (prev.correct && prev.shownId === cur.shownId) {
      out.push({
        turn: cur.turn,
        type: "consecutive-violation",
        description: `직전 정답 ${prev.shownId} 과 같은 음표 ${cur.shownId} 곧바로 재출제`,
      });
    }
  }

  return out.slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Predicate 적용 + Scenario 자동 평가
// ─────────────────────────────────────────────────────────────

/** Predicate 평가 — value vs predicate. */
export function applyPredicate(
  value: number,
  predicate: ScenarioPredicate,
): { passed: boolean; expected: string } {
  switch (predicate.kind) {
    case "lt":
      return { passed: value < predicate.max, expected: `< ${predicate.max}` };
    case "lte":
      return { passed: value <= predicate.max, expected: `≤ ${predicate.max}` };
    case "gt":
      return { passed: value > predicate.min, expected: `> ${predicate.min}` };
    case "gte":
      return { passed: value >= predicate.min, expected: `≥ ${predicate.min}` };
    case "approx": {
      const diff = Math.abs(value - predicate.target);
      return {
        passed: diff <= predicate.tolerance,
        expected: `${predicate.target} ± ${predicate.tolerance}`,
      };
    }
    case "eq":
      return { passed: value === predicate.value, expected: `= ${predicate.value}` };
  }
}

/**
 * 시나리오 expectedMetrics의 id로 SimResult에서 메트릭 값 추출.
 * 신규 메트릭 id 추가 시 여기 case 추가.
 */
function computeMetricValue(
  id: string,
  scenario: Scenario,
  result: SimResult,
): { value: number; detail?: Record<string, number | string> } {
  if (id.startsWith("adaptiveModeTurns.")) {
    const mode = id.slice("adaptiveModeTurns.".length) as AdaptiveMode;
    const v = result.adaptiveModeHistogram[mode] ?? 0;
    return { value: v };
  }
  switch (id) {
    case "softAvoidViolationRate": {
      const r = metricSoftAvoidViolationRate(result.decisions);
      return { value: r.value, detail: r.detail };
    }
    case "n2RecoveryCount": {
      const r = metricN2RecoveryCount(result.decisions);
      return { value: r.value, detail: r.detail };
    }
    case "n2RecoveryHitRate": {
      const r = metricN2RecoveryHitRate(result.decisions);
      return { value: r.value, detail: r.detail };
    }
    case "weakWeightedDecisionCount": {
      const r = metricWeakWeightedCount(result.decisions);
      return { value: r.value, detail: r.detail };
    }
    case "queueMaxViolations": {
      const r = metricQueueMaxViolations(result.decisions);
      return { value: r.value, detail: r.detail };
    }
    case "streakMasteredNoteCount": {
      const r = metricStreakMasteredNoteCount(result.decisions);
      return { value: r.value, detail: r.detail };
    }
    case "accidentalRatioMatchesTarget": {
      const r = metricAccidentalRatio(result.events, result.keySig);
      return { value: r.value, detail: r.detail };
    }
    case "weakSlotPickRateOnWeakIds": {
      const weakIds =
        scenario.simConfig.userModel.kind === "weak_on"
          ? scenario.simConfig.userModel.weakIds
          : new Set<string>();
      const r = metricWeakSlotPickRateOnIds(result.decisions, weakIds);
      return { value: r.value, detail: r.detail };
    }
    default:
      throw new Error(`metrics.ts: unknown expectedMetric id '${id}'`);
  }
}

/** 시나리오 단위 자동 평가 — pass/fail + 의심 케이스 + 분포. */
export function evaluateScenario(scenario: Scenario, result: SimResult): ScenarioEvaluation {
  const metrics: EvaluatedMetric[] = [];
  for (const ex of scenario.expectedMetrics) {
    const { value, detail } = computeMetricValue(ex.id, scenario, result);
    const { passed, expected } = applyPredicate(value, ex.predicate);
    metrics.push({
      id: ex.id,
      label: ex.label,
      value,
      expected,
      passed,
      detail,
    });
  }
  const suspiciousCases = detectSuspiciousCases(result.decisions, result.events, 5);
  const noteDistribution = metricNoteDistribution(result.events);
  return {
    scenarioName: scenario.name,
    metrics,
    suspiciousCases,
    allPassed: metrics.every((m) => m.passed),
    noteDistribution,
    adaptiveModeHistogram: result.adaptiveModeHistogram,
  };
}
