# 03. 게임 비즈니스 로직

> **작성일**: 2026-04-28
> **선행 자료**: `docs/02_ARCHITECTURE.md` (NoteGame 트리)
> **함께 보면 좋은 자료**: `docs/04_DB_SCHEMA.md` (`record_sublevel_attempt`, `user_note_logs`), `docs/PENDING_BACKLOG.md §7` (성능·정밀도)

이 문서는 **출제 → 입력 → 정·오답 처리 → 진도 기록**의 전 흐름과 각 정책을 코드 위치까지 추적해 정리한 자료다. 이 문서를 읽으면 게임 알고리즘을 처음부터 다시 만들 수 있어야 한다.

---

## 1. 21단계 시스템 개요 (`src/lib/levelSystem.ts`)

### 1.1 구조

```
Lv 1 ─ Sublevel 1 (입문)   Sublevel 2 (숙련)   Sublevel 3 (마스터)
Lv 2 ─ ...                 ...                 ...
Lv 3 ─ ...                 ...                 ...
Lv 4 ─ ...                 ...                 ...
Lv 5 ─ ... (샵 키사인)     ...                 ...
Lv 6 ─ ... (플랫 키사인)   ...                 ...
Lv 7 ─ ... (샵+플랫 모두)  ...                 ...
```

총 **7 레벨 × 3 서브레벨 = 21단계** (`MAX_LEVEL=7`, `MAX_SUBLEVEL=3`, `TOTAL_SUBLEVELS=21` — `levelSystem.ts:140-142`).

### 1.2 서브레벨별 공통 패턴 (`levelSystem.ts:89-124`)

| Sublevel | 라벨 | timeLimit | lives (초기 라이프) |
|---|---|---|---|
| 1 | 입문 | 7초 | 5 |
| 2 | 숙련 | 5초 | 4 |
| 3 | 마스터 | 3초 | 3 |

### 1.3 Stage 구성 (`SUBLEVEL_CONFIGS`)

각 Sublevel은 여러 stage로 나뉜다. Stage 한 개의 총 노트 수 = `totalSets × notesPerSet`.

#### Sublevel 1 (27노트, ~1:53)

| Stage | batchSize | totalSets | notesPerSet | 총 노트 |
|---|---|---|---|---|
| 1 | 1 (순차) | 2 | 3 | 6 |
| 2 | 1 | 3 | 5 | 15 |
| 3 | 3 (동시) | 2 | 3 | 6 |

#### Sublevel 2 (40노트, ~2:00)

| Stage | batchSize | totalSets | notesPerSet | 총 노트 |
|---|---|---|---|---|
| 1 | 1 | 3 | 5 | 15 |
| 2 | 3 | 2 | 5 | 10 |
| 3 | 5 | 3 | 5 | 15 |

#### Sublevel 3 (66노트, ~1:59)

| Stage | batchSize | totalSets | notesPerSet | 총 노트 |
|---|---|---|---|---|
| 1 | 3 | 3 | 3 | 9 |
| 2 | 5 | 3 | 5 | 15 |
| 3 | 7 | 3 | 7 | 21 |
| 4 | 7 | 3 | 7 | 21 |

> 📌 `batchSize=1`은 한 번에 한 음표만 표시(순차), `batchSize≥3`은 화면에 동시 표시되며 currentIndex가 batch 안에서 이동.

### 1.4 커스텀 악보 (`level=0`) Stage (`levelSystem.ts:127-132`)

```
1. batchSize=1, sets=3, perSet=3
2. batchSize=1, sets=3, perSet=5
3. batchSize=3, sets=3, perSet=3
4. batchSize=5, sets=3, perSet=5
```

### 1.5 통과 조건 (`PASS_CRITERIA` — `levelSystem.ts:134-138`, `checkPassed()` — `181-187`)

세 조건을 **모두** 충족해야 단계 통과:

| 조건 | 값 |
|---|---|
| `play_count` | ≥ 5 |
| `best_streak` | ≥ 5 (한 게임 내 최대 연속 정답) |
| `accuracy` | ≥ 0.80 (= total_correct / total_attempts) |

