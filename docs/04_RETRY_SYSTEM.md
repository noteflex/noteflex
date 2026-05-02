# §4 Retry System — 명세

> **작성일**: 2026-05-02 (§4 Step D 명세 박기)
> **목적**: retry 시스템(useRetryQueue + composeBatch + final-retry phase) 정확 동작을 향후 회귀 방지용으로 박는다.
> **방법론**: `src/components/NoteGame.tsx` + `src/hooks/useRetryQueue.ts` + `src/lib/simulator/{game.ts,retryQueue.ts}` 코드 트레이스 결과. 추측 X.
> **scope**: 게임 한 판(sublevel 한 판) 내 retry 동작만. 사용자 mastery·세션 간 carry-over는 본 문서 외부.

---

## §1. Overview

### 1.1 목적

- **학습 강화**: 사용자가 못 맞춘 음표를 같은 sublevel 내에서 다시 출제해 학습을 끝까지 끌고 간다.
- **두 phase**:
  - `playing` — stage·set 진행 중. 메인 phase. retry 큐(N+2 알고리즘) 사용.
  - `final-retry` — 모든 stage 끝나고 못 맞춘 음표가 남았을 때 진입. 큐 미사용. `missedNotes` Map 직접 소비.

### 1.2 핵심 데이터 구조

| 구조 | 정의 위치 | 역할 |
|-|-|-|
| `RetryEntry` | `useRetryQueue.ts:26` | `{ id, note, scheduledAtTurn, missCount }`. retry 큐 한 entry. |
| `queueRef` | `useRetryQueue.ts:87` | `Map<id, RetryEntry>` — 활성 큐. `useRef` (state X). |
| `missCountRef` | `useRetryQueue.ts:91` | `Map<id, number>` — 누적 오답. resolve 전까지 유지. |
| `justAnsweredRef` | `useRetryQueue.ts:94` | `{ id, turn } \| null` — 1턴 pop 제외 마커. |
| `phase` | `NoteGame.tsx:402` | `"playing" \| "final-retry" \| "gameover" \| "success"` |
| `missedNotes` | `NoteGame.tsx:409` | `Map<id, NoteType>` — sublevel 전체 못 맞춘 음표. final-retry batch 입력. |
| `batchAndKey` | `NoteGame.tsx:390` | `{ batch, keySig, retryCount }`. `batch[0..retryCount-1]=retry`, `batch[retryCount..]=새 음표`. |
| `turnCounterRef` | `NoteGame.tsx:349` | `useRef<number>` — `popDueOrNull(turn, ...)` 인자 + due 비교. |
| `lastShownNoteRef` | `NoteGame.tsx:352` | `useRef<NoteType \| null>` — 직전 화면 음표. §0.1 dedup용. |

식별자 `id`는 `composeId({clef, key, accidental, octave}) = ${clef}:${key}${acc}${octave}` (예: `treble:F#4`). 같은 음이라도 성부·옥타브가 다르면 다른 entry.

---

## §2. RetryQueue 상태 머신

`useRetryQueue.ts` (production) ↔ `src/lib/simulator/retryQueue.ts` (`SimRetryQueue` — React-free 시뮬레이터). 메서드 시그니처·동작 동일 (parity 유지).

### 2.1 `markMissed(note)` — 오답·timeout 시

```
missCountRef[id] = (missCountRef[id] ?? 0) + 1
existing = queueRef[id]
queueRef[id] = {
  id, note,
  scheduledAtTurn: existing?.scheduledAtTurn ?? Number.MAX_SAFE_INTEGER,
  missCount: missCountRef[id],
}
```

- **§4 fix (2026-05-01)**: 기존 entry의 `scheduledAtTurn` 보존. 이전 동작은 매 호출마다 `MAX_SAFE_INTEGER`로 덮어써서 `rescheduleAfterCorrect`로 set된 N+2 due가 사라지는 회귀 발생. simulator·production 양쪽 동일 fix.
- 새 entry는 `scheduledAtTurn = MAX_SAFE_INTEGER` — `rescheduleAfterCorrect`이 호출될 때까지 `popDueOrNull`에서 절대 안 잡힘.

