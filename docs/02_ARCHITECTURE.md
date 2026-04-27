# 02. 시스템 구조

> **작성일**: 2026-04-28
> **선행 자료**: `docs/01_OVERVIEW.md`
> **함께 보면 좋은 자료**: `docs/03_GAME_LOGIC.md` (게임 도메인 상세), `docs/04_DB_SCHEMA.md` (DB 계층)

---

## 1. 아키텍처 다이어그램 (텍스트)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              브라우저 (사용자)                             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                  React 18 SPA  (Vite 번들, /dist)                  │  │
│  │                                                                    │  │
│  │   ┌─────────────────────────────────────────────────────────────┐  │  │
│  │   │  App.tsx — Provider Tree                                    │  │  │
│  │   │   QueryClientProvider                                       │  │  │
│  │   │     └ AuthProvider (useProfile + supabase.auth)             │  │  │
│  │   │         └ TooltipProvider                                   │  │  │
│  │   │             └ BrowserRouter ──→ Routes                      │  │  │
│  │   └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │   페이지 ─► 섹션 컴포넌트 ─► Hook ─► Supabase / Paddle / Tone.js   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────┬────────────────────────────────────────────────────────────────┘
          │
          │ HTTPS / WSS
          ▼
┌──────────────────────────────┐    ┌──────────────────────────────────────┐
│      Supabase (PostgreSQL)    │    │         외부 서비스                  │
│                               │    │                                      │
│  • Auth (JWT)                 │    │  • Paddle.com         (Web 결제)     │
│  • DB + RLS                   │    │  • RevenueCat         (Mobile IAP)   │
│  • Realtime (WS)              │    │  • Lovable AI Gateway (악보 OCR)     │
│  • Edge Functions (Deno)      │    │  • Apple/Google IAP   (네이티브 검증)│
│    └ admin-action             │    │                                      │
│    └ paddle-webhook           │◄──┐│                                      │
│    └ verify-iap-receipt       │   ││                                      │
│    └ analyze-sheet-music      │   ││                                      │
│    └ payment-webhook (미완)   │   ││                                      │
│    └ create-checkout-session  │   ││                                      │
│      (미완)                   │   ││                                      │
└───────────────────────────────┘   │└──────────────────────────────────────┘
                                    │           │
                                    │           ▼ Webhook
                                    └─────── Paddle / RevenueCat
                                            서버에서 호출 (HMAC 검증)
```

> 🔗 인프라 구체 정보 (Vercel·도메인): `docs/07_DEPLOYMENT.md`

---

## 2. 라우팅 구조 (`src/App.tsx`)

| 경로 | 페이지 | 노출 조건 | 가드 |
|---|---|---|---|
| `/` | `pages/Index.tsx` | 항상 노출 | — |
| `/play` | `pages/Index.tsx` (게임 ON 상태) | `GAME_ENABLED===true` | `ComingSoonGate` |
| `/pricing` | `pages/Pricing.tsx` | `GAME_ENABLED===true` | `ComingSoonGate` |
| `/checkout/success` | `pages/CheckoutSuccess.tsx` | `GAME_ENABLED===true` | `ComingSoonGate` |
| `/checkout/failed` | `pages/CheckoutFailed.tsx` | `GAME_ENABLED===true` | `ComingSoonGate` |
| `/home` | `pages/Home.tsx` | `GAME_ENABLED===true` | `ComingSoonGate` |
| `/profile` | `pages/ProfilePage.tsx` | `GAME_ENABLED===true` | `ComingSoonGate` |
| `/blog` | `pages/Blog.tsx` | 항상 노출 | — |
| `/blog/:slug` | `pages/BlogPost.tsx` | 항상 노출 | — |
| `/terms` | `pages/legal/LegalPage.tsx` (slug=`terms`) | 항상 노출 | — |
| `/privacy` | `pages/legal/LegalPage.tsx` (slug=`privacy`) | 항상 노출 | — |
| `/refund` | `pages/legal/LegalPage.tsx` (slug=`refund`) | 항상 노출 | — |
| `/cookies` | `pages/legal/LegalPage.tsx` (slug=`cookies`) | 항상 노출 | — |
| `/admin` | `pages/admin/AdminLayout.tsx` (Outlet) | feature flag **무관** | `AdminGuard` (`profile.role==='admin'`) |
| `/admin/users` | `pages/admin/AdminUsers.tsx` | 좌동 | 좌동 |
| `/admin/users/:id` | `pages/admin/AdminUserDetail.tsx` | 좌동 | 좌동 |
| `/admin/logs` | `pages/admin/AdminLogs.tsx` | 좌동 | 좌동 |
| `/admin/batch-runs` | `pages/admin/AdminBatchRuns.tsx` | 좌동 | 좌동 |
| `*` | `pages/NotFound.tsx` | 항상 | — |

### 2.1 `ComingSoonGate` 동작 (`src/components/ComingSoonGate.tsx:9-14`)

```tsx
if (!GAME_ENABLED) {
  return <Navigate to="/" replace />;
}
return <>{children}</>;
```

- `VITE_GAME_ENABLED` 환경변수만 검사 (구독·역할과 무관)
- 출시 시 `true`로 전환 → 모든 게임/결제 라우트 활성화

### 2.2 `AdminGuard` 동작 (`src/components/admin/AdminGuard.tsx`)

- `profile.role === 'admin'` 검증 후 `children` 렌더
- `feature flag` 무시 — Coming Soon 모드에서도 접근 가능 (운영팀이 항상 사용 가능해야 함)

### 2.3 SPA fallback

- `vercel.json`에서 모든 경로를 `/index.html`로 rewrite — 새로고침 시에도 라우팅 유지

---

## 3. Provider 트리 / 전역 상태

### 3.1 `App.tsx:27-114`의 트리

```
QueryClientProvider (TanStack Query)
└─ AuthProvider (Context)
   └─ TooltipProvider (Radix)
      ├─ Toaster (shadcn)
      ├─ Sonner (shadcn 보조 토스트)
      └─ BrowserRouter
         └─ Routes
            └─ <CookieBanner />