> 🔗 통과 판정 RPC: `record_sublevel_attempt` (`docs/04_DB_SCHEMA.md`) — DB 단에서 `passed`/`just_passed` 결정.

### 1.6 구독 게이트 (`canAccessSublevel()` — `levelSystem.ts:225-246`)

| Tier | 접근 가능 |
|---|---|
| `guest` | Lv 1만 (3단계) |
| `free` | Lv 1·2 전체 + Lv 3-1 + Lv 4-1 (8단계) |
| `pro` | 21단계 전체 |

`getNextSublevel(level, sublevel)` — Lv 1-3 → Lv 2-1, Lv 7-3 → null (`levelSystem.ts:283-294`).

---

## 2. 정답 / 오답 처리 정책

### 2.1 핵심 원칙: **오답 시 같은 자리 유지**

오답 또는 타이머 만료 시:
- `currentIndex` 변경하지 않음
- `setTimerKey(prev => prev + 1)` 만 호출 → 타이머만 새로 시작
- 사용자는 **같은 음표를 다시** 풀 수 있음

이 정책은 정책 테스트(`src/components/NoteGame.policy.test.tsx`)로 검증된다.

### 2.2 정답 분기 (`src/components/NoteGame.tsx:702-761`)

```
정답 처리:
  1. score++, totalCorrect++
  2. currentStreak++ → bestStreak 갱신
  3. 연속 정답 3회 도달 시:
       lives < maxLives → lives++, setLifeRecovered(true) (1.5초 후 자동 false)
  4. playCorrect() → Tone.js 사운드
  5. logNote(is_correct=true)         → user_note_logs INSERT
  6. recorder.recordNote(correct=true, reactionMs)
  7. wasRetry===true:
       retryQueue.resolve(note)        → 큐에서 완전 제거 + missCount 초기화
     wasRetry===false:
       advanceToNextTurn()
         └─ retryQueue.rescheduleAfterCorrect(note, currentTurn)
             → 마커 있으면 due=currentTurn+2로 갱신 (없으면 no-op)
```

### 2.3 오답 분기 (`NoteGame.tsx:762-804`)

```
오답 처리:
  1. totalAttempts++
  2. currentStreak = 0, individualStreak = 0
  3. lives--                         → 0 이하면 setPhase("gameover")
  4. retryQueue.markMissed(note)     → due=MAX_SAFE_INTEGER (pop 안 됨)
  5. logNote(is_correct=false, error_type="wrong_button")
  6. recorder.recordNote(correct=false, reactionMs)
  7. playWrong()                     → E2 저음 효과음
  8. setTimerKey(prev => prev + 1)   → 타이머만 리셋
  ※ currentIndex / batchIndex 변경 없음 → 같은 자리 유지
```

### 2.4 타이머 만료 분기 (`NoteGame.tsx:807-856`)

오답과 동일하지만 `error_type="timeout"`:

```
타이머 만료 처리:
  1. logNote(is_correct=false, error_type="timeout")
  2. recorder.recordNote(correct=false, reactionMs=TIMER_SECONDS×1000)
  3. retryQueue.markMissed(note)
  4. playWrong()
  5. lives--, currentStreak=0
  6. setTimerKey++              → 같은 자리 유지
```

---

## 3. Retry Queue 알고리즘 (`src/hooks/useRetryQueue.ts`)

### 3.1 의도

오답 음표를 잊지 않고 **정답으로 통과한 시점부터 정확히 2턴 뒤** 다시 풀게 한다 (N+2). 미스 횟수와 무관하게 일정 (사용자 정책 — 2026-04-30 확정).

### 3.2 재출제 규칙

| 조건 | 재출제 시점 | 비고 |
|---|---|---|
| 같은 자리 정답 처리 후 | N + 2 | N = 정답 turn. `rescheduleAfterCorrect`가 advance 전에 호출되어 due=N+2. |
| 2회 이상 누적 미스 | N + 2 (동일) | missCount는 통계용. due 계산엔 영향 없음. |
| 3회 이상 미스 | N + 2 (동일) | 3회+ "즉시 다음 턴" 차등은 신규 정책에서 제거됨. |

