# 05. 사용자 관점 기능 카탈로그

> **작성일**: 2026-04-28
> **선행 자료**: `docs/02_ARCHITECTURE.md`, `docs/03_GAME_LOGIC.md`
> **미구현 기능**: `docs/PENDING_BACKLOG.md` 참조

이 문서는 **현재 코드에 구현된 기능**을 사용자 관점에서 카테고리별로 정리한다. 각 항목에는 진입 경로(URL/UI), 코드 위치, 테스트 커버리지를 명시한다.

---

## 범례

| 마크 | 의미 |
|---|---|
| ✅ | 테스트 있음 |
| ⚠️ | 부분 테스트 또는 mocked |
| ❌ | 테스트 없음 |
| 🔴 | 미구현 (백로그 참조) |

---

## 1. 인증·계정 (Authentication & Account)

### 1.1 회원가입 / 로그인 (이메일+비밀번호, Google OAuth)

| 항목 | 값 |
|---|---|
| 진입 경로 | `pages/Index.tsx` 헤더의 "로그인" 버튼 → `AuthModal` 오픈 |
| 코드 | `src/components/AuthModal.tsx` |
| 데이터 | Supabase Auth → `auth.users` → 트리거로 `profiles` 자동 생성 |
| 흐름 | 2단계: ① 계정 생성/로그인 → ② 프로필 작성 (닉네임 등) |
| 테스트 | ❌ |

### 1.2 닉네임 실시간 중복 체크

| 항목 | 값 |
|---|---|
| 위치 | AuthModal 2단계, ProfilePage |
| 코드 | `src/hooks/useNicknameAvailability.ts`, `src/lib/nicknameValidation.ts` |
| 동작 | 형식 검증(즉시) + 디바운스 500ms 후 `check_nickname_available` RPC 호출, 추천 닉네임 생성 |
| 테스트 | ✅ `src/lib/nicknameValidation.test.ts` (형식 검증) / 가용성 hook은 ❌ |

### 1.3 프로필 페이지 — 닉네임/언어/솔페지 설정

| 항목 | 값 |
|---|---|
| URL | `/profile` (Coming Soon 게이팅) |
| 코드 | `src/pages/ProfilePage.tsx` |
| 설정 항목 | 닉네임, 표시 언어 (locale), 계이름 표기 (한국어 도레미 / 영어 CDE / 라틴 Do-Re-Mi) |
| 솔페지 hook | `src/hooks/useSolfegeSystem.ts` (localStorage + locale 자동 감지) |
| 솔페지 라이브러리 | `src/lib/solfege.ts` |
| 테스트 | ✅ `src/pages/ProfilePage.test.tsx` (닉네임 검증, localStorage 동기화, 로그아웃) + `src/lib/solfege.test.ts` |

### 1.4 계정 정보 표시 (이메일, 가입일, 구독 상태)

| 항목 | 값 |
|---|---|
| 위치 | ProfilePage 하단 카드 |
| 데이터 | `profile.email`, `profile.created_at`, `profile.is_premium`, `profile.premium_until` |
| 테스트 | ❌ (페이지 통합 테스트는 닉네임 위주) |

### 1.5 로그아웃

| 항목 | 값 |
|---|---|
| 위치 | ProfilePage 하단, `AuthBar` 메뉴 |
| 코드 | `useAuth().signOut()` → `supabase.auth.signOut()` |
| 테스트 | ✅ `ProfilePage.test.tsx` |

### 1.6 자동 로케일/국가 감지

| 항목 | 값 |
|---|---|
| 코드 | `src/lib/profile.ts` — `detectLocale()`, `detectCountryCodeSmart()` |
| 동작 | 브라우저 navigator 정보로 국가/언어 자동 감지 → 가입 시 기본값으로 |
| 테스트 | ❌ |

### 1.7 미구현 / 백로그

- 🔴 비밀번호 변경, 이메일 변경, 회원 탈퇴 (`PENDING_BACKLOG.md §5.2`)
- 🔴 학습 이력 다운로드 (CSV/PDF) (`§5.2`)