```

### 3.2 `AuthContext` (`src/contexts/AuthContext.tsx`)

**노출 API**:

| 필드 | 타입 | 설명 |
|---|---|---|
| `session` | `Session \| null` | Supabase 세션 |
| `user` | `User \| null` | 인증된 사용자 |
| `profile` | `Profile \| null` | `profiles` 테이블 행 (display_name, role, is_premium, premium_until, current_streak, total_xp, locale, …) |
| `loading` | `boolean` | 세션 로딩 |
| `profileLoading` | `boolean` | 프로필 로딩 |
| `signOut()` | `() => Promise<void>` | 로그아웃 |
| `refreshProfile()` | `() => Promise<void>` | 프로필 강제 재조회 |

- 내부에서 `useProfile(user)` hook으로 프로필 동기화
- `supabase.auth.onAuthStateChange` 구독 → 세션 변동 시 자동 업데이트

### 3.3 상태 관리 정책

- **전역 인증 상태**: `AuthContext` (Context API)
- **서버 상태 캐싱**: `@tanstack/react-query` — 주로 관리자 페이지에서 사용 (`useAdminUsers`, `useAdminLogs`, `useBatchRuns`)
- **컴포넌트 로컬 상태**: `useState` / `useReducer`
- **고성능 ref 상태**: `useRef` — `NoteGame.tsx`의 `turnCounterRef`, 사운드 인스턴스 등 (리렌더링 회피 목적)
- **로컬 영속화**: `localStorage` — 솔페지 시스템 선택 (`useSolfegeSystem`)
- **Redux/Zustand 미사용**

---

## 4. 페이지 → 섹션 컴포넌트 트리

### 4.1 `pages/Index.tsx` (`/`, `/play`)

```
Index
├─ Header (조건부 노출 — GAME_ENABLED + user)
├─ AuthBar (인라인) — 로그인 / 닉네임 / 로그아웃
├─ LevelSelect (선택 화면, phase==="select")
│  ├─ 21개 sublevel 그리드
│  └─ UpgradeModal (잠금 셀 클릭 시)
├─ NoteGame (게임 화면, phase==="playing")
│  ├─ GameHeader (점수·라이프·연속 정답)
│  ├─ CountdownOverlay (3초 카운트다운)
│  ├─ GrandStaffPractice (오선지 + 음표)
│  ├─ NoteButtons (정답 버튼 + 스와이프)
│  ├─ CountdownTimer (타이머)
│  ├─ AccidentalSwipeTutorial (Lv5+ 첫 진입 튜토리얼)
│  ├─ GameOverDialog (라이프 0)
│  ├─ SublevelPassedDialog (스테이지 완료)
│  └─ MissionSuccessModal (마일스톤)
├─ ComingSoonHero (GAME_ENABLED===false일 때만)
├─ Footer
└─ AuthModal (로그인 트리거 시)
```

### 4.2 `pages/Home.tsx` (`/home`)

```
Home
├─ Header
├─ LastUpdatedStrip ("5분 전 업데이트")
├─ Tabs (rhythm / diagnosis / activity, URL 동기화)
│  ├─ rhythm: XpBarChart + AccuracyReactionChart
│  ├─ diagnosis: DiagnosisTab
│  │   └─ BatchAnalysisSection (음표별 약점/숙달)
│  └─ activity: 최근 세션 테이블
└─ Footer
```

### 4.3 `pages/ProfilePage.tsx` (`/profile`)

```
ProfilePage
├─ Header
├─ ProfileForm (닉네임, 표시 언어, 솔페지 토글)
│  └─ useNicknameAvailability (실시간 중복 체크)
├─ AccountInfoSection (이메일, 가입일, 구독 상태)
└─ DangerZone (로그아웃)
```

### 4.4 `pages/admin/AdminLayout.tsx` (`/admin`)

```
AdminLayout
├─ AdminGuard (검증)
├─ AdminHeader (탭 네비)
└─ <Outlet /> → AdminUsers / AdminUserDetail / AdminLogs / AdminBatchRuns
```

각 페이지 트리:
- **AdminUsers** → 필터 폼 + 페이지네이션 테이블 + 상세 링크
- **AdminUserDetail** → 사용자 카드 + XP 차트 + 세션 로그 + `RoleChangeDialog` / `PremiumDialog` / `XpAdjustDialog` / `StreakAdjustDialog`
- **AdminLogs** → 필터 + 확장 가능 행 테이블
- **AdminBatchRuns** → 요약 카드 + 30일 테이블 + "수동 실행" 버튼

---

## 5. 컴포넌트 카탈로그 (UI 프리미티브 제외)

### 5.1 게임 코어 (`src/components/`)

| 컴포넌트 | 역할 | 주 호출 |
|---|---|---|
| `NoteGame.tsx` | 게임 엔진 — 정답/오답/타이머/라이프/스테이지 진행 (1100+ 라인) | `Index.tsx` |
| `GameHeader.tsx` | 점수/라이프/연속정답 표시 | `NoteGame` |
| `NoteButtons.tsx` | 음표 정답 버튼 그리드 + 스와이프 (Lv5+) | `NoteGame` |
| `StaffDisplay.tsx` | 단일 오선지 SVG 렌더 (legacy, 일부 fallback) | `NoteGame` |
| `CountdownTimer.tsx` | 음표당 제한시간 (색상·펄스 단계) | `NoteGame` |
| `CountdownOverlay.tsx` | 게임 시작 전 3-2-1 카운트다운 | `NoteGame` |
| `practice/GrandStaffPractice.tsx` | 양손 오선지(treble+bass) + 키사인 + 배치 음표 | `NoteGame` |
| `MissionSuccessModal.tsx` | 마일스톤 보상 알림 | `NoteGame` |
| `AccidentalSwipeTutorial.tsx` | Lv5+ 첫 진입 시 스와이프 가이드 | `NoteGame` |

### 5.2 진입·인증·게이팅

| 컴포넌트 | 역할 | 주 호출 |
|---|---|---|
| `LevelSelect.tsx` | 21단계 그리드 + 잠금 표시 + 진도 뱃지 | `Index.tsx` |
| `AuthModal.tsx` | OAuth(Google) + 이메일 회원가입/로그인 (2단계) | `Index.tsx` 외 |
| `ComingSoonGate.tsx` | feature flag 라우트 가드 | `App.tsx` |
| `admin/AdminGuard.tsx` | admin 권한 검증 | `AdminLayout` |
| `UpgradeModal.tsx` | Pro 권유 다이얼로그 | `LevelSelect` |
| `PremiumRequiredDialog.tsx` | Pro 필수 기능 진입 시 알림 | (Pro 전용 진입점) |
| `GameOverDialog.tsx` | 라이프 0 다이얼로그 | `Index` |
| `SublevelPassedDialog.tsx` | 스테이지 완료 다이얼로그 | `Index` |

### 5.3 레이아웃·기타

| 컴포넌트 | 역할 |
|---|---|
| `Footer.tsx` | 푸터 (블로그·법적·SNS 링크) |
| `NavLink.tsx` | 활성 상태 표시되는 네비 링크 |
| `CookieBanner.tsx` | 쿠키 동의 배너 |
| `MarkdownContent.tsx` | 블로그·약관 마크다운 렌더 |
| `BatchAnalysisSection.tsx` | 약점/숙달 음표 카드 |
| `home/DiagnosisTab.tsx` | 진단 탭 (음표별 정확도/반응시간) |

### 5.4 관리자 다이얼로그 (`src/components/admin/`)

| 컴포넌트 | 역할 |
|---|---|
| `RoleChangeDialog.tsx` | user ↔ admin 권한 변경 |
| `PremiumDialog.tsx` | 프리미엄 부여/연장/해제 (preset 7/30/90/365일 또는 커스텀) |
| `XpAdjustDialog.tsx` | XP 증감 |
| `StreakAdjustDialog.tsx` | 스트릭 조정 (`user_streaks`도 동기화) |

### 5.5 UI 프리미티브 (`src/components/ui/`)

shadcn/ui 기반 50+ 파일 — 직접 작성하지 않고 표준 패턴 사용. 대표: `button`, `dialog`, `card`, `tabs`, `table`, `dropdown-menu`, `popover`, `tooltip`, `toast`, `form`, `input`, `select`, `progress`, `chart` 등.

---

## 6. Hook 카탈로그 + 의존성 그래프

### 6.1 인증·프로필

```
AuthContext (useAuth)
   └─ useProfile(user)              ← profiles 테이블 + 실시간 구독