> 구 API (`scheduleRetry` + `intervalFor`)는 차등 적용(1회=N+2, 2회=N+1, 3회=즉시)이지만 production에선 사용하지 않음. 신규 정책은 `markMissed` (마커만, due=MAX) → 정답 처리 시 `rescheduleAfterCorrect`(due=turn+2)로 통일. 같은 음표 절대 연속 미등장 보장은 `popDueOrNull(turn, lastShown)`의 lastShown skip + markJustAnswered 1턴 가드로 처리.

### 3.3 메서드

| 메서드 | 호출 시점 | 동작 | 라인 |
|---|---|---|---|
| `markMissed(note)` | 오답/타임아웃 | missCount++, due=MAX_SAFE_INTEGER (정답 들어올 때까지 pop 금지) | `useRetryQueue.ts:113-130` |
| `rescheduleAfterCorrect(note, turn)` | 정답 (wasRetry=false) | 마커 존재 시 due=turn+2로 갱신, 없으면 no-op | `132-146` |
| `resolve(note)` | 재출제 정답 (wasRetry=true) | 큐에서 완전 제거 + missCount 초기화 | `148-159` |
| `popDueOrNull(turn)` | 매 턴 진입 | 가장 오래된 due ≤ turn 마커 pop & 반환 (FIFO) | `161-179` |
| `reset()` | 스테이지 전환·리플레이 | 큐 초기화 | `NoteGame.tsx:461, 596` |
| `scheduleRetry()` | (구 API, 미사용) | — | `92-111` |

### 3.4 음표 식별

`note_key:octave:clef:accidental` 4-튜플로 식별. `useRetryQueue.test.ts`에서 검증.

### 3.5 동작 예시

```
Turn 10: 음표 A 오답
  → markMissed(A) : due=MAX (pop 안 됨)

Turn 11~20: 일반 음표 출제 (A는 popDueOrNull에서 통과 안 됨)

Turn 20: 일반 음표(예: B)에 정답 입력 시 advanceToNextTurn()
  → A에 대한 markMissed가 있어도 B의 rescheduleAfterCorrect는 A를 건들지 않음
     (rescheduleAfterCorrect는 답한 그 음표에 대해서만 작동)

(주의) 위 흐름에서 사용자가 'A 자체'에 정답을 친 적이 없다면,
  같은 자리 유지 정책 때문에 사용자는 A가 정답일 때까지 머무른다.
  결국 'A 정답' 이벤트가 발생하면 그 시점에 wasRetry 분기를 타게 됨.

실제 재출제 시나리오:
  Turn N: A 오답 → markMissed (due=MAX)
  Turn N: A 다시 정답 (같은 자리) → wasRetry=false (popDueOrNull 결과 아님)
       → rescheduleAfterCorrect(A, N) → due = N+2
  Turn N+1, N+2: prepareNextTurn() → popDueOrNull
       → Turn N+2 시점에 A pop → retryOverride=A → A 재출제
```

### 3.6 큐 영속성 정책 (`NoteGame.tsx:594-655`)

| 전환 | 큐 상태 |
|---|---|
| Stage → Stage (Lv 5+ 키사인 변경 동반) | `reset()` (라인 596) |
| 같은 Stage 내 Set → Set | 유지 (라인 615) |
| 같은 Set 내 Batch → Batch | 유지 (라인 653) |
| 게임 종료(success/gameover) | mount 해제 시 자동 소멸 |

> 🔗 검증: `src/hooks/useRetryQueue.test.ts`, `src/components/NoteGame.test.tsx` (1개 케이스 실패 — 재재출제 시나리오, `docs/06_TESTING.md` 참조)

---

## 4. 가중치 출제 알고리즘 (`src/lib/noteWeighting.ts`)

### 4.1 가중치 상수

