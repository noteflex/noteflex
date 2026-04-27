# 06. 테스트 + 품질

> **작성일**: 2026-04-28
> **선행 자료**: `docs/05_FEATURES.md`
> **데이터 출처**: `test-results.json` (가장 최근 실행 산출물), `vitest.config.ts`, 각 `.test.ts(x)` 파일

---

## 1. 테스트 실행 인프라

### 1.1 테스트 러너

| 도구 | 버전 | 용도 |
|---|---|---|
| **Vitest** | 3.2.4 | 단위·통합·정책·스트레스 테스트 |
| `@testing-library/react` | 16.0 | 컴포넌트 렌더링·쿼리 |
| `@testing-library/user-event` | 14.6 | 사용자 이벤트 시뮬레이션 |
| `@testing-library/jest-dom` | 6.6 | DOM 매처 (`toBeInTheDocument` 등) |
| `jsdom` | 20.0 | 가상 DOM (`vitest.config.ts:8`) |
| `@playwright/test` | 1.57 | 설치만 — **E2E 테스트 0개** |

### 1.2 설정 (`vitest.config.ts`)

```ts
{
  environment: "jsdom",
  globals: true,                          // describe/it/expect 직접 호출
  setupFiles: ["./src/test/setup.ts"],
  include: ["src/**/*.{test,spec}.{ts,tsx}"],
}
```

### 1.3 셋업 파일 (`src/test/setup.ts`)

- `@testing-library/jest-dom` 매처 등록
- 글로벌 mock 또는 polyfill (코드에서 정확히 확인 필요)

### 1.4 실행 명령

| 명령 | 설명 |
|---|---|
| `npm test` | 1회 실행 (CI 모드) |
| `npm run test:watch` | 감시 모드 |
| `npm run lint` | ESLint |
| `npm run iap:test` | IAP 함수 로컬 검증 (`scripts/test-iap-verification.sh`) |

---

## 2. 테스트 파일 카탈로그

발견된 테스트 파일 **18개** (모두 `src/**/*.test.{ts,tsx}` — 별도 e2e 디렉토리 없음).

### 2.1 컴포넌트 테스트 (7개)

| 파일 | 종류 | 검증 영역 |
|---|---|---|
| `src/components/UpgradeModal.test.tsx` | 단위 | Pro 권유 모달 — 렌더링, 네비게이션, 기능 버튼 |
| `src/components/NoteGame.test.tsx` | 통합 | retry queue 통합 — 오답 등록 / N+2 재출제 / 정답 시 큐 제거. **1개 케이스 실패** (line 277, 재재출제 시나리오) |
| `src/components/NoteGame.policy.test.tsx` | 정책 | 신규 정책 (오답 시 같은 자리 유지) — 초기 상태, 정답 진행, 오답 처리, 재출제, 라이프 소진 |
| `src/components/NoteGame.stress.test.tsx` | 스트레스 | 자동 플레이 — 각 레벨(1~7) × 시나리오(전정답 / 전오답 / 랜덤 50%) 조합, 데이터 일관성 |
| `src/components/LevelSelect.test.tsx` | 단위/통합 | 21셀 렌더, 게이팅 (guest/free/pro), 진행률 뱃지 |
| `src/components/GameOverDialog.test.tsx` | 단위 | 제목, 정확도, 버튼 콜백 |
| `src/components/SublevelPassedDialog.test.tsx` | 단위 | 통과/클리어 메시지, 정확도, 다음 단계 버튼 |

### 2.2 Hook 테스트 (4개)

| 파일 | 종류 | 검증 영역 |
|---|---|---|
| `src/hooks/useBatchRuns.test.ts` | 단위 | DB 쿼리, 에러 처리, summary 통계, 수동 실행 트리거 |
| `src/hooks/useLevelProgress.test.ts` | 단위 | 자동 fetch, RPC 호출, 재fetch, 권한 검증 |
| `src/hooks/useRetryQueue.test.ts` | 단위 | N+2/N+1/즉시 규칙, 음표 식별 (clef/octave/accidental), 복수 항목 처리 |
| `src/hooks/useMasteryDetails.test.ts` | 단위 | weakness/mastery 분류 쿼리, 시간 추적, 새로고침 |

