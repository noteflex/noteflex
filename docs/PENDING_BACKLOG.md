# Noteflex 펜딩 백로그

> **출시 마감**: 🎯 **2026-05-31** (확정 — 약 33일)
> **목적**: 머릿속 + 채팅 + 첨부 기획서 + 코드 분석 + 설계-코드 갭에 흩어진 모든 미구현·미결정 항목을 한 곳에 모아 영구 보존.
> **작성일**: 2026-04-27 (초안) → 2026-04-28 (자동 갱신 시스템 도입)
> **출처**: 사용자 24항목 + 첨부 기획서 5개 + 설계 PDF + Claude Code 코드 분석 + 사용자 검증 버그 + Green Billion 명세서

---

## 🎯 출시 일정 (2026-05-31)

오늘 (4/28) 기준 **33일 남음**. 모든 작업 우선순위는 이 마감 기준으로 정렬.

### 병렬 진행 항목 (사용자 직접 + 심사 대기)

심사·승인이 필요한 항목들은 **코드 개발과 동시에** 사용자가 진행:

- **AdSense 심사**: 블로그 글 틈틈이 작성 → 15~20개 도달 시 심사 신청. 심사 기간 중에도 코드는 진행
- **Paddle Vendor 심사**: 약관 4종 + 사업자등록 완료 후 심사 신청. 심사 기간 중에도 코드 진행
- **사업자등록 (Leo Republic)**: 즉시 시작 — Paddle Vendor의 핵심 의존성

### 분류 마크

- 🔴 **출시 전 필수** (5/31까지)
- 🟢 **출시 직후 1개월** (6월 중 추가)
- 🟡 **출시 후 분기별** (Phase 7+, 7~9월)
- ⏳ **심사·승인 대기** (병렬 진행, 외부 의존)
- ⭐ 사용자 강조 항목

---

## ⚙️ 자동 갱신 시스템 (2026-04-28 도입)

**Claude (채팅) 또는 Claude Code 작업 시 다음을 자동으로 처리한다**:

1. **작업 완료 항목**: 항목 옆에 ✅ 추가 또는 §15 "완료 이력" 섹션으로 이동 (중요 항목은 이력 보존)
2. **새 발견 항목**: 버그·펜딩·결정 사항을 즉시 해당 섹션에 추가
3. **설계 변경·정책 결정**: `docs/DESIGN_VS_CODE_GAP.md`의 ❌/⚠️ → ✅ 동기화
4. **commit 분리**: 위 변경은 별도 commit으로 박아둠
   - 예: `docs: backlog update — §0.1 N+2 fix completed`
   - 예: `docs: backlog new finding — Lv5+ key signature race in stage 4`

**사용자가 매번 수동 수정하지 않게 한다.**

---

## 0. 사용자 검증 버그 🔴⭐ (즉시 — 1주차)

다음 세션에서 가장 먼저 잡을 항목.

### 0.1 N+2 재출제 즉시 등장 버그 ✅ (2026-04-29 `bb692cd` 1차 + 2026-04-30 `4e2b6ef` 전역 dedup 확장) · 🔴 디버그 instrumentation 출시 전 제거 필요
**사용자 검증**: "첫 번째 음표를 2번 틀린 후 정답을 맞추면 바로 다음 음표가 같은 음표가 나온다."

- 사용자 의도 (2026-04-30 재확정): 같은 음표가 **연속으로 절대 안 나오게** (전역). 1턴 지연 ~5% 허용.
- **1차 수정 (`bb692cd` 2026-04-29)**: cross-batch dedup (옵션 D) + retry pop 1턴 가드 (옵션 B). batchSize=1 케이스 해결. 그러나 retry pop 음표 자체에는 lastShownNote 비교 없어 사각지대 잔존.
- **2차 수정 (`4e2b6ef` 2026-04-30 전역 dedup 확장)**:
  - `popDueOrNull(turn, lastShownNote?)` 시그니처 확장 — due 후보 중 lastShownNote와 같은 ID는 skip. 모든 후보가 같으면 null → caller가 일반 batch[0]로 fallback (1턴 지연).
  - `lastShownNoteRef` ref 추가 — handleAnswer 시작에서 갱신. 4개 prepareNextTurn 호출 지점 모두에 lastShownNote 명시 전달.
  - **wasRetry 사각지대 fix**: retry 답한 음표가 `currentBatch[currentIndex]`와 같으면 `advanceToNextTurn(false)` (일반 advance)로 처리. retry로 이미 답한 셈이라 batch 음표 1개 자동 통과 — 사용자 입장에서 "같은 음표 바로 또 답하라"는 사각지대 사라짐.
  - **N+2 정책 정확화**: `rescheduleAfterCorrect`를 `advanceToNextTurn` 전에 호출하도록 순서 변경. 기존엔 advance 후 호출이라 turn이 이미 +1되어 due=N+3이었음. 수정 후 due=N+2 정확.
  - 03_GAME_LOGIC.md §3.2 표 정정 — "1회/2회/3회 차등" → "무조건 N+2".
- **수정 위치**: `src/hooks/useRetryQueue.ts` (popDueOrNull 시그니처) + `src/components/NoteGame.tsx` (ref + 4 호출 지점 + wasRetry 사각지대 + N+2 순서) + `docs/03_GAME_LOGIC.md` §3.2.
- **검증 도구 (`src/lib/simulator/`)**: NoteGame logic의 React-free 시뮬레이터. Lv1~4 × sub1~3 random 70% × 500g/each = 18000 games. invariant 위반 0건. delayedFallback 16.64% (사용자 ~5% 예상보다 높지만 추정치 — 큐 size>0 + lastShown skip 시 +1, 정확한 측정 아님). retry 간격 분포 N+2: 1976 (압도적), N+5+ 소수 (큐 충돌 시 1턴 지연된 케이스).
- **테스트**: 304/304 PASS. 새 추가:
  - `useRetryQueue.test.ts` 5케이스 (popDueOrNull lastShown skip)
  - `NoteGame.consecutive.test.tsx` 9케이스 (Lv1-4 × all-correct/random-70 + Lv1 sub2)
  - `NoteGame.invariants.test.tsx` 5케이스 (markMissed/markJustAnswered/rescheduleAfterCorrect 호출 횟수)
  - `src/lib/simulator/sim.test.ts` 10케이스 (1만 게임 fuzz + 정량 보고서)

**사용자 검증 결과** (콘솔 로그 + 시뮬레이터 1만 게임 fuzz):
- TURN 4 correct C5 → TURN 6에 C5 retry (정답 turn + 2)
- TURN 7 correct B4 → TURN 9에 B4 retry
- 같은 음표 연속 등장 0건 ✅
- N+2 분포 압도적 ✅

#### 0.1-cleanup 🔴 디버그 instrumentation 제거 (출시 전, Week 5 안에)
사용자 검증용 임시 추적 코드. 검증 끝나면 제거.
- 삭제 파일: `src/lib/retryQueueDebug.ts`
- `NoteGame.tsx`에서 `// [§0.1 DEBUG]` 마커 grep으로 모두 제거 (import 6개·prepareNextTurn 로그·markMissed×2·markJustAnswered·rescheduleAfterCorrect·resolve·정답 배지 인라인 turn/queue 표시·`SHOW_RETRY_DEBUG_FOR_ADMIN_OR_DEV` 상수)
- `lastRetryPopRef` ref 제거
- 패널 게이트 `SHOW_RETRY_DEBUG_FOR_ADMIN_OR_DEV && isAdminOrDev` → `SHOW_RETRY_DEBUG`(false) 원복 또는 패널 전체 제거
- 검증 가이드: 사용자가 dev server에서 Lv1 Stage1 → 첫 음표 2번 틀린 후 정답 → 콘솔 로그로 `markMissed` ×2 → `markJustAnswered` → `prepareNextTurn(qsize=1)` → batch[0] != 직전 음표 확인 → 2턴 후 retry로 다시 등장 확인.

### §4 retry 잔여 작업 🔴 (Week 2 — 출시 전)

§4 retry 시스템 핵심 구현 완료 (2026-05-01 밤). 다음 세션에서 처리할 잔여:

- ✅ **Step B** (완료 2026-05-02): 자동 로그 + 분석 시스템 — `src/lib/simulator/simLogger.ts` (`MemorySimLogger`/`FileSimLogger`, JSONL append, 14 이벤트 종류), `scripts/run-simulation.ts` (Lv1~4 × Sub1~3 × correctRate {0.3·0.5·0.7·0.9} 매트릭스, 9984 게임 ~3s), `scripts/analyze-sim-logs.ts` (9 invariants 검출 + markdown 자동 보고서), `npm run sim:test` 파이프라인. 9984 game × 790,212 events 위반 0건 검증.
- ✅ **Step C** (완료 2026-05-02, commit `c77492f`): 디버그 트레이스 정리 — `retryQueueDebug.ts` 삭제, `[§0.1 DEBUG]`/`[§4 BUG TRACE]` 마커 제거, sr-only 테스트 인프라 span만 보존 (373/373 PASS).
- ✅ **Step D** (완료 2026-05-02): 명세 박기 — `docs/04_RETRY_SYSTEM.md` 신규 (RetryQueue 상태 머신 + composeBatch/composeFinalRetryBatch 함수 명세 + §0.1 dedup 세 경로 + parity 표 + 테스트 invariant + lives 정책).

#### Step B 부수 펜딩: NoteGame 통합 테스트 (queueRef stale read 검증) 🟡

**범위**: simulator는 React-free → `queueRef` 비동기 stale read 검출 불가 (Q-B2 결정 2026-05-02). production `NoteGame.tsx` 환경에서만 발견되는 버그 클래스 별도 § 필요.
- queueRef 비동기 stale read 검출
- React 환경 시뮬레이션 (React Testing Library)
- 도구: Sonnet 또는 Opus (분석 후 결정)
- 작업 시간: 1~2시간
- 우선순위: 출시 전 펜딩 (sim invariant 9개로 retry 시스템 sim-side 회귀는 보호됨)

### ✅ 0.2 Lv5+ 조표 음표 비율 부족 (완료 2026-04-30, commit bb062c3)
**사용자 검증**: "조표 붙은 음표가 안 나와 swipe 검증 자체 막힘."

- batchSize 기반 조표 비율 — 1→30%, 3→40%, 5→60%, 7→70% (`getAccidentalRatio`)
- treble/bass 50:50 + 한 batch 내 두 자리표 무조건 등장 보장 (`pickBalancedCount`)
- 14개 신규 fuzz 테스트 (10,000 반복 ±5% 허용), 325/325 PASS

### ✅ 0.3 카운트다운 후 첫 음표 버퍼링 (완료 2026-05-01, commit eac606a)
**설계 §3.3.나 + 메모리**: "카운트다운 끝남 = 음표 표시 + 사운드 동시. 버퍼링 없어야 함. Lv7-3 3초 제한에서 답 시간 부족."