### 2.2 `rescheduleAfterCorrect(note, currentTurn)` — 메인 phase 새 음표 정답 시

```
existing = queueRef[id]
if (!existing) return  // 오답 이력 없음 → no-op
queueRef[id] = { ...existing, scheduledAtTurn: currentTurn + 2 }
```

- **N+2 알고리즘**: `due = currentTurn + 2`. 정답 turn 이후 2턴 뒤에 retry 자격.
- 마커 없으면 no-op (해석 11=X — 오답 이력 없는 음표는 큐 안 들어감).

### 2.3 `popDueOrNull(currentTurn, lastShownNote?)` — batch 생성 시 호출

```
lastId = lastShownNote ? composeId(lastShownNote) : null
bestId = null, bestTurn = ∞
for (id, entry) in queueRef:
  // skip 1: justAnswered 1턴 가드
  if (justAnsweredRef && id === justAnsweredRef.id
      && currentTurn - justAnsweredRef.turn <= 1) continue
  // skip 2: §0.1 직전 화면 음표 dedup
  if (lastId && id === lastId) continue
  // due 도달 + 가장 작은 turn 우선
  if (entry.scheduledAtTurn <= currentTurn
      && entry.scheduledAtTurn < bestTurn):
    bestId = id, bestTurn = entry.scheduledAtTurn
if (!bestId) return null
queueRef.delete(bestId)
return entry.note
```

- **두 단계 skip**: justAnswered (1턴 가드) + lastShown (§0.1 dedup).
- 모든 due 후보가 skip되면 null → caller가 `generateBatch`로 새 음표 생성 (1턴 지연 fallback).

### 2.4 `resolve(note)` — retry 음표 정답 시 (영구 제거)

```
missCountRef.delete(id)
queueRef.delete(id)
```

- 다음에 또 틀려도 missCount 1회차부터 재시작.

### 2.5 `markJustAnswered(note, currentTurn)` — 정답 직후

```
justAnsweredRef = { id, turn: currentTurn }
```

- `popDueOrNull`의 1턴 가드 입력. `currentTurn - turn <= 1` 동안 같은 ID skip.

### 2.6 `scheduleRetry(note, currentTurn)` — legacy (현재 NoteGame 미호출)

- `intervalFor(missCount)`: `1→2, 2→1, 3+→0`. due = `currentTurn + interval`.
- `useRetryQueue.test.ts` 회귀 호환용. production NoteGame은 `markMissed` + `rescheduleAfterCorrect` 조합으로 대체.

### 2.7 `reset()` / `has(note)`

- `reset`: 큐·missCount·justAnswered 모두 clear. 게임 시작·리플레이·gameover 시 호출.
- `has`: 큐에 entry 존재 확인 (디버그·테스트용).

---

## §3. composeBatch (메인 phase)

`NoteGame.tsx:595-642` (production) ↔ `simulator/game.ts:164-195` (sim).

### 3.1 시그니처

```ts
composeBatch(
  batchSize: number,
  forceNewKeySig: boolean = false,    // sim에는 없음 — Lv5+ keySig 갱신 신호
  lastShownNote?: NoteType | null,
): { batch: NoteType[]; keySig: KeySignatureType; retryCount: number }
```

### 3.2 알고리즘

```
retryNotes = []
prev = lastShownNote
while (retryNotes.length < batchSize):
  lastShownKey = prev (RetryNoteKey 형식)
  due = retryQueue.popDueOrNull(turnCounterRef.current, lastShownKey)
  if (!due) break
  retryNote = NoteType from due
  retryNotes.push(retryNote)
  prev = retryNote   // §0.1 — retry 끼리 dedup
newCount = batchSize - retryNotes.length
if (newCount === 0):
  return { batch: retryNotes, keySig: 현재 유지, retryCount }
newResult = generateNewBatch(newCount, forceNewKeySig, prev)
return {
  batch: [...retryNotes, ...newResult.batch],
  keySig: newResult.keySig,
  retryCount: retryNotes.length,
}
```