useNicknameAvailability(nickname)   ← check_nickname_available RPC + 디바운스
useSolfegeSystem()                  ← localStorage (ko/en/latin)
```

### 6.2 게임 진행·통계

```
useLevelProgress()                   ← user_sublevel_progress 조회 + record_sublevel_attempt RPC
useUserStats(user)                   ← profiles + user_sessions (7일/league)
useMyStats(user)                     ← user_sessions(20개) + 30일 dailyStats + 약점 음표
useSessionRecorder()                 ← user_sessions INSERT + XP 계산 v2
   └─ recordNote() / endSession()
useNoteLogger()                      ← user_note_logs INSERT
useUserMastery()                     ← note_mastery 맵 (clef:note_key → weakness/normal/mastery)
useMasteryDetails()                  ← note_mastery 상세 (플래그된 음표만)
useRetryQueue()                      ← 메모리 내 retry 마커 큐 (DB 미저장)
useSwipeAccidental({ onCommit, threshold:56 })  ← pointerdown/move/up
```

### 6.3 관리자

```
useAdminUsers()                      ← profiles 페이지네이션 + 필터
useAdminUserDetail(id)               ← profile + sessions + dailyStats + weakNotes
useAdminLogs()                       ← admin_actions 테이블 + distinctActionTypes
useBatchRuns()                       ← daily_batch_runs(30일) + summary + triggerManualRun()
```

### 6.4 UI 보조

```
use-toast (sonner)
use-mobile  ← matchMedia 미디어쿼리
```

### 6.5 의존성 그래프 (NoteGame 중심)

```
NoteGame.tsx
 ├─ useAuth                           (전역)
 ├─ useUserMastery()                  → note_mastery 로드
 ├─ useLevelProgress()                → 진도 RPC
 ├─ useSessionRecorder()              → 세션·XP 기록
 │   └─ Supabase user_sessions INSERT
 ├─ useNoteLogger()                   → 매 음표 로그
 │   └─ Supabase user_note_logs INSERT (Realtime publication)
 ├─ useRetryQueue()                   → 메모리 큐 (markMissed / popDueOrNull / rescheduleAfterCorrect / resolve)
 ├─ useSwipeAccidental({...})         → Lv5+에서만 활성화
 ├─ useSolfegeSystem()                → 버튼 라벨 결정
 └─ <GrandStaffPractice />            → 오선지 + 키사인 렌더
