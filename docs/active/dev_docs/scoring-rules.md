# 채점·통과 규칙 (Scoring & Pass Rules) — 개발 문서

기준일: 2026-06-05. 마스터리 점수·통과 판정·약점 임계값·Fast Track 관련 결정·함정·미해결 정리.

---

## 1. 목적

서브레벨 통과 판정(`checkPassed`)과 마스터리 점수(`computeMasteryScore`) 계산 규칙, 그리고 이 규칙에 달린 결정 이유·버린 대안·불변식·함정을 기록한다. 숫자 상수는 코드(`src/lib/levelSystem.ts`, DB 함수)가 진실이며 이 문서는 숫자를 나열하지 않는다.

---

## 2. 설계 결정과 이유

### 서브레벨 3단계 훈련 목적 구조

레벨당 서브레벨이 3개인 이유: 한 레벨 안에서도 난이도를 세분화해 진행하며 실력 상승을 더 효과적으로 체감하게 하기 위함. sub1=정확도, sub2=흐름, sub3=지구력/초견의 세 훈련 목적 구조.

### PASS_CRITERIA — 단일 진실 출처

통과 조건 4가지(min_play_count, min_best_streak, min_accuracy, min_avg_reaction_ratio)를 `PASS_CRITERIA` 상수 하나로 정의한다. 결정 이유: UI의 "남은 조건 표시"(`checkPassed` 결과 렌더)와 DB RPC의 실제 통과 판정이 다른 숫자를 참조하면 사용자가 보는 진행 상태가 거짓이 된다. 상수 분리가 이 불일치를 방지한다.

불변식: `PASS_CRITERIA`를 변경하면 클라이언트 표시와 DB RPC 두 곳이 함께 바뀌어야 한다 — 한쪽만 바꾸면 통과 표시와 실제 unlock이 엇갈린다.

### Pass Criteria v2 — 윈도우 기반 (2026-05-09)

초기 통과 기준은 누적 `total_correct / total_attempts` 정확도를 사용했다. 결정 이유로 버린 이유: 누적 평균은 초반 부진이 영구히 남아 학습이 늘어도 통과선에 도달이 불가능한 케이스가 생겼다. 해결: `recent_plays` 최근 N판 윈도우로 정확도·반응속도 계산. `play_count`와 `best_streak`는 여전히 누적 — 반복 횟수와 연속 정답은 초반 데이터를 포함한 장기 능력 지표이기 때문이다.

### recent_plays 윈도우 — 표본 최솟값 가드

윈도우에 데이터가 충분하지 않으면 정확도·반응속도 점수를 0으로 처리하고 play_count·best_streak 점수만 부분 적용한다. 결정 이유: 1판 100% 정확도에서 마스터리 점수가 높게 나오면 실력을 반영하지 않는 의미 없는 점수가 된다. 최솟값 도달 전에는 "N판 이상 쳐야 측정 시작" 안내를 노출한다.

전체 세션 누적 평균으로 계산하면 초기 저성과 기록이 평균을 영구히 끌어내려 기준 충족이 부당하게 어려워진다. 이를 피하기 위해 최근 7세션 윈도우로 현재 실력을 반영한다. 윈도우 크기 7 자체는 실용값(최근성 vs 표본 절충, 조정 후보).

### Fast Track (2026-05-09, 그룹 D)

Premium(또는 admin) + Sub2 이상 + 첫 세션 + 세션 정확도 ≥ 99% + avg_reaction_ratio ≤ 지정값 — 5개 AND 조건이 모두 충족되면 마스터리 100, 통과 강제, 다음 서브레벨 자동 unlock.

결정 근거:

- **Premium 전용**: 비로그인·Free 사용자에게 즉시 unlock은 레벨 게이트 가치를 훼손한다.
- **Sub1 제외**: Sub1은 레벨 진입점이므로 건너뛸 수 없어야 한다.
- **첫 세션 한정**: 두 번째 시도 이후에는 "이미 실력을 검증받지 못한" 상태이므로 Fast Track 자격이 없다.
- **반응속도 조건 포함 이유**: 정확도 99%만으로는 천천히 생각해서 맞힌 경우를 구분 못 한다. Fast Track은 이미 숙달된 플레이어를 위한 것이므로 반응속도 조건이 필수다.

반응속도 조건의 분모: `avg_reaction_ratio = avgReactionMs / (sublevelConfig.timeLimit × 1000)` — 서브레벨 노트당 제한 시간(ms) 대비 보정 반응 시간 비율 (NoteGame.tsx 직접 확인). 임계값 근거: 명백히 빠른 유저만 발동하도록 보수적으로 설정, 깊은 근거 없음 — 조정 후보.

불변식: `fast_track=true`이면 `computeMasteryScore`는 어떤 메트릭 계산도 없이 100을 즉시 반환한다. `get_mastery_score` DB 함수도 동일.

### batchSize 정책 — Lv5~7 최솟값 (2026-05-23)

Lv5~7에서 `batchSize=1, 2` stage를 사용하지 않는다. 이유: 조표 음표 혼합 최소 3개 batch부터 유효하다(코드 직접 주석 출처). batchSize가 너무 작으면 조표가 있는 배치에 음표 하나만 나와 "조표 환경에서의 읽기" 훈련이 아니라 단일 음표 기억이 된다.

노트 수 설계 근거(2026-05-23): 노트당 2.5초 기준 속도로 세션 길이 1:30~3:00 타깃에 맞춰 노트 수를 산정.

버린 길: 짝수 batch(2·4·6)는 검토 후 제외 확정(2026-05-23) — batch=2는 화면 sparseness 문제. 재논의 금지 결정.

