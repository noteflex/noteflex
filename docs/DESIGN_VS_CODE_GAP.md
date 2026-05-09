# 설계 문서 vs 구현 코드 차이 분석

> **작성일**: 2026-04-28
> **비교 대상**:
> - **설계 문서**: 사용자 작성 PDF (6페이지) — 2026-04-28 작성
> - **구현 분석**: Claude Code가 코드 분석으로 생성한 docs/ 8개 문서 — 2026-04-28 작성
> **목적**: 설계 의도와 실제 구현 간 차이를 식별해 출시 전 정렬

---

## 평가 범례

| 마크 | 의미 |
|---|---|
| ✅ 일치 | 설계와 코드가 정확히 일치 |
| ⚠️ 부분 일치 | 큰 틀은 같지만 세부 차이 있음 — 출시 전 검토 권장 |
| ❌ 불일치 | 명확하게 다름 — 결정 필요 |
| 🔴 미구현 | 설계엔 있는데 코드에 없음 |
| 💡 추가 구현 | 설계엔 없는데 코드에 있음 — 의도 확인 필요 |
| 🐛 버그 | 사용자 검증으로 확인된 동작 이슈 |

---

## 1. 게임 규칙 — 정답 정책

### 1.1 "맞을 때까지 음표 유지" ✅

| 항목 | 설계 (PDF §3.1.가~다) | 구현 (`NoteGame.tsx:762-804`) | 평가 |
|---|---|---|---|
| 오답 시 음표 유지 | "음표는 맞출 때까지 계속 유지되며" | currentIndex 변경 없음 + setTimerKey++ | ✅ |
| 오답 시 라이프 차감 | "해당 음표를 틀릴 때마다 생명 수는 줄어든다" | `lives--` (음표당 무제한 차감) | ✅ |
| 타이머 만료 = 오답 | "타이머가 다 지날 때까지 못 맞출 경우 오답으로 처리하고" | handleTimerExpire가 오답과 동일 분기 | ✅ |
| 타이머 만료 후 음표 유지 | "맞출 때까지 해당 음표를 유지한다" | 같은 자리 유지 | ✅ |
| 타이머 리셋 | "타이머가 끝나면 다시 리셋 후 다시 시작한다" | setTimerKey++ | ✅ |

### 1.2 NOTE COUNT 처리 ✅

| 항목 | 설계 (§3.1.라) | 구현 | 평가 |
|---|---|---|---|
| 틀린 음표는 카운트 차감 안 함 | "맞춘 후 NOTE COUNT를 하여 총 NOTE의 수가 틀린 음표의 수로 인해 줄어들지 않는다" | 정답 시에만 currentIndex++ + setProgress++ | ✅ |
| 정답 시에만 카운트 차감 | "음표를 맞춘 경우에 총 NOTE 수에서 차감한다" | 정답 분기에서만 진행 | ✅ |

### 1.3 시도 횟수 모두 기록 (옵션 B) ✅

| 항목 | 설계 (§3.1.마) | 구현 | 평가 |
|---|---|---|---|
| 매 시도마다 기록 | "한 음표의 시도 횟수의 모든 기록을 저장하여 분석 데이터에 활용" | `logNote()` 호출 — 정답·오답·타임아웃 모두 매번 INSERT | ✅ |
| 정답률·오답률 계산 | "각각의 음정의 정답률과 오답률을 정확하게 계산하여 수치에 반영" | `user_note_logs` raw 데이터 + 일일 배치로 mastery 갱신 | ✅ |
| 반응속도 기록 | "반응 속도까지 계산하여 해당 음을 보는 속도가 향상되고 있는지까지" | `response_time` 컬럼 (초, 소수점 2자리) | ⚠️ 정밀도 낮음 (아래 §7 참조) |

---

## 2. 게임 구성

### 2.1 레벨 7개 × 단계 3개 = 21단계 ✅

| 항목 | 설계 (§3.2.가, 사) | 구현 | 평가 |
|---|---|---|---|
| 7 레벨 × 3 서브레벨 | "총 7레벨로 구성, 각 레벨 당 3단계 포함, 총 21개의 단계" | `MAX_LEVEL=7, MAX_SUBLEVEL=3, TOTAL_SUBLEVELS=21` | ✅ |
| 한 게임 세션 = 3 STAGE | "한 게임 세션에는 3개의 STAGE가 있다" | ✅ Lv5~7: Sub1·2·3 = 3 stage / Lv1~4: Sub1=4, Sub2=5, Sub3=4 stage (batchSize=1 워밍업 단계 추가 — 2026-05-02 사용자 결정) | ⚠️ |

**설계 변경 (의도적)**: Lv1~4 서브레벨에 batchSize=1 워밍업 stage 추가 (2026-05-02, commit 400dca2).
- Sub 1: 3→4 stages (batchSize=1 × 3개 + batchSize=3)
- Sub 2: 3→5 stages (batchSize=1 × 3개 + batchSize=3·5)
- Sub 3: 3→4 stages (batchSize=1 × 1개 + batchSize=3·5·7)
- Lv5~7: 변경 없음 (batchSize=3~7 전용, 조표 시스템 특성)

→ **결정 완료**: 의도된 설계 확장. 설계 §3.2.가 "3 STAGE" 원칙은 Lv5~7에서 유지.

### 2.2 레벨별 음역대 ✅

