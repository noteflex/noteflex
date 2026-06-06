# 분석 보고서 (AI Report) — 개발 문서

기준일: 2026-06-04. 분석/보고서 기능의 현황·결정·미해결 정리. 다음 세션 맥락용.

## 1. 명칭과 성격

- 내부 통칭은 "AI 코칭 / AI 분석 보고서"이나 LLM은 없다. 전부 결정론적 SQL 규칙 엔진이다.
- 사용자 노출 "AI" 표현은 전부 제거함(심사·환불·과장 리스크). 규칙 기반 분석으로 정정.
- "AI"는 출시 후 데이터가 쌓이면 규칙 결과를 자연어로 풀어주는 얇은 LLM 층을 더할 때 다시 붙인다.

## 2. 아키텍처

- 야간 배치(cron) 우선 + 최소 라이브. 일간 슬라이스는 `user_note_logs`에서 라이브 산출.
- 테이블:
  - `user_analytics_rollup` (day/week/month) — `supabase/migrations/20260526_analytics_02_tables.sql`
  - `user_note_status` — 동 파일
  - `user_note_weak_scores` — `supabase/migrations/20260531_weak_scores_table.sql` (별도 마이그레이션)
- 엔진(롤업·약점·인터벌·clef·임시표 계산)은 구축·가동 중. 데이터 무결성 확인 완료(per-note 로그 정상, `is_correct` 신뢰 가능).

## 3. 세 보고서 목적

- **일간**: 진단·행동("다음에 뭘 고치나"), Free 후킹, 라이브.
- **주간**: 패턴·습관, Pro, 배치.
- **월간**: 성장·정체·유지율, Pro, 배치.

## 4. 현재 상태 (2026-06-04)

**완료:**

- 사용자 노출 AI 표현 제거(`Pricing` · `Index`/SEO · `Dashboard` · `strings.ts` · `index.html`).
- 일간 보고서 보강: 약점 음표 강조 섹션, "Reading by leap size"(인터벌) 섹션 라이브 산출, takeaway 자동 선택.
- 인터벌 0% 표시 버그 수정(`errorRate → accuracy`). 인터벌 섹션 스타일을 카드+라벨/막대/% 한 줄+심각도 색으로 정비.
- **주간 리포트 빌드 완료 + polish + 데이터 3건 수정** (2026-06-04):
  - `useWeeklyReport.ts` — 현재/직전 주 + 7일 day rows 병렬 조회. 모든 derived 값 hook 내부 계산.
  - `WeeklyReport.tsx` — render-only. 헤드라인·메트릭 3개·추세선·리듬 원·집중 음표·격려 카드.
  - `WeeklyAnalyticsPage.tsx` — Pro 게이트 유지, ComingSoonGate 제거.
  - `src/types/analytics.ts` — `WEAK_NOTE_GREEN_THRESHOLD = 0.75`, `WeeklyHeadlineKind` 상수·타입 추가.
  - D1: 헤드라인을 주간 delta 기반 win-first로 교체. "낮았어요"는 delta ≤−1%p 시만(delta ≥ 0이면 부정 표현 완전 제거).
  - D2: `WEAK_NOTE_GREEN_THRESHOLD=0.75` 단일 상수 — 집중 목록 필터(accuracy < 0.75)와 dot 색 분기 모두 동일 기준 참조.
  - D3: "최장 공백"(미래 날짜 포함 오류) → weekStart~오늘 경과일 범위 내 연속 streak.
- admin RLS 오염 발견·수정: `useWeeklyReport` 세 쿼리에 `.eq("user_id", userId)` 명시 추가.
- 개발 검증용 시드 스크립트 작성: `scripts/dev/seed_analytics_current.sql`, `teardown_analytics_seed.sql`.

**보류(데이터 성숙 후, 약 2~4주):**

- 월간 보고서: 목적 = 성장·정체·유지율. §9 수준 설계 후 빌드.

## 5. 핵심 설계 결정

