# Noteflex 세션 로그

> **운영 원칙**: 1개 파일에 모든 세션 누적. 시간 역순 (최신 위). 매 세션 마무리 시 Claude Code가 박음.

---

## 2026-05-09 (오전~) — Group A 실행 + 블로그 10일차

### 사용자 결정

- **Q1·Q2·Q3 (CTO 권장 그대로 OK)**:
  - Q1 = (a) A2 RPC + 클라이언트 = atomic commit
  - Q2 = (b) Free 순차 해금 = useLevelProgress 메모리 캐시 (UI 가드용 즉시 반응, RPC 이중 검증)
  - Q3 = (a) A2 마이그레이션 = 즉시 production apply
- **docs 갱신 패턴 v2 (Group B부터)**: sub-step별 file in-place ✅ 박음(commit X) + 마지막 docs 일괄 commit 1개. 코드 commit 사이에 docs commit 끼움 X.
- **세션 로그 1개 파일 누적 결정**: docs/sessions/noteflex-session-log.md 1개 파일 시간 역순 누적. 파일 분리 X. 토픽 분리 X.
- **블로그 10일차 = 토요일 3편 = 한+영 6 .md**: §3-37·§2-24·§8-87. §8-87 13일차 3편째 차용, 시프트 X.

### 진행 흐름

#### Group A (코드 적용, 4 commits)

| commit | 내용 |
|---|---|
| `e6ed7b2` A1 | canAccessSublevel 재작성 + getProgressGatePrev 신규 (avg_reaction_ratio 개칭 포함) |
| `b232dcd` A2 | 20260509_pass_criteria_v2.sql + useLevelProgress + NoteGame 순차 체인 (atomic) |
| `1848391` A3 | Pricing.tsx freeFeatures·compareRows 5/9 결정 반영 |
| `fbb4340` A4 | docs 동기화 (§B-0.2/B.1/B.2 ✅) |

검증: 470/470 PASS, tsc 0 errors.

#### 블로그 10일차 (콘텐츠, 4 commits)

| commit | 내용 |
|---|---|
| `05744b1` | §3-37 초견 실수 패턴 분석 (ko+en, ~1,700자 / ~880 words) |
| `60e8fb3` | §2-24 쉼표 읽기 (ko+en, ~1,700자 / ~870 words) |
| `d988676` | §8-87 21단계 시스템 (ko+en, ~1,850자 / ~900 words, 13일차 차용) |
| `8acd24e` | blog_topics_100.md §6 이력 6행 + §1.1 10일차 표 + v15 |

이미지 curl HTTP 200 검증 (6개 Pexels): pexels 164821·3756766·210764·1246437·1552617·995301 = 200 ✓

학술 인용:
- Kopiez & Lee (2008) DOI: 10.1080/14613800701871363
- Lehmann & McArthur (2002) Oxford University Press (§3-37)
- Margulis (2007) DOI: 10.1525/mp.2007.24.5.485
- Cooper & Meyer (1960) University of Chicago Press (§2-24)
- Vygotsky (1978) Harvard University Press
- Hattie & Timperley (2007) DOI: 10.3102/003465430298487 (§8-87)

거장 전통: Levitin + 음악 교육 / Copland + Bernstein / Levitin + 음악 교육.

### 갱신 docs

- **PENDING_BACKLOG.md**: §B-0.2·§B.1·§B.2 ✅ 표시 (commit fbb4340)
- **DESIGN_VS_CODE_GAP.md**: §B-0.2 코드 영향 범위 표 상태 열 추가 (commit fbb4340)
- **blog_topics_100.md**: §6 이력 6행 추가 + §1.1 10일차 행 박음 + v15. 누적 46편 (한 23 + 영 23).

### 다음 세션 시작점

1. **5/10 일요일 = 11일차 = 주말 3편**: §3-38 약점 음표 집중 학습 + §5-56 피아노 학습자 가이드 + §7-79 가중치 학습 (14일차 차용)
2. **그 후 Group B = 일일 세션 한도 시스템 (~4h)**:
   - `supabase/migrations/20260509_daily_sessions.sql` 신규
   - `src/hooks/useDailyLimit.ts`
   - `src/components/DailyLimitModal.tsx`
   - NoteGame.tsx 게임 시작 전 limit 체크 + 모달 트리거
   - commit 패턴 v2 적용 (sub-step별 in-place ✅ + 마지막 일괄 commit)

### 출시 카운트다운

오늘 = 2026-05-09. 출시 = 2026-05-31. **22일 남음**.

---