- **`batch[0..retryCount-1]`** = retry 음표, **`batch[retryCount..]`** = 새 음표. handleAnswer의 `wasRetry = currentIndex < retryCount`로 판단.
- **§0.1 dedup 양쪽 적용**: popDueOrNull(turn, lastShownKey) + generateBatch(... prev) — 인접 두 음표는 다른 ID 보장.
- newCount=0 (큐가 batch 전부 채움) 케이스는 keySig 갱신 X (현재 유지).

---

## §4. composeFinalRetryBatch (final-retry phase)

`NoteGame.tsx:658-704` (production) ↔ `simulator/game.ts:205-249` (sim).

### 4.1 시그니처

```ts
composeFinalRetryBatch(
  missedMap: Map<string, NoteType>,
  lastShownNote?: NoteType | null,
): { batch: NoteType[]; keySig: KeySignatureType; retryCount: number } | null
```

### 4.2 알고리즘

```
missedArray = Array.from(missedMap.values())
if (missedArray.length === 0) return null
targetBatchSize = getFinalRetryBatchSize(missedArray.length)

// §0.1 옵션 5: lastShown ID와 다른 음표 우선 정렬
lastShownId = lastShownNote ? composeId(lastShownNote) : null
sortedMissed = lastShownId
  ? [...missedArray.filter(n => composeId(n) !== lastShownId),
     ...missedArray.filter(n => composeId(n) === lastShownId)]
  : missedArray

retryCount = min(sortedMissed.length, targetBatchSize)
retryNotes = sortedMissed.slice(0, retryCount)

// §0.1 옵션 7: retry[0] === lastShown 케이스 (missedArray 모두 lastShown)
//   → retry 통째 skip, 새 음표만 batch (다음 batch에서 lastShown 변경 후 retry 정상 처리)
if (retryCount > 0 && lastShownId
    && composeId(retryNotes[0]) === lastShownId):
  newResult = generateNewBatch(targetBatchSize, false, lastShownNote)
  return { batch: newResult.batch, keySig: newResult.keySig, retryCount: 0 }

newCount = targetBatchSize - retryCount
if (newCount === 0):
  return { batch: retryNotes, keySig: 현재 유지, retryCount }
lastShownForNew = retryNotes[retryNotes.length-1] ?? lastShownNote ?? null
newResult = generateNewBatch(newCount, false, lastShownForNew)
return {
  batch: [...retryNotes, ...newResult.batch],
  keySig: newResult.keySig,
  retryCount,
}
```

- **`retryQueue` 미사용** — final-retry는 N+2 알고리즘 외부. `missedMap`(`missedNotes`)을 인자로 받아 stale state 회피.
- **§0.1 dedup 두 옵션** (2026-05-01 박힘):
  - **옵션 5 (sort)**: `lastShown`과 다른 ID 음표를 retry 자리 첫 번째로 — `batch[0]` dedup 보장.
  - **옵션 7 (좁은 예외)**: missedArray 모두 lastShown ID인 경우(예: missed 1개인데 그게 lastShown) — retry 통째 skip + 새 음표만. 다음 batch에서 lastShown 변경되면 retry 정상.
- 새 음표 생성 시 dedup용 prev = retry 마지막 ?? lastShown.

### 4.3 `getFinalRetryBatchSize(missedCount)` — 동적 batchSize

| missedCount | batchSize |
|-|-|
| 1 ~ 2 | 3 |
| 3 ~ 4 | 5 |
| 5+ | 7 |

`NoteGame.tsx:580-584`. simulator parity (`game.ts:143-147`).