| 마스터리 상태 | weight | 의미 |
|---|---|---|
| `weakness` | **3.0** | 약점 음표 — 3배 자주 출제 |
| `normal` | **1.0** | 기본 |
| `mastery` | **0.3** | 마스터 음표 — 가끔만 |

### 4.2 식별자

음표 키: `${clef}:${key}${accidental}${octave}` — 예: `treble:F#4`, `bass:Bb2` (`noteWeighting.ts:17-30`).

### 4.3 함수

| 함수 | 입력 | 출력 |
|---|---|---|
| `getNoteWeight(masteryMap, clef, key, octave, accidental?)` | masteryMap, 음표 정보 | 1.0 (없으면 기본) / 3.0 (weakness) / 0.3 (mastery) |
| `weightedPickIndex(weights: number[])` | 가중치 배열 | 누적 가중치 기반 인덱스 (합이 0이면 균등) |

### 4.4 호출 위치

- **Lv 1~4 일반 모드**: `generateBatch()` — `NoteGame.tsx:269-271`
- **Lv 5+ 키사인 모드**: `generateKeyBatch()` — `NoteGame.tsx:207-211`

### 4.5 데이터 소스: `useUserMastery()` (`src/hooks/useUserMastery.ts:31-105`)

- 게임 시작 시 1회 `note_mastery` 테이블 조회 → 메모리 맵
- 키 형식: `${clef}:${note_key}` (octave 무관)
- 플래그: `weakness_flag` / `mastery_flag` 둘 중 하나만 활성
- 로그아웃 시 맵 초기화

> 🔗 일일 배치로 플래그 갱신: `run_daily_batch_analysis()` RPC — `docs/04_DB_SCHEMA.md`

---

## 5. 키사인(조성) 시스템 (Lv 5+)

### 5.1 레벨별 키사인 분포 (`NoteGame.tsx:39-72`)

| 레벨 | 조성 | 예시 |
|---|---|---|
| Lv 1~4 | C major 고정 | `showSharps=false, showFlats=false` |
| Lv 5 | Sharp keys만 | G, D, A, E, B, F#, C# (7개) |
| Lv 6 | Flat keys만 | F, B♭, E♭, A♭, D♭, G♭, C♭ (7개) |
| Lv 7 | Sharp + Flat | 14개 모두 |
| Custom (level=0) | 입력 데이터 기반 | 정의된 조성 사용 |

### 5.2 조성 생성 로직 (`getRandomKeySignature(level)` — `NoteGame.tsx:67-72`)

```ts
Lv 5: SHARP_KEYS에서 랜덤 선택
Lv 6: FLAT_KEYS에서 랜덤 선택
Lv 7+: 둘 다 + 동등 확률
```

### 5.3 조성 갱신 시점 (`NoteGame.tsx:587, 608`)

- **Stage 전환**: `forceNewKeySig=true` → 새 조성 생성 + retry queue reset
- **같은 Stage 내 Set 전환**: `forceNewKeySig=false` → 조성 유지 (사용자 일관성)
- **같은 Set 내 Batch 전환**: 조성 유지

> 🔗 안정성 보강 커밋: `3b34405 fix: keep keySig stable within Lv5+ stage` (Phase 6)

---

## 6. 스와이프 액시덴탈 인터랙션 (Lv 5+)

### 6.1 hook (`src/hooks/useSwipeAccidental.ts`)

핵심 임계값: **`threshold = 56px`** (`useSwipeAccidental.ts:41`).

### 6.2 동작 흐름

| 이벤트 | 조건 | 동작 |
|---|---|---|
| `pointerdown` | — | startY 기록, pointer capture |
| `pointermove` | `dy < -56px` (위로) | 즉시 `commit("up")` — 샵 |
| `pointermove` | `dy > +56px` (아래로) | 즉시 `commit("down")` — 플랫 |
| `pointermove` | 그 외 | `translateY` 시각 피드백만 |
| `pointerup` | `\|dy\| < 28px` (50% 미만) | `commit(null)` — 자연음 (탭과 동일) |
| `pointerup` | `28 ≤ \|dy\| < 56px` | 무시 (취소) |
| `pointercancel` | — | 상태 초기화 |

