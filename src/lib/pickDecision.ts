// ═══════════════════════════════════════════════════════════════
// 4-E: PickDecision — 출제 결정 trace 시스템 (dev + 시뮬레이터)
// ═══════════════════════════════════════════════════════════════
// 4-F NoteGame 통합 시 출제 결정마다 PickDecision 객체 생성·기록.
// production 번들에서는 PICK_DECISION_ENABLED=false로 평가 → 호출처가
// `if (PICK_DECISION_ENABLED) { ... }` 가드 사용 시 전체 블록이 tree-shake.
// ═══════════════════════════════════════════════════════════════

import type { AdaptiveMode } from "./noteWeighting";

export type { AdaptiveMode };

/** 출제 결정의 4가지 경로. */
export type PickSource =
  | "n_plus_2_recovery"   // N+2 큐에서 회수 (오답 → 2턴 후 재출제)
  | "weak_weighted"       // 약점 슬롯 (Premium 전용 가중 샘플링)
  | "general"             // 일반 슬롯 (기본 균등 + 조표/streak 가중)
  | "forced_immediate";   // 즉시 강제 출제 (특수 케이스)

/** 출제된 음표 정보 (trace 직렬화용). */
export interface PickedNote {
  key: string;
  octave: number;
  clef: string;
  accidental?: string;
  noteId: string;
}

/** 후보 1개에 대한 가중치 분해. */
export interface PickCandidate {
  noteId: string;
  /** 슬롯 베이스 가중치 (약점 슬롯은 weakMultiplier 기반, 일반 슬롯은 1.0). */
  baseWeight: number;
  isKeySignatureNote: boolean;
  keySignatureMultiplier: number;
  /** user_note_weak_scores 데이터 (없으면 null). */
  accuracyScore: number | null;
  responseTimeScore: number | null;
  combinedWeakScore: number | null;
  /** scoreToWeakMultiplier 결과. */
  weakMultiplier: number;
  masteryFlag: "normal" | "weakness" | "mastery";
  /** MASTERY_WEIGHTS 기반 (3.0 / 1.0 / 0.3). */
  masteryMultiplier: number;
  streakMastered: boolean;
  /** computeStreakMultiplier 결과 (1.0 또는 0.3). */
  streakMultiplier: number;
  softAvoidMultiplier: number;
  /** 모든 multiplier 곱한 최종 가중치. */
  finalWeight: number;
  /** finalWeight / Σ(finalWeights) — 후보 사이의 선택 확률. */
  pickProbability: number;
}

/** 결정 시점의 세션·게임 컨텍스트. */
export interface PickDecisionContext {
  /** 이 결정 직전까지의 누적 정답률 (0 ~ 1). */
  accuracyBeforePick: number;
  adaptiveMode: AdaptiveMode;
  /** 적응형 모드에 따른 약점 슬롯 비율 (0 ~ 1). */
  weakSlotRatio: number;
  /** N+2 큐의 현재 noteId 목록 (due 음표 포함). */
  queueState: string[];
  /** 직전 3개 noteId (최근이 [0]). */
  previousNotes: string[];
  /** 사람이 읽을 수 있는 조표 표기 (예: "G major (F#)" 또는 "C major (none)"). */
  keySignature: string;
  sublevelPoolSize: number;
  keySignatureNotesInPool: number;
}

/** 단일 출제 결정의 전체 스냅샷. */
export interface PickDecision {
  turn: number;
  pickedNote: PickedNote;
  source: PickSource;
  context: PickDecisionContext;
  /** weak_weighted/general 슬롯일 때만 채워짐. n_plus_2/forced는 빈 배열. */
  candidates: PickCandidate[];
  /** weightedPickIndex 입력 난수 (재현용). 비랜덤 경로는 null. */
  randomValue: number | null;
  /** 가중치 누적 분포에서 어느 noteId가 hit인지. 비랜덤 경로는 null. */
  cumulativeProbabilityHit: string | null;
  /** 사람이 읽을 수 있는 한 줄 요약. */
  reasonText: string;
  /** Date.now() */
  timestamp: number;
}

// ─────────────────────────────────────────────────────────
// 활성 플래그 — production에서는 literal false → tree-shake
// ─────────────────────────────────────────────────────────

/**
 * Build-time 상수. production에서는 literal `false`로 평가되어
 * 호출처의 `if (PICK_DECISION_ENABLED) { ... }` 블록이 tree-shake됨.
 */
export const PICK_DECISION_ENABLED: boolean =
  import.meta.env.DEV || import.meta.env.MODE === "simulator";

/**
 * 내부 mutable 플래그. 기본은 PICK_DECISION_ENABLED.
 * 테스트에서 _setPickDecisionEnabled로 override 가능.
 */
