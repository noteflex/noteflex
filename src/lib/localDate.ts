// 사용자 체감 로컬 자정 기준 날짜 키. 스트릭 등 "그날 활동" 판정에 사용.
//
// 분석 데이터(user_sessions/user_stats_daily/rollup)는 여전히 UTC 기반.
// 사용자 체감 = 로컬, 분석 = UTC로 분리 운영.

/** 로컬 자정 기준 YYYY-MM-DD. */
export function getLocalDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