---

## 2. 게임 (Gameplay)

### 2.1 레벨 선택 그리드 (21단계)

| 항목 | 값 |
|---|---|
| URL | `/`, `/play` (Coming Soon 게이팅) |
| 코드 | `src/components/LevelSelect.tsx` |
| 표시 | 7×3 그리드, 잠금 셀(자물쇠) + 진도 뱃지 + 통과 체크 |
| 게이팅 | `canAccessSublevel(tier, level, sublevel)` (`src/lib/levelSystem.ts:225-246`) |
| 잠금 클릭 시 | `UpgradeModal` 또는 `PremiumRequiredDialog` 표시 |
| 테스트 | ✅ `src/components/LevelSelect.test.tsx` (렌더, 게이트, 진행률) |

### 2.2 게임플레이 (NoteGame)

| 항목 | 값 |
|---|---|
| 진입 | LevelSelect에서 단계 클릭 → `Index.tsx` phase=playing |
| 코드 | `src/components/NoteGame.tsx` (1100+ 라인) |
| 도메인 로직 상세 | **`docs/03_GAME_LOGIC.md`** |
| 핵심 컴포넌트 | `GameHeader`, `GrandStaffPractice`, `NoteButtons`, `CountdownTimer`, `CountdownOverlay` |
| 테스트 | ✅ 정책 (`NoteGame.policy.test.tsx`), ⚠️ 통합 (`NoteGame.test.tsx` — 1개 실패), ✅ 스트레스 (`NoteGame.stress.test.tsx`) |

### 2.3 게임 시작 카운트다운 (3-2-1)

| 항목 | 값 |
|---|---|
| 위치 | NoteGame mount 직후 |
| 코드 | `src/components/CountdownOverlay.tsx` |
| 테스트 | ❌ |

### 2.4 음표당 카운트다운 타이머 (색상 단계)

| 항목 | 값 |
|---|---|
| 코드 | `src/components/CountdownTimer.tsx` |
| 단계 | 50% 이상 파랑 / 25-50% 노랑 / 0-25% 주황 / 1초 이하 빨강+pulse |
| 만료 시 | `handleTimerExpire()` → 오답 동일 처리 (같은 자리 유지) |
| 테스트 | ❌ |

### 2.5 정답 버튼 (다언어 — 도레미 / CDE / Do-Re-Mi)

| 항목 | 값 |
|---|---|
| 코드 | `src/components/NoteButtons.tsx` |
| 라벨 결정 | `useSolfegeSystem()` (ko/en/latin) |
| Lv 5+ 모드 | 자연음 7개만 표시, accidental 라벨 제거 (스와이프로 처리) |
| 테스트 | ❌ (NoteButtons 단위 테스트 없음 — 솔페지 라이브러리만 ✅) |

### 2.6 스와이프 액시덴탈 (Lv 5+)

| 항목 | 값 |
|---|---|
| Hook | `src/hooks/useSwipeAccidental.ts` |
| 임계 | **56px** |
| 동작 | 위로 스와이프 = 샵, 아래로 = 플랫, 탭 또는 미달 = 자연음 |
| 첫 사용 튜토리얼 | `src/components/AccidentalSwipeTutorial.tsx` |
| 테스트 | ❌ |

### 2.7 retry queue — 오답 재출제

| 항목 | 값 |
|---|---|
| Hook | `src/hooks/useRetryQueue.ts` |
| 정책 | N+2 / N+1 / 즉시 (미스 누적별) |
| 상세 | `docs/03_GAME_LOGIC.md §3` |
| 테스트 | ✅ `src/hooks/useRetryQueue.test.ts` (algorithm), ⚠️ `NoteGame.test.tsx` (1개 실패) |

### 2.8 라이프 회복 (3 연속 정답)

