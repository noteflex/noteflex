// Daily Challenge — 공유 텍스트(캡션) 빌더.
// 이미지 카드(dailyCardImage)가 시각 결과를 담당 → 캡션은 사람이 SNS에 그대로
// 올리기 좋은 짧은 멘트만. 5×5 이모지 그리드는 카드 이미지가 대체.
//
// 스포일러프리 유지: 음표·정답·키 노출 X. 점수·정답 수는 결과 메타 → 허용.
//
// 출력 구성:
//   "🎼 오늘의 Noteflex 데일리 챌린지 #N 클리어!" 헤더
//   "📅 날짜"
//   "점수 N점 · 정답 n/총"
//   빈 줄
//   훈련 멘트 + 사이트 URL (https://noteflex.app)

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

/** 공유에 노출할 사이트 URL. SNS 친화 형태로 루트만 노출(추적 파라미터 X). */
export function buildShareUrl(): string {
  return "https://noteflex.app";
}

/** 데일리 일련번호 — DailyResultCard·dailyCardImage와 동일 로컬 자정 로직. */
const DAILY_EPOCH_Y = 2026;
const DAILY_EPOCH_M = 6; // 1-based
const DAILY_EPOCH_D = 1;

function dailyNumberFromDateKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map((s) => parseInt(s, 10));
  if (!y || !m || !d) return 1;
  const today = new Date(y, m - 1, d).getTime();
  const epoch = new Date(DAILY_EPOCH_Y, DAILY_EPOCH_M - 1, DAILY_EPOCH_D).getTime();
  return Math.floor((today - epoch) / 86_400_000) + 1;
}

/**
 * 공유 캡션 빌드. 이미지 카드와 짝 — 사람이 SNS에 그대로 올릴 수 있는 멘트.
 * 스포일러프리: 음표·정답·키 노출 X. 점수·정답 수는 결과 메타로 허용.
 *
 * 예시 (ko):
 *   🎼 오늘의 Noteflex 데일리 챌린지 #12 클리어!
 *   📅 2026년 6월 12일
 *   점수 850점 · 정답 22/25
 *
 *   악보를 음악으로 읽는 훈련, 당신도 도전해보세요 👉 https://noteflex.app
 */
export function buildShareText(
  result: DailyFinalResult,
  locale: ShareLocale,
): string {
  const date = formatDateHeader(result.dateKey, locale);
  const dailyNo = dailyNumberFromDateKey(result.dateKey);
  const url = buildShareUrl();
  const total = TOTAL_TURNS * NOTES_PER_TURN;

  if (locale === "ko") {
    return [
      `🎼 오늘의 Noteflex 데일리 챌린지 #${dailyNo} 클리어!`,
      `📅 ${date}`,
      `점수 ${result.score}점 · 정답 ${result.correct}/${total}`,
      "",
      `악보를 음악으로 읽는 훈련, 당신도 도전해보세요 👉 ${url}`,
    ].join("\n");
  }

  return [
    `🎼 Cleared today's Noteflex Daily Challenge #${dailyNo}!`,
    `📅 ${date}`,
    `Score ${result.score} pts · Correct ${result.correct}/${total}`,
    "",
    `Train to read music fluently — try it 👉 ${url}`,
  ].join("\n");
}

/** Web Share sheet 제목 (text는 별도 인자). */
export function buildShareTitle(locale: ShareLocale): string {
  return locale === "ko" ? "Noteflex 데일리" : "Noteflex Daily";
}