## 2026-05-08 밤 ~ 2026-05-09 새벽 — 영역 B-0 티어 매트릭스 결정 + 사실 추적

> **원본 전문**: 이 파일 하단 섹션 (구 세션 로그 형식) 에 박힘. 아래 요약은 핵심 결정·사실·commit만 추출.

### 결정 요약 (D1~D7)

| 결정 | 내용 |
|---|---|
| D1 Guest | Lv1 Sub1만, 3회/일, 가입 유도 모달 |
| D2 Free | Lv1~5 Sub1 순차, 7회/일, 24h 카운트다운 모달 |
| D3 Premium | 전 21단계, 무제한, Quick Mastery 포함 |
| D4 DB PASS_CRITERIA | 20260509_pass_criteria_v2.sql (10회/85%/35%/5 연속) |
| D5 Quick Mastery Mode | Premium 전용, 오류율≤1% AND 반응시간≤타이머 50% → 첫 세션 즉시 통과 |
| D6 Mastery Score UI | Free/Guest = 블러 + CTA, Premium = 전체 노출 |
| D7 AI Coaching | Free = 기본 2종, Premium = 전체 |

### 코드 사실 추적 요약 (F1~F7)

| 사실 | 결과 |
|---|---|
| F1 canAccessSublevel 갭 | Guest Sub1~3 허용 → Sub1만으로 정정 필요 (→ A1) |
| F2 일일 세션 한도 | 완전 미구현 (→ Group B) |
| F3 Mastery Score | 부분 구현, 블러 미구현 (→ Group C) |
| F4 AI Coaching | 완전 미구현 (→ Group C) |
| F5 Quick Mastery Mode | 완전 미구현 (→ Group D) |
| F6 Pricing 카피 | 구 Free 범위 반영, 수정 필요 (→ A3) |
| F7 DB PASS_CRITERIA | play≥5/80% vs TS 10/85% 불일치 (→ A2) |

### commits

| commit | 내용 |
|---|---|
| `8c66a6c` | 세션 로그 신규 (구 파일명, 본 파일로 통합) |
| `5d95cd0` | package.json `npm run resume` 단축어 |
| `74f5200` | PENDING_BACKLOG §B-0/§B.1~B.6/§13.L/§0-1.1 |
| `5571a6e` | DESIGN_VS_CODE_GAP §5/§B-0/§B.1~B.2 |

---

<!-- ═══════════════════════════════════════════════════════ -->
<!-- 아래: 구 세션 로그 형식 (2026-05-08 밤, 상세 원문 보존) -->
<!-- ═══════════════════════════════════════════════════════ -->

---

## 1. 결정 개요

### D1 — Guest 티어 접근 범위 ✅ 확정

| 항목 | 결정값 |
|---|---|
| 접근 가능 레벨 | Lv1 Sub1만 |
| 일일 세션 한도 | 3회/일 |
| 한도 초과 시 | 가입 유도 모달 (광고 보상형 X) |

**배경**: 최대한 빠른 가입 전환 유도. 게스트에게 광고 보상형으로 더 주는 정책은 5/9 결정으로 폐기.

---

### D2 — Free 티어 접근 범위 ✅ 확정

| 항목 | 결정값 |
|---|---|
| 접근 가능 범위 | Lv1~5, 각 레벨 Sub1만 |
| 진행 방식 | 순차 (이전 Sub1 통과 후 다음 레벨 Sub1 해금) |
| 일일 세션 한도 | 7회/일 |
| 한도 초과 시 | 24시간 카운트다운 모달 (Premium 업그레이드 유도) |

**배경**: Sub2~Sub3는 Premium 전용. Free 사용자가 "더 하고 싶다"는 욕구가 생기는 지점을 Lv5 Sub1 통과 후로 설계.

---

### D3 — Premium 티어 접근 범위 ✅ 확정

| 항목 | 결정값 |
|---|---|
| 접근 가능 범위 | 전 21단계 (Lv1-1 ~ Lv7-3) |
| 진행 방식 | 순차 (Sub1→Sub2→Sub3 내 레벨 순차, 이전 Sub 통과 필요) |
| 일일 세션 한도 | 없음 |
| Quick Mastery Mode | 활성 (아래 D5 참조) |

---

### D4 — DB PASS_CRITERIA 정정 마이그레이션 ✅ 확정

| 항목 | TS PASS_CRITERIA (현재) | DB RPC 현재 | 결정 (정정 목표) |
|---|---|---|---|
| 수행 횟수 | 10회 | 5회 | **10회** (TS 기준) |
| 정답률 | 85% | 80% | **85%** (TS 기준) |
| 반응속도 | 타이머 35% 이내 | 미구현 | **추가** |
| 최대 연속 정답 | 5회 | 5회 | **5회** (동일) |

