# Noteflex 분석 보고서 & AI 코칭 스펙 (v1)

> 작성: 2026-05-26 · 출시 목표: 2026-06-07 · 빌드 ① 단계 **확정본**
> 권장 위치: `docs/specs/analytics-report-spec.md`
> 도구: 분석/설계 = 채팅, 구현 = Code(Sonnet)

---

## 0. 한 줄 요약

세 기간 보고서(일간·주간·월간)는 **같은 수치를 기간만 늘려 보여주는 게 아니다.** 각 기간에서만 드러나는 학습 현상을 보여준다.
무거운 집계는 **배치(nightly)** 가 미리 계산하고, 즉시성(이번 세션·오늘)만 읽기 시점에 라이브로 얹는다.

| 보고서 | 답하는 질문 | 드러나는 현상 | 입도 | 티어 |
|---|---|---|---|---|
| 일간 | 다음 세션에 뭘 고치나 | 진단·행동 (지금 이 순간) | 세션·음표 | Free (후킹) |
| 주간 | 내 연습 습관이 어떤가 | 패턴·습관 (추세·리듬) | 날짜 | Pro |
| 월간 | 실제로 늘고 있나 | 성장·정체 (마스터·유지) | 주차 | Pro |
| 세션 종료 코칭 | 방금 어땠나 | 이번 세션 vs 과거 | 세션 1개 | Free 후킹 / Pro 풀 |

---

## 1. 아키텍처: 배치 우선 + 최소 라이브

**원칙: 비싸고 신선도 안 중요한 건 배치, 작고 즉시성 필요한 것만 라이브.**

### 배치 (nightly, 기존 `run_daily_batch_analysis` 확장)
- 과거 일자별 집계 (어제까지의 daily summary)
- 주간·월간 롤업
- 주간·월간 **약점 음표 랭킹** (지속 약점 = 노이즈 제거된 신호)
- **베이스라인**: 유저 **최근 2주 rolling** 평균 정확도·반응속도 (**오늘 제외**, 델타 비교용)
  > lifetime 평균은 사용 안 함 — 개선 중인 유저는 오늘이 거의 항상 평생 평균보다 위라 "오늘 vs 평소" 델타가 늘 거짓 양수(맨날 ▲)가 됨. §6 졸업과 동일 원리.
- 졸업(마스터) 판정 + 유지율
- 스트릭

### 라이브 (read-time, 작은 범위만)
- **오늘 in-progress 슬라이스** — 오늘 친 세션 rows만 읽음 (작아서 가벼움)
- **방금 끝난 세션** — 세션 종료 코칭 다이얼로그용

### 화면별 데이터 출처
- **일간 탭**: 배치 베이스라인 + 오늘 라이브 슬라이스 → 오늘 친 게 즉시 반영됨
- **주간·월간 탭**: 100% 배치 읽기 (토글해도 무거운 쿼리 안 돎)
- **코칭 다이얼로그**: 방금 세션 라이브 계산 vs 배치 베이스라인

> 왜 배치: 로그가 쌓일수록 라이브 전체집계는 토글마다 무거워져 대시보드가 느려진다. 즉시성은 "오늘 슬라이스 + 코칭 다이얼로그"가 이미 커버하므로 라이브 전체집계는 불필요.

---

## 2. 데이터 원천

### `user_note_logs` (음표 단위)
`note_key`, `octave`, `clef`, `is_correct`, `response_time`(**초**), `error_type`, `level`, `created_at`, `interval_from_prev`(직전 음표 대비 부호 있는 반음 거리)

### `user_sessions` (세션 단위)
`note_attempts` JSONB `{ note, correct, reaction_ms(밀리초), clef, accidental }` + 세션 메타(level, score 등)

### ⚠️ 단위 불일치 (기술부채)
- `user_note_logs.response_time` = **초**, `user_sessions.note_attempts.reaction_ms` = **밀리초**
- **엔진 내부는 ms로 통일.** 일간/주간/월간·코칭 전부 ms 기준으로 계산하고, 표시 단위만 화면에서 변환.

---

## 3. 보고서별 상세

### 3.1 일간 — 진단·행동 ("다음 세션에 뭘 고치나")

