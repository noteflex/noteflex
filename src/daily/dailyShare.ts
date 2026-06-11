// Daily Challenge — 공유 텍스트 빌더.
// 스포일러프리: 실제 음표·정답·키 노출 X. 패턴(색 이모지)만.
//
// 출력 구성:
//   헤더 (Noteflex 데일리 + 날짜 + 점수)
//   빈 줄
//   5×5 이모지 그리드 (한 줄=한 턴)
//   빈 줄
//   /daily 절대 URL (?ref=daily_share)

import type {
  DailyFinalResult,
  DailyQuestionResult,
  DailyResultStatus,
} from "./dailyTypes";
import { NOTES_PER_TURN, TOTAL_TURNS } from "./dailyGenerator";

export type ShareLocale = "ko" | "en";

const STATUS_EMOJI: Record<DailyResultStatus, string> = {
  correct_fast: "🟩",
  correct_slow: "🟨",
  wrong: "🟥",
  timeout: "🟥",
  unreached: "⬜",
};

export function emojiForStatus(status: DailyResultStatus): string {
  return STATUS_EMOJI[status];
}

/**
 * results를 questionIndex 순서대로 정렬해 5×5 매트릭스(턴×문제)로 반환.
 * 빈 자리는 안전상 unreached.
 */
export function buildResultMatrix(
  results: readonly DailyQuestionResult[],
): DailyResultStatus[][] {
  const flat: DailyResultStatus[] = Array.from(
    { length: TOTAL_TURNS * NOTES_PER_TURN },
    () => "unreached",
  );
  for (const r of results) {
    if (r.questionIndex >= 0 && r.questionIndex < flat.length) {
      flat[r.questionIndex] = r.status;
    }
  }
  const matrix: DailyResultStatus[][] = [];
  for (let t = 0; t < TOTAL_TURNS; t++) {
    matrix.push(flat.slice(t * NOTES_PER_TURN, (t + 1) * NOTES_PER_TURN));
  }
  return matrix;
}

function buildEmojiGrid(results: readonly DailyQuestionResult[]): string {
  const matrix = buildResultMatrix(results);
  return matrix
    .map((row) => row.map((s) => STATUS_EMOJI[s]).join(""))
    .join("\n");
}

/** "YYYY-MM-DD" → {year, month, day}. */
function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateKey.split("-").map((s) => parseInt(s, 10));
  return { year: y || 0, month: m || 0, day: d || 0 };
}

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateHeader(dateKey: string, locale: ShareLocale): string {
  const { year, month, day } = parseDateKey(dateKey);
  if (locale === "ko") {
    return `${year}년 ${month}월 ${day}일`;
  }
  return `${EN_MONTHS[month - 1] ?? ""} ${day}, ${year}`;
}

/** /daily 절대 URL (현재 origin 기반, 추적 파라미터 포함). */
export function buildShareUrl(): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://noteflex.app";
  return `${origin}/daily?ref=daily_share`;
}

/**
 * 공유 텍스트 빌드. 실제 음표/정답 노출 X (스포일러프리).
 *
 * 예시 (ko):
 *   Noteflex 데일리 · 2026년 6월 11일 · 850점
 *
 *   🟩🟩🟨🟩🟥
 *   🟩🟨🟩🟩🟩
 *   🟩🟩🟩🟨🟩
 *   🟨🟥🟩🟩🟩
 *   🟩🟩⬜⬜⬜
 *
 *   https://noteflex.app/daily?ref=daily_share
 */
export function buildShareText(
  result: DailyFinalResult,
  locale: ShareLocale,
): string {
  const date = formatDateHeader(result.dateKey, locale);
  const grid = buildEmojiGrid(result.results);
  const url = buildShareUrl();

  const header =
    locale === "ko"
      ? `Noteflex 데일리 · ${date} · ${result.score}점`
      : `Noteflex Daily · ${date} · ${result.score} pts`;

  return `${header}\n\n${grid}\n\n${url}`;
}

/** Web Share sheet 제목 (text는 별도 인자). */
export function buildShareTitle(locale: ShareLocale): string {
  return locale === "ko" ? "Noteflex 데일리" : "Noteflex Daily";
}