- `FIRST_NOTE_GRACE_MS = 300ms` — handleCountdownComplete 내부를 300ms setTimeout으로 감쌈
- `setTimerKey(prev => prev+1)` grace 내부에 포함 → Sub3 즉시 타임아웃 버그 동시 수정
- `noteStartTime.current`도 grace 내부에서 설정 → 반응속도 정확한 측정
- 4개 TDD 테스트 (NoteGame.countdown.test.tsx)

### 0.4 UI 음표 잘림·색깔·history 누적 🆕🐛 (사용자 검증 발견 + 설계 위반)

**사용자 검증** (2026-04-29 dev server):
- 오선지 음표가 잘림 (특정 위치에서 화면 밖으로 나가거나 일부만 보임)
- 음표 색깔이 제대로 반영 안 됨

**설계 §3.3.라 위반**: "현재 정답을 맞춰야 하는 음표는 빨간색, 정답을 맞춘 후 history로 남아있는 음표는 회색, 대기 중인 음표는 검은색으로 구분"

**§0.4.1 음표 history 누적 + 리셋 (batchSize별 동작)**

batchSize=1 stage (Sub 1 stage 1·2, Sub 2 stage 1):
- 답한 음표를 회색으로 누적 표시
- 7개 누적 시 화면 리셋 (다음 set는 새 시작)
- 사용자 진행감 = "history가 눈으로 보임"

batchSize=3+ stage (Sub 1 stage 3, Sub 2 stage 2·3, Sub 3 모든 stage):
- 한 batch (3·5·7개) 동시 표시
- 정답 시 회색, 미답 검정, 현재 빨강
- 한 batch 완료 시 다음 batch로 갈아타기 (자연 리셋)
- 사용자 진행감 = "한 묶음씩 풀이"

**§0.4.2 음표 크기 동적 조정** (설계 §3.2.다.※ 인용)

설계 인용: "음표가 5개 또는 7개가 배치되는 STAGE는 조표가 나오는 레벨의 경우 조표의 공간을 고려하여 음표의 크기를 조정해야 할지 고려해야함."

- batchSize=1: 표준 크기 (예: 음표 직경 30px)
- batchSize=3: 표준 크기
- batchSize=5: 약 80% 크기 (24px) — 조표·자리표 공간 고려
- batchSize=7: 약 70% 크기 (21px) — 조표·자리표 공간 고려

오선지 너비는 고정, 음표 크기로 조정.

**§0.4.3 음표 색깔 3단계** (설계 §3.3.라):
- 현재 정답 음표: **빨강**
- 정답 후 history: **회색**
- 대기 중 음표 (3·5·7개 동시 display 시): **검정**

**§0.4.4 잘림 방지 검증**:
- 5개·7개 표시 시 좌우 여백 + 음표 크기로 잘림 0건
- 모바일·데스크톱 둘 다 검증
- Lv5+ 조표 공간 추가 고려

**작업 시간 추정**: 1~2일 (Opus 영역 — 분석 + 코드 수정 + 검증)

---

## 0-1. 설계-코드 갭 정책 결정 ✅ 완료 (2026-04-29 사용자 결정)

다음 9개 항목 사용자 결정 완료. 코드 적용 작업은 별도 commit 진행.

### 0-1.1 단계 Clear 기준 ✅

| 항목 | 결정 |
|---|---|
| 정답률 | **85%** |
| 반응속도 | **sublevel 평균 타이머의 35% 이내** |
| 수행 횟수 | **sublevel 10회 완주 이상** |
| 최대 연속 정답 | **5회 이상 (한 번만 달성, sublevel 안에서)** |

4개 모두 만족해야 stage Clear.

**짚어드릴 점 — Lv 7-3 반응속도 1.05초**:
- Lv 7-3 = 3초 타이머 × 35% = 1.05초
- 일반 성인 + 학습 거치면 도달 가능
- 다만 첫 음표 부담 큼 → §0.3 (카운트다운 안정화) 함께 처리 필수

**코드 영향**:
- `src/lib/levelSystem.ts` `PASS_CRITERIA` 수정
- `record_sublevel_attempt` RPC 또는 클라이언트에 평균 반응속도 계산 + 통과 체크 추가
- `levelSystem.test.ts` 50개 갱신 가능성

### 0-1.2 Sublevel 3 stage 수 ✅

**3 stage 통일** (현재 코드 4 stage → 3 stage 변경)

### 0-1.3 미가입자 권한 ✅

**Lv 1만** (현재 코드 그대로 유지). 빠른 결제 전환 우선.

### 0-1.4 음표 배치 + Stage Set 반복 ✅ (2026-04-29 결정 → 2026-05-02 갱신)

**Lv 1~4 전용 (2026-05-02 갱신, commit 400dca2)**:
| Sublevel | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 |
|---|---|---|---|---|---|
| Sub 1 | 1×5 = 5 | 1×6 = 6 | 1×7 = 7 | 3×5 = 15 | — |
| Sub 2 | 1×5 = 5 | 1×6 = 6 | 1×7 = 7 | 3×3 = 9 | 5×3 = 15 |
| Sub 3 | 1×7 = 7 | 3×3 = 9 | 5×3 = 15 | 7×3 = 21 | — |

총 음표 수:
- Sub 1: 33개 (4 stages) — batchSize=1 준비 3단계 + batchSize=3
- Sub 2: 42개 (5 stages) — batchSize=1 준비 3단계 + batchSize=3·5
- Sub 3: 52개 (4 stages) — batchSize=1 준비 1단계 + batchSize=3·5·7

**Lv 5~7 전용 (2026-04-30, commit 818ae2f)**: batchSize=1 stage 없음 (조표 시스템 특성).
| Sublevel | Stage 1 | Stage 2 | Stage 3 |
|---|---|---|---|
| Sub 1 | 3×5 = 15 | 5×3 = 15 | 7×3 = 21 |
| Sub 2 | 3×5 = 15 | 5×3 = 15 | 7×3 = 21 |
| Sub 3 | 5×3 = 15 | 7×3 = 21 | 7×3 = 21 |

**코드 영향**:
- `src/lib/levelSystem.ts` `SUBLEVEL_CONFIGS` 수정 (notesPerSet, totalSets, batchSize 갱신)

### 0-1.5 재도전 배지 삭제 ✅⭐

설계 §3.3.자 명시: "무의미한 기능. 삭제 필요."

**코드 영향**:
- `src/components/NoteGame.tsx` `🔁 재출제` 배지 제거

### 0-1.6 같은 조표 연속 학습 ✅ (구현 결정)

설계 §3.3.바.B ※: "STAGE에서 틀린 음 2~3개 이상일 경우 N+2 로직 그대로 적용해 다음 STAGE도 동일 조표"

**구현 결정 근거 (사용자)**: "그 정도는 제공해야 돈을 내고 이용할만한 가치가 있다."

**구현 방향**:
- Lv5+ stage 종료 시 미답 retry 마커 카운트
- 2~3개 이상이면 다음 stage 같은 조표 유지
- 그 외에는 새 조표 (현재 동작)

**코드 영향**:
- `src/components/NoteGame.tsx` `handleStageComplete`
- 조건부 keySignature 유지 로직 추가

---

## 0-2. 인프라 이슈 🔴 (1~2주차)

Claude Code 코드 분석 발견.

### 0-2.1 스키마 표류 ⚠️🔴
다음 6개 테이블이 마이그레이션 외부에서 생성:
- `note_mastery`, `daily_batch_runs`, `subscriptions`, `user_streaks`, `admin_actions`, `user_sessions`

**해결**:
- 6개 테이블 SQL dump 추출
- `supabase/migrations/`에 마이그레이션 파일로 정리
- production 환경에 적용해서 정합 확인

### 0-2.2 Supabase 키 하드코딩 🔴⭐
**위치**: `vite.config.ts:17-18`
- URL + anon key가 코드에 박혀 `.env` 무시됨
- **해결**: vite.config.ts 하드코딩 제거 → `.env`만 사용 + ANON_KEY 회전

### 0-2.3 Edge Function 미완성 🔴
**위치**: `supabase/functions/payment-webhook/`, `supabase/functions/create-checkout-session/`
- 두 폴더 모두 `index.ts` 없음 (껍데기만)
- **결제 시스템 핵심 — 즉시 구현 필요**
- 멱등성 + 시그니처 검증

### 0-2.4 NoteGame 테스트 검증
- Claude Code 분석 시점 캐시 문제로 1개 실패 표시됐으나 현재 265/265 통과
- 다음 세션에서 npm test 다시 검증

---

## 1. 비즈니스 모델 · 권한 정책 🔴 (2~3주차)

### 1.1 회원 등급 차등화 🔴
- 미가입: 배치고사 1회 체험 + Lv 결정 (§0-1.3)
- 가입자: Lv 1~2 (또는 Lv 1) + 광고 + 간략 보고서
- Pro: 전 단계 + 상세 분석 + 광고 X + 스트릭 프리즈

### 1.2 구독료 ✅ 결정됨
- 월: $2.99
- 연: **$24.99 (약 30% 할인)** — 설계 §6
- Paddle Production 상품 등록 필요

### 1.3 결제 후킹 메시지 🔴
- 결제 전: "Pro 사용 시 좋은 점" 어필
- 결제 후: 활용 유도
- 취소 직전: cancel saver

### 1.4 챌린지 + 굿즈 패키지 🟢 (출시 후)
- ~$50 (챌린지 + 구독)
- Maestro 한정판 굿즈
- 구글드라이브 문서 확인 필요

---

## 2. 배치고사 + 랭크 시스템 🟢⭐ (출시 후 1~2개월)

큰 시스템이라 5/31 마감 안에 못 들어감. **출시 직후 첫 메이저 업데이트로 추가**.

### 2.1 신병 배치고사
가입 직후 60초 극한 테스트 → 초기 티어 배정

### 2.2 정규 배치고사 (Audition)
**자격**: 3~5일 streak + 음표 500개 + 정확도 90% (Pro는 완화)
**산식**: `Score = (정답률 × 0.4) + (반응속도 × 0.6)`

### 2.3 티어 시스템
| 티어 | 세부 | 컨셉 |
|---|---|---|
| Apprentice | 3·2·1 | 나무 업라이트 |
| Performer | 3·2·1 | 블랙 유광 + 은빛 |
| Virtuoso | 3·2·1 | 골드 그랜드 |
| Maestro | 단일 (1%) | 크리스탈/오로라 |

### 2.4 랭크 감쇠
- 주 3회 미만 → 포인트 하락
- 매월 유지 테스트
- Pro: 강등 보호 + 스트릭 프리즈

### 2.5 진행도 가시화
"배치고사 자격까지 X%" 표시