**결정**: DB RPC를 TS 기준에 맞게 정정.
**파일**: `supabase/migrations/20260509_pass_criteria_v2.sql` 신규 작성 필요.
**코드 영향**: `record_sublevel_attempt` RPC 파라미터 확장 (`avg_reaction_ratio` 추가) + 통과 체크 로직 정정.

---

### D5 — Quick Mastery Mode (패스트 트랙) 정책 ✅ 확정

| 항목 | 결정값 |
|---|---|
| 대상 등급 | Premium 전용 |
| 적용 범위 | Lv1 Sub2 ~ Lv7 Sub3 (Sub1은 제외) |
| 트리거 조건 | 첫 세션에서 오류율 ≤1% AND 평균 반응시간 ≤ 타이머의 50% |
| 발동 시 | 결과 모달에 "빠른 통과" 배지 + 즉시 해금 |
| 미발동 시 | 일반 통과 기준 (D4 기준) 적용 |

**배경**: 이미 해당 레벨을 충분히 숙지한 Premium 사용자가 불필요한 반복을 건너뛸 수 있도록.

---

### D6 — Mastery Score UI 노출 정책 ✅ 확정

| 등급 | UI 표시 |
|---|---|
| Guest / Free | 블러 처리된 카드 + "Premium으로 잠금 해제" CTA |
| Premium | 전체 노출 (단일 숫자 + 4지표 탭) |

**배경**: Mastery Score는 Premium 핵심 가치 중 하나. Free에게 블러로 노출해 업그레이드 유도.

---

### D7 — AI Coaching 정책 ✅ 확정

| 등급 | 제공 범위 |
|---|---|
| Free | 결과 모달 1행 코멘트 (유형 B) + 대시보드 히어로 카드 요약 (유형 C) |
| Premium | 전체 (유형 A~E: 상세 분석 + 다음 세션 추천 + 약점 음표 + 학습 곡선 + 목표 설정) |

**현황**: AI Coaching 전체 미구현. Group C (Mastery Score + AI Coaching) 작업에서 구현 예정.

---

## 2. 코드 사실 추적 결과 (read-only, 2026-05-09)

### F1 — `canAccessSublevel` (src/lib/levelSystem.ts:281-302) ❌ 불일치

```typescript
// 현재 코드
if (tier === "guest") { return level === 1; }  // Lv1 Sub1~3 모두 허용 ← 5/9 결정과 불일치
if (tier === "free") {
  if (level <= 2) return true;  // Lv1~2 Sub1~3 모두 허용 ← 5/9 결정과 불일치
  if ((level === 3 || level === 4) && sublevel === 1) return true;  // Lv3~4 Sub1
  return false;
}
```

**5/9 결정 기준 정정 내용**:
- `guest`: `level === 1 && sublevel === 1` 으로 변경 (Sub1만)
- `free`: `level <= 5 && sublevel === 1` + 순차 해금 조건 (이전 Sub1 통과 체크) 으로 재작성

**작업 파일**: `src/lib/levelSystem.ts`

---

### F2 — 일일 세션 한도 시스템 🔴 완전 미구현

- `daily_session_count` 컬럼: DB 없음
- `useLives` / `useDailyLimit` 훅: 없음
- `daily-reset` Edge Function: 없음
- `24h countdown` 모달 컴포넌트: 없음

**작업 범위 (Group B)**:
1. `supabase/migrations/20260509_daily_sessions.sql` — `daily_sessions` 테이블 (user_id, date, count)
2. `src/hooks/useDailyLimit.ts` — 오늘 세션 수 조회 + 초과 체크
3. `src/components/DailyLimitModal.tsx` — 24h 카운트다운 UI + Premium CTA
4. `NoteGame.tsx` — 게임 시작 전 daily limit 체크 훅 호출

---

### F3 — LevelSelect Mastery Score UI ⚠️ 부분 구현

- `LevelSelect.tsx`: Mastery Score 숫자 표시 있음 (단일 숫자)
- 4지표 탭 UI: 없음
- 블러 처리 (Free/Guest): 없음 — Premium 아닌 사용자도 그대로 노출
- `PremiumBlurCard` 컴포넌트: 없음

**작업 범위 (Group C)**: 블러 래퍼 컴포넌트 + tier 체크 + 4지표 탭 추가

---

### F4 — AI Coaching 컴포넌트 🔴 완전 미구현