| 항목 | 값 |
|---|---|
| 정책 | 연속 3회 + 라이프 < 최대치 → +1 |
| 코드 | `NoteGame.tsx:744-750` |
| UI | `setLifeRecovered(true)` 1.5초 펄스 |
| 테스트 | ✅ 정책 테스트 |

### 2.9 키사인 시스템 (Lv 5+)

| 항목 | 값 |
|---|---|
| Lv 5 | 샵 키 7종 |
| Lv 6 | 플랫 키 7종 |
| Lv 7 | 둘 다 (14종) |
| 갱신 | Stage 전환 시 새 조성, Stage 내에서는 고정 |
| 코드 | `NoteGame.tsx:39-72, 587, 608` |
| 테스트 | ❌ (정책 테스트 부분 커버) |

### 2.10 가중치 출제 (mastery 기반)

| 항목 | 값 |
|---|---|
| Hook | `src/hooks/useUserMastery.ts` (mount 시 1회 로드) |
| 라이브러리 | `src/lib/noteWeighting.ts` |
| 가중치 | weakness 3.0 / normal 1.0 / mastery 0.3 |
| 호출 | `NoteGame.tsx:269-271, 207-211` |
| 테스트 | ✅ `src/lib/noteWeighting.test.ts` |

### 2.11 게임 결과 — 스테이지 통과 / 게임오버 / 미션 성공

| 항목 | 값 |
|---|---|
| `SublevelPassedDialog` | 스테이지 완료 시 — 다음 단계 진행 버튼 |
| `GameOverDialog` | 라이프 0 시 — 이전 단계 / 재시도 |
| `MissionSuccessModal` | 마일스톤 (특별 보상) |
| 테스트 | ✅ `SublevelPassedDialog.test.tsx`, ✅ `GameOverDialog.test.tsx` / MissionSuccessModal ❌ |

### 2.12 음표 사운드 재생

| 항목 | 값 |
|---|---|
| 라이브러리 | `tone 15.1` |
| 코드 | `src/lib/sound.ts` |
| 효과음 | 정답: 음표 자체 재생, 오답: E2 저음, 라이프 회복: (코드 확인 필요) |
| 테스트 | (mock으로 noop 처리됨) |

### 2.13 미구현 / 백로그

- 🔴 힌트 시스템 (50% 시간 경과 시 시각 힌트 옵션) (`PENDING_BACKLOG.md §4.4`)
- 🟢 코드 연습 모드 (화음 계이름) (`§4.1`)
- 🟡 사용자화 레벨 (저작권 free 곡) (`§4.2`)
- 🟢 사용자 악보 스캔 (OCR — 함수는 일부 존재) (`§4.3`)
- 🔴 반응속도 측정 정밀도 개선 (`§7.1`)
- 🔴 Lv 7-3 첫 음표 buffering 이슈 (`§12.5`)

---

## 3. 학습 분석 (Dashboard)

### 3.1 Home 탭 구조

| 항목 | 값 |
|---|---|
| URL | `/home` (Coming Soon 게이팅) |
| 코드 | `src/pages/Home.tsx` |
| 탭 | rhythm (학습 리듬) / diagnosis (실력 진단) / activity (활동 기록) — URL 동기화 |
| 상단 | `LastUpdatedStrip` ("5분 전 업데이트", 1분마다 갱신) |
| 테스트 | ✅ `src/pages/Home.test.tsx` (탭 네비게이션, URL 동기화) |

### 3.2 학습 리듬 탭 (XP / 정확도 추이)

| 항목 | 값 |
|---|---|
| 컴포넌트 | `XpBarChart` (7일/30일 토글), `AccuracyReactionChart` |
| 라이브러리 | `recharts 2.15` |
| 데이터 | `useUserStats(user)` — weekStats / dailyStats30d |
| 테스트 | ❌ |

### 3.3 실력 진단 탭 (`DiagnosisTab`)

