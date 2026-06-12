// Daily Challenge — 공유 페이로드(title·캡션) 빌더.
//
// navigator.share 받는 앱마다 처리가 다름:
//   - title-only 채널(카톡 등): buildShareTitle 한 줄만 노출.
//   - text 채널(X·문자 등): buildShareText 캡션 본문 노출.
//   - 이미지 채널(인스타 등): 이미지 카드(dailyCardImage)가 시각 결과 담당.
// 양쪽 다 의미있게 보이도록 title도 한 줄짜리 멋진 헤더로 작성.
//
// 사용자 노출 표면(title·캡션·카드 헤더)에 데일리 일련번호(#N) 노출하지 않음.
// 스포일러프리 유지: 음표·정답·키 노출 X. 점수·정답 수는 결과 메타 → 허용.

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

/** 짧은 날짜 (월·일만). title·캡션처럼 가독성 우선 채널용. */
function formatDateShort(dateKey: string, locale: ShareLocale): string {
  const { month, day } = parseDateKey(dateKey);
  if (locale === "ko") return `${month}월 ${day}일`;
  return `${EN_MONTHS[month - 1] ?? ""} ${day}`;
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
 * 공유 캡션 — text 채널(X·문자 등). 멋진 완성형 한 덩어리.
 *
 * 예시 (ko):
 *   🎼 오늘의 Noteflex 데일리 챌린지
 *   📅 6월 13일 · 3,830점 (정답 24/25)
 *   악보를 음악으로 읽는 훈련, 당신도 도전해보세요 👉 https://noteflex.app
 */
export function buildShareText(
  result: DailyFinalResult,
  locale: ShareLocale,
): string {
  const date = formatDateShort(result.dateKey, locale);
  const url = buildShareUrl();
  const total = TOTAL_TURNS * NOTES_PER_TURN;
  const score = result.score.toLocaleString();

  if (locale === "ko") {
    return [
      `🎼 오늘의 Noteflex 데일리 챌린지`,
      `📅 ${date} · ${score}점 (정답 ${result.correct}/${total})`,
      `악보를 음악으로 읽는 훈련, 당신도 도전해보세요 👉 ${url}`,
    ].join("\n");
  }

  return [
    `🎼 Today's Noteflex Daily Challenge`,
    `📅 ${date} · ${score} pts (${result.correct}/${total} correct)`,
    `Train to read music fluently — try it 👉 ${url}`,
  ].join("\n");
}

/**
 * 공유 제목 — title-only 채널(카톡 등) 한 줄.
 * 짧은 날짜 + #번호 없음. 카톡 메시지로 자연스러운 길이.
 */
export function buildShareTitle(
  result: DailyFinalResult,
  locale: ShareLocale,
): string {
  const date = formatDateShort(result.dateKey, locale);
  if (locale === "ko") return `🎼 오늘의 Noteflex 데일리 챌린지 · ${date}`;
  return `🎼 Today's Noteflex Daily · ${date}`;
}
