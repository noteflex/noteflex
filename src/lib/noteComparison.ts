/**
 * 음표별 비교 분석 — 최근 세션 vs 이전 누적.
 *
 * 입력: UserNoteLogRecord[] (최근 ~200 적용된 영역)
 * 출력: 빠른/느린/정확도 ↑↓ Top 2씩
 *
 * 분리 방식: 최근 30개를 "이번 세션", 그 이전 30~150개를 "이전 누적"으로 완료.
 * 30개 미만 영역 = 비교 불가 → hasEnough=false.
 */

import type { UserNoteLogRecord } from "./userNoteLogs";

export interface NoteComparison {
  noteKey: string;
  /** delta seconds (음수 = 빨라짐) */
  deltaSec: number;
  /** delta accuracy %p (양수 = 향상) */
  deltaAccPp: number;
  /** 최근 평균 반응시간 (s) */
  currentAvgSec: number;
  /** 최근 정답률 */
  currentAccuracy: number;
}

export interface NoteComparisonResult {
  hasEnough: boolean;
  faster: NoteComparison[];        // Top 2 감소 (빨라짐)
  slower: NoteComparison[];        // Top 2 증가 (느려짐)
  accUp: NoteComparison[];         // Top 2 정답률 향상
  accDown: NoteComparison[];       // Top 2 정답률 하락
}

const EMPTY_RESULT: NoteComparisonResult = {
  hasEnough: false,
  faster: [],
  slower: [],
  accUp: [],
  accDown: [],
};

interface NoteStats {
  noteKey: string;
  total: number;
  correct: number;
  responseSum: number;
  responseCount: number;
}

function aggregate(logs: UserNoteLogRecord[]): Map<string, NoteStats> {
  const map = new Map<string, NoteStats>();
  for (const log of logs) {
    const k = log.note_key;
    const entry = map.get(k) ?? {
      noteKey: k,
      total: 0,
      correct: 0,
      responseSum: 0,
      responseCount: 0,
    };
    entry.total += 1;
    if (log.is_correct) entry.correct += 1;
    if (log.response_time != null) {
      entry.responseSum += log.response_time;
      entry.responseCount += 1;
    }
    map.set(k, entry);
  }
  return map;
}

/**
 * `logs` = 최신 우선 정렬 (created_at desc). 신규 음표(이전 시도 X)는 제외 완료.
 */
export function computeNoteComparison(
  logs: UserNoteLogRecord[],
  currentWindow = 30,
  previousWindow = 120,
  minSamplesPerNote = 3,
): NoteComparisonResult {
  if (logs.length < currentWindow + minSamplesPerNote) {
    return EMPTY_RESULT;
  }

  const recent = logs.slice(0, currentWindow);
  const previous = logs.slice(currentWindow, currentWindow + previousWindow);
  if (previous.length < minSamplesPerNote) {
    return EMPTY_RESULT;
  }

  const recentStats = aggregate(recent);
  const previousStats = aggregate(previous);

  const comparisons: NoteComparison[] = [];
  for (const [noteKey, cur] of recentStats) {
    const prev = previousStats.get(noteKey);
    // 이전 기록 X 영역 = 신규 음표 → 비교 박지 말 것
    if (!prev || prev.total < minSamplesPerNote) continue;
    // 현재도 최소 샘플 만족 영역만 완료
    if (cur.total < 2) continue;

    const curAvgSec = cur.responseCount > 0 ? cur.responseSum / cur.responseCount : 0;
    const prevAvgSec = prev.responseCount > 0 ? prev.responseSum / prev.responseCount : 0;
    const curAcc = cur.total > 0 ? cur.correct / cur.total : 0;
    const prevAcc = prev.total > 0 ? prev.correct / prev.total : 0;

    comparisons.push({
      noteKey,
      deltaSec: curAvgSec - prevAvgSec,
      deltaAccPp: Math.round((curAcc - prevAcc) * 100),
      currentAvgSec: +curAvgSec.toFixed(2),
      currentAccuracy: Math.round(curAcc * 100),
    });
  }

  if (comparisons.length === 0) {
    return EMPTY_RESULT;
  }

  // ±0.1초·±2%p 이내는 노이즈 회피
  const fasterCandidates = comparisons.filter((c) => c.deltaSec < -0.1);
  const slowerCandidates = comparisons.filter((c) => c.deltaSec > 0.1);
  const accUpCandidates = comparisons.filter((c) => c.deltaAccPp > 2);
  const accDownCandidates = comparisons.filter((c) => c.deltaAccPp < -2);

  return {
    hasEnough: true,
    faster: [...fasterCandidates].sort((a, b) => a.deltaSec - b.deltaSec).slice(0, 2),
    slower: [...slowerCandidates].sort((a, b) => b.deltaSec - a.deltaSec).slice(0, 2),
    accUp: [...accUpCandidates].sort((a, b) => b.deltaAccPp - a.deltaAccPp).slice(0, 2),
    accDown: [...accDownCandidates].sort((a, b) => a.deltaAccPp - b.deltaAccPp).slice(0, 2),
  };
}