| 항목 | 값 |
|---|---|
| 코드 | `src/components/home/DiagnosisTab.tsx` |
| 데이터 | `fetchUserNoteLogs(200)` → 음표별 정확도/반응시간 분석 |
| 표시 | 약점 음표, 최고 음표, 일일 정확도 추이 |
| 보조 컴포넌트 | `BatchAnalysisSection.tsx` (배치 분석 결과) |
| 테스트 | ❌ |

### 3.4 활동 기록 탭

| 항목 | 값 |
|---|---|
| 데이터 | `useMyStats(user)` — 최근 세션 20개 |
| 표시 | 세션 테이블 (날짜, 레벨, 점수, 정확도, 결과) |
| 테스트 | ❌ |

### 3.5 펜딩

- 🟡 기록 비교 피드백 ("어제보다 G5 0.3초 빨라짐") (`PENDING_BACKLOG.md §5.1`)
- 🟡 배치고사 진행도 가시화 (`§2.5`)

---

## 4. 결제 (Subscription)

### 4.1 가격 페이지 (`/pricing`)

| 항목 | 값 |
|---|---|
| 코드 | `src/pages/Pricing.tsx` |
| 상품 | 월간 ($2.99 확정) / 연간 (할인율 미정) |
| 토글 | 월간/연간 (44% 할인 표기) |
| 테스트 | ❌ |

### 4.2 Paddle Checkout (Web)

| 항목 | 값 |
|---|---|
| 코드 | `src/lib/paddle.ts:openCheckout()` |
| 환경 | Sandbox (출시 시 Production) |
| Price ID | `VITE_PADDLE_PRICE_MONTHLY` / `VITE_PADDLE_PRICE_YEARLY` |
| 결제 후 리다이렉트 | `/checkout/success` |
| 결제 결과 동기화 | Paddle 웹훅 → `paddle-webhook` Edge Function → `subscriptions` UPSERT + `profiles.is_premium=true` |
| 테스트 | ❌ |

### 4.3 결제 완료 / 실패 페이지

| 페이지 | URL | 동작 |
|---|---|---|
| `CheckoutSuccess.tsx` | `/checkout/success` | 축하 메시지 → 5초 후 메인 자동 이동 |
| `CheckoutFailed.tsx` | `/checkout/failed?reason=cancelled` | 다시 결제 또는 홈 |

테스트: ❌

### 4.4 IAP (Mobile — RevenueCat)

| 항목 | 값 |
|---|---|
| SDK | `@revenuecat/purchases-capacitor 12.3` |
| 검증 함수 | `supabase/functions/verify-iap-receipt/` |
| 패키지 | `scan_pack_10` (10 credits), `scan_pack_30` (30 credits) — 악보 스캔 충전 |
| 테스트 | 로컬 스크립트만 (`scripts/test-iap-verification.sh`, `README_IAP_TESTING.md`) |

> 📌 IAP는 현재 **scan_quota 충전용**으로만 동작. 구독 자체는 Paddle 또는 RevenueCat 어느 쪽이든 `is_premium`을 채울 수 있음 (확인 필요).

### 4.5 구독 등급 차등 적용

| 영역 | 정책 |
|---|---|
| 게임 단계 | guest=Lv1, free=Lv1·2+Lv3-1+Lv4-1, pro=전체 21단계 (`canAccessSublevel`) |
| 잠금 시 UI | `UpgradeModal` (LevelSelect) / `PremiumRequiredDialog` |
| 테스트 | ✅ `src/lib/subscriptionTier.test.ts` (등급 판정), ✅ `LevelSelect.test.tsx` (게이트) |

### 4.6 펜딩

- 🔴 연간 할인율 결정 (`§1.2`)
- 🔴 결제 후킹 메시지 (Pro 어필, 활용 유도, 취소 saver) (`§1.3`)
- 🟡 챌린지 구독 + 굿즈 패키지 (`§1.4`)

---

## 5. 관리자 (`/admin`)

> 🔒 모두 `AdminGuard` (profile.role==='admin') 통과 + Coming Soon 모드 무관 항상 접근 가능.

### 5.1 사용자 관리 (`/admin/users`)

