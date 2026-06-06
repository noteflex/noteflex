# 게임 엔진 (Game Engine) — 개발 문서

기준일: 2026-06-05. NoteGame 루프·표시·타이밍·보정 관련 결정·함정·미해결 정리.

---

## 1. 목적

`NoteGame.tsx`는 음표 생성·표시·입력 처리·점수 계산·오디오 재생을 담당하는 게임 루프 컴포넌트다. 결과 다이얼로그·라우팅 결정은 호스팅 페이지(`PlayPage`)의 몫이며, NoteGame은 게임 결과를 `onAttemptRecorded` 콜백으로 위로 전달한다. 이 문서는 코드에서 읽히지 않는 결정 이유·버린 대안·불변식·함정을 기록한다.

---

## 2. 설계 결정과 이유

### 21-서브레벨 구조 (7레벨 × 3)

Lv1~4와 Lv5~7이 별도 stage 테이블(`SUBLEVEL_CONFIGS` vs `LV5_SUBLEVEL_STAGES`)을 쓰는 이유: Lv5+는 조표 도입으로 stage 구성이 근본적으로 달라 단일 테이블로 표현이 어려움. 레벨당 서브레벨이 3개인 이유: 한 레벨 안에서도 난이도를 세분화해 진행하며 실력 상승을 더 효과적으로 체감하게 하기 위함. sub1=정확도, sub2=흐름, sub3=지구력/초견의 세 훈련 목적 구조.

### 배치(Batch) 표시 모드 (§0.4.1)

`batchSize=1`(순차, history 모드)과 `batchSize≥3`(동시 표시, batch 모드) 두 모드를 같은 엔진에서 처리한다. 연속 표시는 같은 음표가 반복되는 패턴 암기를 방지한다. Lv5~7에서 `batchSize=1, 2` 미사용 이유: 조표 음표 혼합 최소 3개 batch부터 유효하므로(코드 주석 직접 출처) — 조표 훈련에서 혼합 집합이 1~2개면 패턴이 아니라 단순 암기가 된다.

### §C1 M-등분 고정 슬롯 레이아웃 (§C1, 2026-05-09 그룹 D)

stage·phase 기반으로 화면에 등장할 최대 음표 수 M을 미리 결정하고, 오선 위에 M개 슬롯을 고정 분할한다. 이미 정답 처리된 음표도 슬롯 공간을 차지해 빈 자리로 남는다. 결정 이유: 음표 수가 바뀔 때마다 오선이 재배치되면 레이아웃 시프트가 발생해 시선을 분산시킨다. 고정 슬롯으로 답변 진행 중에도 나머지 음표 위치가 변하지 않는다.

### §S1 Uniform Scale (computeScale, 2026-05-09 그룹 D)

`computeScale()` 는 M(동시 표시 음표 수)와 무관하게 고정 값을 반환한다. 결정 이유: batchSize가 1에서 7로 바뀌어도 오선 프레임 크기가 유지돼야 한다. M에 따라 scale을 줄이면 batchSize=7에서 음표가 너무 작아 가독성이 저하된다. 고정값으로 바꾼 이유: batch 크기에 따라 1.0~0.55로 변하던 것을 상수로 고정(2026-05-23) — batch 크기와 무관하게 노트 크기의 시각적 일관성 확보.

불변식: `computeScale(M)` 반환값은 M에 독립적이어야 한다. M을 받는 인자는 호환성 유지용으로, 실제 계산에 사용되지 않는다(테스트에서 `M=1, 3, 7, 12` 모두 동일값 검증).

### §swipe-modal 동기화 정책 (2026-05-02)

Lv5+ 첫 플레이 시 스와이프 튜토리얼 모달을 표시한다. 정책 두 가지:

1. **재플레이 시 모달 건너뜀**: 한 판 이미 진행한 플레이어는 스와이프를 알고 있으므로 불필요한 방해 제거.
2. **모달 표시 중 음표·오선 숨김**: 카운트다운과 동일한 숨김 처리를 모달 중에도 적용 — 플레이어가 준비되기 전에 첫 batch가 노출되는 것을 방지.

### §countdown-instant 동기 초기화 (2026-05-23)

카운트다운 `START` 상태를 `useState` 초기값으로 동기 설정한다. 결정 이유: 마운트 첫 프레임부터 카운트다운이 보여야 한다. 이전에는 `useEffect` + async 초기화 흐름이었고, 이 때 §0.3에서 기술한 Sub3 경쟁 조건이 발생했다.

### §4 Retry Queue 설계 (2026-05-01)

오답 음표는 retry 큐(N+2 알고리즘)에 쌓인다. retry 음표는 별도 화면이 아니라 다음 batch 앞자리에 섞인다. 결정 이유: 오답 복습을 위한 별도 화면 전환은 게임 흐름을 끊는다. 배치 내 통합으로 자연스러운 복습이 이뤄진다.

`final-retry` phase: 모든 stage 소진 후 missedNotes가 남은 경우 전용 phase로 진입한다. 왜 retry를 stage와 분리했는지: stage별 set 카운트가 고정돼 있어, 미완성 음표만을 위한 추가 stage를 만들면 진행률 계산이 복잡해진다.

### §B-0 일일 한도 게이트 분리 (2026-05-23)