- **음자리표별·임시표별 집계 막대 제외**: 기능이 특정 레벨부터 등장하는 level-gating confound + per-note 약점 음표가 음자리표를 이미 담아 중복.
- **인터벌 섹션 유지**: 동일 confound가 있으나 음표 하나로 못 잡는 관계 차원이라 유지하되 "오늘 친 레벨 기준"으로 한정.
- **보고서 루프 원칙**: 관찰→진단→처방→행동 루프를 닫아야 함. 추이 나열에서 멈추지 않는다.

## 6. 미해결 / TODO

- **[중대][Opus] 개인 분석 read 전체 admin RLS user_id 필터 audit** — `useWeeklyReport`에서 수정했으나 동일 패턴이 `usePeriodReport`·`useDailyReport`·`useDailyIntervals`·대시보드 read에 잔존 가능. admin으로 일간/주간/월간 재검증 필요. (상세: PENDING_BACKLOG.md `🔴 중대·Opus` 항목)
- **일간 delta baseline 가드**: baseline이 직전 1일치 희소 데이터로 잡혀 "▲31%p vs avg" 류 허수 표시. 직전 active days < 3이면 delta 숨김 가드 추가 필요.
- **주간 보고서 검증 잔여**: 반응속도 delta 부호(ms↓=빨라짐=emerald) 실측, 격려 카드 grace/nodata 분기, 엣지 5종 화면 검증.
- **월간 보고서 설계 + 빌드**: 데이터 성숙 후. §9 수준 설계 문서 작성이 선행 조건.
- **인터벌 버킷 라벨 정밀도**: `interval_from_prev`가 반음 거리이면 "3rd–5th" 등은 음정 이름과 근사치. 필요 시 재검토.
- **v2 졸업 속도 게이트** (ratio ≤ 0.35): `user_note_logs`에 `sublevel`/`session_id` 컬럼 부재로 보류.
- **RPC vs 직접 조회**: `get_*_report` RPC(own-only RLS) vs `user_analytics_rollup` 직접 조회 — 접근 경로 정리 필요.
- **LLM 자연어 코칭 층**: 출시 후.

## 7. 주요 파일

| 파일 | 역할 |
|---|---|
| `src/components/analytics/DailyReport.tsx` | 일간 보고서 렌더 (약점 음표·인터벌·세션) |
| `src/components/analytics/WeeklyReport.tsx` | 주간 보고서 렌더 (render-only, 계산은 hook) |
| `src/components/analytics/WeeklyAnalyticsPage.tsx` | 주간 페이지 레이아웃·Pro 게이트 |
| `src/components/analytics/MonthlyAnalyticsPage.tsx` | 월간 페이지 레이아웃·Pro 게이트 |
| `src/hooks/useWeeklyReport.ts` | 주간 데이터 조회 + 모든 derived 값 계산 |
| `src/hooks/useAnalytics.ts` | `useDailyReport`, `useDailyIntervals`, `usePeriodReport` |
| `src/types/analytics.ts` | 분석 타입. `WEAK_NOTE_GREEN_THRESHOLD=0.75`, `WeeklyHeadlineKind` 포함 |
| `src/i18n/strings.ts` | analytics 네임스페이스 전체 (ko·en) |
| `scripts/dev/seed_analytics_current.sql` | 개발 검증용 시드 (5/11~6/4) |
| `scripts/dev/teardown_analytics_seed.sql` | 시드 제거 + real-only rollup 재빌드 |
| `supabase/migrations/20260526_analytics_02_tables.sql` | `user_analytics_rollup`, `user_note_status` 테이블 |
| `supabase/migrations/20260526_analytics_03a_functions.sql` | 롤업·약점 계산 함수 |
| `supabase/migrations/20260526_analytics_03b_cron.sql` | 야간 배치 cron |
| `supabase/migrations/20260526_analytics_04_rpcs.sql` | `get_daily_report` 등 RPC |
| `supabase/migrations/20260531_weak_scores_table.sql` | `user_note_weak_scores` 테이블 |

## 8. 참조 스펙

- `docs/archive/specs/noteflex-analytics-report-spec.md` (엔진 스펙)
- `docs/archive/specs/noteflex-analytics-UI-spec.md` (UI 스펙)

## 9. 주간 보고서 (2026-06-04 빌드 완료 + polish + 데이터 3건 수정)