### 6.3 활성화 조건

- `swipeEnabled = (level >= 5)` — `NoteGame.tsx`에서 NoteButtons에 prop 전달
- 스와이프 모드에서 NoteButtons는 자연음 7개만 표시 (♯/♭ 라벨 제거 — `src/components/NoteButtons.tsx:134-137`)

### 6.4 첫 사용 튜토리얼

`AccidentalSwipeTutorial.tsx` — Lv 5+ 첫 진입 시 1회 노출 (localStorage 기반 — 코드에서 확인 필요).

> 🔗 도입 커밋: `c20e737 feat: Lv5+ swipe accidentals (Phase 6)`

---

## 7. 라이프 시스템

### 7.1 초기값 (`SUBLEVEL_CONFIGS[sublevel].lives`)

| Sublevel | 초기 lives |
|---|---|
| 1 (입문) | 5 |
| 2 (숙련) | 4 |
| 3 (마스터) | 3 |

### 7.2 차감 (`NoteGame.tsx:793-794, 845-846`)

- 오답 시 `-1`
- 타이머 만료 시 `-1`
- `lives <= 0` → `setPhase("gameover")`

### 7.3 회복 (`NoteGame.tsx:744-750`)

조건 (모두 만족):
- 연속 정답 **3회** 달성 (정확히 3의 배수마다)
- 현재 lives < 최대 lives (서브레벨 초기값)

회복 시:
- `lives + 1` (최대값까지만)
- `setLifeRecovered(true)` → 1.5초 후 자동 false (UI 펄스 효과)

---

## 8. 점수 / XP 시스템

### 8.1 게임 내 점수 (`NoteGame.tsx:396, 733`)

- 시작 시 0
- 정답 시 `+1`
- 누적만 함 (게임오버 시 보존)

### 8.2 세션 종료 시 XP 계산 v2 (`src/hooks/useSessionRecorder.ts:78-146`)

| 항목 | 값 | 조건 |
|---|---|---|
| **Base** | +1 / 정답 | 정답마다 누적 |
| **Speed Bonus** | +2 / +1 | 레벨별 임계값 (아래 표) |
| **Streak Bonus** | +5, +10, +25 | 5/10/20 연속 정답 마일스톤 |
| **Completion Bonus** | +20 | 게임 완료(success) 시만 — gameover면 0 |
| **Accuracy Bonus** | +30 / +15 / +5 | 100% / ≥90% / ≥80% (완료 시만) |

#### 레벨별 속도 임계 (반응시간 ms)

| 레벨 | ≤+2 보너스 | ≤+1 보너스 |
|---|---|---|
| Lv 1~2 | 0.8s | 1.5s |
| Lv 3~4 | 1.0s | 2.0s |
| Lv 5~6 | 1.3s | 2.5s |
| Lv 7 | 1.5s | 3.0s |
| Custom (0) | 1.0s | 2.0s |

### 8.3 게임오버 시 XP

- Completion/Accuracy 보너스 0
- Base + Speed + Streak만 적용

---

## 9. Mastery 기록 시점

### 9.1 매 시도마다 `user_note_logs` INSERT (`useNoteLogger.ts:11-55`)

`logNote()` 호출 위치:

| 호출 라인 | 상황 | is_correct | error_type |
|---|---|---|---|
| `NoteGame.tsx:713-721` | 정답 | true | null |
| `NoteGame.tsx:763-771` | 오답 | false | "wrong_button" |
| `NoteGame.tsx:811-819` | 타이머 만료 | false | "timeout" |

저장 컬럼:
- `note_key` ("C", "F#", "Bb" 등 — accidental 포함)
- `octave` (정수)
- `clef` ("treble" / "bass")
- `is_correct` (boolean)
- `response_time` (초, 소수점 2자리)
- `error_type` (null / "wrong_button" / "timeout")
- `level` (현재 레벨)

### 9.2 세션 단위 기록 (`useSessionRecorder`)