LevelSelect가 일일 한도의 주 게이트다. PlayPage/NoteGame 안의 게이트는 URL 직접 진입·stale state 대비 안전망. 결정 이유: dailyLimit DB 조회가 느리거나 에러가 나도 카운트다운을 막으면 안 된다 — dailyLimit은 게임 시작과 완전히 분리된 effect에서 처리한다.

### 외부 다이얼로그 정책

`GameOverDialog`와 `SublevelPassedDialog`는 NoteGame 내부에 없다. NoteGame은 `onAttemptRecorded` 콜백으로 결과를 올려 보내고, PlayPage가 다이얼로그를 제어한다. 결정 이유: NoteGame을 재사용 가능한 엔진으로 유지하기 위해. 다이얼로그 행동(라우팅, 다음 레벨 진행)은 호스팅 컨텍스트에 따라 다를 수 있다.

### 오디오 보정 (AudioContext.outputLatency 기반)

시스템 출력 지연을 `AudioContext.outputLatency`로 측정해 반응 시간에서 차감한다. 결정 이유: 기기별 오디오 지연이 달라 보정 없으면 동일 반응속도라도 기기에 따라 점수가 달라진다. V1→V2 localStorage 키 자동 마이그레이션: 기존 보정값 유실 방지. roundtrip 대신 outputLatency를 선택한 이유(2026-05-22 발견): 기존 자극→탭 측정 방식은 유저 본인의 반응시간까지 시스템 지연으로 오인해 차감하는 구조적 오류가 있었다. outputLatency는 시스템 오디오 지연만 보고(블루투스 200~500ms, 일반 0~20ms)하므로 유저 반응은 보존하고 시스템 지연만 보정한다. 디스플레이·입력 지연(5~20ms)은 블루투스 대비 무시 가능하다고 판단. 재측정은 매 게임이 아니라 ondevicechange 트리거 — 매판 측정은 UX 비용으로 기각.

---

## 3. 알려진 함정

### §0.3 카운트다운 경쟁 조건 (Sub3 안전 보장)

이전 설계에서는 카운트다운 종료 후 grace `setTimeout`을 두었다. 이 delay 동안 Sub3(세 번째 서브레벨)에서 `setTimerKey`가 `startRef`를 리셋하기 전에 timer가 시작되는 경쟁 조건이 존재했다. 해결: `setTimerKey`를 동기로 호출해 `startRef`를 즉시 리셋. grace delay를 다시 추가하면 Sub3에서 동일 버그가 재현된다.

### Retry 큐 × 조표 경쟁 조건

retry 큐에서 pop된 음표의 key signature가 현재 stage의 key signature와 다를 수 있다. 이 불일치가 시각적으로 노출되는 엣지 케이스 TBD — 확인 필요.

### reaction_ms 누적 평균 희석

초기 설계에서 `avg_reaction_ratio`를 누적 rolling average로 저장했다. 초반에 느렸던 세션이 이후 세션을 영구적으로 희석해 MIN_ACCURACY 도달이 사실상 불가능한 경우가 생겼다. 해결: `recent_plays` 7판 윈도우로 전환 (20260529_recent_plays_window.sql). 어떤 메트릭이든 cumulative avg로 되돌리면 동일 문제가 재발한다.

### Promise 체인 클로저 단절 (avgReactionRatio)

`recorder.endSession().then(compute avg).then(onAttemptRecorded)` 패턴에서 첫 번째 `.then()`에서 계산한 `avgReactionRatio`가 두 번째 `.then()` 스코프에서 참조 불가였다. 해결: 체인 바깥에 `capturedAvgReactionRatio` 변수를 선언해 두 `.then()` 간에 공유. Promise 체인 내에서 sibling `.then()` 스코프의 값을 참조하는 패턴은 이 버그를 재발시킨다.

---

## 4. 관련 파일 색인

| 파일 | 역할 |
|---|---|
| `src/components/NoteGame.tsx` | 게임 루프 메인 컴포넌트 (§C1·§4·§B-0·§swipe-modal·§countdown-instant) |
| `src/components/practice/GrandStaffPractice.tsx` | 오선 렌더링 + §S1 computeScale + §C1 computeMaxVisibleN |
| `src/lib/levelSystem.ts` | 레벨·서브레벨 구조 (SUBLEVEL_CONFIGS, LV5_SUBLEVEL_STAGES, PASS_CRITERIA) |
| `src/lib/userEnvironmentOffset.ts` | AudioContext 기반 보정, V1→V2 마이그레이션, clampReactionMs |
| `src/hooks/useSessionRecorder.ts` | 세션 내 NoteAttempt 기록, avgReactionMs 로컬 계산 |
| `src/hooks/useRetryQueue.ts` | N+2 retry 큐 로직 |
| `src/pages/PlayPage.tsx` | 외부 다이얼로그 관리, onAttemptRecorded 핸들러 |
| `src/components/GameErrorBoundary.tsx` | 게임 화면 에러 바운더리 |
| `supabase/migrations/20260509_fast_track.sql` | Fast Track 조건 + record_sublevel_attempt 분기 |
| `supabase/migrations/20260529_recent_plays_window.sql` | recent_plays 7판 윈도우 도입 (누적 평균 대체) |