**상태**: 설계 확정 → 빌드 완료 → D1/D2/D3 데이터 정합성 수정 + 디자인 개선 완료. `/analytics/weekly` Pro 전용 라이브.

**관련 파일**: `src/hooks/useWeeklyReport.ts`, `src/components/analytics/WeeklyReport.tsx`, `src/components/analytics/WeeklyAnalyticsPage.tsx`, `src/i18n/strings.ts`, `src/types/analytics.ts`.

목적: 일간(스냅샷·다음 세션 교정)과 달리 "연습이 먹히고 있나 / 습관은 어떤가" — 궤적·리듬·지속 약점.

구성(위→아래):

1. **결론 헤드라인** — 주간 delta 기반 win-first(`headlineKind`: up/down/same/grace/nodata). delta ≤−1%p 시만 "낮았어요" 표현. delta ≥ 0이면 부정 표현 완전 제거. 서브라인: 집중할 음표가 있으면 "{note}만 잡으면 더 오를 거예요", 없으면 "약점이 거의 없었어요".
2. **지표 카드 3개** — 🎯정확도·⚡반응속도·🔥활동일(N/7). delta = vs 지난주(일간 baseline 허수 이슈 없음). up=emerald, down/neutral=gray(red 미사용).
3. **정확도 추세선** — 7일, 목표선 85% 점선. 선 색 = 브랜드 로고 `#D3224E`.
4. **연습 리듬** — 요일별 동그라미(활동=✓ 채움, 빠진 날=점선 외곽). 미래 날짜 = 빈 원. 하단 streak 텍스트: streak≥2 → "🔥 N일 연속 연습 중!", streak≤1 → "이번 주 N일 연습". **미래 날짜 제외**하고 weekStart~오늘 구간만 streak 산출.
5. **집중할 음표** — `WEAK_NOTE_GREEN_THRESHOLD=0.75` 기준. accuracy < 0.75인 음표만 포함(녹색 음표 제외), accuracy 오름차순(가장 약한 것 먼저), 최대 5개. 심각도 점: <50% 적·50~74% 호박.
6. **격려 카드** — 항상 표시(데이터 있을 때). 집중 음표 있으면 "이 페이스면 {note}도 졸업할 수 있어요", 없으면 "이번 주 흐름 그대로 가면 돼요."
7. **Grace(week 1)** — prev 롤업 없으면 진행 바(activeDays/7). 헤드라인에는 "N일째 연습 중이에요" 텍스트 표시.

**핵심 상수/타입**:

```typescript
// src/types/analytics.ts
export const WEAK_NOTE_GREEN_THRESHOLD = 0.75;
export type WeeklyHeadlineKind = "up" | "down" | "same" | "grace" | "nodata";
```

**아키텍처 원칙**: 모든 derived 값(`headlineKind`, `headlineDeltaPp`, `streakDays`, `focusNotes`, `topFocusNote`, `accuracyDeltaPp`, `reactionDeltaMs`, `weekDays`, `todayStr`, `activeDayCount`, `activeDayIndices`, `todayIndex`)은 `useWeeklyReport.ts`에서 산출. `WeeklyReport.tsx`는 render-only.

일관성:
- 음자리표·임시표 집계 막대 미포함(level-gating confound + per-note 중복).
- 인터벌(도약) 분석은 일간 전용.

티어: Pro 전용(`ProLockScreen`).

## 10. 월간 리포트 (설계 — 빌드 PARKED)

**목적**: 성장/리텐션 레이어. 일간=진단, 주간=습관/패턴, 월간=한 달간 성장 궤적 + 지속 여부. 진단이 아니라 성취·궤적 중심(이탈 방지 보상 보고서).

**상태**: 설계 완료(목업 승인). 빌드 PARKED. 전제 조건 2개 충족 전 빌드 금지 —
1. RLS audit 완료(`usePeriodReport`에 명시적 `user_id` 필터 추가).
2. 완료된 한 달 + 직전 달(MoM 비교용) 데이터 존재.

**데이터 소스**: `user_analytics_rollup`(`period_type='month'`, 현재·직전 달), 월 내 daily rollup, 월 내 weekly rollup(없으면 daily를 주 단위 집계), `graduated`/`regressed` JSONB.