**반영 데이터**
- 오늘 세션 목록 (각 정확도·속도·레벨)
- **오늘 틀린 음표 실물 리스트** — 지금 바로 복습용 (가장 액션에 가까운 정보)
- 오늘 정확도/속도 vs 평소(배치 베이스라인) **델타**
- 완료 세션 수, 스트릭 상태
- **세션 내 워밍업 곡선**: 세션 초반 vs 후반 정확도·속도 (attempt 순서 + reaction_ms)
- **세션 간 피로**: 오늘 첫 세션 vs 마지막 세션 (과하게 했나)

**운영**
- 오늘 슬라이스는 **라이브** (배치 베이스라인 위에 오늘 rows를 얹어 계산)
- 신규 유저도 **1일차부터 꽉 참** — 출시 핵심 보고서

**표시 순서**
1. 상단 요약 카드: 정확도 · 평균 속도 · 세션 수 + 평소 대비 ▲▼
2. 오늘의 약점 음표 칩 (탭하면 복습)
3. 세션별 미니 리스트
4. 워밍업/피로 곡선 (오늘 컨디션)

---

### 3.2 주간 — 패턴·습관 ("내 연습 습관이 어떤가")

**반영 데이터 (하루론 절대 안 보이는 것)**
- 요일별 정확도·속도 (7일)
- **연습 리듬**: 요일별 활동 / 빠진 날 / 몰아치기 패턴
- **추세 기울기**: 정확도·속도가 오르는 중인지 내리는 중인지 (점 하나론 추세 없음)
- **지속 약점 vs 일시 약점**: 한 주 내내 틀린 음표 = 진짜 약점 / 오늘만 틀린 건 노이즈
- 활동 일수 / 7, 총 연습량(추정), 레벨 진행
- 이번 주 vs 지난 주 델타

> **핵심 연결**: 주간의 "지속 약점"이 **약점 훈련 모드(2b)의 입력**이다. 일간 노이즈(어제 우연히 한 번 틀림)를 다음날 집중 출제하면 헛다리. 주간 신호만 훈련 입력으로 쓴다. → §6 참조.

**운영**: 100% 배치 (지난 7일 롤업). `<7일`이면 §8 grace.

**표시 순서**
1. 7일 라인차트 (정확도 + 속도)
2. 주간 약점 음표 top
3. 이번 주 vs 지난 주 비교 바
4. 연습 리듬 히트맵 (요일별)

---

### 3.3 월간 — 성장·정체 ("실제로 늘고 있나")

**반영 데이터 (장기로만 존재 가능한 것)**
- 주차별 추세 (4~5주)
- **졸업한 음표**: 약점 → 정상 전환 수 (§6 기준으로 판정)
- **유지율(retention)**: 마스터한 음표가 유지되나 / 퇴보하나 — 본질상 장기 개념
- 레벨 마일스톤
- 월 활동 일수 (꾸준함)
- 누적량, 스킬 궤적 (전체 초견 속도가 진짜 빨라지는지)

**운영**: 100% 배치.
> 정직한 한계: 월간의 핵심 지표(유지율·마스터·궤적)는 **한 달치 데이터가 있어야 존재**한다. 이건 "나중에 하자"가 아니라 지표의 성질. day-1에 만들되 §8 grace가 그 자체로 콘텐츠가 되고, 한 달 뒤 제 모습이 나온다.

**표시 순서**
1. 주차별 추세
2. "이번 달 마스터한 음표 N개"
3. 유지율
4. 마일스톤 타임라인

---

## 4. 세션 종료 AI 코칭 다이얼로그

- **새 모달 X.** 기존 게임 결과 다이얼로그를 정비 ("별도 모달 없음" 원칙 유지).
- 목적: **이번 세션과 과거 기록을 한눈에 비교.**
- 운영: 방금 끝난 세션 **라이브** 계산 vs 배치 베이스라인.

**내용 (compact, 3~4개만)**
- 이번 세션 핵심 지표 + 과거 대비 델타 (이번 세션 vs 평소 / 지난 세션 / 최고)
- 약점 음표 1~2개
- 규칙 기반 코칭 한 줄
- "풀 보고서 보기" → 대시보드 링크

**티어**: Free = 후킹 버전(핵심 + 주간 티저), Pro = 풀.

---