### 2.6 레벨 ↔ 티어 매핑 결정
21단계 (콘텐츠) ≠ 티어 (실력) 분리 권장

### 2.7 DB 스키마 추가
```sql
ALTER TABLE profiles ADD COLUMN current_tier text;
ALTER TABLE profiles ADD COLUMN tier_division integer;
ALTER TABLE profiles ADD COLUMN tier_points integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN last_test_date timestamp;
ALTER TABLE profiles ADD COLUMN streak_count integer DEFAULT 0;

CREATE TABLE tier_history (...)
```

### 2.8 미결정 사항
- 상위 그룹 혜택?
- 하위 그룹 강등?
- 티어 = 배치고사로만?
- 최종 티어 보상?

---

## 3. 광고 시스템 🟢 + ⏳ 심사 (병렬 진행)
**24항목 #3 + 애드센스 기획서 + 광고 UI 기획서**

### 3.1 ⏳ AdSense 심사 (병렬 — 즉시 시작)
- **사용자가 블로그 글 틈틈이 작성** (출시 전부터)
- 5월 중 15~20개 도달 → 심사 신청
- 심사 통과 후 광고 코드 활성화 (머니 스위치)

### 3.2 머니 스위치 구현 ✅ (2026-05-03)
- `VITE_ADS_ENABLED=false` → AdBanner null 반환, DOM 완전 제거
- `VITE_ADS_ENABLED=true` → AdSense script 동적 로드 + ins 태그 렌더링
- Premium 사용자 자동 차단 (`getUserTier === "pro"` → null 반환)

### 3.3 광고 배치 코드 ✅ (2026-05-03 — 사용자 결정 반영)
- **배너**: Blog 하단 + BlogPost 데스크톱 좌/우 사이드바 + 모바일 하단 + Home 하단 + Index 랜딩 하단
- **In-feed**: Home 대시보드 (통계 카드 ↔ 탭 사이)
- **전면 (AdInterstitialModal)**: 3게임마다 + 잠금 해제 시점, 중복 시 1번만
- **보상형**: 출시 후 PENDING

### 3.4 광고 SDK 성능 격리 ✅
동적 스크립트 로드 (document.head.appendChild) — 게임 루프와 격리

### 3.5 Header 통합 + Premium 배지 ✅ (2026-05-03~04)
- `PremiumBadge` 컴포넌트 추출 (amber gradient + Sparkles, useAuth 자체 조회)
- `Header` 컴포넌트: 좌측 `🎼 Noteflex` 로고 링크 + PremiumBadge 자동 표시
  - props: `right`, `below`, `title`, `subtitle`, `headerClassName`, `containerClassName`
- **모든 비게임 페이지 Header 통합** (2026-05-04 완료):
  - Blog, BlogPost, Home, Index(landing+levelSelect), LegalPage(4종)
  - Pricing, ProfilePage, CheckoutFailed, CheckoutSuccess, NotFound
  - AdminLayout: `containerClassName="max-w-6xl"`, right 슬롯에 "관리자 콘솔" + ADMIN 배지
- 게임 화면: Header X (AuthBar 유지, 스펙 그대로)
- Premium 사용자만 배지 노출 (`getUserTier === "pro"`), 무료/게스트 자연스러운 UI

### 3.6 출시 직전 적용 (⚠️ 미적용)
```
VITE_ADS_ENABLED=false → true
VITE_ADSENSE_PUBLISHER_ID=ca-pub-XXXX (AdSense 승인 후 발급)
VITE_ADSENSE_SLOT_BANNER=실제ID
VITE_ADSENSE_SLOT_SIDEBAR_LEFT=실제ID
VITE_ADSENSE_SLOT_SIDEBAR_RIGHT=실제ID
VITE_ADSENSE_SLOT_INFEED=실제ID
VITE_ADSENSE_SLOT_INTERSTITIAL=실제ID
```

### 3.5 약점 음표 표시 (Fail 시) 🔴
**설계 §5.나**: Fail 시 약점 음표 + 광고 시청으로 잠금 해제
- 출시 전: 약점 음표 표시까지
- 출시 후: 광고 시청 잠금 추가

---

## 4. 게임플레이 추가 기능

### 4.1 코드 연습 모드 🟡⭐ (분기별, Phase 7+)
악보 → 코드 계이름 답하는 방식

### 4.2 사용자화 레벨 (저작권 free) 🟢 (출시 후 1~2개월)
Public domain 클래식 곡별 레벨

### 4.3 스캔 기능 (OCR/OMR) 🟡 (분기별)
난이도 높음 — Pro 차별화

### 4.4 힌트 시스템 결정 🔴 (1주차)
- A: 50% 시간 경과 시 시각 힌트 (점수 감점)
- B: 그냥 실패
- 결정 필요

### 4.5 정답 버튼 세계화 🔴⭐ (1~2주차)
한국어/영어/Solfege 토글
- 일부 구현됨 (`useSolfegeSystem.ts`) — 검증 + UI 추가

### 4.6 모든 단계 Clear 후 Special 게임 🟢 (출시 후)
설계 §3.2.사.B-2 — 어떤 식으로 제공할지 결정 후

---

## 5. 사용자 경험 · 리텐션

### 5.1 기록 비교 피드백 🟢⭐ (출시 후)
"어제보다 G5 0.3초 빨라졌어요" — 이탈 방지

### 5.2 회원관리 페이지 🔴 (3주차)
- 비밀번호 변경, 이메일 변경, 탈퇴
- 학습 이력 다운로드 — 출시 후

### 5.3 닉네임 중복 체크 검증 🔴 (1주차)
- 이메일 중복 ✅ 확인됨
- 닉네임 중복은 가입 시점에 적용되는지 확인

### 5.4 가입자 대시보드 부분 잠금 🔴 (3주차)
**설계 §5.나**: 간략 보고서 외 잠금
- 잠금 UI + 결제 유도

---

## 6. UI/UX 정비 🔴⭐ (3~4주차)

### 6.1 알려진 UI 버그
- 오선지 점프 버그
- DiagnosisTab 통일 + slice(-7) 하드코딩 제거
- 모바일 반응형 정비
- 재도전 배지 삭제 (§0-1.5)
- 게임 화면 단순화 (설계 §3.3.자)

### 6.4 §3 GrandStaffPractice UI 세부 조정 (출시 전 UI 작업 시점) 🟡

2026-05-02 사용자 결정으로 핵심 fix만 적용 (batchSize=3 균등 분포 + batchSize=7 잘림 X 보장). 세부 시각 조정은 출시 전 UI 작업 시점에 일괄 처리.

**작업 항목**:
- **/admin/staff-preview 어드민 페이지 신규**: 모든 Lv·Sub·stage·batchSize·keySig 조합을 한 화면에 격자 비교
- 음표 시각 크기·spacing·자리표 영역·키사인 영역 세부 비례 조정
- 모든 케이스 검증: batchSize 1~7 × keySig 0~7 × Lv 1~7
- 모바일·다크모드·어드민 가드 적용
- 도구: Sonnet, 작업 시간 1~2시간

**현 상태 (2026-05-02 기준)**:
- max-w 612 (NoteGame 게임 영역, commit 6bcd719)
- batchSize=3 균등 분포 적용 (gap = batchSize+1 = 4, 첫 음표 spacing 안쪽으로)
- batchSize=5·7 변경 X (현재 잘림 X 가정)
- 음표 viewBox 좌표·크기 그대로 (1.25배 비례 조정 X — 시각 변동 없으므로 의미 X로 분석)

### 6.2 디자인 컨셉 통일 🟢 (출시 후 점진)
- "Midnight Grand" — 다크 + 골드
- 티어별 디자인 차별화 (§2와 함께 출시 후)

### 6.3 티어 카드 SNS 공유 🟢 (출시 후, §2와 함께)

---

## 7. 성능 · 정밀도 ⭐⭐⭐
**Green Billion v1.0 + 24항목 + 설계 §3.3.자**

> 5월 31일까지: §7.1 (performance.now) + §7.10 (sync 검증)만 출시 전
> 나머지 (§7.2~§7.5)는 출시 직후 1개월 내 추가

### 7.1 고해상도 타임스탬프 ✅ 완료 (2026-05-03)
**Green Billion §2.1**

- `Date.now()` → `performance.now()` 전면 전환 (**정밀도 영향 사이트만**)
- 작업 분량: **2~3시간** (Sonnet 1세션, 사용량 ~15%) → **실제 1세션 내 완료**
- 어제 백로그 명시 위치(`useNoteLogger.ts`, `useSessionRecorder.ts`)는 grep 0건 — 코드 변경됨, 아래 실측이 정정 사양
- **완료 결과** (2026-05-03): NoteGame 12 + CountdownTimer 3 = 15 사이트 perf.now() 전환. DiagnosisTab·PremiumDialog 2 사이트 Date.now() 유지 (절대 시간). vitest 373/373 PASS, sim:test 9 invariants 위반 0건 (9984 게임 / 790,301 이벤트).

**실측 17 사이트** (grep 2026-05-03):

| 파일 | 사이트 | 라인 | 정밀도 영향 | 전환 |
|---|---|---|---|---|
| `src/components/NoteGame.tsx` | 12 | 348·737·813·821·847·888·913·928·942·1077·1144·1187 | 핵심 (reactionMs 측정) | ✅ perf.now() |
| `src/components/CountdownTimer.tsx` | 3 | 12·17·25 | 카운트다운 타이밍 | ✅ perf.now() |
| `src/components/home/DiagnosisTab.tsx` | 1 | 53 | 절대 시간 (`now - created` 기간 필터, log.created_at은 DB ISO timestamp) | ❌ Date.now() 유지 |
| `src/components/admin/PremiumDialog.tsx` | 1 | 113 | 절대 시간 (`untilDate.getTime() > Date.now()` 구독 만료일 비교) | ❌ Date.now() 유지 |

**결정**:
- 전환 대상: NoteGame 12 + CountdownTimer 3 = **15 사이트**
- 절대 시간이라 유지: DiagnosisTab 1 + PremiumDialog 1 = **2 사이트**
- `NoteGame.tsx:942` `id: Date.now()`: React key 용도. perf.now()도 단조 증가 + 소수점 부동점 → 호환 OK, 전환 ✅

**검증** (2주차 작업 완료 시):
- `grep -rn "Date.now()" src/` → 결과 **2건만 남음** (DiagnosisTab·PremiumDialog 절대 시간 사이트)
- 게임 reactionMs 회귀 테스트 (수동 + 시뮬레이터)
- 카운트다운 정상 작동 확인

### 7.2 Web Workers 분리 🟢 (출시 후 1~2주)
**Green Billion §2.2**
- 신규 파일: `src/workers/timingWorker.ts`
- 분리 대상: 정답 판정, 반응속도 계산, retry queue due
- 난이도 높음 — 출시 후

