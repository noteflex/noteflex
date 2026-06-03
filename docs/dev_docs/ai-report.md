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
- 주간/월간 렌더(`PeriodReport`) 구축, low-data 안내를 기간 단위 문구로 분리.
- 일간 보고서 보강: 약점 음표 강조 섹션, "Reading by leap size"(인터벌) 섹션 라이브 산출, takeaway 자동 선택.
- 인터벌 0% 표시 버그 수정(`errorRate → accuracy`). 인터벌 섹션 스타일을 카드+라벨/막대/% 한 줄+심각도 색으로 정비.
- 약점 음표 강조 행·인터벌 섹션 목업 스타일 적용(음표명 19px, 정확도 색, 카드 래퍼).

**보류(데이터 성숙 후, 약 2~4주):**

- 주간/월간 깊이: 추세 차트·연습 리듬 히트맵·이번주 vs 지난주 비교·마일스톤·유지율.

## 5. 핵심 설계 결정

- **음자리표별·임시표별 집계 막대 제외**: 기능이 특정 레벨부터 등장하는 level-gating confound + per-note 약점 음표가 음자리표를 이미 담아 중복.
- **인터벌 섹션 유지**: 동일 confound가 있으나 음표 하나로 못 잡는 관계 차원이라 유지하되 "오늘 친 레벨 기준"으로 한정.
- **보고서 루프 원칙**: 관찰→진단→처방→행동 루프를 닫아야 함. 추이 나열에서 멈추지 않는다.

## 6. 미해결 / TODO

- **델타 버그**: baseline이 직전 1일치 희소 데이터로 잡혀 "▲31%p vs avg" 류 허수 표시. `null` 가드만으로 부족 → baseline을 만든 직전 활동일 수 기준(예: ≥3일 미만이면 델타 숨김)으로 가드 필요. rollup이 그 일수를 들고 있는지 먼저 확인.
- **인터벌 버킷 라벨 정밀도**: `interval_from_prev`가 반음 거리이면 "3rd–5th" 등은 음정 이름과 근사치. 필요 시 재검토.
- **v2 졸업 속도 게이트** (ratio ≤ 0.35): `user_note_logs`에 `sublevel`/`session_id` 컬럼 부재로 보류.
- **약점 음표 강조 행·심각도 색**: 비-100% 날 기준으로 실측 확인 필요.
- **RPC vs 직접 조회**: `get_*_report` RPC(own-only RLS) vs `user_analytics_rollup` 직접 조회 — 접근 경로 정리 필요.
- **LLM 자연어 코칭 층**: 출시 후.

## 7. 주요 파일

| 파일 | 역할 |
|---|---|
| `src/components/analytics/DailyReport.tsx` | 일간 보고서 렌더 (약점 음표·인터벌·세션) |
| `src/components/analytics/PeriodReport.tsx` | 주간·월간 공용 렌더 |
| `src/components/analytics/WeeklyAnalyticsPage.tsx` | 주간 페이지 레이아웃·Pro 게이트 |
| `src/components/analytics/MonthlyAnalyticsPage.tsx` | 월간 페이지 레이아웃·Pro 게이트 |
| `src/hooks/useAnalytics.ts` | `useDailyReport`, `useDailyIntervals`, `usePeriodReport` |
| `src/i18n/strings.ts` | analytics 네임스페이스 전체 (ko·en) |
| `supabase/migrations/20260526_analytics_02_tables.sql` | `user_analytics_rollup`, `user_note_status` 테이블 |
| `supabase/migrations/20260526_analytics_03a_functions.sql` | 롤업·약점 계산 함수 |
| `supabase/migrations/20260526_analytics_03b_cron.sql` | 야간 배치 cron |
| `supabase/migrations/20260526_analytics_04_rpcs.sql` | `get_daily_report` 등 RPC |
| `supabase/migrations/20260531_weak_scores_table.sql` | `user_note_weak_scores` 테이블 |

## 8. 참조 스펙

- `docs/specs/noteflex-analytics-report-spec.md` (엔진 스펙)
- `docs/specs/noteflex-analytics-UI-spec.md` (UI 스펙)

## 9. 주간 보고서 설계 (2026-06-04 확정 · 빌드 보류)

목적: 일간(스냅샷·다음 세션 교정)과 달리 "연습이 먹히고 있나 / 습관은 어떤가" — 궤적·리듬·지속 약점. 한 점으로는 안 보이고 일주일이 있어야 보이는 것을 띄운다.

구성(위→아래):

1. **결론 헤드라인** — 궤적 + 지속 약점 + 리듬을 한 문장으로. 통계 나열 X.
2. **지표 카드 3개** — 정확도·평균 반응·활동일(N/7). 델타 기준은 vs 지난 주(일간의 baseline 허수 이슈 없음).
3. **정확도 추세선** — 7일, 통과선 85% 점선, 빠진 요일은 점 없이 라벨만 흐리게. 선 색 = 프랙티스 노트 색(`#b91c1c` — `TARGET_COLOR`, `src/components/practice/GrandStaffPractice.tsx:56`).
4. **연습 리듬** — 요일별 동그라미(활동=채움, 빠진 날=점선 외곽) + "N/7, 최장 공백". 채운 동그라미 색 = 프랙티스 노트 색(`#b91c1c`).
5. **지속 약점("Weak all week")** — 음표별 "missed N of M days"로 지속성 표기 + 정확도 + 심각도 점(<50% 적·50~74% 호박·≥75% 녹). 지속 약점(신호)과 하루치(노이즈)를 가른다. 수동 "훈련 시작" CTA는 두지 않는다 — 약점은 알고리즘이 훈련 로테이션에 자동 반영(졸업 제외·퇴보 재진입)하므로 불필요하고, 행동 전가 금지 원칙에도 맞는다.
6. **Grace(week 1)** — 7일 미만이면 진행 게이지 + "N/7일, 며칠 더" + 있는 만큼 부분 표시. "준비 중" placeholder 금지.

일관성:

- 음자리표·임시표 집계 막대 미포함(일간과 동일 — level-gating confound + per-note 중복).
- 인터벌(도약) 분석은 일간 전용. 주간은 궤적·리듬·지속 약점이라는 별도 표면.

티어: Pro 전용(Free는 기존 `ProLockScreen`). 빌드는 7일+ 실데이터 누적 후.