### computeScale 불변식 (§S1)

`computeScale(M)`은 M(슬롯 수)과 무관하게 고정 값을 반환한다. 불변식 이유: batchSize=1에서 7까지 같은 오선 크기를 사용해야 stage 전환 시 레이아웃 시프트가 없다. 고정값으로 바꾼 이유: batch 크기에 따라 1.0~0.55로 변하던 것을 상수로 고정(2026-05-23) — batch 크기와 무관하게 노트 크기의 시각적 일관성 확보.

불변식: M 인자를 받지만 계산에 사용하지 않는다. 이 동작은 테스트(`GrandStaffPractice.test.tsx`)로 고정돼 있으며, 추후 M-가변 scale을 도입하려면 테스트와 함께 명시적으로 변경해야 한다.

### WEAK_NOTE_GREEN_THRESHOLD — 단일 상수 통일

약점 음표 판단 임계값을 하나의 상수(`src/types/analytics.ts`)로 통일한다. 이 상수는 두 곳에서 참조된다:

1. 주간 리포트 음표 점 색상 (threshold 이상 = 초록 = 양호)
2. "집중할 음표" 목록 필터 (threshold 미만 = 약점 목록 포함)

결정 이유(D5 사건 교훈): 이전에 두 곳이 서로 다른 값을 사용했을 때, 음표가 점 차트에서 초록으로 보이면서 동시에 "집중할 음표" 목록에도 나타나는 모순이 발생했다. 사용자 입장에서 이미 잘하는 음표가 집중 목록에 있으면 보고서를 신뢰하기 어렵다.

불변식: 이 임계값은 반드시 한 곳에만 정의해야 한다. 두 곳 이상에 복사하면 D5 사건이 재현된다.

### 구독 게이트 vs. 진행 게이트 명시적 분리

`canAccessSublevel`(구독 티어 기반 접근 가능 여부)과 `getProgressGatePrev`(이전 서브레벨 통과 여부)는 의도적으로 별도 함수다. 결정 이유: 두 개념을 하나로 합쳤을 때, Premium 구독 만료가 진행 상태(이미 unlock된 서브레벨)를 소급 잠그는 버그가 발생했다. "구독"은 "새 것에 접근할 권리"고 "진행"은 "이미 달성한 것"이다 — 만료가 기존 달성을 지워선 안 된다.

---

## 3. 알려진 함정

### WEAK_NOTE_GREEN_THRESHOLD 중복 (D5 사건)

`WEAK_NOTE_GREEN_THRESHOLD`를 두 곳 이상에 하드코딩하면 D5 사건이 재현된다: 점 차트에서 초록인 음표가 집중 목록에 등장하는 UI 모순. 이 상수를 새로운 곳에서 참조할 때는 반드시 import하고 절대 복사하지 않는다.

### baseline 없는 delta (▲31%p 사건)

delta 계산의 baseline이 하루치 희소 데이터일 때 "▲31%p" 같은 통계적으로 무의미한 큰 값이 노출됐다. 가드: baseline active day 수가 최솟값 미만이면 delta 표시를 숨긴다. 분모가 적은 상황에서의 delta는 노이즈이며 신뢰를 깎는다.

### 상수 숫자를 문서에 적지 말 것

이 문서에 pass 임계값·윈도우 크기·배치 크기 등의 구체적인 숫자를 기록하면, 코드 변경 후 문서가 틀린 숫자를 제시하는 상태가 된다. 이 문서는 "왜 그 숫자여야 하는지"와 "어떤 불변식이 있는지"만 다룬다. 현재 값은 코드를 직접 확인한다.

### 누적 평균이 학습 곡선을 희석

`avg_reaction_ratio`를 누적 rolling average로 저장한다. 이 값은 초반 느린 세션이 포함돼 있어 실제 현재 실력보다 낮을 수 있다. 마스터리/통과 판정에는 `recent_plays` 윈도우를 쓰는 이유가 여기에 있다. Fast Track 반응속도 조건은 세션 값(`p_avg_reaction_ratio`)을 직접 사용하므로 누적 희석 문제를 회피한다. 만약 어떤 판정에서 cumulative avg를 다시 사용하면 초반 부진 사용자가 영구히 패널티를 받는 문제가 재발한다.

---

## 4. 관련 파일 색인

| 파일 | 역할 |
|---|---|
| `src/lib/levelSystem.ts` | PASS_CRITERIA, checkPassed, calculateAccuracy, calculateReactionRatio, RECENT_WINDOW_SIZE, MIN_RECENT_SAMPLE, canAccessSublevel, getProgressGatePrev |
| `src/components/MasteryScoreCard.tsx` | computeMasteryScore (4 컴포넌트, recent_plays 윈도우, fast_track 즉시 반환) |
| `src/components/practice/GrandStaffPractice.tsx` | computeScale (§S1), computeMaxVisibleN (§C1) |
| `src/types/analytics.ts` | WEAK_NOTE_GREEN_THRESHOLD 단일 정의 |
| `src/lib/aiCoaching.ts` | fast_track 분기 코칭 메시지 |
| `supabase/migrations/20260509_fast_track.sql` | Fast Track 5-조건 AND, record_sublevel_attempt 분기, get_mastery_score 100 강제 |
| `supabase/migrations/20260509_pass_criteria_v2.sql` | Pass Criteria v2 적용 |
| `supabase/migrations/20260529_recent_plays_window.sql` | recent_plays JSONB 윈도우, 윈도우 기반 get_mastery_score |