---

## §5. final-retry phase

### 5.1 진입 조건

`handleSetComplete` 안에서 (`NoteGame.tsx:723-744`):

1. `currentSetNum >= stage.totalSets`
2. `nextStageIdx >= stages.length` (모든 stage 끝)
3. `missedNotes.size > 0`
4. `composeFinalRetryBatch(missedNotes, lastShownNote)` non-null

위 4개 모두 충족 시:
```
setPhase("final-retry")
setBatchAndKey(result)
setCurrentIndex(0)
setDisabledNotes(new Set())
setAnsweredNotes([])
setTimerKey(prev => prev + 1)
playNote(result.batch[0])
```

`missedNotes.size === 0` 또는 `composeFinalRetryBatch` null이면 `setPhase("success")`.

### 5.2 정답 처리 (`handleAnswer:1002-1007`)

```
wasRetryNote = currentIndex < batchAndKey.retryCount
id = wasRetryNote ? composeId(currentTarget) : null
advanceFinalRetry(wasRetryNote, id)
```

- **retry 음표 정답** (`idx < retryCount`) → `missedNotes.delete(id)` + advance.
- **새 음표 정답** (`idx >= retryCount`) → `missedNotes` 변동 X + advance (학습 보조 — 같은 음표를 새 자리로 한 번 더 풀었다는 신호).
- **큐 변동 X** — 코드상 `markJustAnswered`·`resolve`·`rescheduleAfterCorrect` 호출은 phase === "final-retry" 분기 (`return`) 이전이 아니라 이후 블록에 있음(line 1013-1021).
  → final-retry에서 정답 시 큐 호출 0회 (이미 1005에서 return).

### 5.3 오답 처리 (`handleAnswer:1068-1073`)

```
// 1046-1049: phase !== "final-retry" 가드 → markMissed/addMissedNote 호출 X
lives -= 1
if (lives <= 0) → setPhase("gameover"); return
wasRetryNote = currentIndex < batchAndKey.retryCount
id = wasRetryNote ? composeId(currentTarget) : null
advanceFinalRetry(wasRetryNote, id)
```

- **큐·missedNotes 추가 X** — 마지막 단계라 더 이상 add 안 함.
- **retry 음표 오답** → `missedNotes.delete(id)` (학습 포기 — 다음 기회 없음).
- **새 음표 오답** → `missedNotes` 변동 X (학습 보조 자리, 진행만).

### 5.4 Timeout 처리 (`handleTimerExpire:1135-1138`)

오답과 동일:
- `phase !== "final-retry"` 가드(1109)로 `markMissed`/`addMissedNote` 호출 X.
- lives -1, `advanceFinalRetry(wasRetryNote, id)`.

### 5.5 advanceFinalRetry 흐름 (`NoteGame.tsx:868-918`)

```
nextIndex = currentIndex + 1
lastShownNote = currentBatch[currentIndex]

if (nextIndex < currentBatch.length):
  // 같은 batch 내 다음 음표
  if (wasRetryNote) missedNotes.delete(id)
  setCurrentIndex(nextIndex), playNote
  return

// batch 끝 — setMissedNotes(prev → next):
if (wasRetryNote) next.delete(id)
if (next.size === 0):
  setPhase("success")
  return
result = composeFinalRetryBatch(next, lastShownNote)
if (result):
  setBatchAndKey(result), setCurrentIndex(0)
  if (result.batch.length > 1) setAnsweredNotes([])  // §0.4.1
  playNote(result.batch[0])
```

- batch 끝 시점에 `next` = `missedNotes` 갱신본 — `composeFinalRetryBatch(next, ...)`는 stale state 회피.
- 다음 batch의 `batchSize`도 `getFinalRetryBatchSize(next.size)`로 동적 재계산 (3·5·7).

### 5.6 종료 조건

- `missedNotes.size === 0` → `setPhase("success")`. 게임 클리어.
- `lives === 0` → `setPhase("gameover")`.

