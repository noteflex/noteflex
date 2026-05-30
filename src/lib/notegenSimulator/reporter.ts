/**
 * 5-D: 시뮬레이션 결과 콘솔 출력 + JSON 저장.
 *
 * 사용자 핵심 요구: "어떤 음이 어떤 사유로 출제됐는지 한 눈에".
 *   - 메트릭 표 (pass/fail + 경계 근처 경고 ⚠️)
 *   - adaptive 모드 분포
 *   - 음별 출제 ASCII bar (top 10)
 *   - 의심 케이스 자동 추출
 *   - 디테일 표 (처음·마지막 20턴 또는 --full 전체)
 *
 * JSON: test-results/notegen-{scenarioName}-{ISO timestamp}.json — gitignore됨.
 *
 * ANSI 컬러 미사용 — 유니코드 심볼만 (vitest·파이프·파일 캡처 호환).
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PickDecision } from "@/lib/pickDecision";
import type { Scenario } from "./scenarios/types";
import type { SimEvent, SimResult } from "./core/simSession";
import type { ScenarioEvaluation, EvaluatedMetric } from "./metrics";

// ─────────────────────────────────────────────────────────────
// 옵션 + 결과 타입
// ─────────────────────────────────────────────────────────────

export interface ReporterOptions {
  /** true면 전체 turn 출력. false면 처음·마지막 20턴만. default false. */
  full?: boolean;
  /** true면 JSON 저장. default false (테스트 환경 부산물 회피 — 명시적 활성화). */
  outputJson?: boolean;
  /** JSON 저장 디렉토리. default "test-results". */
  outputDir?: string;
}

const DEFAULT_DETAIL_HEAD_TAIL = 20;
const DEFAULT_BAR_MAX = 20;
const DEFAULT_DIST_TOPN = 10;

/** 경계 근처 경고 — fail이지만 임계값에서 epsilon 안에 있으면 ⚠️ 별도 표시. */
const APPROX_BOUNDARY_EPSILON = 0.001;

// ─────────────────────────────────────────────────────────────
// Event ↔ Decision 매핑 (per-batch 그룹)
// ─────────────────────────────────────────────────────────────

/**
 * decisions를 turn별로 그룹핑 — 같은 composeBatch의 decisions는 동일 turn 공유.
 * 한 batch의 decisions[i]는 batch[i]에 대응 (n_plus_2_recovery는 batch 앞 슬롯들).
 */
function groupDecisionsByTurn(decisions: PickDecision[]): {
  byTurn: Map<number, PickDecision[]>;
  sortedTurns: number[];
} {
  const byTurn = new Map<number, PickDecision[]>();
  for (const d of decisions) {
    const arr = byTurn.get(d.turn) ?? [];
    arr.push(d);
    byTurn.set(d.turn, arr);
  }
  const sortedTurns = Array.from(byTurn.keys()).sort((a, b) => a - b);
  return { byTurn, sortedTurns };
}

/** 이진 탐색: event.turn 이하의 가장 큰 batch turn 인덱스. */
function findBatchTurnIndex(sortedTurns: number[], eventTurn: number): number {
  let lo = 0;
  let hi = sortedTurns.length - 1;
  let res = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedTurns[mid] <= eventTurn) {
      res = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return res;
}

function lookupDecision(
  event: SimEvent,
  byTurn: Map<number, PickDecision[]>,
  sortedTurns: number[],
): PickDecision | null {
  const idx = findBatchTurnIndex(sortedTurns, event.turn);
  if (idx < 0) return null;
  const batchDecisions = byTurn.get(sortedTurns[idx]) ?? [];
  return batchDecisions[event.batchIndex] ?? null;
}

// ─────────────────────────────────────────────────────────────
// 포매팅 헬퍼
// ─────────────────────────────────────────────────────────────

/** UTF-8 시각 길이 기반 padEnd — 한글 등 와이드 글자 1자 = 2폭. */
function visualLength(s: string): number {
  let len = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    // 매우 단순한 와이드 판정 — 한글(가-힣), 한자, 가나, 풀폭 기호 영역.
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0x303e) ||
      (code >= 0x3041 && code <= 0x33ff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff00 && code <= 0xff60)
    ) {
      len += 2;
    } else {
      len += 1;
    }
  }
  return len;
}

function padRight(s: string, width: number): string {
  const lack = width - visualLength(s);
  return lack > 0 ? s + " ".repeat(lack) : s;
}

function padLeft(s: string, width: number): string {
  const lack = width - visualLength(s);
  return lack > 0 ? " ".repeat(lack) + s : s;
}