## 5. 규칙 기반 인사이트 엔진

- 보고서 3종 + 코칭 다이얼로그가 **공유**. raw 집계는 하나, 각 화면이 다른 파생 지표를 뽑아 쓴다.
- 절대값 + **비교 델타** 둘 다 산출.
- **v1 = 규칙/템플릿 기반.** 예: "낮은음자리 G2가 약점, 평소보다 0.8초 느림 — 다음 세션에서 집중."
- 실제 LLM 호출 코칭은 **출시 후** 업그레이드 (비용·지연 때문에 v1 제외).

---

## 6. 졸업(마스터) 판정 + 약점 훈련 루프

**판정 구간: 해당 음표 최근 20회 시도 (lifetime 평균 사용 X)**
> lifetime으로 계산하면 초반 실패가 평생 평균을 끌어내려 영영 졸업 못 함. 마스터는 "지금 잘하나"이므로 **최근 구간**으로 본다.
> 단위는 '세션'이 아니라 **'해당 음표의 시도(attempt)'** — 음표가 세션마다 등장 횟수가 달라서, 세션 단위로 잡으면 음표별 표본 크기가 들쭉날쭉해진다.

**졸업 기준 (절대 기준으로 잠금 — "평균 이하"는 약한 기준이라 사용 안 함)**
음표가 다음을 **모두** 만족하면 졸업:
1. 최근 20회 시도 정확도 ≥ 95% (= 20회 중 오답 ≤ 1)
2. 최근 20회 시도 중앙 반응속도 **ratio ≤ 0.35** (= 서브레벨 timeLimit × 0.35, 기존 `PASS_CRITERIA` 방식. **절대 ms 아님** — 이 시스템엔 절대 ms 기준이 없음. recon 정정)
3. 그 20회가 **≥ 2개 세션에 걸쳐 있을 것** (한 세션 운빨 졸업 방지)
4. 최근 시도가 **20회 미만이면 판정 보류** (표본 부족)
5. **이전에 약점으로 분류됐던 음표** (약점 → 정상 '전환'이 졸업의 정의)

> 구간 크기 ↔ 정확도 바는 연동: 95% 바는 20회여야 오답 1개 허용(19/20). 15회면 0오답이라야 통과(14/15=93%)라 너무 빡셈 → **20 권장**, 튜닝 가능.
> v2 옵션: 고정 구간 대신 EWMA(최근 가중 이동평균)로 자연 감쇠 — 더 매끈하지만 졸업 기준을 유저에게 설명하기 어려워 v1은 투명한 고정 구간 사용.

**닫힌 루프**
- 졸업한 음표 → 약점 훈련 출제 로테이션에서 **제외**
- 퇴보(기준 미달 재발) → 훈련 로테이션 **재진입**
- 즉, 보고서가 훈련 입력을 갱신한다.

---

## 7. 티어 분배 & 업셀

**분배**
- **Free**: 일간 + 코칭 다이얼로그(후킹 버전)
- **Pro**: 주간 · 월간 + 음표별 심층 + 코칭 풀

**업셀 (일간 → 주간 블러 티저)**
- 일간 하단에 주간 티저 한 줄 (블러/자물쇠). 예: "오늘 틀린 음표, 이번 주 내내 그랬을까?"
- **담백하게 한 줄.** 결핍 너무 대놓고 건드리면 naggy → Jobs 결 깨짐.
- ⚠️ **결제 직후 빈 화면 금지**: 주간은 첫 주 비어있음. 1일차 Pro 결제 후 "쌓이는 중 20%"만 보이면 환불·사기감 → Paddle 환불 리스크. 티저 카피를 **미래가치로 프레이밍** ("이번 주 패턴이 쌓이면 해제"). 결제 직후엔 잠금 화면 대신 §8 퀘스트 게이지를 Pro에게도 노출.

---

## 8. Grace ("쌓이는 중") 상태

빈 화면을 버그가 아니라 **퀘스트**로 인지시킨다.
- 단순 그레이 X → **진행률 게이지 + 해금 D-day**
- 예: `주간 추세 ██░░░░░░ 25% — 4일 더 채우면 해금`
- 카피는 **compact** (그 어시 버전은 장황 → 줄임)
- 듀오링고식 "매일 켜서 채우는" 루프와 정합