---

## §6. lives 정책

### 6.1 초기값

`SUBLEVEL_CONFIGS` (`src/lib/levelSystem.ts:96+`):

| Sublevel | 초기 lives | timeLimit |
|-|-|-|
| 1 | 5 | 7s |
| 2 | 4 | 5s |
| 3 | 3 | 3s |

`MAX_LIVES = sublevelConfig.lives` — 초기값과 회복 상한 동일.

### 6.2 변동 규칙 (메인 + final-retry phase 공통)

- **정답**: 변동 X. `individualStreak += 1`.
  - **3연속 정답** (`newStreak >= 3`): `lives < MAX_LIVES`이면 `lives += 1` (상한 = MAX_LIVES) + `lifeRecovered=true` 1.5초 표시 + streak=0 reset.
- **오답·timeout**: `lives -= 1`. `lives <= 0` → `setPhase("gameover")`. `individualStreak=0`.

### 6.3 phase별 일관성

코드 1057-1063·1126-1131라인 모두 phase 분기 *전에* `setLives` 처리 → final-retry phase에서도 메인 phase와 동일 lives 정책 적용.

---

## §7. N+2 알고리즘

### 7.1 정의

- 메인 phase에서 새 음표 정답 시: `rescheduleAfterCorrect(note, currentTurn)` → 큐 마커 있던 entry의 `due = currentTurn + 2`.
- 마커 없으면 no-op (해석 11=X).

### 7.2 적용 phase

- **메인 phase만**. final-retry phase는 큐 자체 미사용 (rescheduleAfterCorrect 호출 0회).

### 7.3 게임 종료 보장

- N+2 due → 큐 entry는 무한 대기 X. 메인 phase 진행 중 due 도달 시 popDueOrNull로 빠져나옴.
- `markMissed` 직후의 entry는 `MAX_SAFE_INTEGER` due → `rescheduleAfterCorrect`(메인 phase 같은 음표 또 정답)이 호출될 때까지 큐에 남음. 호출되지 않은 채 모든 stage 끝나면 `missedNotes`로 final-retry phase에서 처리.

### 7.4 측정 결과 (`sim.test.ts` 보고서)

- N+2: 압도적 (대부분).
- N+5+: 소수 (큐 충돌 — 같은 turn에 due 도달한 entry 여럿 시 1턴 지연).
- N+1·N+0: 발생 X (현재 정책상 `intervalFor` 미사용, `scheduleRetry` legacy).

---

## §8. §0.1 dedup 정책 (모든 batch 생성 경로 적용 필수)

### 8.1 세 경로 모두 적용

| 경로 | 위치 | dedup 메커니즘 |
|-|-|-|
| **`composeBatch` (메인 phase)** | `NoteGame.tsx:595` | `popDueOrNull(turn, lastShownKey)` + `generateBatch(... prev)` |
| **`composeFinalRetryBatch` (final-retry phase)** | `NoteGame.tsx:658` | 옵션 5 sort (lastShown 다른 ID 우선) + 옵션 7 좁은 예외 (retry 통째 skip) |
| **`generateBatch` (새 음표)** | `NoteGame.tsx` `generateBatch` | 내부 prev 추적 (cross-batch + intra-batch dedup) |

### 8.2 회귀 방지 원칙 (메모리 박힘)

> 향후 batch 생성 경로 신규 추가 시 위 dedup 정책 명시 적용 필수 — §0.1 회귀 방지.

새 batch 생성 함수 도입 시 반드시:
1. `lastShownNote`/`lastShown ID` 비교 입력 받기.
2. retry 음표 ↔ 새 음표 인접 dedup.
3. 새 음표 ↔ 새 음표 인접 dedup (`generateBatch` prev 인자).
4. fuzz 시뮬레이션(`sim.test.ts`)으로 violation 0 검증.

---