function fmtNum(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

function fmtPct(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return "—";
  return (v * 100).toFixed(digits) + "%";
}

/** approx predicate 경계 근처 fail이면 ⚠️ 별도 표시. */
function statusSymbol(metric: EvaluatedMetric): string {
  if (metric.passed) return "✓";
  // approx: "0.6 ± 0.07" 형태 파싱해서 boundary epsilon 검사.
  const m = metric.expected.match(/^(-?\d+(?:\.\d+)?)\s*±\s*(-?\d+(?:\.\d+)?)/);
  if (m) {
    const target = parseFloat(m[1]);
    const tolerance = parseFloat(m[2]);
    const diff = Math.abs(metric.value - target);
    if (diff <= tolerance + APPROX_BOUNDARY_EPSILON) return "⚠️";
  }
  return "✗";
}

// ─────────────────────────────────────────────────────────────
// 섹션 빌더
// ─────────────────────────────────────────────────────────────

function renderHeader(scenario: Scenario, simResult: SimResult, timestamp: string): string[] {
  const line = "═".repeat(70);
  return [
    line,
    `시나리오 ${scenario.name} — ${scenario.description}`,
    `seed: ${scenario.simConfig.seed} | endReason: ${simResult.endReason} | totalAttempts: ${simResult.totalAttempts} | 시작: ${timestamp}`,
    line,
    "",
  ];
}

function renderMetricsTable(evaluation: ScenarioEvaluation): string[] {
  const lines: string[] = ["[메트릭]"];
  const labelWidth = Math.max(
    20,
    ...evaluation.metrics.map((m) => visualLength(m.label)),
  );
  const valueWidth = 10;
  const expectedWidth = 18;
  lines.push(
    "  " +
      padRight("지표", labelWidth) +
      " " +
      padLeft("실제", valueWidth) +
      "   " +
      padRight("기대", expectedWidth) +
      " 판정",
  );
  lines.push("  " + "─".repeat(labelWidth + valueWidth + expectedWidth + 7));
  for (const m of evaluation.metrics) {
    const valueStr =
      Number.isInteger(m.value) && Math.abs(m.value) < 1e6
        ? String(m.value)
        : fmtNum(m.value, 3);
    lines.push(
      "  " +
        padRight(m.label, labelWidth) +
        " " +
        padLeft(valueStr, valueWidth) +
        "   " +
        padRight(m.expected, expectedWidth) +
        "  " +
        statusSymbol(m),
    );
  }
  lines.push("");
  return lines;
}

function renderAdaptiveHistogram(evaluation: ScenarioEvaluation): string[] {
  const lines: string[] = ["[adaptive 모드 분포]"];
  const order = ["free", "warmup", "normal", "boost_weak", "reduce_weak"] as const;
  for (const mode of order) {
    const count = evaluation.adaptiveModeHistogram[mode] ?? 0;
    if (count > 0) lines.push(`  ${padRight(mode, 12)} ${count}턴`);
  }
  lines.push("");
  return lines;
}

function renderNoteDistribution(evaluation: ScenarioEvaluation): string[] {
  const dist = evaluation.noteDistribution;
  const total = Object.keys(dist).length;
  const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, DEFAULT_DIST_TOPN);
  const lines: string[] = [
    `[음별 출제 분포 — top ${top.length} of ${total}]`,
  ];
  if (top.length === 0) {
    lines.push("  (no events)");
    lines.push("");
    return lines;
  }
  const maxCount = top[0][1];
  const idWidth = Math.max(...top.map(([id]) => visualLength(id)));
  for (const [id, count] of top) {
    const barLen = Math.max(1, Math.round((count / maxCount) * DEFAULT_BAR_MAX));
    const bar = "█".repeat(barLen);
    lines.push(`  ${padRight(id, idWidth)}  ${padRight(bar, DEFAULT_BAR_MAX)} ${count}`);
  }
  lines.push("");
  return lines;
}

function renderSuspiciousCases(evaluation: ScenarioEvaluation): string[] {
  const lines: string[] = [`[의심 케이스 ${evaluation.suspiciousCases.length}건]`];
  if (evaluation.suspiciousCases.length === 0) {
    lines.push("  (없음)");
  } else {
    for (const s of evaluation.suspiciousCases) {
      lines.push(`  ⚠️ 턴 ${s.turn} │ ${s.type} │ ${s.description}`);
    }
  }
  lines.push("");
  return lines;
}