### 7.3 Calibration 🔴⭐ (Week 1 — 사용자 명시 결정 2026-04-29)

**사용자 결정 (타협 불가)**:
> "블루투스 레이턴시 보정 없이는 우리 서비스 정체성이 무너진다. UI는 최소화하더라도 보정값 계산 로직은 이번 주 안에 구현. 블루투스 이어폰 사용 시 무조건 박살난다."

**Green Billion §2.3 그대로**:
- 서비스 진입 시 사용자 환경 레이턴시 측정 (강제)
- `User_Environment_Offset` 으로 보정값 관리
- 모든 reactionMs 계산에 `(actualMs - userEnvOffset)` 적용

**최소 구현 범위 (Week 1)**:
1. Calibration 루틴
   - 시각 신호 + 사운드 동시 제시 → 사용자 탭 → 입력 지연 측정
   - 3~5회 반복 측정 → 평균값 계산
2. Offset 저장
   - localStorage `noteflex.userEnvOffset`
   - 동기화 (선택): profiles 테이블 컬럼 추가
3. 첫 게임 진입 시 1회 강제 실행
   - skip 불가 또는 한 번만 skip 허용
4. 모든 reactionMs 계산에 적용
   - useNoteLogger, useSessionRecorder, NoteGame 등
5. UI 최소화
   - 1분 안내 모달 + 진행률 + 결과 표시
   - 디자인 정교화는 출시 후

**출시 후 추가 (Phase 7)**:
- §7.5 Effective Precision SLA (정밀도 등급 표시 + 약관 §3 면책)
- 캘리브레이션 재측정 옵션 (디바이스 변경 감지)
- Pro 사용자 대상 정밀도 통계

**작업 시간 추정**: 1~2일 (UI 최소화 시)

**코드 영향**:
- 신규 파일: `src/components/CalibrationModal.tsx`
- 신규 파일: `src/lib/userEnvironmentOffset.ts`
- `src/components/NoteGame.tsx` 또는 `App.tsx` 첫 진입 시 calibration 체크
- `src/hooks/useNoteLogger.ts`, `src/hooks/useSessionRecorder.ts` reactionMs 계산에 offset 적용

---

#### 7.3-A 작업 분할 (4 sub-step) — Opus 분석 2026-05-02

| 단계 | 범위 | 시간 | 사용량 | 모델 | 의존성 |
|---|---|---|---|---|---|
| §7.3.1 | 명세 박기 + 사용자 결정 (11 Q 결정 시트) + 데이터 모델·skip·재측정·DB 컬럼 확정 | 1~2시간 | 25~30% | Sonnet | — |
| §7.3.2 | ~~코어 lib + 영속화 (`userEnvironmentOffset.ts`, profile sync, 마이그레이션 SQL, 단위 테스트)~~ ✅ 완료 (2026-05-03) | — | — | — | §7.3.1 ✅ |
| §7.3.3 | ~~Calibration UI + 측정 (`CalibrationModal.tsx`, 자극 송출, outlier reject·평균, 결과 표시·저장, 첫 진입 가드) **+ §7.10.2 sync 측정 통합** (CalibrationModal 2단계: 1단계 sync 3회 평균 / 2단계 env offset 5회 절사 평균, Q-C 결정)~~ ✅ 완료 (2026-05-03) | — | — | — | §7.3.2, §7.10.1 ✅ |
| §7.3.4 | ~~reactionMs 보정 적용 (boundary 1지점 전략 — `useSessionRecorder.recordNote` 진입 시 offset 차감, NoteGame 3사이트 손대지 X, clamp 0, speed threshold 의미 재정의, 회귀 테스트)~~ ✅ 완료 (2026-05-03) | — | — | — | §7.3.2 ✅ |

**총합**: ~13~18시간 (≈2일). 단계별 독립 commit, 각 단계 Sonnet 1세션 충분.

**시뮬레이터 (Step B) 통합 제외**: 현재 시뮬레이터(`src/lib/simulator/game.ts`)는 reactionMs 모델링 X (dedup invariants 전용). 통합 가치 < 비용.

#### 7.3-B 사용자 결정 시트 (11 Q — 2026-05-03 결정 완료)

> 사용자 결정 (2026-05-03): CTO 권장 그대로 일괄 OK. §7.3.1 작업 시 아래 결정값 그대로 명세에 박을 것.