---

## 9. v1 제외 항목 (정직)

데이터 성숙 / 비용 때문에 출시 v1에서 뺀다. 빈 차트 노이즈 방지.
- 또래 백분위 (모집단 비교)
- 마이크로프리즈 / 지터 등 고급 지표
- 장기 추세 (데이터 성숙 후 자연 등장)
- LLM 기반 코칭 (규칙 기반 후 업그레이드)

---

## 10. Code가 ② 진입 전 확인할 것 (추측 금지, 사실부터)

1. ~~연습 시간 산출~~ → **해결됨(recon)**: `user_sessions.duration_seconds`(+ started_at/ended_at) 존재 확인. LAG 근사 불필요, `duration_seconds` 직접 사용.
2. `response_time`(초) vs `reaction_ms`(밀리초) — 엔진 ms 통일 지점 확정
3. 기존 `run_daily_batch_analysis` 현재 산출물 → 무엇을 더 얹어야 하는지 (새로 안 만들고 확장)
4. 테이블 이름 정확히 = `user_note_logs` (≠ user_game_logs)

---

## 11. 빌드 순서

1. **① (이 문서) 확정** + 인사이트 엔진 / 배치 집계 설계
2. **② 음표 출제 로직**
   - 2a. 전 레벨 출제 로직 점검·보완 (배치 내 같은 피치 클래스 상한 + 임시표/자연음 비율) — 기반 먼저
   - 2b. 약점 쿼리(주간 신호) + 약점 가중 출제 — 2a 위에 올림
3. **③ 보고서 UI + 코칭 다이얼로그 정비** (둘 다 ①의 인사이트 엔진 공유)
4. **④ 스트릭**

---

## 12. RECON 반영 (2026-05-26 1차 recon) — 기존 자산 & 정정

### 재사용할 기존 자산 (새로 만들지 않음)
- `note_mastery`: 음표별 `weakness_flag`·`mastery_flag`·`mastery_level`(0~5)·`recent_accuracy`·`total_attempts`. **§6 졸업의 토대** — 평행 시스템 X, 이걸 확장.
- `user_stats_daily`: 일간 집계 (트리거 실시간 적재). 일간 보고서 토대.
- `get_mastery_score(level, sublevel)`: 마스터리 점수 0~100. (B-0 Mastery Score UI 구현됨)
- `generateCoachingComment()` (`src/lib/aiCoaching.ts`, TS 규칙 기반): §5 코칭 엔진이 이미 존재 → 코칭 다이얼로그는 **확장**.
- `record_game_session` / `handle_session_complete`(트리거): 세션 → user_sessions·user_stats_daily·note_mastery 적재 경로.
- `run_daily_batch_analysis`(SECURITY DEFINER, KST 00:00): note_mastery 플래그 + daily_batch_runs 적재. **주/월 롤업은 여기 확장.**

### 정정 (스펙 본문 반영됨)
- **연습 시간**: `duration_seconds` 직접 사용. LAG 근사 폐기. (§10)
- **졸업 속도 기준**: 절대 ms 아님 → **ratio ≤ 0.35**(timeLimit×0.35, 기존 PASS_CRITERIA). (§6)
- **§6 졸업**: 기존 mastery_flag(`total_attempts≥20 AND recent_accuracy≥0.95`)에 [약점→전환 전제 + 속도 ratio 게이트]를 얹는 reconcile.
- **데이터 권위**: 음표 단위 = `user_note_logs`(octave·error_type·interval·level 보유). `note_attempts` JSONB는 `{note,clef,correct,reaction_ms}`로 더 가벼움(octave·accidental 없음) → **음표 분석은 user_note_logs 사용.**

### 순 신규 (아직 없음 — 이번에 만들 것)
- 주간·월간 롤업 (배치 확장)
- 일/주/월 보고서 UI (탭) + 코칭 다이얼로그 정비
- 비교 델타 2주 rolling 베이스라인
- `user_note_logs` 복합 인덱스 (user_id, created_at) 등 — 현재 단일 인덱스라 범위 쿼리 seq scan 위험