function renderDetailTable(
  events: SimEvent[],
  decisions: PickDecision[],
  opts: ReporterOptions,
): string[] {
  const { byTurn, sortedTurns } = groupDecisionsByTurn(decisions);
  const full = opts.full ?? false;

  const lines: string[] = [];
  const headerCols = [
    padLeft("턴", 4),
    padRight("음표", 12),
    padRight("source(slot%)", 18),
    padRight("baseW", 6),
    padRight("mastM", 6),
    padRight("keyM", 6),
    padRight("strkM", 6),
    padRight("softM", 6),
    padRight("pick%", 6),
    "ans",
    padRight("resp", 5),
  ];
  const header = headerCols.join(" │ ");

  const renderRow = (e: SimEvent): string => {
    const d = lookupDecision(e, byTurn, sortedTurns);
    const picked = d?.candidates.find((c) => c.noteId === d.pickedNote.noteId);
    let sourceStr = "—";
    if (d) {
      if (d.source === "n_plus_2_recovery") {
        sourceStr = "n+2 recovery";
      } else if (d.source === "weak_weighted") {
        sourceStr = `weak(${Math.round(d.context.weakSlotRatio * 100)}%)`;
      } else if (d.source === "general") {
        sourceStr = `general(${Math.round((1 - d.context.weakSlotRatio) * 100)}%)`;
      } else {
        sourceStr = d.source;
      }
    }
    return [
      padLeft(String(e.turn), 4),
      padRight(e.shownId, 12),
      padRight(sourceStr, 18),
      padRight(picked ? fmtNum(picked.baseWeight) : "—", 6),
      padRight(picked ? fmtNum(picked.masteryMultiplier) : "—", 6),
      padRight(picked ? fmtNum(picked.keySignatureMultiplier) : "—", 6),
      padRight(picked ? fmtNum(picked.streakMultiplier) : "—", 6),
      padRight(picked ? fmtNum(picked.softAvoidMultiplier) : "—", 6),
      padRight(picked ? fmtPct(picked.pickProbability) : "—", 6),
      e.correct ? " ✓ " : " ✗ ",
      padRight(fmtNum(e.responseTimeSec), 5),
    ].join(" │ ");
  };

  const renderBlock = (title: string, slice: SimEvent[]): string[] => {
    const out: string[] = [title, header, "─".repeat(header.length)];
    for (const e of slice) out.push(renderRow(e));
    return out;
  };

  if (full || events.length <= DEFAULT_DETAIL_HEAD_TAIL * 2) {
    lines.push(...renderBlock(`[전체 ${events.length}턴]`, events));
  } else {
    lines.push(...renderBlock("[처음 20턴]", events.slice(0, DEFAULT_DETAIL_HEAD_TAIL)));
    lines.push("  ⋮");
    lines.push(...renderBlock("[마지막 20턴]", events.slice(-DEFAULT_DETAIL_HEAD_TAIL)));
  }
  lines.push("");
  return lines;
}

// ─────────────────────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────────────────────

/** 시나리오 결과를 콘솔용 단일 string으로 포맷. */
export function formatScenarioReport(
  scenario: Scenario,
  simResult: SimResult,
  evaluation: ScenarioEvaluation,
  options: ReporterOptions = {},
): string {
  const ts = new Date().toISOString();
  const sections: string[][] = [
    renderHeader(scenario, simResult, ts),
    renderMetricsTable(evaluation),
    renderAdaptiveHistogram(evaluation),
    renderNoteDistribution(evaluation),
    renderSuspiciousCases(evaluation),
    renderDetailTable(simResult.events, simResult.decisions, options),
  ];
  // allPassed 요약 footer.
  sections.push([
    "═".repeat(70),
    `결과: ${evaluation.allPassed ? "✓ ALL PASSED" : "✗ FAILURES"} (${evaluation.metrics.filter((m) => m.passed).length}/${evaluation.metrics.length})`,
    "═".repeat(70),
    "",
  ]);
  return sections.map((s) => s.join("\n")).join("\n");
}

/** 콘솔 출력. */
export function printScenarioReport(
  scenario: Scenario,
  simResult: SimResult,
  evaluation: ScenarioEvaluation,
  options: ReporterOptions = {},
): void {
  // eslint-disable-next-line no-console
  console.log(formatScenarioReport(scenario, simResult, evaluation, options));
}

/**
 * JSON 저장. 파일 경로 반환.
 *
 * 파일명: {outputDir}/notegen-{scenarioName}-{ISO timestamp}.json
 * test-results/는 .gitignore됨 (시나리오당 ~5MB).
 */
export function writeScenarioJson(
  scenario: Scenario,
  simResult: SimResult,
  evaluation: ScenarioEvaluation,
  outputDir: string = "test-results",
): string {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  const safeTs = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `notegen-${scenario.name}-${safeTs}.json`;
  const path = join(outputDir, filename);

  // userModel.weakIds는 Set — JSON.stringify에서 빈 객체로 직렬화되니 사전 변환.
  const cfgClone = {
    ...scenario.simConfig,
    userModel:
      scenario.simConfig.userModel.kind === "weak_on"
        ? {
            ...scenario.simConfig.userModel,
            weakIds: Array.from(scenario.simConfig.userModel.weakIds),
          }
        : scenario.simConfig.userModel,
    weakScoreMap: scenario.simConfig.weakScoreMap
      ? Array.from(scenario.simConfig.weakScoreMap.entries())
      : undefined,
  };

  const payload = {
    timestamp: new Date().toISOString(),
    scenario: { ...scenario, simConfig: cfgClone },
    simResult: {
      endReason: simResult.endReason,
      totalAttempts: simResult.totalAttempts,
      correctCount: simResult.correctCount,
      missCount: simResult.missCount,
      retryAppearances: simResult.retryAppearances,
      finalQueueSize: simResult.finalQueueSize,
      adaptiveModeHistogram: simResult.adaptiveModeHistogram,
      keySig: simResult.keySig,
      events: simResult.events,
      decisions: simResult.decisions,
    },
    evaluation,
  };

  writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
  return path;
}