```

---

## 7. lib 디렉토리 (`src/lib/`) 책임

| 파일 | 역할 | 의존 |
|---|---|---|
| `levelSystem.ts` | 21단계 정의·통과 조건·구독 게이트·다음/이전 단계 계산 | (pure) |
| `noteWeighting.ts` | 가중치 출제 알고리즘 (weakness 3.0 / normal 1.0 / mastery 0.3) | (pure) |
| `noteTypes.ts` | 음표 타입 정의 (`NOTE_KEYS`, `Clef`, `Accidental` 등) | (pure) |
| `solfege.ts` | 음 이름 매핑 (한국어 도레미 / 영어 CDE / 라틴 Do-Re-Mi) | (pure) |
| `staffGeometry.ts` | 오선지 좌표·간격 계산 | (pure) |
| `sound.ts` | Tone.js 사운드 (음표 재생, 정답/오답 효과음) | tone |
| `featureFlags.ts` | `GAME_ENABLED` (`VITE_GAME_ENABLED`) | env |
| `subscriptionTier.ts` | `getUserTier(user, profile)` → `'guest' \| 'free' \| 'pro'` | (pure) |
| `paddle.ts` | `initPaddle()`, `openCheckout()`, `PADDLE_PRICES` | @paddle/paddle-js |
| `profile.ts` | 로케일/국가 자동 감지, 프로필 변환 | (pure) |
| `nicknameValidation.ts` | 닉네임 형식 검증 (zod, 다국어 메시지) | zod |
| `adminActions.ts` | `callAdminAction(...)` — admin-action Edge Function 호출 | supabase |
| `userNoteLogs.ts` | `fetchUserNoteLogs()` 등 로그 조회 헬퍼 | supabase |
| `markdownLoader.ts` | 블로그/약관 `.md` 파일 동적 로드 (`import.meta.glob`) | vite glob |
| `utils.ts` | `cn()` (clsx + tailwind-merge) — shadcn 표준 |  |

---

## 8. 데이터 흐름 시나리오

### 8.1 사용자 액션: "Lv 1-1 게임 시작 → 음표 정답"

```
[사용자] LevelSelect에서 Lv 1-1 클릭
   │
   ▼