- 결과 모달 1행 코멘트: 없음
- 대시보드 히어로 카드: 없음
- 분석 API 연동: 없음

**작업 범위 (Group C)**: 최소 구현 (Free용 결과 모달 1행 + 대시보드 카드)

---

### F5 — Quick Mastery Mode 🔴 완전 미구현

- 트리거 조건 체크 로직: 없음
- "빠른 통과" 배지: 없음
- 즉시 해금 플로우: 없음

**작업 범위 (Group D)**: `record_sublevel_attempt` RPC 확장 + 클라이언트 트리거 감지 + 결과 모달 배지

---

### F6 — Pricing.tsx 카피 ⚠️ 수정 필요

현재 `freeFeatures[5]`: `"광고 시청 후 이용"` — 5/9 결정으로 폐기된 정책.

수정 항목:
- `freeFeatures[5]` 삭제 또는 `"7회/일 세션 한도"` 로 교체
- `compareRows` Free 열 Lv3~5 Sub1 반영 (현재 Lv3~4 Sub1만)
- Guest 열 Lv1 Sub1만 반영 (현재 Lv1 전체)

**작업 범위 (Group A)**: `src/pages/Pricing.tsx` 수술적 카피 갱신

---

### F7 — DB 스키마 + 마이그레이션 ⚠️ PASS_CRITERIA 불일치

**`supabase/migrations/20260425_sublevel_system.sql` 확인 결과**:
- `record_sublevel_attempt` RPC 통과 기준: `play_count >= 5 AND accuracy >= 0.80`
- TS `PASS_CRITERIA` (levelSystem.ts:166-172): `MIN_PLAY_COUNT: 10, MIN_ACCURACY: 0.85`
- **실제 통과 기준은 DB** — TS 설정은 클라이언트에서만 체크 (DB가 override)

**결정**: 신규 마이그레이션으로 DB를 TS 기준에 맞게 정정
- `play_count >= 10`
- `accuracy >= 0.85`
- `avg_reaction_ratio <= 0.35` (avg_reaction_ms / timer_ms) — 컬럼 추가 필요
- `max_streak >= 5` (이미 일치)

---

## 3. 영역별 작업 그룹 분류

| 그룹 | 항목 | 예상 시간 | 우선순위 |
|---|---|---|---|
| **Group A** (~2h) | canAccessSublevel 정정 + DB 마이그레이션 + Pricing.tsx | 2h | 🔴 즉시 |
| **Group B** (~4h) | 일일 세션 한도 시스템 전체 | 4h | 🔴 출시 전 |
| **Group C** (~5h) | Mastery Score UI (블러) + AI Coaching 기본 | 5h | 🔴 출시 전 |
| **Group D** (~4h) | Quick Mastery Mode | 4h | 🔴 출시 전 |

---

## 4. 결정 보류 항목 (5/9 현재)

| 항목 | 이유 |
|---|---|
| 7일 무료 체험 (Premium Trial) | 결제 플로우 + Paddle 설정 필요 — 출시 후 |
| Lifetime 플랜 ($X 일시불) | 가격 정책 미결 — 출시 후 |
| 배치고사 → 레벨 자동 배정 | 배치고사 전체 미구현 — 출시 후 |
| 랭킹 등록 (Premium) | 랭킹 시스템 미구현 — 출시 후 |
| Free 사용자 스트릭 프리즈 | 스트릭 시스템 미구현 — 추후 |

---

## 5. 다음 세션 시작 우선순위

1. **Group A** (~2h): `canAccessSublevel` 정정 + `20260509_pass_criteria_v2.sql` + `Pricing.tsx` 카피 수술
2. **Group B** (~4h): 일일 세션 한도 시스템 (DB + 훅 + 모달)
3. **Group C** (~5h): Mastery Score 블러 UI + AI Coaching 기본
4. **Group D** (~4h): Quick Mastery Mode

---

## 6. 이번 세션 완료 항목

| 항목 | 상태 |
|---|---|
| 블로그 §1.4~1.5 작성 정책 갱신 | ✅ (2026-05-08 세션) |
| 블로그 9일차 4편 한+영 작성 | ✅ (2026-05-08 세션) |
| 영역 B-0 티어 매트릭스 결정 (D1~D7) | ✅ |
| 코드 사실 추적 7개 영역 | ✅ (read-only) |
| 세션 로그 박음 | ✅ |
| PENDING_BACKLOG.md 갱신 | ✅ |
| DESIGN_VS_CODE_GAP.md 갱신 | ✅ |