### 엔진 작성 전 gap-fill로 확인 (미해결)
- `user_stats_daily` · `note_mastery` 전체 컬럼
- `recent_accuracy` 윈도우 정의 (몇 회 / 며칠)
- `mastery_level` 0~5 단계 정의
- `note_key` 임시표 포함 여부 (임시표별 정확도·2a 분석 가능성 결정)
- session_type별 통계 취급 (tutorial 제외 여부)

---

---

## 13. 엔진 구현 결정/발견 (2026-05-26 v1 구축)

### 13.1 확정 결정 (엔진 v1 — 구현 미적용, 파일만 작성)

- **데이터 권위**: `user_note_logs`(원시 per-note). `user_sessions`는 세션 메타(`duration_seconds`, `session_type`)만.
- **신뢰 금지 컬럼**:
  - `user_stats_daily.avg_reaction_ms` — `(old+new)/2` 누적 평균 버그
  - `note_mastery.recent_accuracy` — 어떤 트리거/함수도 기록하지 않음 (항상 NULL)
  - `user_stats_daily.weak_notes` — 트리거가 한 번도 기록하지 않음 (항상 NULL)
  → 분석 엔진은 위 3개를 사용하지 않고 `user_note_logs`에서 직접 산출.
- **session_type 필터**: `tutorial` 제외. `regular`·`focus_mode`·`custom_score` 포함.
- **단위 통일**: `response_time` (초, NUMERIC(5,2)) → 엔진 내부는 모두 `× 1000` 변환해 ms로 처리.
- **약점 단위**: `(user_id, note_key, octave, clef)` — octave 구분(같은 음이라도 옥타브 다르면 별개 약점).
- **세션 매칭**: `user_note_logs`에 `session_id` 컬럼 없음 → `user_sessions(started_at, ended_at)` 시간 범위 EXISTS로 매핑.
- **기존 자산 보존**: `note_mastery` 트리거·`mastery_level` 재계산·`run_daily_batch_analysis`(약점/마스터리 플래그) 모두 건드리지 않음. 분석 엔진은 평행 시스템으로 별도 운영. 출시 후 정정 시점에 통합 결정.

### 13.2 졸업 속도 기준 확인 결과 (§6 보완)

**`user_note_logs`에 `sublevel` 컬럼이 없음.** 검증 위치:
- `supabase/migrations/20260405142021_*.sql` (스키마 원본)
- `supabase/migrations/20260525_note_interval_from_prev.sql` (마지막 ALTER)
- `src/hooks/useNoteLogger.ts:35-44`·`src/lib/userNoteLogs.ts:11` (insert payload)

→ per-attempt에 sublevel 식별 불가 → **ratio ≤ 0.35 기준은 v1에서 적용 불가**.

**v1 졸업 = 정확도만**:
1. 최근 20회 시도 정확도 ≥ 95% (오답 ≤ 1)
2. 20회가 ≥ 2개 세션에 걸침 (시간 범위 매칭으로 distinct session 카운트)
3. 이전에 약점이었던 음(`ever_weakness = true`)
4. 20회 미만 → 보류

**v2 졸업** (속도 게이트 추가): `user_note_logs`에 `sublevel`(또는 `session_id`) 컬럼 추가 후, sublevel별 `timeLimit × 0.35` 적용.

### 13.3 롤업 테이블 구조

#### `user_analytics_rollup`
- `(user_id, period_type, period_start)` UNIQUE, `period_type ∈ {day, week, month}`
- 활동량: `sessions_count`, `total_attempts`, `correct_attempts`, `total_duration_seconds`, `active_days`
- 정확도·반응속도: `overall_accuracy`, `avg_reaction_ms`, `median_reaction_ms`
- JSONB 섹션: `by_clef`, `by_accidental`, `by_level`, `per_note`, `interval_error_rates`, `weak_notes_top` (상위 10)
- 스트릭·베이스라인·졸업: `streak_days`, `baseline_accuracy`, `baseline_avg_reaction_ms` (period_end -14d ~ -1d), `graduated_count`, `regressed_count`, `graduated_notes`, `regressed_notes`
- RLS: own + admin SELECT. INSERT/UPDATE는 SECURITY DEFINER 배치만.