- `recorder.recordNote()` — 매 시도 in-memory 누적
- `recorder.endSession(status)` — 게임 종료 시 `user_sessions` INSERT (XP 계산 결과 포함)

### 9.3 일일 배치 → mastery 플래그 (`note_mastery`)

- 매일 UTC 15:00 (한국 자정) `run_daily_batch_analysis()` RPC 실행 (cron 또는 수동)
- 사용자별 `recent_accuracy`, `avg_reaction_ms`, `total_attempts` 분석
- `weakness_flag` / `mastery_flag` 갱신
- 결과는 `daily_batch_runs` 테이블에 요약 기록

> 🔗 SQL 함수 본체: `supabase/migrations/20260424_premium_expiry.sql:30-116`

---

## 10. 게임 흐름 제어 (Phase / Turn / Stage)

### 10.1 Phase 상태 (`NoteGame.tsx`)

| Phase | 의미 |
|---|---|
| `"playing"` | 게임 진행 중 |
| `"success"` | 모든 stage 완료 |
| `"gameover"` | 라이프 0 |

### 10.2 카운터

| 카운터 | 의미 | 갱신 |
|---|---|---|
| `turnCounterRef` | 글로벌 턴 (retry queue due 비교용) | `prepareNextTurn()`에서 ++ (`NoteGame.tsx:552`) |
| `currentIndex` | 현재 batch 내 음표 인덱스 | 정답 시만 `advanceToNextTurn()`에서 변경 (`NoteGame.tsx:658-659`) |
| `setProgress` | 현재 set에서 처리한 누적 음표 수 | batch 완료 시 ++, set 완료 시 리셋 |

### 10.3 흐름 의사코드

```
mount:
  loadMastery()
  loadProgress()
  stages = getStagesFor(level, sublevel)
  generateNewBatch(stage=0, set=0)
  countdown 3초 → phase="playing"

while phase==="playing":
  prepareNextTurn():
    turnCounterRef++
    retryOverride = retryQueue.popDueOrNull(turnCounterRef)
    if retryOverride: 음표 = retryOverride (wasRetry=true)
    else: 음표 = currentBatch[currentIndex] (wasRetry=false)
    playNote()
    timer 시작 (TIMER_SECONDS)

  사용자 입력 (button or swipe):
    handleAnswer(picked) →
      correct? → 정답 분기 → advanceToNextTurn()
      wrong?   → 오답 분기 → 같은 자리 유지

  타이머 만료:
    handleTimerExpire() → 같은 자리 유지

  batch 완료 (currentIndex >= batchSize):
    setProgress += batchSize
    if setProgress >= notesPerSet: handleSetComplete()
    else: generateNewBatch() (retry queue 유지)

  set 완료:
    if 다음 set 있음: 같은 stage 다음 set, retry queue 유지
    else: handleStageComplete()

  stage 완료:
    if 다음 stage 있음: keySig 갱신(Lv5+), retryQueue.reset()
    else: phase = "success"

phase==="success":
  recorder.endSession("completed")
  recordAttempt() RPC → passed/just_passed 결정
  <SublevelPassedDialog /> 표시

phase==="gameover":
  recorder.endSession("gameover")
  recordAttempt() RPC
  <GameOverDialog /> 표시
```

---

## 11. 카운트다운 타이머 (`src/components/CountdownTimer.tsx`)

| 항목 | 값 |
|---|---|
| `duration` | sublevel 기반 (3 / 5 / 7초) |
| `resetKey` | 변경 시 타이머 리셋 (오답 시 setTimerKey++) |
| 갱신 주기 | 50ms |
| 0 도달 시 | `onExpire()` 콜백 |

### 색상 단계 (`CountdownTimer.tsx:1-60`)

| fraction | 색 |
|---|---|
| > 50% | primary (파랑) |
| 25%~50% | 노랑 |
| 0%~25% | 주황 |
| ≤ 1초 | 빨강 + pulse 애니메이션 |

---

## 12. 오선지 렌더 (`src/components/practice/GrandStaffPractice.tsx`)

### 12.1 표시 모드