[Index.tsx] phase = "playing" 으로 전환, NoteGame mount
   │
   ▼
[NoteGame] mount 시:
   ├─ useUserMastery() → Supabase note_mastery 조회 → masteryMap 채움
   ├─ useLevelProgress() → user_sublevel_progress 조회
   ├─ getStagesFor(1, 1) → [{batchSize:1, totalSets:2, notesPerSet:3}, ...]
   ├─ generateBatch() → noteWeighting.weightedPickIndex() → 음표 결정
   └─ <CountdownOverlay /> 표시 → 끝나면 phase=playing
   │
   ▼
[사용자] 정답 버튼 클릭 (예: "도")
   │
   ▼
[NoteGame.handleAnswer()]
   ├─ 정답 분기 (NoteGame.tsx:702-761)
   │   ├─ score++, totalCorrect++, currentStreak++
   │   ├─ 연속 3회 → lives++ (최대치까지)
   │   ├─ playCorrect() → Tone.js 사운드
   │   ├─ logNote(is_correct=true)
   │   │   └─ Supabase user_note_logs INSERT (RLS: auth.uid()=user_id)
   │   ├─ recorder.recordNote(correct=true, reactionMs)
   │   ├─ wasRetry ? retryQueue.resolve() : retryQueue.rescheduleAfterCorrect()
   │   └─ advanceToNextTurn()
   │       └─ prepareNextTurn()
   │           ├─ retryQueue.popDueOrNull(turn) → 재출제 음표 또는 null
   │           └─ generateBatch() (필요 시 새 배치)
   │
   ▼
[모든 stage 완료 시] phase="success"
   ├─ recorder.endSession("completed") → user_sessions INSERT (XP 계산)
   ├─ recordAttempt() → record_sublevel_attempt RPC
   │   └─ play_count≥5 ∧ best_streak≥5 ∧ accuracy≥0.8 → passed=true
   └─ <SublevelPassedDialog />
```

### 8.2 사용자 액션: "Pro 구독 결제"

```
[사용자] /pricing 진입 → "월간 구독" 클릭
   │
   ▼
[Pricing.tsx] openCheckout({ plan:"monthly", userEmail, userId })
   │
   ▼
[lib/paddle.ts] initPaddle() (싱글톤) → paddle.Checkout.open({...})
   │
   ▼
[Paddle 오버레이] 카드 입력 → 결제 완료
   │
   ├─► [브라우저] successUrl=/checkout/success 리다이렉트
   │      └─ <CheckoutSuccess /> 5초 후 메인 이동
   │
   └─► [Paddle 서버] Webhook → POST /functions/v1/paddle-webhook
          ├─ HMAC-SHA256 서명 검증 (Paddle-Signature 헤더)
          ├─ subscription.activated 등 이벤트 라우팅
          └─ subscriptions 테이블 UPSERT + profiles.is_premium=true
                │
                ▼
