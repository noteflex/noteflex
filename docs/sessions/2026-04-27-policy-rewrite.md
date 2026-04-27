# 2026-04-27 세션 로그 — 정책 재작성 + Phase 6 swipe 복원 + admin 우회

> **작업 환경**: Claude.ai 채팅 세션 + Claude Code (Opus 4.7, 1M context)
> **작업자**: 사용자 (yongjun-kim) + Claude (CTO 역할)
> **소요 시간**: 약 8시간 (세션 다수)
> **결과**: 4 commits, 263→265 tests passing, 정책 의도와 코드 일치화

---

## 작업 배경

### 발견된 핵심 문제

기존 `ae0aace` 시점의 정답 정책이 사용자 의도와 어긋나 있었다.

- **코드 동작**: 오답 시 다음 음표로 진행 + retry queue에 N+2턴 후 재출제 (spaced repetition)
- **사용자 의도**: "맞을 때까지 못 넘어감" — 오답 시 같은 음표 그 자리에 유지

이 어긋남이 Phase 5 디버그 저널에 적힌 race condition 처방으로 가려져 있었지만, 실제 사용자 플레이 시 "도→레→도→레 무한 반복" 같은 혼란을 일으켰다.

### 부수적 발견

검증 과정에서 별개의 버그 다수 발견:

1. CountdownTimer가 paused 풀릴 때 `startRef.current` 갱신 안 함 → 카운트다운 후 타이머가 처음부터가 아닌 흘러간 상태로 시작
2. `advanceToNextTurn`의 `wasRetry=true` 분기에 `setTimerKey` 호출 누락 → "목숨 2개 남으면 타이머 멈춤" 현상
3. Lv5+ 같은 stage 내에서 매 batch마다 keySig 새로 생성 → retry queue의 음표가 새 키사인에서 응답 불가능 (사용자가 답할 버튼이 없음)

---

## 의사결정 기록

### 정책 결정 (사용자 확정)

사용자가 명시적으로 결정한 정책:

| 항목 | 결정 |
|---|---|
| 오답 처리 | 같은 음표 그 자리에 유지 + 라이프 1 차감 + retry queue 마커 등록 |
| 정답 처리 | 다음 음표 진행 + 마커 있던 음표만 N+2 retry 등록 |
| 타이머 만료 | 오답과 동일 처리 |
| 라이프 0 | 게임오버 |
| mastery 기록 | 매 시도마다 (옵션 B) |
| 재출제 정답 | 큐에서 영구 제거 |
| 재출제 오답 | 같은 자리 유지 + 마커 갱신 |
| Stage 전환 시 retry queue | Lv1-4: 유지 / Lv5+: reset (조표 충돌 회피) |
| 같은 stage 내 keySig | 고정 (한 stage = 한 키사인) |

### 정책 모호점 명확화 (Claude Code 검토)

Claude Code가 시나리오 13개 검토 중 명확화 요청:

- **Q10 (오답 시 큐 등록 의미)**: A안 — 마커만 등록, 출제는 같은 자리 유지 메커니즘으로 처리
- **Q11 (정답 시 N+2 등록 대상)**: X안 — 오답 이력 있던 음표만 등록 (강화 학습)
- **Q12 (재출제 정답 처리)**: P안 — 영구 제거

---

## 작업 흐름

### 1단계: 채팅 세션에서 시도 (실패)

코드 변경 다수 시도했으나 매번 새로운 회귀 버그 발생:

- GameHeader 두 번 렌더링 (정답 배지 패치 적용 시 기존 블록 안 지움)
- sed로 라인 자르다 잉여 `</div>` 남김
- 오답 후 currentIndex 진행 안 시켜서 도→레→도→레 무한 반복
- 변경 누적이 너무 많아 어디서 깨졌는지 추적 불가

**교훈**: 큰 코드 변경에서 단순 채팅은 비효율적. 컨텍스트 손실 + 부분 패치 누적 위험.

### 2단계: Claude Code 도입

Claude Code 설치 후 TDD 방식으로 재시작:

```bash
sudo npm install -g @anthropic-ai/claude-code
cd /Users/yongjun-kim/Desktop/noteflex
claude
```

작업 원칙:
1. 새 정책 테스트 먼저 작성 (실패 확인 → TDD)
2. 코드 수정해서 테스트 통과
3. 매 단계 commit
4. 모든 자동 테스트 통과 후 사용자 검증

### 3단계: 정책 변경 commit (3b34405)