#### `user_note_status`
- PK: `(user_id, note_key, octave, clef)`
- 최근 20회 윈도우: `recent_20_attempts`, `recent_20_correct`, `recent_20_accuracy`, `recent_20_sessions`, `recent_20_avg_ms`, `recent_20_median_ms`
- 상태: `status ∈ {learning, weakness, graduated, regressed}`, `ever_weakness`
- 시각: `graduated_at`, `regressed_at`, `weakness_flagged_at`, `last_attempt_at`
- RLS: own + admin SELECT.

### 13.4 핵심 공식

- **약점 점수**: `weak_score = (1 - accuracy) × √attempts + LEAST(avg_ms/3000, 1.0) × 0.3`
- **임시표 분류**: `note_key ~ '[#b]'` → `accidental`, else `natural`
- **도약 버킷**: `ABS(interval_from_prev)` → `0 / 1-2 / 3-5 / 6-9 / 10+` (NULL 제외)
- **스트릭**: KST 기준 `created_at::date` distinct + 역방향 연속 일수
- **2주 베이스라인**: 같은 user의 `period_type='day'` rollup에서 `period_start ∈ [period_end-14, period_end-1]` 평균
- **세션 매칭 (EXISTS)**:
  ```sql
  AND NOT EXISTS (SELECT 1 FROM user_sessions s
                  WHERE s.user_id = log.user_id
                    AND s.session_type = 'tutorial'
                    AND log.created_at BETWEEN s.started_at AND s.ended_at)
  ```

### 13.5 작성된 마이그레이션 파일 (적용 X)

| 파일 (의존성 순서) | 내용 |
|---|---|
| `20260526_analytics_01_indexes.sql` | `user_note_logs(user_id, created_at DESC)`, `user_note_logs(user_id, note_key, octave, clef, created_at DESC)`, `user_sessions(user_id, session_type, started_at, ended_at)` |
| `20260526_analytics_02_tables.sql` | `user_analytics_rollup`, `user_note_status` 테이블 + RLS + `daily_batch_runs` 확장 |
| `20260526_analytics_03a_functions.sql` | `refresh_user_note_status(uuid)`, `build_period_rollup(uuid,text,date,date)`, `run_daily_analytics_rollup()` — outer EXCEPTION으로 에러 흡수(RAISE 안 함). cron 변경 없음. |
| `20260526_analytics_03b_cron.sql` | cron `noteflex-daily-batch` 갱신 — 기존 호출 보존 + `run_daily_analytics_rollup()` 추가. 03a 적용·수동 검증 후 분리 적용. |
| `20260526_analytics_04_rpcs.sql` | `get_daily_report(date)`, `get_weekly_report(date)`, `get_monthly_report(int,int)`, `get_user_note_status(text)` — 모두 SECURITY INVOKER, own-only RLS |
| `20260526_analytics_99_rollback.sql` | ⚠️ 자동 적용 X. 전체 원복 수동 실행 템플릿 (§A cron → §B RPC → §C 함수 → §D 테이블 → §E 컬럼 → §F 인덱스). |
| `20260526_analytics_03_engine.sql.bak` | 분할 전 원본 (보존만, `.bak` 확장자로 마이그레이션 자동 적용 대상 제외). |

### 13.6 검토 포인트 (DB 적용 전)

1. **인덱스 비용**: `user_note_logs` 4컬럼 복합 인덱스(`user_id, note_key, octave, clef, created_at`)는 쓰기 성능에 약간 부담. INSERT 처리량 측정 후 결정.
2. **세션 매칭 EXISTS 성능**: 활동량 큰 유저(>10K logs)에서 EXISTS 시간 범위 매칭 비용 측정 필요. 임계 시 materialized link 테이블 고려.
3. **temp data·중복 row**: `build_period_rollup`은 idempotent (UPSERT). 같은 날짜 재실행 안전.
4. **cron 갱신은 trigger·기존 함수 영향 X**: `run_daily_batch_analysis`는 그대로 유지, 본 마이그레이션이 cron 명령 문자열만 갱신.
5. **권한**: 모든 새 함수에 `GRANT EXECUTE TO authenticated` 또는 `postgres`만 부여 (anon 차단).
6. **v1 한계**: 졸업 속도 게이트(ratio≤0.35)는 v2로 보류 (sublevel 컬럼 추가 후).

---

*확정본. 변경 시 이 문서를 갱신하고 세션 로그에 기록.*