| 설계 (§3.2.나) | 구현 (`NoteGame.tsx:39-72, getNotesForLevel`) | 평가 |
|---|---|---|
| 1: 높은음자리표 | `TREBLE_NOTES` (C4~C6) | ✅ |
| 2: 낮은음자리표 | `BASS_NOTES` (C2~C4) | ✅ |
| 3: 덧줄 포함 높은음자리표 | `ADV_TREBLE_NOTES` (C3~C7) | ✅ |
| 4: 덧줄 포함 낮은음자리표 | `ADV_BASS_NOTES` (C1~C5) | ✅ |
| 5: 샵 그랜드 오선지 | `SHARP_KEYS` (G/D/A/E/B/F#/C#) | ✅ |
| 6: 플랫 그랜드 오선지 | `FLAT_KEYS` (F/Bb/Eb/Ab/Db/Gb/Cb) | ✅ |
| 7: 샵+플랫 그랜드 | 둘 다 + 동등 확률 | ✅ |

### 2.3 단계별 난이도 (타이머·생명) ✅

| 항목 | 설계 (§3.2.다) | 구현 (`SUBLEVEL_CONFIGS`) | 평가 |
|---|---|---|---|
| 1단계 타이머 | 7초 | 7초 | ✅ |
| 2단계 타이머 | 5초 | 5초 | ✅ |
| 3단계 타이머 | 3초 | 3초 | ✅ |
| 1단계 생명 | 5개 | 5 | ✅ |
| 2단계 생명 | 4개 | 4 | ✅ |
| 3단계 생명 | 3개 | 3 | ✅ |

### 2.4 STAGE 음표 배치 (1·3·5·7개) ✅ (2026-04-29 결정)

| 항목 | 설계 (§3.2.다) | 구현 | 평가 |
|---|---|---|---|
| 음표 배치 단위 | 1 / 3 / 5 / 7개 STAGE | ✅ Lv1~4: Sub1=1·1·1·3 (4st), Sub2=1·1·1·3·5 (5st), Sub3=1·3·5·7 (4st) — 2026-05-02 확정 | ✅ |
| batchSize=1 stage 워밍업 추가 | (설계엔 없음) | 💡 Lv1~4에 batchSize=1 단계 추가 (Sub1·2: totalSets 5·6·7, Sub3: totalSets 7만) | 💡 추가 구현 |
| 한 STAGE 동시 표시 수 | "음표가 하나 씩 3개가 배치되는 STAGE는..." | ✅ batchSize=1이면 1개씩 순차, batchSize=3이면 3개 동시 (batch mode) — 2026-04-30 구현 | ✅ |

### 2.5 SUCCESS / FAIL 메시지 ⚠️

| 항목 | 설계 (§3.2.바) | 구현 | 평가 |
|---|---|---|---|
| 게임 SUCCESS + 단계/레벨 Clear | "단계 Clear 성공! 다음 단계로 진행 버튼, 이번 단계 다시 수행 버튼" | `SublevelPassedDialog` 존재 | ✅ |
| 게임 SUCCESS + 단계/레벨 Clear 못함 | "Success 메시지와 함께 다시 플레이 버튼" | `MissionSuccessModal` (별개?) | ⚠️ 코드 확인 필요 |
| 게임 FAIL | "다시 도전하기 버튼 + 어떤 음을 많이 틀렸는지 메시지에 보여주기" | `GameOverDialog` 존재 / 약점 음표 표시 여부 미확인 | ⚠️ |
| 레벨선택으로 가는 버튼 (Success/Fail 모두) | "Success/Fail 모두 메시지 상단에 레벨선택 화면으로 가능 버튼" | (코드 확인 필요) | ⚠️ |
| Clear 상태 유지 (재시도 시) | "한 번 단계 또는 레벨을 Clear한 경우에는 해당 단계 또는 레벨을 다시 수행 시 실패하여도 Clear 상태는 유지" | `record_sublevel_attempt` RPC가 `passed=true`를 한 번 set 후 유지 | ✅ |

### 2.6 단계 Clear 기준 ✅ (2026-04-29 결정)

| 항목 | 설계 (§3.2.사.A) | 구현 (`PASS_CRITERIA`) | 평가 |
|---|---|---|---|
| 정답률 | 80~85% 이상 | 85% (0.85) ✅ (2026-04-30) | ✅ |
| 반응속도 | 타이머 시간의 30~40% 이내 | 35% (`MIN_AVG_REACTION_RATIO: 0.35`) ✅ (2026-04-30) | ✅ |
| 수행 횟수 | 7~10번 이상 | 10회 이상 (`play_count >= 10`) ✅ (2026-04-30) | ✅ |
| 최대 연속 정답 | (설계엔 없음) | 5회 이상 (`best_streak >= 5`) | 💡 추가 구현 |

### 2.7 레벨 Clear 기준 ✅

| 항목 | 설계 (§3.2.사.B) | 구현 | 평가 |
|---|---|---|---|
| 레벨 Clear = 모든 단계 Clear | "모든 각 레벨의 모든 단계 Clear 여부를 확인" | `getNextSublevel()` 다음 레벨 진입 | ✅ |
| 7레벨 = 마지막 | "마지막 단계로 다음 단계가 없음" | `getNextSublevel(7,3)=null` | ✅ |
| 7레벨 Clear 축하 메시지 | "모든 레벨을 Clear 축하 메시지" | `MissionSuccessModal` | ⚠️ 코드 확인 필요 |
| Special 게임 (모든 단계 후) | "어떤 식으로 제공할지 고민 필요" | 🔴 미구현 | 결정 보류 |

---

## 3. 게임 내 로직

### 3.1 게임 시간 (1:30~3:00) ⚠️

| 항목 | 설계 (§3.3.가) | 구현 | 평가 |
|---|---|---|---|
| 한 세션 1:30~3:00 | "기본 1:30~3:00 사이" | Sub1 ~1:53, Sub2 ~2:00, Sub3 ~1:59 (08_LOGIC §1.3 기준) | ✅ |
| 레벨이 높을수록 길게 | "낮은 레벨/단계에서 높은 레벨/단계로 올라감에 따라 한 세션 당 시간을 늘려간다" | sublevel별로 늘어나지만 레벨별로는 동일 (Lv1·Sub1 = Lv7·Sub1 시간 같음) | ⚠️ |

### 3.2 화면 로드 (3-2-1 카운트다운) ⚠️

| 항목 | 설계 (§3.3.나) | 구현 | 평가 |
|---|---|---|---|
| 3-2-1 카운트다운 | "3-2-1 카운트 다운을 보여준 후" | `CountdownOverlay` ✅ | ✅ |
| 카운트다운 끝남 = 음표 표시 + 사운드 | "카운트가 끝남과 동시에 바로 음표가 보여지고 해당 음표의 소리가 나온다" | handleCountdownComplete에서 첫 음표 표시 + playNote | ✅ |
| 버퍼링 방지 | "카운트다운 소리와 겹치거나 버퍼링 등의 문제가 있을 수 있으므로 해당 문제가 발생하지 않도록 해야 한다" | ✅ ensureAudioReady() → playNote() 순서 보장 (5f62244) + FIRST_NOTE_GRACE_MS=300 (§3.12 참조) | ✅ |
| 카운트다운 중 음표·조표 숨김 | (설계 의도 포함) | ✅ showCountdown guard — targetNote·batchNotes·keySharps·keyFlats 모두 null/undefined (commits 58c4aab·c1b9d7c·717797e) | ✅ |
| 빨간색 표시 | "정답을 맞춰야 하는 음표이므로 빨간색으로 바로 표시" | `targetNote`에 빨강 적용 (코드 확인 필요) | ⚠️ |

### 3.3 음표 색깔 구분 ✅

| 색깔 | 설계 (§3.3.라) | 구현 | 평가 |
|---|---|---|---|
| 빨강 | 현재 맞춰야 하는 음표 | targetNote 강조 | ✅ |
| 회색 | 정답 맞춘 후 history | answeredNotes 회색 | ✅ |
| 검정 | 대기 중인 음표 (3·5·7개 동시 display) | batch 모드에서 미답 음표 | ✅ |

### 3.4 음표 사운드 ✅

| 항목 | 설계 (§3.3.마) | 구현 | 평가 |
|---|---|---|---|
| 그랜드 피아노 사운드 | "그랜드 피아노 소리를 이용해" | Tone.js + 피아노 샘플 | ✅ |
| 음표 표시와 동시 재생 | "display됨과 동시에(Sync를 정확히 맞춰) 소리를 들려준다" | playNote 호출 (정확한 sync 검증 ❌) | ⚠️ 검증 필요 |

### 3.5 N+2 로직 — 레벨 1~4 ⚠️

| 항목 | 설계 (§3.3.바.A) | 구현 | 평가 |
|---|---|---|---|
| 틀린 음표 다음 다음 음표에 재출제 | "N+2 로직을 반영해 틀림 노트를 다음 다음 음표에 다시 DISPLAY" | due = currentTurn + 2 (markMissed → rescheduleAfterCorrect) | ✅ |
| STAGE 끝나도 큐 이어짐 (Lv1-4) | "이전 STAGE에서의 N+2에 Queue에 적재된 음표를 이어서 보여준다" | Lv1-4: Stage 전환 시 reset 안 함, 큐 유지 | ✅ |

### 3.6 N+2 로직 — 레벨 5~7 ✅

| 항목 | 설계 (§3.3.바.B) | 구현 | 평가 |
|---|---|---|---|
| Lv5+ STAGE 전환 시 큐 리셋 | "STAGE가 바뀌면 이전 STAGE에서 N+2로직에 의해 Queue에 적재된 음표를 보여주지 않는다. 해당 Queue를 리셋해야함" | Lv5+ Stage 전환 시 `retryQueue.reset()` 호출 | ✅ |
| 같은 조표 연속 학습 (오답 多 시) | "혹은 해당 STAGE에서 틀린 음이 2개~3개 이상일 경우 N+2 로직을 그대로 적용하여 다음 STAGE에서도 동일한 조표의 문제로 적용하는 방안" | ✅ 구현 완료 (2026-04-30) — Lv5+에서 stage 전환 시 retryQueue.size ≥ 2면 다음 stage 동일 조표 유지 | ✅ (commit 6c1a7e8) |

### 3.7 버튼 Swipe (Lv5+) ✅

| 항목 | 설계 (§3.3.사) | 구현 | 평가 |
|---|---|---|---|
| #조표 = 위로 올리기 | "#조표인 경우 버튼을 위로 올리고" | `dy < -56px` → commit("up") | ✅ |
| b조표 = 아래로 내리기 | "b인 경우 버튼을 아래로 내려" | `dy > +56px` → commit("down") | ✅ |
| 자연음 = 일반 클릭 | (스와이프 미달 시 자연음) | tap 또는 미달 → commit(null) | ✅ |

### 3.8 음표 Display 비율 ❌🐛

| 항목 | 설계 (§3.3.아) | 구현 | 평가 |
|---|---|---|---|
| Lv5~7 골고루 비율 | "높은음자리표, 낮은음자리표, 조표가 섞여 있어 해당 경우의 수를 모두 반영" | ✅ batchSize>1: 매 batch 두 자리표 모두 등장 보장 + treble:bass 50:50 평균 (2026-04-30) | ✅ |
| 6:4 / 4:6 / 7:3 / 3:7 비율 | (사용자 검증 시 명시) | ✅ batchSize 1→3→5→7 = 30%→40%→60%→70% 조표 (2026-04-30, commit bb062c3) | ✅ |
| 한 STAGE 길게 + 두~세 번 N+2 | "Lv5~7 STAGE를 Lv1~4보다 더 길게 조정해 하나의 조표를 이용해 두 번 N+2로 인해 많으면 세 번 정도 학습할 수 있게 한다" | 같은 stage 안에서 keySig 고정 (3b34405 commit) | ✅ |

→ **버그 확인됨 (사용자 검증)**: Lv5+에서 조표 붙은 음표 비율 부족 → 스와이프 인터랙션 검증 자체가 막힘

### 3.9 게임 화면 단순화 ⚠️

| 항목 | 설계 (§3.3.자) | 구현 | 평가 |
|---|---|---|---|
| 화면 단순화 | "게임에 관련 없는 내용은 없애고 최대한 오선지와 음표에 집중할 수 있도록" | 현재 GameHeader + 정답 배지(admin) + 진행 라벨 + 오선지 + 버튼 | ⚠️ 정비 필요 |
| 0.01초도 지연 없게 | "0.01초(인간이 느낄 수 있는 최소한의 시간)의 지연도 발생하면 안 된다" | 🔴 측정·최적화 미완 | 🔴 (펜딩 §7) |
| "재도전" 마크 삭제 | "현재 구현돼 있는 기능 중 N+2의 음표가 나올 때 상단에 보이는 '재도전' 마크도 삭제 필요. 무의미한 기능임" | 현재 코드: `🔁 재출제` 배지 표시됨 | ❌ 사용자 의도 = 삭제 |

→ **결정 필요**: 재출제 배지 삭제할지

### 3.10 N+2 재출제 즉시 등장 버그 ✅ (1차 2026-04-29 `bb692cd` + 2차 2026-04-30 `4e2b6ef` 전역 dedup)

**사용자 검증으로 확인된 동작 이슈**:

> "첫 번째 음표를 2번 틀린 후 정답을 맞추면 바로 다음 음표가 같은 음표가 나오네"

설계 의도 (2026-04-30 재확정): "같은 음표가 **연속으로 절대 안 나오게**" (전역). 1턴 지연 ~5% 허용.

**진짜 원인** (분석 결과 추정과 다름): retry queue의 due 계산은 정상이었음. `generateBatch`의 batch 내부 인접 dedup이 cross-batch에 적용 안 됐고, batchSize=1 stage(Lv1~4 초반)에서 매 advance마다 새 batch를 생성하므로 `batch[0]`이 직전 정답 음표와 동일하게 픽 가능. mastery 가중치가 방금 틀린 음표를 더 자주 픽하도록 편향시켜 확률 증가.

**1차 수정 (`bb692cd` 2026-04-29)**:
- 옵션 D — `generateBatch`/`generateKeyBatch`에 `lastShownNote` 인자 추가, batch[0]이 직전 음표와 같은 clef·key·octave면 재픽
- 옵션 B — `useRetryQueue.markJustAnswered(note, currentTurn)` 추가, popDueOrNull이 markedTurn~markedTurn+1 동안 해당 id pop 제외 (이중 안전장치)
- 정답 처리 시 `advanceToNextTurn` 직전에 `markJustAnswered` 호출

**2차 수정 (`4e2b6ef` 2026-04-30 전역 dedup 확장)**:
- `popDueOrNull(turn, lastShownNote?)` 시그니처 확장 — due 후보 중 lastShownNote와 같은 ID skip. 모든 후보가 같으면 null → 일반 batch[0] (이미 dedup됨) fallback (1턴 지연).
- `lastShownNoteRef` ref + 4개 prepareNextTurn 호출 지점 모두에 lastShownNote 명시 전달.
- **wasRetry 사각지대 fix**: retry 답한 음표가 `currentBatch[currentIndex]`와 같으면 일반 advance(false) — batch 음표 1개 자동 통과.
- **N+2 정확화**: `rescheduleAfterCorrect`를 advance 전에 호출 (구 동작은 advance 후 호출이라 turn += 1 영향으로 due=N+3이었음). 이제 due=N+2 정확. 03_GAME_LOGIC.md §3.2 표 정정.

**검증 도구 (`src/lib/simulator/`)**:
- React-free game logic 시뮬레이터. Lv1~4 × sub1~3 random 70% × 500g/each = 18000 games, invariant 위반 0건. delayedFallback 16.64% (1턴 지연 fallback 추정치 — 정확한 측정엔 lastShown 동일 due 카운팅 보강 필요). retry 간격 분포 N+2: 1976 (압도적), N+5+ 소수.

**테스트**: 304/304 PASS. 새로 추가:
- `useRetryQueue.test.ts` 5케이스 (popDueOrNull lastShown skip)
- `NoteGame.consecutive.test.tsx` 9케이스 (전역 dedup invariant)
- `NoteGame.invariants.test.tsx` 5케이스 (호출 횟수 회귀 방지)
- `src/lib/simulator/sim.test.ts` 10케이스 (1만 게임 fuzz + 정량 보고서)

### 3.11 GrandStaffPractice UI 음표 history·색깔·크기·잘림 🐛 → 4 step 계획 수립 (2026-05-01 Opus 분석)

**사용자 발견 이슈 3개**:
1. **색깔 불일치** — 악보에서 target 음표가 빨간색이어야 하나 black으로 표시되는 경우 있음
2. **history 누적 X** — batchSize=1 stage에서 이전 음표들이 악보에 남아야 하는데 매 set 완료 시 즉시 초기화됨
3. **음표 크기·잘림** — history 음표가 작게 표시되거나 viewBox 경계에서 잘림

**Opus 분석 결과 (GrandStaffPractice.tsx 556줄 전체 추적)**:

*Gap 1 — 색깔*: `TARGET_COLOR="#b91c1c"` (red), `HISTORY_COLOR="#1c1917"` (black), `ANSWERED_COLOR="#9ca3af"` (gray) — 모두 인라인 SVG 속성으로 분기됨. 현재 구현에서 `batchNotes[0]`이 target일 때 색깔 분기는 올바름. 단 history mode(batchNotes 없음)에서 legacy 렌더링 경로가 별도 존재 — 두 경로가 분리돼 있어 일관성 확인 필요.

*Gap 2 — history 누적*: `handleSetComplete`가 `setAnsweredNotes([])` 호출. batchSize=1, notesPerSet=1인 stage(Sub1 1단계·2단계, Sub2 1단계)에서는 매 음표 정답 후 set 완료가 되어 history 즉시 초기화. 결과적으로 batchSize=1 구간에서 history 음표 0개 — 설계 의도("이전 음표들이 남아있어야 한다")와 불일치.

*Gap 3 — 크기·잘림*: `noteSpacing` 계산에서 `gapCount`가 level 기반(Lv5+=6, 나머지=4)으로 계산됨 — batchSize가 아닌 level 기반이라 많은 history 음표가 쌓일 때 간격 계산 오차 가능. 현 viewBox=800 기준 최대 7개 history + target = 8개 음표가 들어갈 때 spacing 계산 미검증.

**4 step 구현 계획**:
- **Step 1 (30분)**: 색깔 분기 두 경로 통일 — history/batch 모드 모두 동일한 색깔 상수 사용 확인
- **Step 2 (2~3시간)**: history 누적 fix — `handleSetComplete`의 `setAnsweredNotes([])` 를 batchSize=1 stage에서 조건부로 실행. stage 전환 시에만 초기화, 동일 stage 내 단일 음표 정답은 history 유지. 최대 누적 개수(예: 7) 초과 시 가장 오래된 것부터 제거.
- **Step 3 (1~2시간)**: 크기 계산 fix — gapCount를 batchSize 기반으로 전환, history 최대치를 반영한 viewBox 여백 확보
- **Step 4 (30분)**: 잘림 방지 — viewBox 좌우 padding 보장, 마지막 음표가 오른쪽 경계를 넘지 않도록 clamp

**예상 총 소요**: 4~6시간 (§0.4 구현 세션)

### 3.12 카운트다운 후 첫 음표 버퍼링 + Sub3 즉시 타임아웃 ✅ (2026-05-01, commit `eac606a`)

**버그**: 카운트다운(3초) 완료 직후 game state가 활성화돼 첫 음표 타이머가 즉시 시작 — Sub3(3초 제한)에서 카운트다운 3초가 elapsed로 잡혀 첫 tick(50ms)에 timeout expire.

**수정**:
- `FIRST_NOTE_GRACE_MS = 300` 상수 추가 (NoteGame.tsx)
- `handleCountdownComplete` 내부에 `setTimeout(..., 300)` 래퍼 추가
- grace setTimeout 내부에서 `setTimerKey(prev => prev+1)` 호출 → CountdownTimer의 `useEffect([resetKey])`가 `startRef.current = Date.now()` 리셋
- `noteStartTime.current` 설정도 grace 내부로 이동

**테스트 (4개, vi.useFakeTimers)**:
1. 카운트다운 직후 버튼 여전히 disabled (grace 중)
2. 299ms → disabled, +1ms=300ms → enabled
3. Sub3: grace+50ms 시점 playWrong 미호출
4. Sub3: grace 후 full 3초 타이머 — 2.9초 미만료, 3.05초 만료

337/337 PASS.

### 3.13 §4 Retry 시스템 (final-retry phase + composeBatch) ✅ (2026-05-01 밤)

설계 §3.3.바에 N+2 로직이 명시돼 있으나 final-retry phase(배치 완료 후 잔여 retry 처리)는 설계엔 없음. 필요성이 구현 중 발견되어 추가.

| 항목 | 구현 | 평가 |
|---|---|---|
| composeBatch (retry 큐 통합) | retry queue popDueOrNull + generateBatch 조합, lastShownNote dedup 전 경로 적용 | 💡 설계 확장 |
| missedNotes Map | 음표별 오답 횟수 추적 → final-retry batch 크기 결정 (3·5·7) | 💡 설계 확장 |
| final-retry phase | 배치 완료 + missedNotes 비어있지 않으면 진입, 동적 batchSize (3·5·7) | 💡 설계 확장 |
| 시뮬레이터 parity | composeFinalRetryBatch dedup (옵션 5 sort + 옵션 7 retry skip) — commits 1215178·509eb37 | 💡 |

commits 5e37084·7338406·eb8b5e2·1215178·509eb37. 373/373 PASS.

### 3.14 Swipe 모달 Controlled 상태 머신 ✅ (2026-05-02)

Lv5+ 첫 진입 시 "조표 입력 사용법" 모달 → 카운트다운 → 첫 음표 순서 보장.

| 항목 | 구현 | 평가 |
|---|---|---|
| showSwipeTutorial → showCountdown 순서 | hasSeen=false면 모달 먼저, 닫은 후 카운트다운 시작 | 💡 설계 확장 |
| 모달 중 timer paused | showSwipeTutorial guard — timer/NoteButtons/정답 라벨/음표/조표 모두 비활성 | ✅ |
| 모달·카운트다운 중 조표 숨김 | keySharps·keyFlats props에 !(showCountdown || showSwipeTutorial) guard 추가 — commit 717797e | ✅ |
| 모달·카운트다운 중 lives 보호 | timer paused + disabled → 시간 경과로 인한 오답 처리 X | ✅ |

commits 941b04f·6f5290f·c1b9d7c·717797e. 373/373 PASS.

### 3.15 GrandStaffPractice batchSize 렌더링 fix ✅ (2026-05-02, commit 87f3aaf)

| 항목 | 이전 | 이후 | 평가 |
|---|---|---|---|
| batchSize=3 균등 분포 | gap=batchSize+1=4 일치 X 케이스 존재 | gap=batchSize+1=4 정확 (첫 음표 spacing 내부 기준) | ✅ |
| batchSize=7 잘림 방지 | 잘림 발생 가능 | no-clip 보장 | ✅ |
| 세부 시각 조정 | — | 출시 전 UI 작업 시점 펜딩 (PENDING_BACKLOG §6.4) | 🟡 |

---

## 4. 배치고사 시스템 🔴

### 4.1 설계 (§4) vs 구현

| 항목 | 설계 | 구현 |
|---|---|---|
| 배치고사 정의 (Lv1~7 종합 게임) | ✅ 명시 | 🔴 미구현 |
| 미가입자 / 구독자 구분 | ✅ 명시 | 🔴 미구현 |
| 티어/듀오링고 등급 시스템 | ✅ 명시 | 🔴 미구현 |
| 일정 기간마다 배치고사 응시 | ✅ 명시 | 🔴 미구현 |
| 이용 횟수(스트릭)·서비스 이용 정보 분석 | ✅ 명시 (현재 티어 유지/하락 결정) | 🔴 미구현 |
| 구독자 — 등급 결정 + 혜택 | ✅ 명시 | 🔴 미구현 |
| 미가입자 — 결과 보고서로 가입 후킹 | ✅ 명시 | 🔴 미구현 |

→ **전부 출시 후 Phase 7 펜딩** (`PENDING_BACKLOG.md §2`)

### 4.2 결정 필요 항목 (설계에 명시된 보류 사항)

- 티어 상위 그룹 → 어떤 혜택?
- 티어 하위 그룹 → 강등 등 불이익?
- 티어는 반드시 배치고사로만 오를 수 있는지?
- 최종 티어 도달자 → 굿즈 또는 무료 이용?

---

## 5. 사용자 등급별 권한 ❌ → 5/9 결정 완료, 코드 정정 필요

### 5.1 설계 (§5) vs 구현 vs 5/9 결정

| 등급 | 5/9 결정 | 현재 코드 | 평가 |
|---|---|---|---|
| **Guest (미가입자)** | Lv1 Sub1만, 3회/일 | `level === 1` (Sub1~3 모두 허용) | ❌ Sub1 한정 추가 필요 |
| **Free (가입자)** | Lv1~5 Sub1만 순차, 7회/일 | Lv1·2 전체 + Lv3·4 Sub1 (9 sublevel) | ❌ 완전 재작성 필요 |
| **Premium** | 전 21단계 순차 (Sub1→2→3), 무제한 | pro = 21단계 전체 | ✅ (순차 체크 추가 필요) |

**코드 정정 대상** (`src/lib/levelSystem.ts:281-302`):
```typescript
// 현재 (잘못됨)
if (tier === "guest") { return level === 1; }
if (tier === "free") {
  if (level <= 2) return true;
  if ((level === 3 || level === 4) && sublevel === 1) return true;
  return false;
}

// 정정 목표
if (tier === "guest") { return level === 1 && sublevel === 1; }
if (tier === "free") { return level <= 5 && sublevel === 1 && /* 이전 Sub1 통과 체크 */; }
```

→ **Group A 작업** 포함 (2026-05-09 결정)

### 5.2 광고 시청 정책 🔴

| 항목 | 설계 (§5.가, 나) | 구현 | 평가 |
|---|---|---|---|
| 미가입자 게임 시 광고 | ✅ 명시 | ✅ AdBanner (guest → 광고 노출) + AdInterstitialModal (3게임마다) | ✅ |
| 가입자 게임 시 광고 | ✅ 명시 | ✅ AdBanner free → 광고 노출 | ✅ |
| 게임 직후 보고서 광고 | ✅ 명시 (전면 광고 + 배너) | ✅ AdInterstitialModal (3게임마다 + 잠금 해제) | ✅ |
| Fail 시 약점 음표 보여주기 + 광고 | ✅ 명시 | 🔴 미구현 (약점 표시도 미구현) | 펜딩 §3.5 |
| 게임 중 광고 X | ✅ 명시 (집중력 방해 방지) | ✅ NoteGame 실행 중 AdBanner 배치 없음 | ✅ |
| 블로그 목록/글 사이드바 + in-feed | 미명시 (확장 배치) | ✅ Blog목록 좌/우 sticky + in-feed 6개마다 + BlogPost 좌/우 sticky (2026-05-04) | ✅ |
| 메인 페이지(/) 광고 | ❌ 정책상 광고 X (메모리 #21) | 🔴 Index.tsx L343 `<AdBanner>` 존재 — i18n sprint에서 제거 | ⚠️ |
| 대시보드 라우트 명 | `/dashboard` (§13.2·메모리 #21) | ✅ `/dashboard` + Dashboard.tsx 리네임 완료 (2026-05-04) | ✅ |
| 대시보드 잠금 (가입자) | ✅ 명시 ("간략 보고서 외 잠금") | 🔴 — 현재 free도 모든 탭 접근 가능 | ⚠️ |

### 5.3 프리미엄 권한 ⚠️

| 항목 | 설계 (§5.다) | 구현 | 평가 |
|---|---|---|---|
| 모든 기능 사용 | ✅ | tier='pro' = 21단계 | ✅ |
| 배치고사 가능 | ✅ | 🔴 미구현 | 펜딩 |
| 광고 없음 | ✅ | ✅ `getUserTier === "pro"` → AdBanner null 반환 (Premium 자동 차단) | ✅ |
| 랭킹 등록 | ✅ | 🔴 미구현 | 펜딩 |

---

## 6. 구독 이용료 ⚠️

| 항목 | 설계 (§6) | 구현 | 평가 |
|---|---|---|---|
| 월 구독료 | $2.99 | $2.99 (Sandbox) | ✅ |
| 연 구독료 | $35.88 → $24.99 (약 30% 할인) | 🔴 Production 상품 ID 미설정 | 결정 필요 |

→ **결정 필요**: 연 $24.99로 확정 → Paddle Production에 등록 → Vercel 환경변수 갱신

---

## 7. 성능·정밀도 🔴

### 7.1 설계 (§3.3.자, §3.1.마) vs 구현

| 항목 | 설계 | 구현 | 평가 |
|---|---|---|---|
| 0.01초 지연 없음 | "0.01초(인간이 느낄 수 있는 최소한의 시간)의 지연도 발생하면 안 된다" | ✅ `performance.now()` 전환 완료 (2026-05-03, 15 사이트: NoteGame 12 + CountdownTimer 3). DiagnosisTab·PremiumDialog 2 사이트는 절대 시간이라 Date.now() 유지 | ✅ |
| 음표 출력 속도 | "음표가 나오는 속도, 해당 음표의 실제 소리가 나오는 속도, 정답을 클릭 또는 swipe하는 반응 속도 등등" | (측정·최적화 미완) | 🔴 |
| 반응 속도 정밀 분석 | "반응속도까지 계산하여 해당 음을 보는 속도가 향상되고 있는지까지" | response_time 초 단위 (소수점 2자리 = 10ms 정밀도) | ⚠️ |

→ **펜딩 §7 (성능·정밀도) 우선순위 매우 높음** — 설계 문서가 "가장 중요한 키포인트"라고 명시

### 7.2 사용자 강조 (별도 첨부 기획서)

설계 PDF 외 첨부된 "앱 성능 극한 최적화 가이드" 0.00000001초 단위 정밀도 요구. `performance.now()`, useRef, requestAnimationFrame, Web Worker 등 권장 — 모두 미적용.

### 7.3 §7.3 Calibration ❌ → 분할 진행 박힘 (Opus 분석 2026-05-02)

| 항목 | 상태 |
|---|---|
| 사양 | `PENDING_BACKLOG.md §7.3-A~E` 박힘 (4 sub-step + 11 Q 결정 시트 + 결합 영역 + 코드 영향 + 위험) |
| 구현 | **§7.3.2~§7.3.5 ✅** + UX fix (5초, 버튼 primary) + device 자동 재측정 ✅ + A2 이벤트 로깅 ✅. PENDING: speed bonus 재튜닝 (출시 후), false positive 분석 (출시 후), §8.1 통합 분석 대시보드 (출시 후 Phase 7-A) |
| 진행 흐름 | ~~§7.1~~ ✅ → ~~§7.3.1~~ ✅ → ~~§7.3.2~~ ✅ → ~~§7.3.3+§7.10.2~~ ✅ → ~~§7.3.4~~ ✅ → ~~§7.3.5~~ ✅ → ~~device 감지 fix~~ ✅ → §3.5 약점 음표 또는 §7.10.3 |
| 결합 위험 | §7.3 완료. |

→ **다음 진입점**: §3.5 약점 음표 또는 §7.10.3

---

## 8. 화면 로드 / 초기 음표 표시 ⚠️

### 8.1 설계 (§3.3.나)

> "카운트다운 소리와 겹치거나 버퍼링 등의 문제가 있을 수 있으므로 해당 문제가 발생하지 않도록 해야 한다."

### 8.2 사용자 메모리 — 알려진 우려

> "Lv 7-3 (3초 제한): 같은 음표를 3초 안에 못 맞추면 무한 반복하다 라이프 다 까임. 첫 번째 나오는 음은 모달이 닫히거나 화면 카운트다운이 끝남과 동시에 바로 확인되어야 하는데 버퍼링이 조금이라도 걸리면 답이 없다."

### 8.3 평가

설계 문서 의도와 사용자 우려가 **일치**합니다. 하지만 현재 구현은:
- handleCountdownComplete에서 setShowCountdown(false) → 곧바로 첫 음표 + sound
- 사운드 버퍼링 시 timer는 이미 시작됨 → 시간 손실

→ **펜딩 추가 필요**: 카운트다운 종료 후 첫 음표 표시 vs 타이머 시작 사이에 안정화 지연 (200~500ms)

---

## 9. UI 우려 사항 (설계 명시)

### 9.1 재도전 마크 삭제 ✅ (2026-04-30, commit f09919c)

**설계 (§3.3.자)**: "현재 구현돼 있는 기능 중 N+2의 음표가 나올 때 상단에 보이는 '재도전' 마크도 삭제 필요. 무의미한 기능임"

**현재 코드**: `🔁 재출제` 배지 삭제 완료 (`NoteGame.tsx`)

### 9.2 화면 단순화

**설계**: "화면 UI는 최대한 집중할 수 있는 색과 크기로 구성"

**현재 상태**: 정비 필요 (PENDING_BACKLOG.md §6, §8 — UI/UX 미친듯이 수정)

### 9.3 Navigation 정리 🔴 (Week 3 — PENDING_BACKLOG.md §13.2)

**범위**: header/sidebar 일관성, 페이지별 nav 상태 리뷰, 불필요한 진입점 제거.
**원칙**: memory #19 (사용자 행위 전가 X) + memory #14 (NavOnlyRoute, PWA).
**의존성**: NavOnlyRoute 가드 전제 조건으로 전체 네비게이션 흐름 점검 필요.

---

## 10. 핵심 차이 요약 — 우선순위별 (2026-05-01 갱신)

### ✅ 사용자 결정 완료 (2026-04-29) — 코드 적용 작업 남음

1. **단계 Clear 기준** ✅: 정답률 85% / 반응속도 평균 35% / 수행 10회 / 최대 연속 5회
2. **미가입자 권한** ✅: Lv 1만 (현재 코드 동일, 변경 없음)
3. **연간 구독료** ✅: $24.99 (Paddle Production 등록 작업)
4. **재도전 배지 삭제** ✅
5. **Sublevel 3 stage 수** ✅: 3 stage 통일
6. **음표 배치** ✅: Sub 1 = 1·1·3, Sub 2 = 1·3·5, Sub 3 = 3·5·7
7. **Stage 음표 set 반복** ✅: Sub 1 = 6·7·5, Sub 2 = 6·3·3, Sub 3 = 3·3·3
8. **같은 조표 연속 학습** ✅: 구현
9. **§7.3 Calibration 출시 전 필수** ✅ (사용자 명시 — 정체성)

### 🐛 버그 (사용자 검증 확인됨)

1. **N+2 즉시 등장** ✅ 완료 (commit 4e2b6ef, 2026-04-29) — 옵션 D + B + 호출 순서 정정 + 시뮬레이터 검증
2. **Lv5+ 조표 음표 비율 부족** ✅ 완료 (commit bb062c3, 2026-04-30) — batchSize별 30%/40%/60%/70% 조표 비율 + treble/bass 50:50 + 두 자리표 보장
3. **첫 음표 버퍼링 + Sub3 즉시 타임아웃** ✅ 완료 (commit eac606a, 2026-05-01) — FIRST_NOTE_GRACE_MS=300, setTimerKey 리셋, 4개 TDD 테스트
4. **UI 음표 잘림·색깔·history 누적 X** 🆕 — 분석 완료 (§3.11, 4 step 계획 수립), 구현 예정 (§0.4)
5. **batchSize=3 균등 분포 + batchSize=7 잘림** ✅ 완료 (commit 87f3aaf, 2026-05-02)

### 🔴 출시 후 펜딩 (이미 PENDING_BACKLOG.md에 박힘)

1. 배치고사 시스템 전체
2. 광고 시스템 (배너·전면·보상형)
3. 미가입자 보고서 후킹
4. 가입자 대시보드 부분 잠금
5. 성능·정밀도 (0.01초 지연 제거)
6. 약점 음표 표시 (Fail 시)

### 💡 코드에 있고 설계엔 없음 (확인 필요)

1. 라이프 회복 (3연속 정답) — 설계 §3.2.마.B에 있음 ✅
2. mastery 가중치 출제 (3.0 / 1.0 / 0.3) — 설계 §3.1.마와 일치 ✅
3. XP 시스템 v2 (속도 보너스, 스트릭 보너스 등) — 설계엔 명시 없음 💡
4. admin 페이지 (4개 다이얼로그) — 설계에 부분 명시 + 구현이 더 풍부 💡
5. mocked IAP (모바일 RevenueCat) — 설계엔 없음 💡

---

## 11. 다음 세션 작업 우선순위 (2026-05-01 갱신)

### Week 1 완료 현황 (2026-04-29 ~ 2026-05-02)

1. ✅ §0.1 N+2 즉시 등장 버그 수정 (commit 4e2b6ef, 2026-04-29)
2. ✅ §0.2 Lv5+ 조표 비율 수정 (commit bb062c3, 2026-04-30)
3. ✅ §0.3 카운트다운 후 첫 음표 버퍼링 + Sub3 즉시 타임아웃 (commit eac606a, 2026-05-01)
4. ✅ §0.4 분석 완료 — 4 step 계획 수립 (§3.11, 2026-05-01 Opus)
5. ✅ §0-1.5 재도전 배지 삭제 (commit f09919c)
6. ✅ §0-1.1~§0-1.6 코드 전체 적용 (commit 6c1a7e8)
7. ✅ §4 retry 시스템 통합 + 시뮬레이터 parity (commits 5e37084·7338406·eb8b5e2·1215178·509eb37, 2026-05-01 밤)
8. ✅ §1 사운드 동기화 + §2 카운트다운 음표 숨김 (commits 5f62244·58c4aab, 2026-05-01 밤)
9. ✅ §3 batchSize=3 균등 분포 + batchSize=7 잘림 X (commit 87f3aaf, 2026-05-02)
10. ✅ 카운트다운 애니메이션 1s 동기화 (commit 6283ad9, 2026-05-02)
11. ✅ swipe 모달 controlled + 조표·음표·NoteButtons·정답 라벨 가드 (commits 941b04f·6f5290f·c1b9d7c·717797e, 2026-05-02)
12. ✅ Lv1~4 batchSize=1 stage 정책 갱신 (commit 400dca2, 2026-05-02)

### Week 2 우선순위 (다음 작업)

1. **🔴 §0.4 GrandStaffPractice 구현** (§3.11 4 step, 4~6시간) — Step 1 색깔 → Step 2 history → Step 3 크기 → Step 4 잘림 방지
2. **🔴 §7.10 음표-사운드 sync 검증** — §7.3 calibration 결합 (sync 없이 calibration 신뢰도 X)
3. **✅ §7.1 performance.now() 전환** — 2026-05-03 완료 (15 사이트, vitest 373/373 + sim:test 9 invariants 위반 0건)
4. **🔴 §7.3 Calibration 4 단계** (Opus 2026-05-02 분할, 총 13~18시간) — §7.3.1 결정 시트 (11 Q) → §7.3.2 코어 lib → §7.3.3 UI + 측정 → §7.3.4 reactionMs 보정 적용
5. §4 retry 잔여 작업 (Step B 자동 로그, Step C 디버그 정리, Step D 명세)
6. §13.1 다국어 (KR+EN, 도메인·라우팅·콘텐츠 분리)
7. §13.2 라우팅 보호 + PWA 등록

### Week 2~3 (인프라 + 결제 + 비즈니스)

1. §0-2.1 스키마 표류 정리
2. §0-2.2 Supabase 키 하드코딩 제거
3. §0-2.3 Edge Function 구현 (payment-webhook)
4. ~~§7.1 performance.now() 전환~~ ✅ 완료 (2026-05-03)
5. §10.1 약관 4종 본문
6. §1.2 Paddle Production 상품 등록
7. §1.1 회원 등급 차등화
8. §3 광고 시스템 (배너·전면·보상형 코드)

### Week 4~5 (마무리)

1. §6 UI/UX 정비 마무리 (§6.4 GrandStaffPractice 세부 시각 조정 포함)
2. §3.5 약점 음표 표시 (Fail 시)
3. §12.1 Sentry 도입
4. §0.1-cleanup 디버그 코드 제거
5. §11 환경변수 production 전환
6. 사용자 검증

### 출시 후 (Phase 7+)

1. §2 배치고사 + 랭크 시스템 전체
2. §7.2~§7.5 (Web Workers, Calibration 정교화, Fixed-point, SLA)
3. §4.2 사용자화 레벨, §4.3 스캔
4. §0-2.4 GitHub Actions CI/CD
5. §12.2 E2E 테스트

---

---

## B-0. 영역 B — 티어 매트릭스 결정 (2026-05-09)

### B-0.1 결정 완료 항목 ✅

| 항목 | 결정값 |
|---|---|
| Guest 접근 범위 | Lv1 Sub1만, 3회/일 |
| Free 접근 범위 | Lv1~5 Sub1만 순차, 7회/일 |
| Premium 접근 범위 | 전 21단계 순차, 무제한 |
| 광고 보상형 세션 정책 | **영구 폐기** |
| DB PASS_CRITERIA | `20260509_pass_criteria_v2.sql` 마이그레이션으로 TS 기준 정렬 |
| Quick Mastery Mode | Premium 전용, Lv1 Sub2~Lv7 Sub3, 오류≤1%+시간≤50% 첫 세션 즉시 통과 |
| Mastery Score UI | Premium = 전체 노출, Free/Guest = 블러 + CTA |
| AI Coaching | Free = 기본 2종 (결과 모달 1행 + 대시보드 카드), Premium = 전체 |

### B-0.2 코드 영향 범위

| 파일 | 변경 내용 | 그룹 | 상태 |
|---|---|---|---|
| `src/lib/levelSystem.ts` | `canAccessSublevel` guest/free 규칙 재작성 + `getProgressGatePrev` 신규 | Group A | ✅ e6ed7b2 |
| `supabase/migrations/20260509_pass_criteria_v2.sql` | DB PASS_CRITERIA 정정 (10/85%/35%/5) + avg_reaction_ratio 컬럼 | Group A | ✅ b232dcd |
| `src/pages/Pricing.tsx` | 카피 갱신 (광고 보상형 제거, Free Lv5 Sub1, Guest Sub1 only) | Group A | ✅ 1848391 |
| `daily_sessions` 테이블 + `useDailyLimit` + `DailyLimitModal` | 일일 한도 시스템 신규 | Group B | ✅ 7167977·0cbd5ac·b81937e·f4265df + Fix Sprint b58d873·fbe4d29 (LevelSelect 메인 게이트 + NoteGame 안전망) |
| `LevelSelect.tsx` + `PremiumBlurCard` | Mastery Score 블러 + 4지표 탭 | Group C | 🔴 미구현 |
| AI Coaching 컴포넌트 | 결과 모달 1행 + 대시보드 카드 | Group C | 🔴 미구현 |
| `record_sublevel_attempt` RPC + Quick Mastery 감지 | Quick Mastery Mode | Group D | 🔴 미구현 |

### B.1 일일 세션 한도 시스템 ✅ Group B + Fix Sprint 완료 (2026-05-09)

**Group B 코드 (commits 7167977·0cbd5ac·b81937e·f4265df)**:
- `daily_sessions` 테이블 + RLS + RPC 2개 (`increment_daily_session`·`get_today_session_count`)
- `useDailyLimit` 훅 (guest=localStorage / free=RPC / pro=Infinity, UTC 자정 카운트다운)
- `DailyLimitModal` (guest/free 분기, ko/en strings, animate-pop-in, 메모리 #19 backdrop·ESC 닫기 X)
- `NoteGame.tsx` 마운트 한도 게이트 (B4 영역, 후속 Fix Sprint에서 안전망 패턴으로 정정)

**Fix Sprint (commits b58d873·fbe4d29)** — 사용자 검증 발견 영역 정정:
- 게이트 위치: NoteGame 마운트 → **LevelSelect 단계 클릭 시점** 이동 (백그라운드 게임 진행 영역 차단)
- NoteGame = 안전망 패턴 (한도 도달 시 `onLevelSelect()` 콜백, 게임 진입 X)
- DailyLimitModal 컨텐츠 재작성 — Guest 가치 3개·Free 가치 4개·Free 가격 표시·Quick Mastery 영역 제거 + "모든 단계 열림" 표현 정정

→ **512/512 PASS, tsc 0 errors**. 메모리 #16·#18·#19·#24·#25·#26·#27 일관.

### B.2 Quick Mastery Mode 🔴 완전 미구현

설계·결정 기준 대비 코드 상태:
- 트리거 조건 체크 (오류율·반응시간): 없음
- 즉시 통과 플로우: 없음
- "빠른 통과" 배지: 없음

→ **Group D 전체 신규 구현** (~4h)

---

## 12. 메모

이 비교는 **설계 PDF 6페이지 + 구현 docs/ 8개 문서**를 1:1 대조한 결과다. 사용자 첨부 별도 기획서 4개 (배치고사·광고 UI·애드센스·성능 최적화) 의 항목은 이미 `PENDING_BACKLOG.md`에 14개 카테고리로 정리되어 있으므로 본 문서에서는 PDF 본문과의 차이만 다뤘다.

**결론**: 설계와 구현은 핵심 게임 로직(맞을 때까지 유지, NOTE COUNT, retry queue, 키사인, 스와이프)에서 일치하며, 차이는 주로 **세부 수치(통과 기준, 권한 범위, stage 수)**와 **미구현 기능(배치고사, 광고, 성능 최적화)**이다. 위 §11 우선순위 순서로 진행하면 출시 가능 상태에 도달.

---

## 13. 변경 이력

- 2026-04-28: 초안 작성 (설계 PDF vs Claude Code 8개 분석 문서 비교)
- 2026-04-29: 사용자 결정 9개 + §0.1 완료 (commit 4e2b6ef) + §7.3 Calibration 출시 전 필수 격상 + §10/§11 갱신 (결정 완료 반영) + §2.4/§2.6/§5 평가 마크 ✅ 업데이트
- 2026-05-02 (Opus 4.7 분석): §7.3 Calibration 영역 분할 + 결합 위험 박힘 (§7.3 신규 표 + §11 Week 2 우선순위 §7.10·§7.1·§7.3 결합 순서). 코드 변경 0건.
- 2026-05-03 (Sonnet 4.6): **§7.1 `Date.now()` → `performance.now()` 전면 전환 완료** — 15 사이트 (NoteGame 12 + CountdownTimer 3). 절대 시간 2 사이트 (DiagnosisTab·PremiumDialog) Date.now() 유지. vitest 373/373 PASS, sim:test 9984 게임 invariants 위반 0건.
- 2026-05-09 (Sonnet 4.6): **§5 권한 매트릭스 5/9 결정 반영** (Guest Sub1 한정·Free Lv1~5 Sub1·Premium 전체) + **§B-0/§B.1~B.2 영역 B 결정 박음** (일일 세션 한도·Quick Mastery Mode 전체 미구현 확인 + 코드 영향 범위 매핑).
- 2026-05-09 (Sonnet 4.6): **Group A 완료** — §B-0.2 코드 영향 범위 표 상태 열 추가 (✅ commits e6ed7b2·b232dcd·1848391). Group B~D 미구현 상태 명시 유지.
- 2026-05-09 오후 (Opus 4.7): **Group B 완료** — §B-0.2 daily_sessions 행 ✅ (7167977·0cbd5ac·b81937e·f4265df) + §B.1 ❌→✅ (구현 완료 영역 4 항목 명시). Group C (Mastery Score 블러 + AI Coaching 기본)·Group D (Quick Mastery Mode) 미구현 영역 일관 유지.
- 2026-05-09 오후~ (Opus 4.7): **Group B Fix Sprint** — §B-0.2·§B.1 정합 영역 갱신 (LevelSelect 메인 게이트 + NoteGame 안전망 패턴). commits b58d873·fbe4d29. 사용자 검증 발견: 백그라운드 게임 진행 차단 + DailyLimitModal 컨텐츠 후킹 강화 + Quick Mastery 영역 제거. 512/512 PASS.
- 2026-04-30: §0-1 코드 적용 완료 — §0-1.1~0-1.6 모두 구현 (commits f09919c, 6c1a7e8) + §2.6 PASS_CRITERIA 테이블 ✅ 갱신 + §2.6 같은조표연속학습 ✅ + §9.1 재도전마크 ✅ + §3.8 조표 비율 + treble/bass ✅ (commit bb062c3)
- 2026-05-01: §3.11 §0.4 GrandStaffPractice 분석 추가 (Opus 보고서, 3갭 4 step 계획) + §3.12 §0.3 ✅ 추가 (commit eac606a) + §10/§11 갱신 (Week 1 완료 현황, Week 2 우선순위)
- 2026-05-02: §2.1 stage 수 ⚠️ (Lv1~4 batchSize=1 확장 반영) + §2.4 음표 배치 테이블 ✅ + §3.2 버퍼링 방지 ✅ + 카운트다운 조표 숨김 ✅ + §3.13 §4 retry 시스템 신규 + §3.14 swipe 모달 신규 + §3.15 batchSize 렌더링 fix 신규 + §10 버그 5번 추가 + §11 Week 1 완료 12개·Week 2 §4 잔여 추가 + §13 변경 이력