## §9. NoteGame.tsx ↔ simulator/game.ts parity

| 함수·메서드 | NoteGame.tsx 줄 | simulator/game.ts 줄 | 비고 |
|-|-|-|-|
| `composeBatch` | 595-642 | 164-195 | sim Lv1~4만 (Lv5+ keySig 미지원) |
| `composeFinalRetryBatch` | 658-704 | 205-249 | 옵션 5 sort + 옵션 7 skip 동일 |
| `getFinalRetryBatchSize` | 580-584 | 143-147 | 1~2=3, 3~4=5, 5+=7 |
| `markMissed` | useRetryQueue.ts:129-149 | retryQueue.ts:38-50 | due 보존 (§4 fix) |
| `rescheduleAfterCorrect` | useRetryQueue.ts:151-165 | retryQueue.ts:52-57 | due = turn + 2 |
| `popDueOrNull` | useRetryQueue.ts:187-214 | retryQueue.ts:69-88 | justAnswered + lastShown skip |
| `resolve` | useRetryQueue.ts:167-178 | retryQueue.ts:59-63 | miss + queue 둘 다 delete |
| `markJustAnswered` | useRetryQueue.ts:180-185 | retryQueue.ts:65-67 | 1턴 pop 제외 마커 |

**회귀 위험 시 양쪽 동시 수정 필수.** 한쪽만 변경하면 sim invariant fuzz 테스트가 production 회귀를 못 잡는다.

### 9.1 sim 미지원 영역

- **Lv5+ keySig** (`generateKeyBatch`): 첫 검증은 Lv1~4 단일 clef에 집중. Lv5+ keySig sim 확장은 별도 작업.
- **타이머 만료**: 오답 응답으로 동등 검증됨 (코드 분기 동일).

---

## §10. 테스트 invariant

`src/lib/simulator/sim.test.ts` 검증 (1만 게임 fuzz):

| invariant | 테스트 | 결과 |
|-|-|-|
| §0.1 dedup violation 0건 | `Lv1~4 × sub1~3 random 70% × 500g/each` | 0건 (검증 완료) |
| `markMissed` due 보존 (§4 fix) | `Lv1~3 random 30% × 1000g`, `max-turns === 0` | 0건 max-turns (회귀 시 무한 대기 → max-turns 발생) |
| `composeFinalRetryBatch` dedup | `final-retry phase violation 0` (Lv1~3 × 300~500g) | 0건 |
| 게임 종료 보장 | `endReason !== "max-turns"` | 모든 시나리오 통과 |
| N+2 우세 | `retryIntervalDist N+2 압도적` | 보고서 출력 |

추가 production 테스트:
- `src/components/NoteGame.test.tsx` — 통합 테스트 (DOM 기반 retry 시나리오).
- `src/components/NoteGame.policy.test.tsx` — 정책 시나리오 A~H.
- `src/hooks/useRetryQueue.test.ts` — hook 단위 테스트.

---

## §11. 자동 검증 시스템 (Step B 구축됨, 2026-05-02)

### §11.1 구성

| 파일 | 역할 |
|---|---|
| `src/lib/simulator/simLogger.ts` | `SimLogger` 인터페이스 + `MemorySimLogger` (테스트) + `FileSimLogger` (대용량 fuzz JSONL append). 14가지 이벤트 종류. |
| `scripts/run-simulation.ts` | Lv1~4 × Sub1~3 × correctRate {0.3·0.5·0.7·0.9} 매트릭스 fuzz. `--games <N>` (default 10000). `tmp/sim-logs/{timestamp}.jsonl` 출력. |
| `scripts/analyze-sim-logs.ts` | JSONL streaming 파싱 → 9 invariant 검출 → `tmp/sim-logs/analysis-report-{timestamp}.md` 자동 생성. |
| `scripts/_polyfills.ts` | vite-node localStorage 폴리필 (NoteGame.tsx 트리에 supabase client.ts 포함). |
| `package.json` | `npm run sim:run` / `sim:analyze` / `sim:test`. |