핵심 변경:

**`useRetryQueue.ts`**
- `markMissed(note)` 추가: marker-only 등록 (due = MAX_SAFE_INTEGER)
- `rescheduleAfterCorrect(note, currentTurn)` 추가: 마커 있을 시에만 N+2 갱신
- 기존 API (`scheduleRetry`, `popDueOrNull`, `resolve`, `reset`) 유지

**`NoteGame.tsx`**
- 오답 분기: `advanceToNextTurn` 제거, `setLives(-1)` + `markMissed(note)` + `restayOnWrong()` (같은 자리 유지)
- 정답 분기: 마커 있던 음표만 `rescheduleAfterCorrect`, 그 후 `advanceAfterCorrect(wasRetry)`
- 타이머 만료: 오답과 동일 분기 사용
- `retryOverride` state로 retry 음표 표시
- Lv1-4 stage 갈이 시 retry queue 유지, Lv5+만 reset

**`generateNewBatch` 시그니처 변경**:
- `forceNewKeySig` 파라미터 추가 (기본값 `false`)
- 같은 stage 내 호출 시 `currentKeySignature` 재사용
- Stage 전환 + replay 시에만 새 keySig 생성

**테스트**:
- `NoteGame.policy.test.tsx` 신규 (13개 시나리오)
- `NoteGame.test.tsx` 5개 retry queue 통합 테스트 갱신

**결과**: 263/263 통과

### 4단계: Phase 6 swipe 복원 commit (c20e737)

이전 채팅 세션에서 작성됐다가 commit 안 되어 untracked 상태로 남아있던 두 파일 복원:

- `src/hooks/useSwipeAccidental.ts` (그대로 사용)
- `src/components/AccidentalSwipeTutorial.tsx` (그대로 사용)

**`NoteButtons.tsx`**:
- `swipeEnabled` prop 추가
- `swipeEnabled=true` 시 자연음 7개만 표시 (♯/♭ 라벨 버튼 제거)
- 내부 `NoteButton` sub-component가 `useSwipeAccidental` 핸들러 바인딩
- 임계 50% 도달 시 ♯=시안 / ♭=앰버 ring + 손가락 따라 translateY

**`NoteGame.tsx`**:
- `swipeEnabled={level >= 5}` 전달
- 카운트다운 종료 후 `AccidentalSwipeTutorial` 트리거 (localStorage 1회 차단)

**테스트 디버깅**:
- jsdom에서 `fireEvent.pointer*`가 React 핸들러에 도달 못 함 발견
- 동기 dispatch는 turn 간 React state flush 안 됨
- 해결: `act()` + native `PointerEvent` (없으면 `MouseEvent` fallback)

**결과**: 263/263 통과 (Lv5/6/7 stress test 포함)

### 5단계: admin 권한 우회 + 정답 배지 commit (499a9e3)

**`subscriptionTier.ts`**:
- 우선순위: guest → admin → pro tier → is_premium → free
- `profile.role === "admin"`이면 무조건 `'pro'` 반환 (admin은 모든 레벨 접근)

**`subscriptionTier.test.ts`**:
- admin 단독 + admin+free + admin+non-premium 케이스 추가 (총 9 PASS)

**`LevelSelect.tsx`**:
- `isAdmin = profile?.role === "admin"`
- 진도 게이트 분기: `if (!isPrevPassed && !isAdmin)` (admin은 진도 무관 모든 셀 접근)
- 구독 게이트는 별도 변경 X (admin이 이미 'pro'로 통과)

**`NoteGame.tsx`**:
- `useAuth`에서 `profile` 받기
- `isAdminOrDev = profile?.role === "admin" || import.meta.env.DEV`
- GameHeader 위에 노란 정답 배지 표시:
  ```tsx
  💡 정답: {getNoteAnswer(currentTarget)}  (admin/dev only)
  ```

**결과**: 265/265 통과

---

## 메타 작업

### 펜딩 백로그 정리 commit (85303c0)

사용자가 채팅에 보낸 24항목 + 첨부 4개 기획서 (배치고사·랭크 시스템, 광고 UI 전략, 애드센스 승인 전략, 앱 성능 최적화) + Claude 메모리상 펜딩을 종합:

`docs/PENDING_BACKLOG.md` (372줄, 14개 카테고리):
1. 비즈니스 모델·권한 정책
2. 배치고사 + 랭크 시스템
3. 광고 (애드센스)
4. 게임플레이 추가 (코드 연습, 사용자화 레벨, 스캔, 힌트, 정답 버튼 세계화)
5. 사용자 경험·리텐션
6. UI/UX 정비
7. 성능·정밀도 (0.0001초 단위)
8. 관리자 페이지 보강
9. 도메인 이메일 + 사업자
10. 콘텐츠·마케팅
11. 환경변수 변경 체크리스트
12. 인프라·운영
13. 결정 보류 항목 (사용자 결정 필요 7개)
14. 메모

우선순위 표기: 🔴 출시 전 필수 / 🟡 출시 직후 / 🟢 중장기

---

## 검증

### 자동 테스트
- 19 test files / 265 tests / 100% passing
- 신규: `NoteGame.policy.test.tsx` (13 scenarios)
- 갱신: `NoteGame.test.tsx` (5 retry-queue tests rewritten)
- 영향 없음: `useRetryQueue.test.ts` (15), `levelSystem.test.ts` (50), 외 다수

### 사용자 수동 검증

OK:
- 21셀 모두 admin에서 잠금 해제됨
- 노란 정답 배지 표시됨 (admin/dev)
- Lv1-1 일부러 오답 → 음표 그대로 + 라이프 차감 + 타이머 리셋 확인
- 정답 → 다음 음표 진행 확인
- 5번 오답 → 게임오버 확인
- 카운트다운 후 타이머 정상 (꽉 찬 상태에서 시작)

NG (다음 세션 작업 펜딩):
- **버그 1**: 첫 음표 2번 틀린 후 정답 시 즉시 같은 음표가 다음 자리에 등장. 의도는 "다른 음표 1~2개 풀고 그 다음 retry". turn counter 증가 타이밍과 due 계산 어긋남 추정.
- **버그 2**: Lv5+에서 조표 붙은 음표 비율 부족 (의도: 6:4 / 4:6 / 7:3 / 3:7 비율로 자연음 vs 조표 음 + treble/bass 골고루). 그래서 swipe 인터랙션 검증 자체가 막힘.

---

## Push 결정

이 세션 commit 4개 (`85303c0`, `3b34405`, `c20e737`, `499a9e3`)를 origin/main에 push.

다음 세션에서 위 NG 버그 2개 수정 작업 진행 예정.

---

## 교훈 (Phase 6 디버그 저널 후속)

### 1. 단순 채팅의 한계

큰 코드 변경(다중 파일, 정책 재작성)은 채팅 세션에서 비효율적이다. 컨텍스트 손실 + 부분 패치 누적 + 사용자 검증 사이클 길어짐. **Claude Code 같은 에이전트 도구가 적합하다.**

### 2. 자동 테스트 ≠ 동작 보장

250+ 테스트 통과해도 사용자 정책 의도가 코드에 반영 안 되면 사용자 경험은 깨진다. **새 정책 도입 시 사용자 의도를 테스트로 먼저 명문화** (TDD)하는 게 정답.

### 3. 정책 결정은 사용자 권한

CTO 역할의 Claude는 구현 책임이 있지만, 정책 결정 권한은 사용자에게 있다. 사용자 의도가 명확하지 않을 때 임의 해석 금지. **변경 전 명확화 요청** 원칙.

### 4. Race condition은 우회보다 근본 수정

Phase 5에서 keySig race condition을 "stage 갈이마다 reset"으로 우회했지만, 사실은 **"같은 stage = 같은 키"** 가정이 코드에 박히지 않은 게 근본 원인. Lv5+ 키사인 안정화로 해결되며 retry queue도 stage 단위로 일관화됨.

### 5. Untracked 파일은 위험

`useSwipeAccidental.ts`, `AccidentalSwipeTutorial.tsx` 두 파일이 이전 세션에서 commit 안 되고 untracked로 남아있었음. **새 파일 생성 시 즉시 commit** 원칙. 또는 stash·branch 활용.

### 6. 펜딩 리스트는 코드베이스에 박아야 영구

머릿속 + 채팅에만 있던 펜딩(배치고사 등)은 압축본·메모리 한계로 사라질 수 있다. **`docs/PENDING_BACKLOG.md` 같은 파일로 git에 박아야 영구 보존**.

---

## Commits

```
499a9e3 feat: admin tier override + answer hint badge
c20e737 feat: Lv5+ swipe accidentals (Phase 6)
3b34405 fix: keep keySig stable within Lv5+ stage
85303c0 docs: pending backlog from user 24 items + 4 design docs
```

총 13 files changed, +1130 / -152.