let activeEnabled: boolean = PICK_DECISION_ENABLED;

// ─────────────────────────────────────────────────────────
// Ring buffer (최대 1000개)
// ─────────────────────────────────────────────────────────

const RING_BUFFER_MAX = 1000;
const buffer: PickDecision[] = [];

/** 결정 1건 기록. 활성 상태가 아니면 no-op. */
export function recordPickDecision(decision: PickDecision): void {
  if (!activeEnabled) return;
  buffer.push(decision);
  while (buffer.length > RING_BUFFER_MAX) buffer.shift();

  // dev 디버깅용 window 노출 (브라우저 한정).
  if (typeof window !== "undefined") {
    (window as unknown as { __pickDecisions?: PickDecision[] }).__pickDecisions = buffer;
  }
}

/** 기록된 결정 전체 조회 (방어 복사). */
export function getPickDecisions(): PickDecision[] {
  return buffer.slice();
}

/** 버퍼 초기화 (테스트·세션 전환 시). */
export function clearPickDecisions(): void {
  buffer.length = 0;
  if (typeof window !== "undefined") {
    (window as unknown as { __pickDecisions?: PickDecision[] }).__pickDecisions = buffer;
  }
}

// ─────────────────────────────────────────────────────────
// reasonText 생성
// ─────────────────────────────────────────────────────────

/**
 * PickDecision에서 한 줄 사람-친화 요약 생성.
 *
 * source별 분기:
 *   - weak_weighted: "약점 슬롯(NN%) F#4 선택. combinedScore 0.72 → ×2.44. 직전 음 B4와 다름. graduated=normal. adaptive=normal."
 *   - general:       "일반 슬롯(NN%) C4 선택. weak_scores 없음. 직전 음 B4와 다름. graduated=normal. adaptive=normal."
 *   - n_plus_2_recovery: "N+2 회복 큐 F#4 회수. adaptive=normal."
 *   - forced_immediate:  "즉시 강제 출제 F#4. adaptive=normal."
 */
export function buildReasonText(
  decision: Omit<PickDecision, "reasonText">,
): string {
  const { pickedNote, source, context, candidates } = decision;
  const noteLabel = `${pickedNote.key}${pickedNote.accidental ?? ""}${pickedNote.octave}`;
  const prevLabel = context.previousNotes[0]
    ? extractNoteLabelFromId(context.previousNotes[0])
    : "없음";

  switch (source) {
    case "n_plus_2_recovery":
      return `N+2 회복 큐 ${noteLabel} 회수. adaptive=${context.adaptiveMode}.`;

    case "forced_immediate":
      return `즉시 강제 출제 ${noteLabel}. adaptive=${context.adaptiveMode}.`;

    case "weak_weighted":
    case "general": {
      const slotLabel = source === "weak_weighted" ? "약점 슬롯" : "일반 슬롯";
      const slotPct = source === "weak_weighted"
        ? Math.round(context.weakSlotRatio * 100)
        : Math.round((1 - context.weakSlotRatio) * 100);

      const picked = candidates.find((c) => c.noteId === pickedNote.noteId);
      const scorePart = picked
        ? picked.combinedWeakScore !== null
          ? `combinedScore ${picked.combinedWeakScore.toFixed(2)} → ×${picked.weakMultiplier.toFixed(2)}`
          : "weak_scores 없음"
        : "후보 정보 없음";

      const prevPart = `직전 음 ${prevLabel}${
        picked && picked.softAvoidMultiplier < 1
          ? `와 같음 (×${picked.softAvoidMultiplier.toFixed(1)})`
          : "와 다름"
      }`;
      const gradPart = picked ? `graduated=${picked.masteryFlag}` : "graduated=?";
      const adaptPart = `adaptive=${context.adaptiveMode}`;

      return `${slotLabel}(${slotPct}%) ${noteLabel} 선택. ${scorePart}. ${prevPart}. ${gradPart}. ${adaptPart}.`;
    }
  }
}

/** "treble:F#4" → "F#4" (음명 + 옥타브). */
function extractNoteLabelFromId(noteId: string): string {
  const colonIdx = noteId.indexOf(":");
  return colonIdx >= 0 ? noteId.slice(colonIdx + 1) : noteId;
}

// ─────────────────────────────────────────────────────────
// 테스트 전용 override (production에는 영향 없음 — 호출처 없음)
// ─────────────────────────────────────────────────────────

/** 테스트 전용: 활성 플래그 강제 설정. */
export function _setPickDecisionEnabled(enabled: boolean): void {
  activeEnabled = enabled;
}

/** 테스트 전용: 활성 플래그 복원. */
export function _resetPickDecisionEnabled(): void {
  activeEnabled = PICK_DECISION_ENABLED;
}