[다음 접속] useProfile() 자동 refetch → tier='pro' → 전체 21단계 잠금 해제
```

### 8.3 사용자 액션: "관리자가 사용자 XP 조정"

```
[관리자] /admin/users/{id} 진입 → XpAdjustDialog 열기 → +500 입력
   │
   ▼
[XpAdjustDialog] callAdminAction({ action_type:"adjust_xp", target_user_id, delta:500, reason })
   │
   ▼
[lib/adminActions.ts] supabase.functions.invoke("admin-action", { body, headers:{ Authorization } })
   │
   ▼
[Edge Function: admin-action]
   ├─ JWT 검증 → 호출자 user_id 추출
   ├─ profiles.role !== 'admin' → 403
   ├─ profiles.total_xp += 500
   └─ admin_actions 테이블 INSERT (admin_id, target_user_id, before/after, IP, UA)
   │
   ▼
[useAdminUserDetail] refresh() → UI 갱신
```

---

## 9. 환경 분기 흐름 (Coming Soon ↔ 실서비스)

| 상태 | 설정 | 노출 라우트 | 게임/결제 |
|---|---|---|---|
| Coming Soon (현재) | `VITE_GAME_ENABLED=false` (Vercel) | `/`, `/blog/*`, `/terms`, `/privacy`, `/refund`, `/cookies`, `/admin/*` | 비활성 (`/play` 등은 `/`로 리다이렉트) |
| 실서비스 (출시) | `VITE_GAME_ENABLED=true` | 모든 라우트 | 활성 — `docs/PENDING_BACKLOG.md §11` 체크리스트 |
| 로컬 개발 | `.env.local`에 `VITE_GAME_ENABLED=true` | 모든 라우트 | 활성 |

---

## 10. 주요 통신 채널

| 채널 | 트리거 | 처리 위치 |
|---|---|---|
| **HTTP REST** (Supabase PostgREST) | `supabase.from(...).select/insert/update` | RLS 정책으로 보호 |
| **JWT 인증** | `supabase.auth.getSession()` | Authorization 헤더 자동 첨부 |
| **Realtime (WebSocket)** | `user_note_logs` 테이블 publication | `useNoteLogger`/관리자 화면 (확인 필요) |
| **RPC** | `record_sublevel_attempt`, `consume_scan_quota`, `apply_payment_topup`, `expire_premium_users` 등 | `supabase.rpc(...)` |
| **Edge Function** | `admin-action`, `analyze-sheet-music` 등 | `supabase.functions.invoke(...)` |
| **Paddle Webhook** (외부 → 내부) | 결제 이벤트 | `supabase/functions/paddle-webhook/index.ts` |
| **RevenueCat Webhook** (외부 → 내부) | IAP 이벤트 | `verify-iap-receipt` (Bearer 토큰 검증) |

---

## 11. 빌드·번들 구조

- **Vite SPA**: `index.html` + `dist/assets/index-*.js` + `dist/assets/index-*.css`
- **번들 분할**: `vite.config.ts`에서 별도 manualChunks 설정 없음 → 단일 청크 (React Lazy 미사용)
- **환경변수 주입**: `import.meta.env.VITE_*` (빌드 타임)
  - ⚠️ **하드코딩 주의**: `vite.config.ts:17-18`에서 Supabase URL/Key를 `define`으로 강제 주입 — `.env`의 값은 무시됨
- **Capacitor 빌드**: `npm run cap:sync` → `dist/`를 `android/app/src/main/assets/public/` 등으로 복사

---

## 12. 미해결 / 확인 필요 항목

- 🟡 `useUserStats` 의 league/standing 계산 로직 — DB에 league 테이블이 없음 (코드에서 확인 필요)
- 🟡 `payment-webhook` / `create-checkout-session` Edge Function — 폴더만 있고 `index.ts` 없음 (구현 미완)
- 🟡 일부 hook (`useNoteLogger`)에서 Realtime 구독 사용 여부 — DB에는 publication 있으나 클라 쪽 구독 코드 확인 필요
- 🔴 `note_mastery`, `daily_batch_runs`, `subscriptions`, `user_streaks`, `admin_actions`, `user_sessions` 테이블 정의는 마이그레이션 외부에서 생성됨 — `docs/04_DB_SCHEMA.md` 참조

---

다음: `docs/03_GAME_LOGIC.md` (게임 도메인 로직 — retry queue·가중치·키사인·스와이프 정책 상세)