| 항목 | 값 |
|---|---|
| 코드 | `src/pages/admin/AdminUsers.tsx` |
| Hook | `useAdminUsers()` — 페이지네이션, 필터(검색/role/premium/minor) |
| 표시 | 테이블 (이메일, 닉네임, 권한, 프리미엄, XP, 가입일) |
| 테스트 | ❌ |

### 5.2 사용자 상세 (`/admin/users/:id`)

| 항목 | 값 |
|---|---|
| 코드 | `src/pages/admin/AdminUserDetail.tsx` |
| Hook | `useAdminUserDetail(id)` — profile + sessions + dailyStats + weakNotes |
| 액션 다이얼로그 | `RoleChangeDialog`, `PremiumDialog`, `XpAdjustDialog`, `StreakAdjustDialog` |
| 통계 | 30일 XP 차트, 세션 로그, 약점 음표 |
| 테스트 | ❌ |

### 5.3 액션 로그 (`/admin/logs`)

| 항목 | 값 |
|---|---|
| 코드 | `src/pages/admin/AdminLogs.tsx` |
| Hook | `useAdminLogs()` — 필터(action_type, admin_id, days) |
| 표시 | 확장 가능한 행 (변경 내역 JSON) |
| 데이터 | `admin_actions` 테이블 |
| 테스트 | ❌ |

### 5.4 일일 배치 이력 (`/admin/batch-runs`)

| 항목 | 값 |
|---|---|
| 코드 | `src/pages/admin/AdminBatchRuns.tsx` |
| Hook | `useBatchRuns()` |
| 표시 | 최근 30일 — 날짜, 상태, 분석 건수, weakness↑↓, mastery, 프리미엄 만료 |
| 액션 | "수동 실행" 버튼 (`run_daily_batch_analysis()` RPC) |
| 테스트 | ✅ `src/hooks/useBatchRuns.test.ts` (hook 단위) / 페이지 ❌ |

### 5.5 Edge Function 백엔드

`admin-action`이 모든 변경을 처리 — IP/UA + before/after를 `admin_actions`에 기록. 자세한 내용 `docs/04_DB_SCHEMA.md §11.1`.

### 5.6 펜딩

- 🟡 매출 대시보드, 사용자 행동 퍼널, A/B 테스트 결과, 광고 실적, 콘텐츠 관리 (`PENDING_BACKLOG.md §8`)

---

## 6. 법적·콘텐츠 (Legal & Content)

### 6.1 법적 페이지

| URL | slug | 코드 | 콘텐츠 |
|---|---|---|---|
| `/terms` | terms | `pages/legal/LegalPage.tsx` | `src/content/legal/terms.md` |
| `/privacy` | privacy | 좌동 | `src/content/legal/privacy.md` |
| `/refund` | refund | 좌동 | `src/content/legal/refund.md` |
| `/cookies` | cookies | 좌동 | `src/content/legal/cookies.md` |

| 항목 | 값 |
|---|---|
| 노출 | **Coming Soon 모드에서도 항상 노출** (Paddle 등록 / 광고 심사용) |
| 마크다운 로더 | `src/lib/markdownLoader.ts` (`import.meta.glob`) |
| 렌더 | `MarkdownContent.tsx` (react-markdown + remark-gfm) |
| 테스트 | ❌ |
| 펜딩 | 🔴 변호사 자문 후 본문 정식 작성 (`PENDING_BACKLOG.md §10.1`) |

### 6.2 블로그

| URL | 페이지 | 콘텐츠 |
|---|---|---|
| `/blog` | `pages/Blog.tsx` (목록) | `src/content/blog/*.md` (현재 `welcome.md` 1개) |
| `/blog/:slug` | `pages/BlogPost.tsx` | 좌동 |

| 항목 | 값 |
|---|---|
| 노출 | 항상 (AdSense 심사용) |
| 펜딩 | 🔴 심사용 2~3편 + 승인 후 15~20편 (`PENDING_BACKLOG.md §10.2`) |