### 2.3 라이브러리 테스트 (5개)

| 파일 | 종류 | 검증 영역 |
|---|---|---|
| `src/lib/nicknameValidation.test.ts` | 단위 | 형식 (3-20자, 소문자/숫자/밑줄), 다국어 메시지 |
| `src/lib/subscriptionTier.test.ts` | 단위 | guest/free/pro/admin 매핑, 우선순위 (admin > pro > is_premium > free) |
| `src/lib/levelSystem.test.ts` | 단위 | SUBLEVEL_CONFIGS, 통과 조건 (play/streak/accuracy), 접근 제어, 다음/이전 단계 |
| `src/lib/noteWeighting.test.ts` | 단위 | 가중치 (3.0 / 1.0 / 0.3), 통계적 분포 검증 |
| `src/lib/solfege.test.ts` | 단위 | 한국어/영어/라틴 매핑, 로케일 자동 감지 |

### 2.4 페이지 테스트 (2개)

| 파일 | 종류 | 검증 영역 |
|---|---|---|
| `src/pages/Home.test.tsx` | 통합 | rhythm/diagnosis/activity 탭 전환, 콘텐츠 분리, URL 동기화 |
| `src/pages/ProfilePage.test.tsx` | 통합 | 닉네임 검증, 가용성 확인, localStorage 동기화, 로그아웃 |

### 2.5 기타 (1개)

| 파일 | 비고 |
|---|---|
| `src/test/example.test.ts` | 셋업 검증용 예제 — 실제 의미 없음 |

---

## 3. 테스트 종류별 통계

| 종류 | 파일 수 | 비고 |
|---|---|---|
| 단위 (Unit) | 11 | hook 4, library 5, dialog 2 |
| 통합 (Integration) | 5 | NoteGame, LevelSelect, Home, ProfilePage, example |
| 정책 (Policy) | 1 | NoteGame.policy |
| 스트레스 (Stress) | 1 | NoteGame.stress |
| **합계** | **18 파일** | |

### 3.1 케이스 통과 현황 (`test-results.json`)

```
총 스위트:  71
통과 스위트: 69  ✓
실패 스위트:  2

총 테스트:  190
통과 테스트: 189  ✓
실패 테스트:  1   ✗
```

> 📌 사용자 컨텍스트("263개 통과")와 다름 — `test-results.json`은 마지막 실행 시점 산출물로, 최근 변경(`499a9e3`, `c20e737`, `3b34405` 등) 후 재실행하면 갯수가 달라질 수 있다. 출시 직전 재실행으로 갱신 필요.

### 3.2 실행 시간

- 총 ~15초 (스트레스 테스트 영향)

---

## 4. 알려진 실패 케이스

### 4.1 NoteGame.test.tsx:277

| 항목 | 값 |
|---|---|
| 케이스 | "재출제된 음표를 또 오답하면 재재출제까지 이어짐" |
| 기대 | E |
| 실제 | A |
| 원인 추정 | 음표 선택 결정성 — `weightedPickIndex` 랜덤 + retry queue FIFO 순서가 테스트 시드와 어긋남 |
| 영향 | 정책 테스트(`NoteGame.policy.test.tsx`) 및 hook 단위 테스트(`useRetryQueue.test.ts`)는 통과 — 실패는 통합 시나리오 한정 |
| 권장 조치 | 테스트에서 randomness seed 고정 또는 mock으로 결정성 부여 |

---

## 5. 테스트 갭 분석 (Gap Analysis)

### 5.1 미테스트 페이지 (15개 페이지 중 13개 ❌)

