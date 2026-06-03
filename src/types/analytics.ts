// Noteflex analytics types — RPC return shapes (from 20260526_analytics_04_rpcs.sql)
// 주의: get_daily_report은 source(rollup|live)에 따라 키 셋이 다르다.

export type Clef = "treble" | "bass";

export interface SessionSummary {
  id: string;
  level: number | null;
  started_at: string;
  ended_at: string | null;
  total_notes: number | null;
  correct_notes: number | null;
  accuracy: number | null;
  avg_reaction_ms: number | null;
  duration_seconds: number | null;
  session_type: string | null;
}

// 오늘 라이브 — 오답 음표 (errors/attempts만, error_rate는 프론트에서 계산)
export interface WrongNoteToday {
  note_key: string;
  octave: number;
  clef: Clef;
  attempts: number;
  errors: number;
}

// 롤업(과거일) — 약점 음표 상위
export interface WeakNoteRollup {
  note_key: string;
  octave: number;
  clef: Clef;
  attempts: number;
  weak_score: number;
  error_rate: number;
  avg_ms: number | null;
}

export interface PerNote {
  note_key: string;
  octave: number;
  clef: Clef;
  attempts: number;
  accuracy: number;
  avg_ms: number | null;
  median_ms: number | null;
}

// no_data 응답
export interface DailyReportNoData {
  status: "no_data";
  date: string;
  source: "rollup";
}

// 오늘 라이브 응답
export interface DailyReportLive {
  status?: undefined;
  source: "live";
  date: string;
  period_type: "day";
  streak_days: number;
  sessions: SessionSummary[];

  total_attempts: number;
  correct_attempts: number;
  overall_accuracy: number | null;
  avg_reaction_ms: number | null;
  median_reaction_ms: number | null;
  wrong_notes_today: WrongNoteToday[];

  baseline_accuracy: number | null;
  baseline_avg_reaction_ms: number | null;
  baseline_days: number;
}

// 과거일 롤업 응답 (user_analytics_rollup 전체 컬럼 펼침)
export interface DailyReportRollup {
  status?: undefined;
  source: "rollup";
  sessions: SessionSummary[];

  id: string;
  user_id: string;
  period_type: "day";
  period_start: string;
  period_end: string;

  sessions_count: number;
  total_attempts: number;
  correct_attempts: number;
  total_duration_seconds: number;
  active_days: number;

  overall_accuracy: number | null;
  avg_reaction_ms: number | null;
  median_reaction_ms: number | null;

  by_clef: unknown;
  by_accidental: unknown;
  by_level: unknown;
  per_note: PerNote[] | null;
  interval_error_rates: unknown;
  weak_notes_top: WeakNoteRollup[] | null;

  streak_days: number | null;

  baseline_accuracy: number | null;
  baseline_avg_reaction_ms: number | null;

  graduated_count: number;
  regressed_count: number;
  graduated_notes: unknown;
  regressed_notes: unknown;

  computed_at: string;
}

export type DailyReport = DailyReportLive | DailyReportRollup | DailyReportNoData;

// 주간·월간 롤업 — user_analytics_rollup에서 직접 조회
export interface PeriodRollup {
  id: string;
  user_id: string;
  period_type: "week" | "month";
  period_start: string;
  period_end: string;

  sessions_count: number;
  total_attempts: number;
  correct_attempts: number;
  total_duration_seconds: number;
  active_days: number;

  overall_accuracy: number | null;
  avg_reaction_ms: number | null;
  median_reaction_ms: number | null;

  by_clef: unknown;
  by_accidental: unknown;
  by_level: unknown;
  per_note: PerNote[] | null;
  interval_error_rates: unknown;
  weak_notes_top: WeakNoteRollup[] | null;

  streak_days: number | null;

  baseline_accuracy: number | null;
  baseline_avg_reaction_ms: number | null;

  graduated_count: number;
  regressed_count: number;

  computed_at: string;
}

// 공용 — UI에서 다루기 편한 정규화 약점 항목
export interface WeakNoteForChip {
  note_key: string;
  octave: number;
  clef: Clef;
  attempts: number;
  error_rate: number; // 0..1
  avg_ms?: number | null;
}

export function isNoData(r: DailyReport | null | undefined): r is DailyReportNoData {
  return !!r && (r as DailyReportNoData).status === "no_data";
}
export function isLive(r: DailyReport | null | undefined): r is DailyReportLive {
  return !!r && r.source === "live" && (r as DailyReportLive).status === undefined;
}
export function isRollup(r: DailyReport | null | undefined): r is DailyReportRollup {
  return !!r && r.source === "rollup" && (r as DailyReportRollup).status === undefined;
}

/**
 * 오늘(live)·과거(rollup) 응답에서 약점 칩 입력으로 정규화.
 * - live: wrong_notes_today (errors/attempts → error_rate 계산)
 * - rollup: weak_notes_top (error_rate 그대로)
 */
export function normalizeWeakNotes(r: DailyReport | null | undefined, topN = 5): WeakNoteForChip[] {
  if (!r || isNoData(r)) return [];
  if (isLive(r)) {
    return (r.wrong_notes_today ?? [])
      .map((w) => ({
        note_key: w.note_key,
        octave: w.octave,
        clef: w.clef,
        attempts: w.attempts,
        error_rate: w.attempts > 0 ? w.errors / w.attempts : 0,
      }))
      .sort((a, b) => b.error_rate - a.error_rate || b.attempts - a.attempts)
      .slice(0, topN);
  }
  // rollup
  return (r.weak_notes_top ?? [])
    .map((w) => ({
      note_key: w.note_key,
      octave: w.octave,
      clef: w.clef,
      attempts: w.attempts,
      error_rate: w.error_rate,
      avg_ms: w.avg_ms,
    }))
    .slice(0, topN);
}