| # | 결정 항목 | 옵션 | **결정 (2026-05-03)** |
|---|---|---|---|
| Q-A | **자극 모드** | (a) 시각+사운드 동시 (스펙) / (b) 사운드만 / (c) 양쪽 분리 측정 | **(a) 시각+사운드 동시** — 게임 환경과 자극 형식 일치 |
| Q-B | **offset 의미** ⚠️ | (a) 출력 장치 레이턴시만 / (b) 출력 + 사용자 신경근 반응 baseline 합산 — (b)면 reactionMs 0 근처 수렴, 의미 재해석 필요 | **(a) 출력 장치 레이턴시만** — 기존 통계·XP·진단 의미 유지, Bluetooth/스피커 차이만 보정 |
| Q-C | **측정 횟수 + 이상치** | 3·5·7회, 단순 평균 / median / 최악 1개 제거 후 평균 | **5회 + 절사 평균** (최고/최저 1개씩 제거 후 평균) |
| Q-D | **저장 위치** | (a) localStorage만 / (b) profiles 테이블 컬럼 추가 (마이그레이션 1개) | **(b) profiles 테이블 컬럼** — `user_env_offset_ms INT` 마이그레이션 1개 + 다중 디바이스 동기화 |
| Q-E | **첫 진입 정책** | (a) skip 불가 / (b) 1회 skip 허용 (이후 강제) / (c) 무제한 skip (배지로만 표시) | **(b) 1회 skip 허용 (이후 강제)** — 신규 가입 친화도 + 정확도 균형 |
| Q-F | **재측정 트리거** | (a) 수동만 / (b) UA 변경 감지 / (c) audioContext output device 변경 감지 | **(c) device 변경 감지 + (a) 수동** (둘 다) — 이어폰↔스피커 자동 + 사용자 설정 메뉴 |
| Q-G | **§7.1과의 순서** | (a) §7.1 (Date→perf) 먼저 → §7.3 / (b) §7.3 먼저 → §7.1 통합 — **(a) 권장** (정밀도 일관성) | **(a) §7.1 먼저** — 옵션 B 흐름과 일치, perf.now() 기반 후 calibration |
| Q-H | **속도 보너스 thresholds** (`useSessionRecorder.ts:56~62`) | offset 적용 후 기준 변경 / 그대로 유지 / 별도 레벨별 재튜닝 | **1차 그대로 유지** + 출시 후 데이터 기반 재튜닝 (출시 전 회귀 위험 회피) |
| Q-I | **기존 세션 데이터** | (a) 그대로 raw 유지 (호환) / (b) offset 컬럼 별도 보관 / (c) 일괄 변환 (지양) | **(b) offset 컬럼 별도 보관** — raw + offset 동시 보관, 호환 + 추적 가능 |
| Q-J | **avg_reaction_ms 표기** | Home/Admin 표시: raw 값 / offset 적용값 / 둘 다 | **정정 (2026-05-03)** — Home: 보정값만 (raw 토글 영구 제거, 메모리 #19 사용자 행위 전가 X) / Admin: 보정값 + raw + offset 동시 노출 (관리자 디버깅 전용, ✅ §7.3.5 완료) / 진단·랭킹·XP: 보정값 |
| Q-K | **음수 reactionMs** | clamp 0 / 통계에서 제외 / "예외 제스처"로 별도 카운트 | **clamp 0** — 음수는 자극 도래 전 응답(예측·우연), 0으로 단순 처리 |

**§7.3.1 진입 시 적용 사항** (위 결정 그대로 명세에 반영):
- DB 마이그레이션 1개 (Q-D): `profiles.user_env_offset_ms INT` (default null)
- 측정 절차 (Q-A·Q-C): 시각+사운드 동시 자극 5회, 절사 평균(최고·최저 제외 3회 평균)
- offset 의미 (Q-B): 출력 장치 레이턴시만 — 음수 사용자 응답은 clamp 0 (Q-K)
- skip 정책 (Q-E): 첫 진입 시 1회 skip 허용 플래그 (`profiles.calibration_skipped_once BOOLEAN` 또는 localStorage)
- 재측정 (Q-F): ✅ `devicechange` 이벤트 리스너 → 자동 재측정 (메모리 #19). `device_change_events` 테이블 로깅 (A2). PENDING: 출시 후 false positive 빈도 분석 → audio output 전용 감지 보강 결정
- 데이터 정책 (Q-I): 기존 세션 raw 유지, 신규 세션부터 offset 컬럼 추가 보관
- 표시 정책 (Q-J): Home 보정값만 (raw 토글 영구 제거), Admin 보정+raw+offset 동시 (§7.3.5 ✅ 완료)
- thresholds (Q-H): `useSessionRecorder.ts:56~62` 1차 그대로 유지 — 출시 후 1~2주 데이터 누적 후 재튜닝

#### 7.3-C 결합 영역 (Opus 분석 2026-05-02, 갱신 2026-05-03)

- **§7.10 (음표-사운드 sync 검증)**: ~~sync 측정 없이 calibration 만들면 측정값 신뢰도 X. 순서: §7.10 → §7.3 또는 동시 진행.~~ → **Q-C 결정 (2026-05-03)으로 확정: §7.10.2 측정 로직을 §7.3.3 CalibrationModal 안 통합**. CalibrationModal 2단계 (1단계 sync / 2단계 env offset). 별도 §7.10 세션 불필요. §7.3.3 진입 시 §7.10.2 포함해서 작업.
- **§7.1 (Date.now → performance.now)**: ✅ 2026-05-03 완료 (15 사이트). §7.3 calibration 측정 코드 전환 부담 없음.
- **§0.4 (GrandStaffPractice)**: 직교 영역 — 충돌 없음.

#### 7.3-D 코드 영향 범위 (실측, Opus 2026-05-02)

- 신규: `src/lib/userEnvironmentOffset.ts`, `src/components/CalibrationModal.tsx`
- 변경 후보 (boundary 1지점 전략 채택 시 useSessionRecorder만 변경 → NoteGame 3사이트 손대지 X):
  - `src/hooks/useSessionRecorder.ts:32, 250, 278, 304` (recordNote 진입 시 offset 차감)
  - `src/hooks/useNoteLogger.ts:23` (response_time 초 단위)
  - `src/hooks/useSessionRecorder.ts:56~62, 98~102` (속도 보너스 thresholds — Q-H 결정 따라)
  - 노출 통계 (Home/Admin/BatchAnalysis): Q-J 결정 따라
- DB: `supabase/migrations/` 신규 (Q-D = (b) 시) — `profiles.user_env_offset_ms INT`

#### 7.3-E 위험 요소 (Opus 2026-05-02)

- **`noteStartTime` 정밀도 한계**: `NoteGame.tsx:928`은 응답 시각 - 직전 setter 시각 기준. 실제 visual paint·audio playback과 미세 어긋남 존재 — 보정 정밀도 한계.
- **Q-B 영향이 큼**: offset에 신경근 반응(150~250ms) 포함 시 raw reactionMs ≈ 200ms → 보정 후 ≈ 0. 기존 분석/표시/XP 보너스 의미 전부 재정의 필요.
- **§7.10 audio sync 결합**: 위 §7.3-C 참조.

### 7.4 Fixed-point Arithmetic 🟢 (출시 후 1~2주)
**Green Billion §2.4**
- 신규 유틸: `src/lib/preciseTime.ts`
- 정수 단위 시간 연산

### 7.5 Effective Precision SLA 🟢 (출시 후 1개월)
**Green Billion §2.5**
- 정밀도 등급 표시
- 이용약관 §3 면책 조항 (변호사 자문)

### 7.6 렌더링 최적화 🟢 (출시 후)
- requestAnimationFrame
- React 메모이제이션
- DOM → Canvas (필요시)

### 7.7 네트워크 + 에셋 🟢 (출시 후)
- Edge Functions, PWA, WebP/AVIF, Woff2

### 7.8 스트레스 테스트 🟢 (출시 후, DAU 기준 도달 시)

### 7.9 피아노 사운드 조정 🔴 (2~3주차)
- §0.3과 연관
- Web Audio API의 sample-accurate 스케줄링

### 7.10 음표-사운드 Sync 검증 🔴 (2주차)
**설계 §3.3.마**

- 현재 sync 측정 → **±10ms 시작 → 실측 후 재조정** (Q-D 결정 2026-05-03: Safari rAF 정밀도 한계 + 인간 perception threshold ≈ 15~30ms)

#### 7.10-A 작업 분할 (3 sub-step) — Opus 분석 2026-05-03

| 단계 | 범위 | 시간 | 사용량 | 모델 | 의존성 |
|---|---|---|---|---|---|
| §7.10.1 | ~~명세 박기 + 사용자 결정 (Q-시트 6 Q, 측정 방식·도구·시점·기준 확정)~~ ✅ 완료 (2026-05-03) | — | — | — | — |
| §7.10.2 | ~~측정 로직 구현 — rAF+perf.now() vs AudioContext.currentTime, PerformanceObserver + AudioContext. **§7.3.3 CalibrationModal 안 통합** (Q-C 결정: calibration 모달 2단계 — 1단계 sync 측정 / 2단계 env offset 측정). 브라우저·디바이스 매트릭스 실측~~ ✅ 완료 (2026-05-03, §7.3.3 통합) | — | — | — | §7.10.1 ✅, §7.1 ✅ |
| §7.10.3 | 보정 적용 — **±10ms 초과 시 audio 송출 시점 조정만** (Q-D·Q-E 결정). **Q-F: sync gap > ±20ms → calibration 해당 회차 outlier 제외**. 회귀 테스트. §7.3.4와 결합 가능 | 2~4시간 | 20~25% | Sonnet | §7.10.2 |

**총합**: ~5~9시간 (§7.10.1 완료 제외). 단계별 독립 commit. **§7.10.2는 §7.3.3 작업 세션에 통합 진행** (별도 세션 불필요).

#### 7.10-B 사용자 결정 시트 (6 Q — §7.10.1 결정 완료 2026-05-03)

> 사용자 결정 (2026-05-03): CTO 권장 그대로 일괄 OK. §7.10.2~§7.10.3 작업 시 아래 결정값 그대로 구현에 박을 것.

| # | 결정 항목 | 옵션 | **결정 (2026-05-03)** |
|---|---|---|---|
| Q-A | **측정 방식** | (a) visual paint timestamp(`requestAnimationFrame` 후 `perf.now()`) vs audio start timestamp(`AudioContext.currentTime`) 비교 / (b) Performance API `paint` entry 활용 / (c) 외부 카메라+마이크 측정 (정밀도 ↑↑) | **(a) rAF+perf.now() vs AudioContext.currentTime** — §7.1 완료로 perf.now() 이미 도입, 추가 API 0, AudioContext.currentTime이 가장 정밀한 audio 시계 (Chrome ≈ 0.02ms) |
| Q-B | **측정 도구** | (a) 브라우저 내장 (PerformanceObserver + AudioContext) / (b) Audio Worklet 정밀 측정 / (c) 외부 도구 (예: 화면+오디오 동시 녹음 후 분석) | **(a) PerformanceObserver + AudioContext** — 기존 AudioContext 재사용, 최소 추가 코드. Audio Worklet은 §7.9와 출시 후 통합 |
| Q-C | **측정 시점** | (a) `handleCountdownComplete` (게임 시작 시 1회) / (b) 음표 송출 매 시점 (지속 측정) / (c) 자동 calibration 모달 안 별도 측정 | **(c) calibration 모달 안 별도 단계** — §7.3 CalibrationModal 2단계 통합 (1단계 sync 3회 평균 / 2단계 env offset 5회 절사 평균), 사용자 마찰 최소화 |
| Q-D | **±5ms 기준** | (a) 그대로 / (b) 더 엄격(±3ms) / (c) 더 느슨(±10ms) — 브라우저별·디바이스별 정밀도 한계 고려 | **(c) ±10ms 시작 → 실측 후 재조정** — Safari rAF 정밀도 한계 (cross-origin isolation 없으면 최대 20ms 오차), 인간 perception threshold ≈ 15~30ms |
| Q-E | **보정 방식** | (a) audio 송출 시점 조정만 / (b) 시각 paint 조정만 / (c) 둘 다 (방향 따라) | **(a) audio 송출 시점 조정만** — 시각 조정은 reactionMs 측정 기준점 왜곡 위험. AudioContext 스케줄링 파라미터 1개만 변경, 코드 영향 최소 |
| Q-F | **§7.3 결합** | (a) §7.10 sync 측정값 → calibration baseline 영향 0 (독립) / (b) sync offset도 calibration offset에 포함 (합산) / (c) sync는 calibration 측정 outlier 검출 기준 | **(c) sync = calibration outlier 검출 기준** — sync gap > ±20ms 회차는 calibration 측정에서 제외. §7.3 Q-C 절사 평균과 자연 통합, 역할 분리 명확 |

**§7.10.2 진입 시 적용 사항** (위 결정 그대로 구현에 반영):
- 측정 공식 (Q-A): `syncGap = audioContext.currentTime × 1000 - rafTimestamp` (ms)
- 도구 (Q-B): PerformanceObserver + AudioContext — sound.ts `ensureAudioReady` 활용
- 측정 위치 (Q-C): CalibrationModal 1단계, 3회 측정 → 평균
- 기준 (Q-D): ±10ms pass/fail, §7.10.2 실측 후 재조정
- 보정 (Q-E): `playNote` 호출 시 `AudioContext.currentTime + syncOffset` 적용
- §7.3 결합 (Q-F): `syncGap > ±20ms` → 해당 calibration 회차 outlier 마킹 후 제외

#### 7.10-C 코드 영향 범위 (Opus 2026-05-03)

- `src/lib/sound.ts` — 5/1 §1 fix 적용 영역 (`ensureAudioReady`), audio context resume 시점이 sync 측정의 출발점
- `src/components/NoteGame.tsx` — `handleCountdownComplete` 등 시각·사운드 동시 송출 시점 (Q-C 결정 후 정밀 위치 박을 것)
- 5/2 swipe 모달 fix 영역 (메모리 #18 동기화 정책) — 영향 범위 추가 검증 필요
- 신규 후보: `src/lib/audioVisualSync.ts` (측정 + 보정 로직)

#### 7.10-D 위험 요소 (Opus 2026-05-03)

- **브라우저별 audio·visual 정밀도 차이**: Chromium·WebKit·Firefox 각각 `requestAnimationFrame`·`AudioContext.currentTime` 정밀도 다름. 단일 기준 ±5ms 충족 어려울 수 있음 (Q-D 재검토 후보).
- **사용자 환경 차이**: 블루투스 헤드폰(100~300ms 출력 지연)·외장 스피커·내장 스피커별 측정값 변동 큼. **§7.3 calibration이 환경 offset 흡수 가정** (Q-F 결정 따라).
- **§7.3 calibration과 결합 (이중 보정 위험)**: sync offset과 user environment offset의 의미 분리 불명확 시 calibration 결과 오염. Q-F 결정으로 사전 차단.
- **§7.1 perf.now() 정밀도 의존**: §7.1 적용 후 §7.10 측정해야 정밀. 옵션 B 진행 시 §7.1 같은 세션 내 끝낸 후 §7.10.2 진입.

### 7.11 검증 체크리스트 (출시 전 + 출시 후)
- [x] §7.1: Date.now() 2건만 남음 (DiagnosisTab·PremiumDialog 절대 시간 사이트, 2026-05-03 완료)
- [ ] §7.10: Sync ±10ms (5/31 이전, Q-D 결정 반영 — 실측 후 재조정)
- [ ] §7.2: Web Worker 작동 (출시 후)
- [ ] §7.3: Calibration 작동 (출시 후)
- [ ] §7.4: 부동소수점 0건 (출시 후)
- [ ] §7.5: Precision 배지 + 약관 (출시 후)

---

## 8. 관리자 페이지 보강 🟢 (출시 후)

기존 + 추가:
- 매출 대시보드, 사용자 행동 퍼널, A/B 테스트
- 광고 실적 (AdSense 승인 후)
- 콘텐츠 관리, 배치고사 모니터링

### 8.1 §7.3 통합 분석 대시보드 🟢 (출시 후 — Phase 7-A)

Calibration 사용 패턴 + 환경 분석을 위한 관리자 전용 뷰.

**데이터 소스**:
- `calibration_results` 테이블 (별도 마이그레이션 필요 — 현재 미존재)
- `device_change_events` 테이블 (✅ 마이그레이션 완료 2026-05-03)
- `profiles.user_env_offset_ms` (✅)

**화면 구성**:
- offset 분포 히스토그램 (0~200ms 구간별 사용자 수)
- device 변경 이벤트 목록 + 재측정 전후 offset 비교
- 환경별 분석 (user_agent 기반 브라우저·OS 분포)
- false positive 분석 (audio output-only 변경 vs 실제 I/O 변경 비율)

---

## 9. 도메인 + 사업자 🔴⭐ + ⏳ 심사 (1주차 시작)

### 9.1 도메인 이메일 🔴 (1주차)
- `support@noteflex.app`, `tax@noteflex.app`, `admin@noteflex.app`
- Google Workspace 또는 Cloudflare Email Routing

### 9.2 ⏳ 한국 사업자 등록 (즉시 시작)
- **Leo Republic 활용**
- Paddle Vendor 신청 핵심 의존성
- 사용자 직접 작업

### 9.3 ⏳ Paddle Vendor 심사 (병렬)
- **이용약관 4종 등록 → 심사 신청 가능**
- 사업자등록 + 약관 완성 후 즉시 신청
- 심사 기간 중 코드 진행

---

## 10. 콘텐츠 + 마케팅

### 10.1 약관 4종 본문 🔴 (1~2주차, 사용자 결정 2026-04-30)
- 서비스 이용약관, 개인정보처리방침, 환불정책, 쿠키 정책
- **변호사 자문 X** — 분쟁 발생 시 추가 검토
- **Termly 또는 iubenda 자동 생성 서비스** ($10~30/월) — GDPR·CCPA·PIPA 자동 준수
- Claude로 영어→한국어 번역, 사용자 검수 후 게시
- **사업자등록 직후 즉시 게시**
- **Paddle Vendor 심사 + AdSense 심사의 핵심 의존성**

### 10.2 ⏳ 블로그 글 작성 (사용자 직접, 출시 전부터 지속)
- AdSense 심사용 15~20개 목표
- 옵션 A 마크다운 — Claude가 .md 작성, 사용자 push
- 사용자가 틈틈이 작성

### 10.3 SNS 핸들 선점 🔴 (1주차)
- 인스타, 트위터, Threads, TikTok @noteflex.app

### 10.4 옵션 B 블로그 시스템 🟢 (출시 후)
- /admin/blog + DB 게시판

---

## 11. 출시 임박 환경변수 체크리스트 🔴 (5/30~31)

```
[ ] VITE_PADDLE_ENVIRONMENT: sandbox → production
[ ] VITE_PADDLE_CLIENT_TOKEN: test_ → live_
[ ] VITE_PADDLE_PRICE_MONTHLY: Production 상품 ID ($2.99)
[ ] VITE_PADDLE_PRICE_YEARLY: Production 상품 ID ($24.99)
[ ] VITE_SUPABASE_ANON_KEY 회전 + vite.config.ts 하드코딩 제거
[ ] VITE_GAME_ENABLED: false → true
```

Claude가 출시 임박 시 자동 고지.

---

## 12. 인프라 · 운영

### 12.1 Sentry 도입 🔴 (4주차)
프로덕션 에러 모니터링 — 출시 직전 도입

### 12.2 E2E 테스트 (Playwright) 🟢 (출시 후)
가입 → 게임 → 결제 핵심 플로우

### 12.3 payment-webhook 검증 🔴 (§0-2.3 참조)

### 12.4 mastery DB 부하 모니터링 🟢 (출시 후 DAU 도달 시)

### 12.5 Lv7-3 3초 제한 검토 🔴 (1주차, §0.3 연동)

### 12.6 GitHub Actions CI/CD 🟢 (출시 후 1~2주)
- PR 시 npm test + tsc 자동

### 12.7 스키마 마이그레이션 정리 🔴 (§0-2.1)

### 12.8 Supabase 키 하드코딩 제거 🔴 (§0-2.2)

### 12.9 PENDING_BACKLOG 자동 갱신 ✅ (이미 시스템 구축됨)
- §자동 갱신 시스템 참조

---

## 13. 결정 보류 항목

### 13.1 글로벌 다국어 출시 전략 (사용자 결정 2026-04-30)

- **5/31 출시**: 한국어 + 영어 2개 언어 동시 출시
- **출시 후 1~4주**: 일본어 추가 (1~2주), 중국어 추가 (2~4주) 점진 확장
- **블로그**: 5/1부터 한+영 동시 작성 (4/30 글은 5/1에 영어 버전 추가)
- **게임 UI i18n**: Week 3 도입 (react-i18next, Sonnet 1~2일)
- **음표 라벨 토글**: Week 2 (한국식·영문식·솔페주, 1~2시간)
- **URL 구조**: `/ko/*`, `/en/*` 언어 코드 포함
- **블로그 폴더**: `src/content/blog/ko/`, `src/content/blog/en/`
- **카테고리 영문 매핑**: 초견의 정석 = Sight-Reading Lab, 실전 연습 가이드 = Practice Hub, 음악 이론 & 화성학 = Theory & Harmony, 뮤직 테크 & 미래 = Music Tech
- **Paddle 글로벌 결제** 자동 활성화
- 상세 전략: `docs/i18n/STRATEGY.md`

### 13.2 라우팅 보호 + Navigation 정리 + PWA 등록 (사용자 결정 2026-04-30, Week 3~4)

**목적**: "앱같은 UX" — URL 직접 접근 차단, 네비게이션 버튼으로만 화면 전환

**공개 라우트** (URL 직접 접근 OK, SEO):
`/`, `/blog/*`, `/about`, `/contact`, `/terms`, `/privacy`, `/cookies`, `/refund`, `/login`, `/signup`

**보호 라우트** (URL 직접 접근 차단, 네비게이션만):
`/play`, `/levels`, `/dashboard`, `/settings`, `/billing`, `/admin/*`

**Navigation 정리 범위** (memory #14 + memory #19):
- header/sidebar 일관성 점검 — 페이지별 nav 상태 리뷰
- 불필요한 토글·중복 진입점 제거 (memory #19: 사용자 행위 전가 X 원칙 적용)
- `NavOnlyRoute` 가드 전제 조건으로 전체 페이지 네비게이션 흐름 검토
- Admin·Dashboard·Settings 등 보호 라우트 진입 경로 통일

**구현**:
- React Router `NavOnlyRoute` 가드 (`location.state.fromNav` 체크)
- 게임 진행 상태 localStorage 저장 (새로고침 대응)
- PWA: `manifest.json` + `vite-plugin-pwa` + Service Worker
- 모바일 첫 진입 시 "홈 화면에 추가" 팝업 (3초 후 1회, "다음에" → 7일 cooldown, "설치" → 영구 안 보여줌)
  - iOS: 수동 안내 + 단계 설명 (공유 → 홈 화면에 추가)
  - Android: `beforeinstallprompt` 자동
- 아이콘: 192·512·180 + maskable
- **작업 시간**: Week 3 Navigation 정리 (Sonnet 1~2시간) + Week 4 PWA (Sonnet 7~8시간 + 사용자 아이콘 제작 30분)

### 13.3 §0-1 정책 결정 ✅ 완료 (2026-04-29 사용자 결정)
- [x] 단계 Clear 기준 — 정답률 85% / 반응속도 평균 35% / 수행 10회 / 최대 연속 5회
- [x] Sublevel 3 stage 수 — 3 통일
- [x] 미가입자 권한 — Lv 1만
- [x] N+2 단일 STAGE 음표 배치 — Sub 1: 1·1·3, Sub 2: 1·3·5, Sub 3: 3·5·7
- [x] Stage 음표 set 반복 — Sub 1: 6·7·5, Sub 2: 6·3·3, Sub 3: 3·3·3
- [x] 재도전 배지 — 삭제
- [x] 같은 조표 연속 학습 — 구현

### 13.2 콘텐츠·게임플레이
- [ ] 힌트 시스템 (A vs B)
- [ ] 정답 버튼 디폴트 명명
- [ ] Special 게임 — 어떤 식
- [ ] 챌린지 가격대
- [ ] 굿즈 종류

### 13.3 배치고사·티어 (출시 후 결정)
- [ ] 상위 그룹 혜택
- [ ] 하위 그룹 강등
- [ ] 티어 획득 경로
- [ ] 최종 티어 보상
- [ ] 21단계 ↔ 티어 매핑

### 13.4 광고 (출시 후)
- [ ] 미가입자 vs 가입자 광고 차이
- [ ] 노출 빈도

---

## 🏆 우선순위 정리 (2026-05-03 갱신)

### 출시 전 필수 (5/31까지) — 순서별

| # | 항목 | 상태 | 예정 Week |
|---|---|---|---|
| 1 | §7.3 Calibration 전체 | ✅ 완료 (2026-05-03) | — |
| 2 | §7.1 performance.now() 전환 | ✅ 완료 (2026-05-03) | — |
| 3 | §0.4 UI 음표 history·크기·색깔·잘림 | 🔴 미완 | Week 2 |
| 4 | §7.10 음표-사운드 Sync 검증 | 🔴 미완 | Week 2~4 |
| 5 | §13.2 라우팅 보호 (NavOnlyRoute) + Navigation 정리 | 🔴 미완 | Week 3 |
| 6 | §1 결제·회원 등급 완성 (회원관리·대시보드 잠금·후킹) | 🔴 미완 | Week 3 |
| 7 | §10.1 약관 4종 + ⏳ Paddle Vendor 심사 신청 | 🔴 미완 | Week 3 |
| 8 | §13.2 PWA 등록 + §12.1 Sentry 도입 | 🔴 미완 | Week 4 |

### 출시 후 (6월~)

| 항목 | Phase |
|---|---|
| §8.1 §7.3 통합 분석 대시보드 | Phase 7-A (6월) |
| §3 광고 시스템 (AdSense 승인 후) | Phase 7-A (6월) |
| §7.2 Web Workers + §7.4 Fixed-point | Phase 7-A (6월) |
| §5.1 기록 비교 피드백 | Phase 7-A (6월) |
| §12.2 E2E 테스트 (Playwright) | Phase 7-A (6월) |
| §7.5 Effective Precision SLA | Phase 7-B (7~9월) |
| §2 배치고사 + 랭크 시스템 | Phase 7-B (7~9월) |
| §4.2 사용자화 레벨 | Phase 7-B (7~9월) |
| §6.2~6.3 디자인 컨셉 + 티어 카드 SNS | Phase 7-B (7~9월) |

---

## 14. 33일 작업 일정 (Phase 별)

### Week 1 (4/29 ~ 5/5): 버그 + 정책 코드 적용 + Calibration + 사업자 시작
- [x] §0.1 N+2 즉시 등장 버그 ✅ (commit 4e2b6ef, 2026-04-29)
- [x] §0-1.1~0-1.6 정책 결정 ✅ (사용자, 2026-04-29)
- [x] §0-1.5 코드 적용: 재도전 배지 삭제 ✅ (2026-04-30)
- [x] §0-1 정책 코드 전체 적용: PASS_CRITERIA + SUBLEVEL_CONFIGS + avg_reaction_time + §0-1.6 ✅ (2026-04-30)
- [x] §0.2 Lv5+ 조표 비율 (batchSize 기반 30/40/60/70%) ✅ (2026-04-30, commit bb062c3)
- [x] §0-1.4 Lv 5~7 SUBLEVEL_CONFIGS (batchSize 3·5·7 전용) ✅ (2026-04-30, commit 818ae2f)
- [x] §0.3 카운트다운 + Sub3 즉시 타임아웃 fix ✅ (2026-05-01, commit eac606a)
- [x] §0.4 UI 음표 history·크기·색깔 분석 완료 ✅ (2026-05-01, Opus 4 step 계획)
- [x] §4 retry 시스템 통합 (composeBatch + final-retry phase + 동적 batchSize 3·5·7) ✅ (2026-05-01 밤, commits 5e37084·7338406·eb8b5e2)
- [x] §4 시뮬레이터 parity (composeFinalRetryBatch dedup fix) ✅ (2026-05-01 밤, commits 1215178·509eb37)
- [x] §1 사운드 동기화 (audio context ensureAudioReady) ✅ (2026-05-01, commit 5f62244)
- [x] §2 카운트다운 중 음표 숨김 ✅ (2026-05-01, commit 58c4aab)
- [x] §3 batchSize=3 균등 분포 + batchSize=7 잘림 X 보장 ✅ (2026-05-02, commit 87f3aaf)
- [x] 카운트다운 애니메이션 1s 동기화 + fade-out ✅ (2026-05-02, commit 6283ad9)
- [x] swipe 모달 controlled 상태 머신 (modal → countdown → note 흐름) ✅ (2026-05-02, commit 941b04f)
- [x] swipe 모달 회귀 fix (paused·disabled gate) ✅ (2026-05-02, commit 6f5290f)
- [x] 모달·카운트다운 중 음표·NoteButtons·정답 라벨·조표 가드 ✅ (2026-05-02, commits c1b9d7c·717797e)
- [x] Lv 1~4 batchSize=1 stage 정책 갱신 (Sub1: 4 stages 33음표, Sub2: 5 stages 42음표, Sub3: 4 stages 52음표) ✅ (2026-05-02, commit 400dca2)
- [ ] **§7.3 Calibration 구현 (사용자 명시 — 정체성)** ⭐
- [ ] §4.4 힌트 시스템 결정
- [ ] §5.3 닉네임 중복 검증
- [ ] §9.1 도메인 이메일 시작
- [ ] §9.2 ⏳ 사업자 등록 시작 (Leo Republic)
- [ ] §10.3 SNS 핸들 선점
- [ ] §0.1-cleanup 출시 전 후속으로 처리 (Week 5)
- [ ] **사용자 작업**: 블로그 글 1~3편 작성 시작 (4/30 1일차부터)

### Week 2 (5/6 ~ 5/12): §0.4 마무리 + Calibration + i18n 준비
- [ ] §0.4 UI 음표 history·크기·색깔·잘림 구현 마무리
- [x] **§7.3 Calibration 4 단계 완료** ✅ 2026-05-03 (Opus 분석 2026-05-02 — §7.3-A 표 참조)
  - [x] §7.3.1 결정 시트 (11 Q) ✅
  - [x] §7.3.2 코어 lib + 영속화 ✅
  - [x] §7.3.3 UI + 측정 (§7.10.2 통합) ✅
  - [x] §7.3.4 reactionMs 보정 적용 ✅ — Q-J(Stats display raw/corrected) = §7.3.5 PENDING, speed bonus thresholds 출시 후 재튜닝 PENDING
- [ ] **§7.10 음표-사운드 Sync 검증** (§7.3 결합 — sync 측정 없이 calibration 신뢰도 X, **§7.10 → §7.3 또는 동시 진행 권장**)
- [x] **§7.1 performance.now() 전환** ✅ 완료 (2026-05-03, 15 사이트: NoteGame 12 + CountdownTimer 3)
- [ ] §3.5 약점 음표 표시 (Fail 시)
- [ ] §4.5 음표 라벨 토글 한+영+솔페주 (1~2시간)
- [ ] §0-2.1 스키마 표류 정리
- [ ] §0-2.2 Supabase 키 하드코딩 제거
- [ ] §0-2.3 Edge Function 구현 (payment-webhook)
- [ ] §1.2 Paddle Production 상품 등록 (연간 $24.99)
- [ ] **사용자 작업**: 블로그 글 추가 (한+영 동시)

### Week 3 (5/13 ~ 5/19): i18n + 라우팅 보호 + Navigation 정리 + 비즈니스 모델
- [ ] 게임 UI i18n 도입 (react-i18next, locales/ko·en.json, Sonnet 1~2일)
- [ ] 4/30·5/1~ 블로그 글 영어 번역 누적 (영어 폴더 분기)
- [ ] §13.2 라우팅 보호 (NavOnlyRoute) 도입
- [ ] §13.2 Navigation 정리 (header/sidebar 일관성, memory #14 NavOnlyRoute, memory #19 UX)
- [ ] §1.1 회원 등급 차등화 적용
- [ ] §1.3 결제 후킹 메시지
- [ ] §5.2 회원관리 페이지
- [ ] §5.4 가입자 대시보드 잠금
- [ ] §10.1 약관 4종 Termly/iubenda 생성 → 번역·검수
- [ ] §10.1 약관 완성 → ⏳ Paddle Vendor 심사 신청
- [ ] **사용자 작업**: 블로그 글 누적 10개 이상

### Week 4 (5/20 ~ 5/26): PWA + 마무리
- [ ] §13.2 PWA 등록 (manifest.json + Service Worker + 설치 유도 팝업)
- [ ] About / Contact 페이지 작성
- [ ] 다차원 시뮬레이션 검증 (Opus, 1~2일)
- [ ] §3.2 머니 스위치 구현
- [ ] §6 UI/UX 정비 마무리
- [ ] §12.1 Sentry 도입
- [ ] §7.9 피아노 사운드 조정
- [ ] §7.10 음표-사운드 Sync 검증 (Week 2 §7.3과 결합 진행 시 여기 ✅ 처리)
- [ ] **사용자 작업**: 블로그 글 누적 15~20개 → ⏳ AdSense 심사 신청
- [ ] 사용자 검증 라운드 1

### Week 5 (5/27 ~ 5/31): 최종 + 출시
- [ ] §0.1-cleanup 디버그 instrumentation 제거
- [ ] §11 환경변수 production 전환
- [ ] Termly 약관 4종 게시 (사업자등록 직후)
- [ ] 사용자 검증 라운드 2
- [ ] 출시 전 최종 점검
- [ ] **5/31 출시** 🚀

### 5/31 ~ 6/30: 출시 후 1개월 (Phase 7-A)
- [ ] §3 광고 시스템 (AdSense 승인 시)
- [ ] §7.2 Web Workers
- [ ] §7.4 Fixed-point Arithmetic
- [ ] §0-2.4 GitHub Actions CI/CD
- [ ] §12.2 E2E 테스트
- [ ] §5.1 기록 비교 피드백
- [ ] §8.1 §7.3 통합 분석 대시보드 (calibration_results 마이그레이션 + admin 히스토그램·device_change_events 뷰)
- [ ] 일본어 추가 (1~2주)
- [ ] 중국어 추가 (2~4주)

### 7월 ~ 9월: 출시 후 분기별 (Phase 7-B)
- [ ] §2 배치고사 + 랭크 시스템 전체
- [ ] §7.5 Effective Precision SLA
- [ ] §4.2 사용자화 레벨
- [ ] §6.2~6.3 디자인 컨셉 + 티어 카드 SNS

---

## 15. 완료 이력

작업 완료 시 여기로 이동. 큰 변경은 commit hash와 함께 기록.

**2026-04-27 ~ 28**:
- ✅ Phase 5: 21단계 sublevel 시스템
- ✅ Phase 6: Lv5-7 swipe accidentals (`c20e737`)
- ✅ 정답 정책 재작성 (`3b34405`) — 맞을 때까지 못 넘어감 + retry queue 하이브리드
- ✅ keySig 안정화 (Lv5+ 같은 stage 같은 키)
- ✅ admin tier override + 정답 배지 (`499a9e3`)
- ✅ 펜딩 백로그 정리 (`85303c0`)
- ✅ 세션 로그 (`f0ab64e`)
- ✅ 8개 분석 문서 (`3d49b57`)
- ✅ 설계 vs 코드 갭 분석
- ✅ Green Billion 명세 통합

**2026-04-29**:
- ✅ §0.1 N+2 재출제 즉시 등장 버그 (`bb692cd`) — 옵션 D (cross-batch dedup) + 옵션 B (retry pop 1턴 가드). 진짜 원인은 retry queue가 아닌 `generateBatch`의 cross-batch dedup 부재였음. 9개 신규 테스트 + 기존 265개 회귀 없음 (274/274 PASS).
- ✅ §0-1 정책 결정 9개 사용자 결정
  - 정답률 85%, 반응속도 평균 35%, 수행 10회, 최대 연속 5회 (한 번)
  - Sub 3 = 3 stage, 미가입자 = Lv 1만
  - 음표 배치: Sub 1 = 1·1·3, Sub 2 = 1·3·5, Sub 3 = 3·5·7
  - Stage 음표 set 반복: Sub 1 = 6·7·5, Sub 2 = 6·3·3, Sub 3 = 3·3·3
  - 재도전 배지 삭제, 같은 조표 연속 학습 구현
- ✅ §0.4 신규 (UI 음표 history·크기·색깔·잘림 방지) 발견 + 백로그 등록
- ✅ §7.3 Calibration 출시 전 필수 격상 (사용자 명시 — 서비스 정체성)

**2026-04-30**:
- ✅ §0.1 전역 dedup 확장 (`4e2b6ef`) — popDueOrNull(turn, lastShown?) 시그니처 확장 + `lastShownNoteRef` 4개 호출 지점 적용 + wasRetry 사각지대 fix (retry == currentBatch[currentIndex] 시 일반 advance) + N+2 정확화 (rescheduleAfterCorrect를 advance 전 호출, 기존 advance 후라 due=N+3이었음) + simulator (1만 게임 fuzz) + 19개 신규 테스트 (304/304 PASS).
- ✅ §0-1.5 재도전 배지 삭제 (`f09919c`) — NoteGame.tsx 🔁 재출제 배지 제거
- ✅ §0-1 정책 코드 전체 적용 — PASS_CRITERIA (정답률 85%·반응속도 35%·수행 10회·연속 5회) + SUBLEVEL_CONFIGS 3 stage 통일 + avg_reaction_time 필드 + §0-1.6 같은 조표 연속 학습 구현 + 333/333 PASS
- ✅ §0.2 Lv5+ 조표 비율 (`bb062c3`) — batchSize 기반 30/40/60/70% 조표 비율 + treble/bass 50:50 + 두 자리표 보장 + 14개 fuzz 테스트 325/325 PASS
- ✅ §0-1.4 Lv5~7 SUBLEVEL_CONFIGS (`818ae2f`) — batchSize 1·2 stage 제거, Sub1·2: 3·5·7 batchSize 51음표, Sub3: 5·7·7 batchSize 57음표, LV5_SUBLEVEL_STAGES 신규, getStagesFor(sublevel, isCustom, level) level 파라미터 추가 + 333/333 PASS

**2026-05-01**:
- ✅ §0.3 카운트다운 후 첫 음표 300ms 안정화 + Sub3 즉시 타임아웃 fix (`eac606a`) — FIRST_NOTE_GRACE_MS=300, handleCountdownComplete에 setTimeout 래퍼, setTimerKey(prev+1) grace 내부로 이동, noteStartTime.current grace 내부에서 설정 — 4개 TDD 테스트 (vi.useFakeTimers), 337/337 PASS
- ✅ §0.4 분석 완료 (Opus 보고서) — GrandStaffPractice.tsx 556줄 전체 분석, 갭 3개 식별, 4 step 구현 계획 수립 (Step 1 색상 30분 → Step 2 history 2~3시간 → Step 3 크기 1~2시간 → Step 4 클리핑 30분, 총 4~6시간)
- ✅ 문서 갱신 v7 — §13.1 글로벌 다국어 출시 전략 + §13.2 라우팅 보호·PWA + §14 Week 일정 갱신 (Week 2~5 재편) + §10.1 약관 Termly/iubenda 결정 + docs/i18n/STRATEGY.md 신규

**2026-05-01 (밤)**:
- ✅ §4 retry 시스템 통합 재정의 — composeBatch (retry 큐 통합 + lastShownNote dedup), missedNotes Map, final-retry phase 동적 batchSize (3·5·7), composeFinalRetryBatch dedup (옵션 5 sort + 옵션 7 retry skip) — commits 5e37084·7338406·eb8b5e2·1215178·509eb37
- ✅ §1 사운드 동기화 (ensureAudioReady → playNote 순서 보장) — commit 5f62244
- ✅ §2 카운트다운 중 음표 숨김 (showCountdown guard) — commit 58c4aab
- ✅ §0.1 dedup 정책 모든 batch 생성 경로 명세 박힘 — commit cf384ef

**2026-05-02**:
- ✅ §3 GrandStaffPractice batchSize=3 균등 분포 + batchSize=7 잘림 X 보장 — commit 87f3aaf
- ✅ 카운트다운 애니메이션 1s 동기화 + fade-out — commit 6283ad9
- ✅ swipe 모달 controlled 상태 머신 (showSwipeTutorial → showCountdown → playing 순서 강제) — commit 941b04f · 회귀 fix commit 6f5290f
- ✅ 모달·카운트다운 중 음표·NoteButtons·정답 라벨·조표(keySharps·keyFlats) 가드 — commits c1b9d7c·717797e · 368/368 → 373/373 PASS
- ✅ Lv 1~4 batchSize=1 stage 정책 갱신 (Sub1: 4 stages 33음표, Sub2: 5 stages 42음표, Sub3: 4 stages 52음표) — commit 400dca2 · 373/373 PASS
- ✅ 블로그 3일차 6편 한+영 (누적 14편) — commit 7a1ebdd · 블로그 이미지 CSS 제한 — commit 8091e8e

---

## 16. 메모 · 추후 보강

이 문서는 Claude·Claude Code가 자동으로 갱신한다 (§자동 갱신 시스템).
사용자 수동 작업 최소화.

**문서 연결**:
- `docs/DESIGN_VS_CODE_GAP.md` — 설계 PDF vs 구현 비교
- `docs/00_INDEX.md` — 전체 문서 인덱스
- `docs/03_GAME_LOGIC.md` — 게임 로직 상세
- `docs/04_DB_SCHEMA.md` — DB 구조

---

## 변경 이력

- 2026-04-27: 초안 — 사용자 24항목 + 첨부 4개 기획서
- 2026-04-28 (오전): §0/§0-1/§0-2 신설, 모든 항목 출시 전 격상
- 2026-04-28 (오후): Green Billion 명세 §7 통합
- 2026-04-28 (저녁): **출시 일정 확정 (5/31)** + **Week 1~5 일정 박힘** + **자동 갱신 시스템 도입** + **AdSense·Paddle 병렬 심사 반영** + 우선순위 5/31 기준 재분류 (🔴 출시 전 / 🟢 출시 후 1개월 / 🟡 분기별 / ⏳ 심사 대기) + §15 완료 이력 신설
- 2026-04-29 (밤): §0-1 정책 결정 9개 모두 확정 + §0.1 ✅ 완료 (commit 4e2b6ef) + §0.4 신규 (UI 음표 history·크기·색깔·잘림 방지) + §7.3 Calibration 출시 전 필수로 격상 (사용자 명시 — 정체성 결정)
- 2026-04-30 (밤): §0-1 코드 적용 완료 — §0-1.1~0-1.6 모두 구현 (commit 6c1a7e8) + §0.2 Lv5+ 조표 비율 수정 (commit bb062c3) + 블로그 1일차 2편 작성 완료 (sight-reading-basics, musical-staff-principle)
- 2026-05-01: §0.3 카운트다운 grace buffer + Sub3 즉시 타임아웃 fix (eac606a) + §0.4 GrandStaffPractice 분석 (Opus 보고서, 3갭 4 step) + 문서 갱신 v7 (§10.1 Termly 결정, §13.1 글로벌 다국어, §13.2 라우팅·PWA, §14 Week 재편, docs/i18n/STRATEGY.md 신규)
- 2026-05-01 (밤): §4 retry 시스템 통합 재정의 — composeBatch (retry 큐 통합), missedNotes Map, final-retry phase 동적 batchSize (3·5·7) — commits 5e37084, 7338406, eb8b5e2. §1 사운드 동기 (5f62244), §2 카운트다운 음표 숨김 (58c4aab). 시뮬레이터 §4 parity (1215178) + final-retry dedup fix (옵션 5+7) + 신규 invariant 테스트. **§0.1 dedup 정책 — 모든 batch 생성 경로 적용**: composeBatch (popDueOrNull lastShown skip + generateBatch prev), composeFinalRetryBatch (옵션 5 sort + 옵션 7 retry skip 예외), generateBatch (내부 prev). 향후 batch 생성 경로 신규 추가 시 위 dedup 정책 명시 적용 필수 — §0.1 회귀 방지.
- 2026-05-02 (Opus 4.7 분석): **§7.3 Calibration 작업 분할 + 결정 시트 + 위험 분석 박힘** — §7.3-A (4 sub-step, 총 13~18시간), §7.3-B (11 Q 결정 시트), §7.3-C (§7.10·§7.1 결합), §7.3-D (코드 영향 boundary 1지점 전략), §7.3-E (위험 요소). Week 2 일정에 §7.3.1~§7.3.4 + §7.10 + §7.1 결합 진행 박음. 코드 변경 0건.
- 2026-05-02: §3 batchSize=3 균등 분포 + batchSize=7 잘림 X 보장 (commit 87f3aaf) + 카운트다운 애니메이션 1s 동기화·fade-out (commit 6283ad9) + swipe 모달 controlled 상태 머신 modal→countdown→note (commit 941b04f) + swipe 모달 회귀 fix (commit 6f5290f) + 모달·카운트다운 중 음표·NoteButtons·정답 라벨·조표 가드 (commits c1b9d7c·717797e) + Lv 1~4 batchSize=1 stage 정책 갱신 Sub1=33음표·Sub2=42음표·Sub3=52음표 (commit 400dca2) + 블로그 3일차 6편 한+영 (commit 7a1ebdd) + 블로그 이미지 CSS 제한 (commit 8091e8e). 373/373 PASS.
- 2026-05-03 (Opus 4.7): **§7.10 sub-step 3개 + §7.1 실측 17 사이트 + §7.3.1 결정 시트 완료** — §7.10-A (3 sub-step), §7.10-B (6 Q 결정 시트 완료), §7.3-B (11 Q 결정 시트 완료). 코드 변경 0건. (commit 6080e0a)
- 2026-05-03 (Sonnet 4.6): **§7.1 코드 완료** (commit 42a4b68) + **§7.10.1 결정 완료** — §7.10-B 6 Q 결정값 박힘 (Q-A:a·Q-B:a·Q-C:c·Q-D:c·Q-E:a·Q-F:c). §7.3-C 결합 정책 확정: §7.10.2 측정 로직 §7.3.3 CalibrationModal 안 통합, §7.3.3 추정 7~10시간으로 상향. §7.3.3 의존성에 §7.10.1 추가. docs 갱신 (commits 4d73b69, 65d005f).
- 2026-05-03 (Sonnet 4.6): **§7.3.2 코어 lib 완료** — `src/lib/userEnvironmentOffset.ts` (localStorage r/w, DB sync, clamp, device change, skip), `src/hooks/useUserEnvOffset.ts` (needsCalibration·canSkip·deviceChanged), `supabase/migrations/20260503_add_user_env_offset.sql`. 단위 테스트 23건 신규. vitest 396/396 PASS.
- 2026-05-03 (Opus 4.7): **§7.3.3 + §7.10.2 완료** — `src/components/CalibrationModal.tsx` (4단계 상태 머신: intro→sync-measure→env-measure→complete), `src/lib/audioVisualSync.ts` (rAF+perf.now() vs AudioContext.currentTime, measureSyncGapAverage), `src/lib/calibrationMeasurement.ts` (trimmedMean·clampOffset·isSyncOutlier). NoteGame.tsx 통합 (showCalibration gate, memory #18 순서 보장). 단위 테스트 23건 신규 (audioVisualSync 7 + calibrationMeasurement 16). vitest 419/419 PASS. sim:test 9984 games 0 violations.
- 2026-05-03 (Sonnet 4.6): **§7.3.4 완료 — §7.3 코어 완료** — `useSessionRecorder.recordNote` boundary offset 차감 (DB 방식 C: JSONB `reaction_ms_raw` + `summary.avg_reaction_ms_raw` + `summary.offset_ms_applied`). NoteGame 3사이트 손대지 않음. speed bonus thresholds 값 유지 (corrected reactionMs 기준). 단위 테스트 6건 신규. vitest 425/425 PASS. sim:test 0 violations. PENDING: §7.3.5 Stats display (raw/corrected), speed bonus 재튜닝 (출시 후).
- 2026-05-03 (Sonnet 4.6): **§7.3 UX fix + §7.3.5 완료** — CalibrationModal 측정 시간 30초→5초, 측정 시작 버튼 primary 색상. §7.3.5 Admin 동시 노출 완료. Q-J 정책 정정 (Home raw 토글 영구 제거, 메모리 #19).
- 2026-05-03 (Sonnet 4.6): **§7.3 device 변경 자동 재측정 + A2 이벤트 로깅** — `onDeviceChange` 시그니처 갱신 (kinds 전달), `setIsCalibrated(false)` → 다음 게임 자동 모달 (메모리 #19 옵션 C). `device_change_events` 테이블 + migration SQL. `logDeviceChangeEvent`·`updateDeviceChangeEvent` 신규. 단위 테스트 8건 신규. vitest 433/433 PASS. PENDING: 출시 후 false positive 분석 → audio output 전용 감지 보강.