| 페이지 | 테스트 |
|---|---|
| `Index.tsx` | ❌ |
| `Pricing.tsx` | ❌ |
| `CheckoutSuccess.tsx` | ❌ |
| `CheckoutFailed.tsx` | ❌ |
| `Blog.tsx` | ❌ |
| `BlogPost.tsx` | ❌ |
| `NotFound.tsx` | ❌ |
| `legal/LegalPage.tsx` | ❌ |
| `admin/AdminLayout.tsx` | ❌ |
| `admin/AdminUsers.tsx` | ❌ |
| `admin/AdminUserDetail.tsx` | ❌ |
| `admin/AdminLogs.tsx` | ❌ |
| `admin/AdminBatchRuns.tsx` | ❌ (hook은 ✅) |
| `Home.tsx` | ✅ |
| `ProfilePage.tsx` | ✅ |

### 5.2 미테스트 컴포넌트 (도메인 컴포넌트 ~30개 중 7개만 ✅)

테스트 있음:
- `LevelSelect`, `NoteGame` (3종 테스트), `UpgradeModal`, `GameOverDialog`, `SublevelPassedDialog`

테스트 없음 (주요):
- `NoteButtons`, `GameHeader`, `CountdownTimer`, `CountdownOverlay`, `StaffDisplay`, `GrandStaffPractice`
- `MissionSuccessModal`, `AccidentalSwipeTutorial`
- `AuthModal`, `PremiumRequiredDialog`, `ComingSoonGate`, `AdminGuard`
- `Footer`, `NavLink`, `MarkdownContent`, `CookieBanner`, `BatchAnalysisSection`, `DiagnosisTab`
- 관리자 다이얼로그 4종 (`PremiumDialog`, `RoleChangeDialog`, `XpAdjustDialog`, `StreakAdjustDialog`)

### 5.3 미테스트 Hook (~18개 중 4개만 ✅)

테스트 있음:
- `useRetryQueue`, `useLevelProgress`, `useBatchRuns`, `useMasteryDetails`

테스트 없음 (주요):
- `useAuth` (Context)
- `useProfile`
- `useNicknameAvailability`
- `useUserMastery`, `useNoteLogger`, `useSessionRecorder`
- `useUserStats`, `useMyStats`
- `useAdminUsers`, `useAdminUserDetail`, `useAdminLogs`
- `useSwipeAccidental`, `useSolfegeSystem`
- `use-toast`, `use-mobile`

### 5.4 미테스트 lib

- `paddle.ts` ❌
- `adminActions.ts` ❌
- `userNoteLogs.ts` ❌
- `markdownLoader.ts` ❌
- `staffGeometry.ts` ❌
- `sound.ts` ❌
- `featureFlags.ts` ❌
- `profile.ts` ❌
- `noteTypes.ts` ❌
- `utils.ts` ❌

### 5.5 미테스트 Edge Function

| 함수 | 테스트 |
|---|---|
| `admin-action` | ❌ |
| `paddle-webhook` | ❌ |
| `verify-iap-receipt` | 로컬 스크립트만 (`scripts/test-iap-verification.sh`) |
| `analyze-sheet-music` | ❌ |
| `payment-webhook` | (구현 미완) |
| `create-checkout-session` | (구현 미완) |

---

## 6. E2E 테스트 부재

| 항목 | 상태 |
|---|---|
| Playwright 설치 | ✅ (`@playwright/test 1.57`) |
| `playwright.config.ts` | ✅ (`createLovableConfig()` 기본 설정만) |
| `playwright-fixture.ts` | ✅ (existence — 내용 미확인) |
| **E2E 테스트 파일** | ❌ (0개) |
| `e2e/` 또는 `tests/` 디렉토리 | ❌ |

> 🔴 **Phase 7 펜딩** — `docs/PENDING_BACKLOG.md §12.2`. 출시 직후 시나리오:
> - 가입 → 첫 게임 → 통과 → 결제 → 게임오버
> - 관리자: 권한 변경 → 학생 계정 알림
> - 배치 분석 수동 실행 → 약점 갱신 확인

---

## 7. CI/CD 설정

| 항목 | 상태 |
|---|---|
| `.github/workflows/` | ❌ (디렉토리 없음) |
| GitHub Actions | ❌ |
| Vercel 자동 배포 | ✅ (Git push 시 — 빌드만, 테스트 게이팅 없음) |
| Husky / lint-staged | ❌ |
| Pre-commit hooks | ❌ |
| 자동화 스크립트 | `scripts/test-iap-verification.sh` (수동 실행 IAP 검증) |