### 6.3 쿠키 배너

| 항목 | 값 |
|---|---|
| 코드 | `src/components/CookieBanner.tsx` |
| 표시 | 모든 페이지에서 항상 (App.tsx:109) |
| 테스트 | ❌ |

### 6.4 푸터

| 항목 | 값 |
|---|---|
| 코드 | `src/components/Footer.tsx` |
| 링크 | 블로그, 약관, 개인정보, 환불, 쿠키, SNS (펜딩) |
| 테스트 | ❌ |

---

## 7. Coming Soon 모드 (`VITE_GAME_ENABLED=false`)

### 7.1 동작

- 메인(`/`)에 "2026년 5월 출시 예정" 배너 표시 (※ 정확한 카피는 코드 확인 필요)
- 게임/결제/인증 라우트 → `/`로 리다이렉트
- 정적 페이지(블로그, 약관) + `/admin/*`은 항상 노출

### 7.2 토글 스위치

`src/lib/featureFlags.ts:10-11`:

```ts
export const GAME_ENABLED =
  import.meta.env.VITE_GAME_ENABLED === "true";
```

### 7.3 가드 컴포넌트

`src/components/ComingSoonGate.tsx:9-14` — `Navigate to="/" replace`로 차단.

### 7.4 출시 전환 절차

`docs/PENDING_BACKLOG.md §11` 체크리스트 → `docs/07_DEPLOYMENT.md` 참조.

---

## 8. 모바일 (Capacitor)

### 8.1 빌드

| 항목 | 값 |
|---|---|
| 설정 | `capacitor.config.ts` (appId: `com.domisol.app`, appName: `Domisol`, webDir: `dist`) |
| 명령 | `npm run cap:sync` (`build` + `cap sync`), `npm run cap:open:android`, `npm run cap:open:ios` |
| 디렉토리 | `android/` (커밋됨), `ios/` (없음 — iOS 미빌드 추정) |

### 8.2 IAP

| 항목 | 값 |
|---|---|
| SDK | `@revenuecat/purchases-capacitor 12.3` |
| 가이드 | `README_IAP_TESTING.md` |
| 검증 함수 | `verify-iap-receipt` |

### 8.3 펜딩

- 🟡 PWA 구현 (Service Worker) (`PENDING_BACKLOG.md §7.4`)

---

## 9. 기능 매트릭스 요약