### 섹션 구성 (위→아래)

1. **헤드라인(성장 우선)** — "한 달 동안 정확도 N%p ↑ · 음표 N개 졸업". `accuracyDeltaPp` = 이번달 avg − 지난달 avg(첫 달이면 숨김). `graduatedCount` = `graduated.length`.
2. **지표 4장** — 🎯정확도(MoM Δ) / ⚡반응속도(MoM Δ, ms↓=빨라짐=emerald) / 🗓️연습일(active일/경과일) / 🏅졸업 음표 수. month rollup baseline + 월 내 daily rollup count.
3. **주차별 성장 곡선** — 월 내 주별 평균 정확도 선(4–5점). weekly rollup 또는 daily 주 집계. 데이터 없는 주는 점 생략. 선 색 `#D3224E`.
4. **연습 캘린더(히트맵)** — 칸 = 그 달의 한 날, offset = 그 달 1일의 요일. 색 농도 = 그 날 연습량 = `user_note_logs`의 그 날 시도 수(session_id 없으므로 세션 수 대신 시도 수). 버킷 4단계: 0(빈 칸) / 연한 / 중간 / 진한. 임계값은 placeholder — 첫 달 실데이터 분포 확인 후 확정. 범례 캡션 필수: "칸 색이 진할수록 그 날 연습을 많이 했어요". 최장 연속일은 경과일(과거)만 대상.
5. **졸업한 음표** — 월초 weak(<0.75) → 월말 양호(≥0.75)로 전이한 음표. `graduated` JSONB. "X% → Y% ✓" 형식. 가장 강한 성장 신호.
6. **아직 잡을 음표** — 여러 주에 걸쳐 weak(<0.75)였던 음표만. `weak_notes_top`을 주별 등장 횟수로 필터. 다음 달 focus로 이월.
7. **격려/다음** — `graduatedCount > 0`이면 축하 + 다음 목표, 성장 flat이면 정직한 격려, 한 달 미만 데이터면 grace("아직 한 달치 데이터가 없어요").

### 알려진 함정 / 전제

- **첫 달은 MoM Δ 전부 숨김** — 직전 달이 없으면 모든 delta 표기를 숨긴다(주간 delta 버그와 동일 패턴).
- **반응속도 부호 주의** — ms 감소 = 빨라짐 = emerald. 주간과 동일하지만 뒤집히기 쉬움.
- **graduated/regressed 신뢰도** — 배치가 기간 시작/끝 상태 전이를 정확히 계산해야 신뢰 가능. 실데이터 검증 필요.
- **usePeriodReport는 RLS audit 대상** — admin RLS 오염(`is_admin()` 전체 반환) 대상. `user_id` 필터 audit 완료 후에만 검증 가능.
- **한 달 미만 데이터** — grace 상태로 처리. 강한 empty state("아직 한 달치 데이터가 없어요") 표시.

### 색상 팔레트

| 용도 | 값 |
|---|---|
| 성장 곡선 | `#D3224E` |
| 히트맵·active | `#22c55e` (연한 `#86d9a0`) |
| positive delta / 졸업 ✓ | `#1a9d52` |
| 약점 점 | `#EF9F27` |

이모지는 헤드라인·지표·섹션·격려에만 절제 사용.

## 11. 알려진 함정 (Known Pitfalls)

- **개인 분석 read는 RLS 스코핑에 의존하지 말 것** — `is_admin()` 정책은 전 유저 행을 반환한다. 개인 보고서·대시보드 read는 반드시 명시적 `.eq("user_id", userId)` 필터를 추가해야 한다. 이 필터 없이 RLS에만 의존하면 admin 계정이 조회 시 다른 유저 데이터가 혼입된다(활동일 오버카운트, 추세선 왜곡, delta 계산 오류). admin 전용 전체 조회는 `/admin/*` 경로에서만.
- **`Promise.all`에서 sub-query 오류를 throw하지 말 것** — 직전 주·일간 rows처럼 없어도 동작 가능한 쿼리는 오류 시 `null`/빈 배열로 처리하고 `console.warn`으로만 기록. `throw`하면 선택적 데이터 부재가 전체 보고서 오류 화면으로 전이된다.