| 상태 | 색 |
|---|---|
| 현재 음표 (current) | 파란색 |
| 정답 처리된 이력 (past, 최대 TOTAL_SLOTS) | 초록색 |
| 미출제 (future) | 검정 |

### 12.2 Batch 모드 (batchSize > 1)

- 모든 음표 동시 표시
- `batchIndex`로 현재 활성 음표 강조
- batch 갈이 시 답변 이력 초기화

> 🔗 일부 fallback은 `src/components/StaffDisplay.tsx` 사용.

---

## 13. 진도 기록 (`src/hooks/useLevelProgress.ts:58-93`)

### 13.1 `recordAttempt()` 호출

phase 변경 시(success/gameover) 호출 — `NoteGame.tsx:471-473`.

```ts
recordAttempt({
  p_level, p_sublevel,
  p_attempts: totalAttempts,
  p_correct: totalCorrect,
  p_max_streak: bestStreak,
  p_game_status: phase,  // 'success' | 'gameover'
})
```

### 13.2 RPC: `record_sublevel_attempt` (`supabase/migrations/20260425_sublevel_system.sql:68-164`)

반환 JSON:

```json
{
  "level": 1,
  "sublevel": 1,
  "play_count": 5,
  "total_attempts": 30,
  "total_correct": 27,
  "accuracy": 0.9,
  "best_streak": 7,
  "passed": true,
  "just_passed": true
}
```

`just_passed===true`일 때 다음 단계 자동 unlock (DB 함수 내부 처리).

### 13.3 자동 refetch

`useLevelProgress`는 RPC 응답 후 `fetchProgress()`를 호출 → `LevelSelect`의 잠금 상태가 즉시 갱신됨.

---

## 14. 정책 요약 매트릭스

| 정책 | 적용 위치 | 코드 |
|---|---|---|
| **오답 시 같은 자리 유지** | 오답·타임아웃 분기 | `NoteGame.tsx:762-804, 807-856` |
| **연속 정답 3회 → 라이프 회복** | 정답 분기 | `NoteGame.tsx:744-750` |
| **N+2 retry** | popDueOrNull / rescheduleAfterCorrect | `useRetryQueue.ts:113-179` |
| **3회 이상 오답 → 즉시 재출제** | markMissed missCount 누적 | `useRetryQueue.ts:113-130` |
| **약점 3배 출제** | weightedPickIndex | `noteWeighting.ts:17-47` |
| **마스터 0.3배** | 위와 동일 | 위와 동일 |
| **Lv 5 샵 / Lv 6 플랫 / Lv 7 둘 다** | getRandomKeySignature | `NoteGame.tsx:67-72` |
| **Stage 내 키사인 고정** | forceNewKeySig 분기 | `NoteGame.tsx:587, 608` |
| **스와이프 56px 임계** | useSwipeAccidental threshold | `useSwipeAccidental.ts:41` |
| **타이머 만료 = 오답 처리** | handleTimerExpire | `NoteGame.tsx:807-856` |
| **단계 통과: play≥5 ∧ streak≥5 ∧ acc≥0.8** | record_sublevel_attempt | DB 함수 |
| **다음 단계 자동 unlock** | record_sublevel_attempt | DB 함수 |
| **구독 게이트** | canAccessSublevel | `levelSystem.ts:225-246` |

---

## 15. 펜딩 백로그 (관련 항목)

- 🔴 **반응속도 측정 정밀도**: `Date.now()` → `performance.now()` (`docs/PENDING_BACKLOG.md §7.1`)
- 🔴 **첫 음표 buffering 이슈**: Lv 7-3 3초 제한 부담 (`§12.5`)
- 🔴 **힌트 시스템 결정 보류**: 시간 50% 경과 시 시각 힌트? (`§4.4`)
- 🟡 **세계화 정답 버튼**: 한/영/라틴 토글 (이미 useSolfegeSystem 존재) (`§4.5`)
- 🟢 **코드 연습 모드**: 화음 계이름 (`§4.1`)

---

다음: `docs/04_DB_SCHEMA.md` (Supabase 데이터 모델)