| 카테고리 | 기능 | 코드 위치 | URL/UI | 테스트 |
|---|---|---|---|---|
| 인증 | Google OAuth + 이메일 회원가입 | AuthModal.tsx | Index 헤더 | ❌ |
| 인증 | 닉네임 실시간 중복 체크 | useNicknameAvailability.ts | AuthModal, ProfilePage | ⚠️ |
| 인증 | 프로필 설정 | ProfilePage.tsx | `/profile` | ✅ |
| 인증 | 로그아웃 | AuthContext.signOut | ProfilePage | ✅ |
| 게임 | 21단계 레벨 선택 | LevelSelect.tsx | `/`, `/play` | ✅ |
| 게임 | 게임 엔진 | NoteGame.tsx | LevelSelect 클릭 후 | ✅⚠️ |
| 게임 | retry queue (N+2) | useRetryQueue.ts | NoteGame 내부 | ✅ |
| 게임 | 가중치 출제 | noteWeighting.ts | NoteGame 내부 | ✅ |
| 게임 | 키사인 (Lv5+) | NoteGame.tsx:39-72 | NoteGame 내부 | ❌ |
| 게임 | 스와이프 액시덴탈 (56px) | useSwipeAccidental.ts | NoteButtons | ❌ |
| 게임 | 라이프 회복 (3연속) | NoteGame.tsx:744-750 | GameHeader | ✅ |
| 게임 | 카운트다운 타이머 | CountdownTimer.tsx | NoteGame | ❌ |
| 게임 | 게임오버/통과 다이얼로그 | GameOverDialog/SublevelPassedDialog | NoteGame 종료 시 | ✅ |
| 분석 | 학습 리듬 탭 (XP/정확도 차트) | Home.tsx → recharts | `/home` | ⚠️ |
| 분석 | 실력 진단 탭 | DiagnosisTab.tsx | `/home` | ❌ |
| 분석 | 활동 기록 탭 | Home.tsx | `/home` | ❌ |
| 결제 | 가격 페이지 | Pricing.tsx | `/pricing` | ❌ |
| 결제 | Paddle Checkout | lib/paddle.ts | Pricing 클릭 | ❌ |
| 결제 | 결제 후처리 | paddle-webhook 함수 | (Paddle → DB) | ❌ |
| 결제 | IAP (모바일) | verify-iap-receipt | RevenueCat | 로컬 스크립트만 |
| 결제 | 등급 게이팅 | subscriptionTier.ts | LevelSelect | ✅ |
| 관리자 | 사용자 목록 | AdminUsers.tsx | `/admin/users` | ❌ |
| 관리자 | 사용자 상세 + 4 다이얼로그 | AdminUserDetail.tsx + admin/* | `/admin/users/:id` | ❌ |
| 관리자 | 액션 로그 | AdminLogs.tsx | `/admin/logs` | ❌ |
| 관리자 | 배치 이력 | AdminBatchRuns.tsx | `/admin/batch-runs` | ⚠️ (hook만) |
| 법적 | 약관 4종 | LegalPage.tsx + content/legal/*.md | `/terms`, `/privacy`, `/refund`, `/cookies` | ❌ |
| 콘텐츠 | 블로그 | Blog.tsx, BlogPost.tsx + content/blog/*.md | `/blog`, `/blog/:slug` | ❌ |
| 인프라 | Coming Soon 모드 | featureFlags.ts + ComingSoonGate.tsx | (전역) | ❌ |
| 인프라 | 쿠키 배너 | CookieBanner.tsx | (전역) | ❌ |

---

## 10. 사용자 시나리오 예시

### 10.1 신규 사용자 — 첫 게임 ~ 첫 통과

1. 메인(`/`) 진입 → "체험하기" 클릭 → `/play`
2. AuthBar에서 게스트 상태 → Lv 1만 접근 가능
3. Lv 1-1 클릭 → 3-2-1 카운트다운 → 게임 시작
4. 음표 풀이 → 오답 시 같은 자리 유지 → 정답 시 다음 음표
5. 27노트 완주 → `SublevelPassedDialog` (단, play_count<5 이라 passed=false)
6. 5회째 도전에서 streak ≥ 5 + 정확도 ≥ 80% → 통과 → 다음 단계 자동 unlock

### 10.2 기존 사용자 — 약점 분석 → 결제

1. `/home` 진입 → 진단 탭 → 약점 음표 확인 (예: F#5)
2. 가중치 출제로 게임에서 F#5 자주 등장 → 학습 후 정확도 상승
3. Lv 3-1 진입 시도 → 잠금(free 8단계) → `UpgradeModal` 표시
4. `/pricing` 이동 → 월간 $2.99 클릭 → Paddle Checkout
5. 결제 완료 → `/checkout/success` → 자동 메인 이동
6. 다음 접속 시 `useProfile` refetch → tier='pro' → 21단계 전체 잠금 해제

### 10.3 관리자 — 강제 프리미엄 부여

1. `/admin/users` → 검색 → 사용자 클릭
2. `/admin/users/:id` → "프리미엄 부여" 클릭 → `PremiumDialog`
3. preset "30일" 선택 → 사유 입력 → 확인
4. `admin-action` Edge Function 호출 → `profiles.is_premium=true, premium_until=now+30d`
5. `admin_actions` 로그 기록 (관리자 ID, 대상 ID, before/after, IP/UA)
6. `/admin/logs`에서 즉시 확인 가능

---

다음: `docs/06_TESTING.md` (테스트 + 품질)