> 🔴 **현황**: 배포 전 자동 테스트·린트·빌드 가드 부재. 모든 검증은 수동으로 `npm test` / `npm run lint` / `npm run build` 실행 필요.

---

## 8. 테스트 패턴 (모범 사례)

### 8.1 Mock 전략

`NoteGame.test.tsx`의 mock 패턴 (요약):

```ts
vi.hoisted(() => { /* mocks 미리 선언 */ });

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => testUser }));
vi.mock("@/hooks/useUserMastery", () => ({ useUserMastery: () => emptyMap }));
vi.mock("@/hooks/useNoteLogger");
vi.mock("@/hooks/useSessionRecorder");
vi.mock("@/lib/sound", () => ({ playCorrect: vi.fn(), playWrong: vi.fn() }));
vi.mock("@/components/practice/GrandStaffPractice");
```

이 패턴이 좋은 이유:
- 외부 통합(DB, 사운드, 복잡한 SVG 렌더) 차단
- 테스트 격리 — NoteGame 자체 로직만 검증

### 8.2 Hook 테스트 패턴

`useRetryQueue.test.ts`처럼 hook은 `renderHook` + `act`로 검증.

### 8.3 정책 테스트

`NoteGame.policy.test.tsx`는 행동 시나리오 단위 — "오답 시 같은 자리 유지" 같은 비즈니스 규칙을 명확히 표현.

### 8.4 스트레스 테스트

`NoteGame.stress.test.tsx`는 자동 플레이 시나리오로 데이터 일관성 (정답/오답 합 = 시도 합) 검증.

---

## 9. 권장 보강 우선순위

### 🔴 출시 전 필수

1. **NoteGame.test.tsx 실패 케이스 수정** — 결정성 확보 또는 케이스 의도 재검토.
2. **`useNoteLogger`, `useSessionRecorder` 단위 테스트** — DB 쓰기 + XP 계산은 핵심 데이터 무결성 영역.
3. **Pricing → Paddle Checkout 통합 테스트** (mock paddle-js).
4. **AdminGuard / ComingSoonGate 가드 테스트** — 보안 직결.
5. **CI 도입**: GitHub Actions로 `npm test && npm run lint && npm run build` 자동화.

### 🟡 출시 직후 (Phase 7)

6. **E2E 골든 패스** — Playwright 시나리오 3~5개:
   - 가입 → 첫 게임 → 단계 통과
   - Pro 결제 → 잠금 해제 확인
   - 관리자: 사용자 검색 → 프리미엄 부여 → 로그 확인
7. **Edge Function 통합 테스트** — `paddle-webhook`, `admin-action` (서명 검증, 권한 검증).
8. **DiagnosisTab + BatchAnalysisSection 시각 회귀 테스트** (chromatic 또는 storybook).

### 🟢 중장기

9. **부하 테스트** — k6로 동시접속 (`docs/PENDING_BACKLOG.md §7.5`).
10. **카오스 테스트** — Supabase 응답 지연·실패 시 UX 검증.

---

## 10. 결론

| 영역 | 상태 |
|---|---|
| 게임 도메인 로직 | 🟢 강함 — retry queue / level system / mastery 가중치 모두 단위·정책·스트레스 테스트 |
| UI 컴포넌트 | 🔴 약함 — ~90% 미테스트 |
| Hook (auth/profile/sessions) | 🔴 약함 |
| 페이지 통합 | 🟡 중간 — Home/ProfilePage만 ✅ |
| Edge Function | 🔴 부재 |
| E2E | 🔴 부재 (Phase 7 펜딩) |
| CI/CD | 🔴 부재 |

**출시 직전 행동**: 위 §9의 🔴 5개 항목을 1~2일 안에 처리하면 핵심 회귀 위험을 90% 차단할 수 있다.

---

다음: `docs/07_DEPLOYMENT.md` (배포 + 인프라)