### §11.2 9 Invariants

| # | 검증 | 위치 |
|---|---|---|
| 1 | due=MAX 영구 잔존 (success 종료 시) | session-end + queue snapshot |
| 2 | composeBatch retryCount + newCount = batchSize | compose-batch payload |
| 3 | retry 음표 위치 = 첫 자리 (idx<retryCount ⇔ isRetry) | note-shown payload |
| 4 | final-retry batchSize = expected (1~2→3, 3~4→5, 5+→7) | compose-final-retry-batch payload |
| 5 | lives 차감 일관성 (wrong=-1, 3-streak=+1) | lives-change payload |
| 6 | missedNotes 추가·제거 일관성 | mark-missed/resolve 추적 |
| 7 | phase 전환 일관성 (playing→final-retry only) | phase-transition payload |
| 8 | final-retry retry vs 새 음표 처리 분리 | answer-correct phase=final-retry |
| 9 | §0.1 dedup (인접 음표 같지 않음) | note-shown.consecutiveViolation |

> **Invariant 10 (queueRef 비동기 stale read)** — sim 환경 검출 불가 (React-only). NoteGame 통합 테스트 별도 § 펜딩 (`PENDING_BACKLOG.md §4 Step B 부수`).

### §11.3 사용

```bash
npm run sim:test          # 1만 게임 fuzz + 분석 + markdown 보고서 (≈5초)
npm run sim:run -- --games 5000   # 게임 수 지정
npm run sim:analyze -- --logs tmp/sim-logs/<file>.jsonl
```

retry 시스템 변경 시 `npm run sim:test` 한 줄로 9 invariants 회귀 자동 검증.

### §11.4 검증 결과 (구축 직후)

- 9984 game × 790,212 events × 9 invariants → 위반 0건.
- JSONL 파일 ~129 MB / 분석 ~1.8s.
- final-retry 진입 1035/9984 (10.4%), gameover 7707, success 2277.

---

## §12. 변경 이력

- **2026-04-29**: §0-1 박힘 (popDueOrNull `lastShown` skip, wasRetry 사각지대 fix, N+2 정확화, simulator 1만 게임 fuzz, commit `4e2b6ef`).
- **2026-05-01**:
  - §1 sound sync (commit `5f62244`).
  - §2 카운트다운 음표 숨김 (commit `58c4aab`).
  - **§4 retry 시스템 통합** (commits `5e37084` `7338406` `eb8b5e2`):
    - `composeBatch` (retry 큐 통합 batch 생성)
    - `missedNotes` Map (sublevel 전체 못 푼 음표)
    - final-retry phase 동적 batchSize (3·5·7)
  - **시뮬레이터 §4 parity** (commit `1215178`) + final-retry dedup fix 옵션 5+7 (commit `509eb37`).
  - §0.1 명세 (commit `cf384ef`).
- **2026-05-02**:
  - §3 단순 fix.
  - 카운트다운 애니메이션 매끄러움 (commit `6283ad9`).
  - swipe 모달 controlled state machine (modal → countdown → note) (commits `941b04f`·`6f5290f`·`c1b9d7c`).
  - batchSize=1 stage 정책 (Lv 1~4) (commit `87f3aaf`).
  - **§4 Step C — debug trace cleanup** (commit `c77492f`): `retryQueueDebug.ts` 삭제, `[§0.1 DEBUG]`/`[§4 BUG TRACE]` 마커 제거, sr-only 테스트 인프라 span만 보존.
  - **§4 Step D — 본 명세 박힘**.
  - **§4 Step B — 자동 검증 시스템 구축**: `simLogger.ts` + `scripts/run-simulation.ts` + `scripts/analyze-sim-logs.ts` + 9 invariants + `npm run sim:test` 파이프라인. 9984 game × 790,212 events 위반 0건 검증.
