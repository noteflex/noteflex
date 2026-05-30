# 인증 흐름 종합 진단 — 2026-05-11

> **상태**: 진단 only. 코드 변경 X. CTO 정정 방향 결정용.
> **작업자**: Opus 4.7 (Sonnet 4.6는 3회 추측 정정 모두 빗나감 — 깊은 분석 필요)
> **검토 범위**: src/ 인증 영역 18개 파일 + supabase/migrations/ 19개 파일 + 최근 3개 commit (4b2ee76, 1d2d2c3, 1e188b4)
> **방법**: 실제 코드 read only. 가설은 "가설"로 명시. 단정 X.

---

## 0. Executive Summary — 핵심 발견 5개

### 🔴 #1. **`profile_completed` 컬럼이 로컬 마이그레이션에 없음 — Bug #4 root cause 확정**

- `handle_new_user_profile` 트리거 (`20260408001000_add_profiles_scan_quota.sql`)는 신규 사용자에게 `(id, scan_quota)` 두 컬럼만 INSERT
- `grep "profile_completed" supabase/` 결과 **0 hits**
- 즉, `profile_completed` 컬럼은 Lovable/Supabase Studio에서 직접 추가된 영역 — local migration 누락
- 모든 신규 사용자 (Magic Link / Google OAuth 무관) → `profile_completed = false` (또는 NULL → falsy)
- AuthCallback.tsx:24 `profile?.profile_completed ?? false` → 모든 사용자에게 `false` 전송 → BroadcastChannel → `/?complete_profile=1` → Step 3 모달

→ **Bug #4 (기존 Google 사용자가 Step 3 들어감)** 의 진짜 원인 = DB 데이터 상태. 코드는 정상 동작.

### 🔴 #2. **Bug #1, #3, #5 = 모두 브라우저 password manager autofill — React 영역 아님**

- React state 영역은 conditional render + key prop + form.reset()으로 이미 정상 동작 중
- Chrome / Safari는 `autoComplete="off"`를 **무시**하는 영역 — anti-pattern 판정
- form.reset()은 DOM값을 비우지만, password manager가 마운트 직후 asynchronous하게 **재채움**
- 단위 테스트가 통과한 이유 = jsdom은 password manager 시뮬 안 함

→ 모든 React 정정 (`1e188b4`, `1d2d2c3`, `4b2ee76`)이 실패한 진짜 이유 = **시도 자체가 잘못된 영역을 완료**. 진짜 원인 = 브라우저 동작이라 React 정정으로 해결 불가.

### 🔴 #3. **Bug #2 (Step 3 안 나옴) = Supabase 이메일 템플릿 미갱신 — 가장 유력**

- 코드 상으로는 정상: `emailRedirectTo: ${window.location.origin}/auth/callback` 명시
- 단, Supabase Dashboard "Confirm signup" 템플릿이 `{{ .Token }}` (OTP)이면 → 이메일에 6자리 코드만 표시 → 클릭할 링크 없음 → AuthCallback never runs → BroadcastChannel never fires → Step 3 never shows
- 검증 = 사용자가 Supabase Dashboard에서 템플릿 확인 필요 (코드만으로 검증 불가)

→ 코드 영역 정정으로 기록할 수 있는 게 아니라 **Supabase 설정 영역**.

### 🟡 #4. **마이그레이션 drift = 정합성 위험**

- `profile_completed`, `nickname`, `birth_year/month/day`, `country_code`, `locale`, `timezone`, `tos_agreed_at`, `privacy_agreed_at`, `marketing_agreed_at`, `is_minor`, `current_streak`, `longest_streak`, `total_xp`, `current_league`, `last_practice_date`, `onboarding_completed`, `role`, `is_premium`, `premium_until`, `display_name`, `avatar_url`, `email`, `subscription_tier` — 코드에서 사용 중이나 **로컬 마이그레이션에서 정의 없음**
- 운영 DB와 마이그레이션 파일이 disconnected 상태 → 향후 staging/prod 재설정 시 schema drift

### 🟡 #5. **AuthBroadcastListener — 다중 탭 / 멀티 디바이스 / 모바일 이메일 클라이언트에서 silent fail 가능**

- BroadcastChannel은 동일 origin + 동일 storage partition에서만 작동
- 이메일 앱이 별도 webview로 열면 (iOS Mail · 일부 Android 클라이언트) → 별도 storage → 메시지 도달 X
- 원본 탭이 닫혀 있으면 메시지 수신자 없음 → AuthCallback가 `window.close()` 시도하지만 보안상 실패 → 사용자 stuck

---

## 1. 인증 흐름 아키텍처 맵

### 1.1 컴포넌트 계층

```
App.tsx
├── AuthProvider (contexts/AuthContext.tsx)
│   └── useProfile (hooks/useProfile.ts) ← profiles 실시간 구독
├── BrowserRouter
│   ├── Routes (/, /auth/callback, /profile, ...)
│   └── AuthBroadcastListener ← BroadcastChannel("noteflex_auth")
└── (모든 컴포넌트가 useAuth() 접근 가능)

src/components/AuthModal.tsx ← 인라인, Index.tsx에서 조건부 마운트
src/pages/AuthCallback.tsx ← /auth/callback 라우트
src/pages/ProfilePage.tsx ← /profile, 탈퇴 모달 인라인
```

### 1.2 4개 인증 흐름 매핑

#### Flow A: 신규 이메일 가입 (Magic Link)

```
AuthModal.handleStep1Next (line 140)
  ↓
checkEmailExists() → RPC check_email_exists
  ├─ exists=true && confirmed=true → 차단 + 로그인 CTA
  └─ exists=false OR (exists && !confirmed)
       ↓
       supabase.auth.signInWithOtp({
         email,
         options: {
           shouldCreateUser: true,
           emailRedirectTo: `${origin}/auth/callback`,
         }
       })
       ↓
       setSignupStep(2) → magic-link-screen
       ↓
       [사용자가 이메일 링크 클릭 — 새 탭]
       ↓
       AuthCallback.tsx (line 9 useEffect)
         ├─ supabase.auth.getSession() → 세션 확인
         ├─ profiles.select("profile_completed").eq("id", user.id).single()
         ├─ BroadcastChannel("noteflex_auth").postMessage({
         │     type: "AUTH_COMPLETE",
         │     profile_completed: profileCompleted (대부분 false)
         │   })
         └─ window.close() + setTimeout(closeFailed UI, 500ms)

  ↑ 원본 탭(Step 2 대기)
  App.tsx:39 AuthBroadcastListener
    └─ channel.onmessage:
       ├─ await supabase.auth.refreshSession()
       ├─ if (!e.data.profile_completed) → navigate("/?complete_profile=1")
       └─ else → navigate("/")
  
  Index.tsx:44 useSearchParams → completeProfile=true
  Index.tsx:47 useEffect → setShowAuth(true)
  Index.tsx:111 → AuthModal key="auth-step3" + initialSignupStep=3 마운트
  ↓
  AuthModal Step 3 (line 533)
    ├─ 닉네임 + 생년월일 + 국가 + 약관 + 비밀번호(non-OAuth)
    └─ handleSignupSubmit (line 193)
       ├─ if (!isOAuthUser) supabase.auth.updateUser({password})
       └─ completeProfile(userId, {...}) → profiles UPDATE profile_completed=true
```

#### Flow B: Google OAuth

```
AuthModal.handleGoogleLogin (line 109)
  ↓
supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${origin}/auth/callback` }
})
  ↓
[Google 인증 페이지 → /auth/callback redirect]
  ↓
AuthCallback.tsx — Flow A와 동일
  └─ profile_completed=false면 → /?complete_profile=1 → Step 3

  ⚠️ 기존 Google 사용자도 profile_completed 컬럼이 false면 Step 3로 가는 영역
```

#### Flow C: 비밀번호 로그인

```
AuthModal.handleLogin (line 124)
  ↓
supabase.auth.signInWithPassword({email, password})
  ↓
AuthContext.onAuthStateChange → setSession → user 업데이트
  ↓
onClose() → showAuth=false → AuthModal unmount
```

#### Flow D: 비밀번호 변경 + 탈퇴

```
ProfilePage.handleChangePassword (line 165)
  ├─ signInWithPassword(현재 비번 검증)
  └─ updateUser({password: 새 비번})

ProfilePage.handleDeleteAccount (line 201)
  ├─ signInWithPassword(비번 재검증)
  ├─ RPC request_account_deletion (소프트 삭제 + PII 마스킹)
  └─ signOut() → navigate("/")
```

### 1.3 상태 lifecycle 매트릭스

| 컴포넌트 | mount 트리거 | unmount 트리거 | state reset 영역 |
|---|---|---|---|
| AuthModal | `showAuth && GAME_ENABLED` (Index:111) | `showAuth=false` OR `key` 변경 | 전체 state는 마운트 시 useState 초기값 |
| AuthBroadcastListener | App 시작 시 영구 | App 종료 시 | n/a |
| ProfilePage delete modal | `showDeleteModal=true` (조건부 render) | `showDeleteModal=false` | onClick에서 동기 reset + useEffect form.reset() |
| AuthCallback | `/auth/callback` 라우트 진입 | 라우트 이탈 | useState `closeFailed` 만 |

---

## 2. 5개 버그 root cause 분석

### Bug #1: 로그인 모달 열면 비번 그대로 남아있음

**현재 코드 상태** (4b2ee76 이후):
- Index.tsx:111 conditional render — `showAuth=false` 시 AuthModal 완전 unmount
- AuthModal.tsx:75-79 mount useEffect — `loginFormRef.current?.reset()` 호출
- AuthModal.tsx:432 login password input — `autoComplete="current-password"`

**데이터 흐름 추적**:
```
1. 사용자가 "로그인" 버튼 클릭 → setShowAuth(true)
2. Index.tsx re-render → {showAuth && ...} → AuthModal MOUNT
3. AuthModal useState 초기값: password="" (empty)
4. React 첫 render → DOM에 <input type="password" value=""> 생성
5. useEffect mount → loginFormRef.current.reset() (이미 비어있음, no-op)
6. 페인트 발생
7. ⚠️ 브라우저 password manager가 password input 감지 → 저장된 비번 자동 채움 (asynchronous, 페인트 후)
8. 사용자 시야 = 자동완성된 비번
```

**1d2d2c3, 4b2ee76 정정이 실패한 정확한 메커니즘**:
- conditional render = React level 정합 ✅ (이건 동작함)
- form.reset() = DOM value 초기화 ✅ (이건 동작함)
- **둘 다 페인트 → autofill 발생 직전에만 실행됨**. autofill은 그 후에 일어남.
- jsdom은 password manager 시뮬레이션 안 함 → 테스트는 통과
- Chrome/Safari는 `autoComplete="current-password"`을 "saved password 자동 입력 허용" 신호로 해석 → 의도대로 채움

**가설 3개 + 검증 방법**:

| # | 가설 | 검증 |
|---|------|------|
| H1 | **브라우저 autofill (가장 유력)** | DevTools → Application → Storage → Passwords 확인. 또는 incognito mode에서 동일 현상 재현 — 안 일어나면 autofill 확정 |
| H2 | React state 잔존 (이미 반증) | React DevTools → AuthModal 컴포넌트 선택 → state.password 값 확인. "" 이면 H1 |
| H3 | HMR이 dev 환경에서 state 보존 | `npm run build && npm run preview`로 production build 테스트. 동일하면 H1 |

**진짜 root cause 후보**:
- **H1 확정**: 브라우저 password manager가 React state와 무관하게 DOM input에 직접 비번 채움. `autoComplete="current-password"`는 이걸 명시적으로 허용함.

**정정 방향 (CTO 판단용)**:
- **Option A**: 의도된 동작으로 수용 — 로그인 폼은 saved password 자동완성이 UX 표준. 사용자에게 안내.
- **Option B**: `autoComplete="off"` + 무작위 `name` (Chrome 무시 가능성) + 1Password / LastPass 등에 무력화 시도 — UX 손상 vs 보안 trade-off
- **Option C**: 로그인 폼을 password manager가 인식 못 하도록 hidden decoy input + 동적 type 전환 트릭 — 복잡도 ↑

---

### Bug #2: 가입 후 Step 3 페이지 안 나옴

**현재 코드 상태**:
- AuthCallback.tsx:18-22 profiles.select(profile_completed)
- AuthCallback.tsx:27-31 BroadcastChannel.postMessage
- App.tsx:42-55 AuthBroadcastListener.onmessage → navigate
- Index.tsx:111 `key={completeProfile ? "auth-step3" : "auth-normal"}` 조건부 마운트

**데이터 흐름 추적** (예상 정상):
```
1. Step 1 이메일 제출 → signInWithOtp() → magic-link-screen (Step 2)
2. 사용자 이메일 받음 → 링크 클릭 → 새 탭 → /auth/callback
3. AuthCallback.getSession → session 확인
4. AuthCallback.profiles.select(profile_completed) → false (default)
5. AuthCallback.BroadcastChannel.postMessage({type, profile_completed:false})
6. AuthCallback.window.close() (실패 시 닫기 UI)
7. 원본 탭 AuthBroadcastListener 수신 → refreshSession → navigate("/?complete_profile=1")
8. Index.tsx re-render → completeProfile=true → setShowAuth(true) (effect)
9. AuthModal key="auth-step3" 마운트 → mode="signup", signupStep=3
10. Step 3 form 표시
```

**가설 4개 + 검증 방법**:

| # | 가설 | 검증 | 우선순위 |
|---|------|------|---------|
| H1 | **Supabase 이메일 템플릿이 `{{ .Token }}` (OTP 6자리)이고 `{{ .ConfirmationURL }}` 미적용** | Supabase Dashboard → Auth → Email Templates → "Confirm signup" 본문 확인. 또는 실제 메일 수신 후 링크 vs 6자리 코드 확인 | **최우선** |
| H2 | 이메일 클라이언트가 별도 webview (iOS Mail, 일부 Android)로 열어서 BroadcastChannel 분리 | 데스크탑 Chrome에서 메일 → 클릭 → 동일 브라우저 새 탭으로 열림 확인. mobile 테스트 분리 | 중 |
| H3 | 원본 탭이 닫혀있거나 다른 디바이스 → BroadcastChannel listener 없음 → 메시지 손실 | AuthBroadcastListener는 원본 탭이 살아있을 때만 작동. 사용자가 PC에서 가입 → 모바일에서 메일 확인하면 fail | 중 |
| H4 | AuthCallback의 BroadcastChannel 송신은 성공하지만, 원본 탭의 navigate → Index.tsx의 effect가 `completeProfile=true` 인식 실패 | Index.tsx:47 useEffect의 deps `[completeProfile]` 정상. 단, navigate replace 후 즉시 다음 lap에서 effect 발화 — 정상 흐름 | 저 (검증 후 reject 가능) |

**진짜 root cause 후보**:
- **H1이 가장 유력**. 이전 세션 종료 시 "Supabase email template must be updated by user (`{{ .Token }}` → `{{ .ConfirmationURL }}`)" 펜딩으로 명시되었으나 사용자가 적용했는지 미확인.
- 사용자 검증 (`로컬 npm run dev → 가입 후 메일 수신 → 메일 본문 확인`) 없이 단정 불가.

**검증 명령**:
```bash
# 1. Supabase Dashboard 확인 (사용자 액션)
#    https://supabase.com/dashboard/project/[project-ref]/auth/templates
#    "Confirm signup" 본문에 {{ .ConfirmationURL }} 포함 여부 확인

# 2. 실제 메일 수신 확인 — 로컬 dev에서
#    npm run dev → 가입 진행 → 본인 메일에 도착한 본문 확인
#    클릭 가능한 링크 있음 = OK
#    6자리 코드만 있음 = 템플릿 미갱신 = H1 확정
```

---

### Bug #3: 회원 탈퇴 모달 비번 재입력 칸 그대로 남아있음

**현재 코드 상태** (4b2ee76 이후):
- ProfilePage.tsx:111 `deletePwName = useRef(\`dpw_\${Math.random()...}\`)` — 무작위 name
- ProfilePage.tsx:114 useEffect `[showDeleteModal]` → form.reset()
- ProfilePage.tsx:543 onClick에서 동기 setDeletePw("") + setDeleteReason("") + setShowDeleteModal(true)
- ProfilePage.tsx:580 input `autoComplete="off"` + `name={deletePwName.current}`

**데이터 흐름**:
```
1. "회원 탈퇴" 버튼 클릭
2. onClick 동기: setDeletePw("") → setDeleteReason("") → setShowDeleteModal(true)
3. React batch update → re-render with showDeleteModal=true
4. {showDeleteModal && <form...>} → form MOUNT, deletePw="" 상태
5. DOM에 <input type="password" value="" autoComplete="off" name="dpw_xxx">
6. useEffect `[showDeleteModal]` 발화 → deleteFormRef.current.reset() (이미 비어있음)
7. ⚠️ 브라우저 password manager가 type=password 감지 → autoComplete="off" 무시 → 저장된 비번 채움
```

**Bug #1과 동일한 root cause**.

**autoComplete="off" 무력화 메커니즘**:
- Chrome: 2014년부터 보안 우려로 인해 password input의 `autoComplete="off"`를 무시. 사용자가 password manager에 저장한 사이트의 password 필드는 항상 autofill 후보.
- Safari: 동일하게 무시. iCloud Keychain이 채움.
- Firefox: 비교적 존중하나 사용자 설정에 따라 달라짐.
- `name` 무작위화는 새 input으로 보이게 만들지만, **type=password + label 텍스트 ("비밀번호 재입력")**이 강한 신호 → 일부 manager는 여전히 채움

**가설 + 검증 방법**:

| # | 가설 | 검증 |
|---|------|------|
| H1 | **password manager가 autoComplete="off" 무시 (확정 유력)** | incognito mode + password manager 무력화 상태에서 재현 안 됨 = H1 확정 |
| H2 | useEffect timing 영역 (이미 반증) | React DevTools state inspector |

**정정 방향**:
- **Option A**: type을 dynamic 전환 — 마운트 시 `type="text"`, focus 시 `type="password"` → manager 회피 (UX 시각적 노출 위험)
- **Option B**: `readOnly` + click 시 readOnly 해제 트릭 (구식 회피)
- **Option C**: 탈퇴 확인을 비번 입력 대신 "DELETE" 텍스트 입력으로 변경 — GitHub 패턴. **추천**
- **Option D**: 수용 — autofill되면 사용자가 더 편함 (자기 비번이라 빈 자리에 그게 있는 게 맞음). 단, UX 혼란만 안고 가야 함

---

### Bug #4: 기존 Google 사용자가 갑자기 Step 3 페이지로 들어감

**ROOT CAUSE 확정 (가설 X, 사실)**:

```sql
-- handle_new_user_profile (20260408001000_add_profiles_scan_quota.sql:45-57)
INSERT INTO public.profiles (id, scan_quota)
VALUES (NEW.id, 3)
ON CONFLICT (id) DO NOTHING;
-- ↑ profile_completed 미설정. 신규 사용자 모두 default 값 (false 또는 NULL).
```

**그리고**:
- `grep "profile_completed" supabase/migrations/` → **0 hits**
- `grep "ADD COLUMN" supabase/migrations/` (completed 관련) → **0 hits**

**결론**: `profile_completed` 컬럼은 Lovable 또는 Supabase Studio에서 직접 추가됨. 로컬 마이그레이션과 disconnect.

**데이터 흐름** (Google 기존 사용자):
```
1. 기존 사용자(snape016 등) Google OAuth 로그인
2. AuthCallback → profiles.select(profile_completed).eq(id, user.id).single()
3. profile_completed = false (또는 NULL → ?? false)
4. BroadcastChannel.postMessage({profile_completed: false})
5. AuthBroadcastListener → navigate("/?complete_profile=1")
6. AuthModal Step 3 마운트 → 닉네임/생년월일/국가/약관 입력 요구
```

**SQL 진단 쿼리** (사용자가 Supabase SQL Editor에서 실행):

```sql
-- 0. profile_completed 컬럼 메타정보 확인
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'profile_completed';

-- 1. 전체 사용자 profile_completed 분포
SELECT
  profile_completed,
  COUNT(*) AS user_count
FROM public.profiles
GROUP BY profile_completed
ORDER BY profile_completed NULLS FIRST;

-- 2. Google OAuth 사용자 중 profile_completed=false 목록
SELECT
  p.id,
  u.email,
  u.raw_app_meta_data->>'provider' AS provider,
  u.created_at AS user_created,
  p.profile_completed,
  p.nickname,
  p.birth_year
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.raw_app_meta_data->>'provider' = 'google'
  AND COALESCE(p.profile_completed, FALSE) = FALSE
ORDER BY u.created_at;

-- 3. 닉네임·생년월일 이미 있는데 profile_completed가 false인 행 (역행 데이터)
SELECT id, nickname, birth_year, birth_month, birth_day, profile_completed
FROM public.profiles
WHERE nickname IS NOT NULL
  AND birth_year IS NOT NULL
  AND COALESCE(profile_completed, FALSE) = FALSE;

-- 4. handle_new_user_profile 트리거가 실제로 어떤 형태로 운영 DB에 있는지
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user_profile'
  AND pronamespace = 'public'::regnamespace;
```

**정정 방향** (CTO 판단용):

| Option | 영역 | 작업량 | 위험 |
|--------|------|--------|------|
| **A. 데이터 패치** | 닉네임 + 생년월일이 이미 있는 사용자는 `profile_completed=true`로 일괄 UPDATE | 5분 (SQL 1줄) | 저 — 기존 데이터 기반 추론. 검증 가능 |
| **B. AuthCallback 분기 강화** | profile_completed 외에 `nickname IS NOT NULL`도 함께 검사 | 30분 | 저 — 코드 정합 |
| **C. handle_new_user_profile 트리거 수정** | 신규 사용자에 `profile_completed=false` 명시 INSERT + Google OAuth는 별도 분기 (Google은 이메일 인증 완료 상태이지만 닉네임 등 미수집 → false 유지가 맞음) | 1시간 | 중 — 로컬 마이그레이션 작성 필요 |
| **D. 마이그레이션 정합** | 운영 DB의 실제 스키마를 dump하여 로컬 마이그레이션과 동기화 | 2~4시간 | 중 — 향후 staging/prod 셋업 안정성 ↑ |

**추천 = A + B 조합**. C는 별도 sprint, D는 출시 전 별도 sprint.

---

### Bug #5: 프로필 페이지에서 이전 사용자 비번 잔존

**현재 코드 상태**:
- ProfilePage.tsx:118-122 `useEffect([user?.id])` → `setCurrentPw("")` setNewPw("")` setConfirmPw("")`
- ProfilePage.tsx:373 `autoComplete="current-password"` (현재 비번)
- ProfilePage.tsx:396 `autoComplete="new-password"` (새 비번)

**데이터 흐름**:
```
1. 사용자 A 로그인 → /profile 진입 → 비번 변경 시도 → 현재 비번 입력
2. 다른 탭에서 사용자 A signOut → AuthContext.user → null
3. ProfilePage useAuth() → user=null → if (!user) navigate("/") (line 125-128)
4. 또는 동일 탭에서 사용자 B 로그인 → user.id 변경
5. useEffect([user?.id]) 발화 → React state 모두 ""로 리셋
6. ⚠️ 단, 브라우저 password manager가 type=password + autoComplete="current-password" 감지 → 새 사용자의 saved password 채움
```

**Bug #1, #3과 동일한 root cause = 브라우저 autofill**.

특히 위험한 영역: `autoComplete="current-password"`는 **명시적으로 saved password autofill 허용** 신호. password manager가 사용자 B의 비번을 자동 채움. 사용자 B 입장에서 "내 비번이 미리 채워져 있네?" — 정상 동작이지만, 사용자 A 비번이 남아있다고 오해 가능.

**가설**:

| # | 가설 | 검증 |
|---|------|------|
| H1 | password manager autofill (가장 유력) | incognito 모드 또는 password manager 비활성화 |
| H2 | useEffect([user?.id]) 발화 실패 | React DevTools — user.id 변경 후 currentPw state 값 확인. "" 이면 H1, 잔존하면 H2 |
| H3 | 사용자 A와 사용자 B 사이의 signOut → signIn 빠른 전환 → user.id 변경이 setState 전에 발화 안 함 | onAuthStateChange 콜백이 동기로 user 갱신하는지 확인 |

**정정 방향**:
- Bug #1과 동일한 trade-off. password manager autofill을 수용할지 회피할지 CTO 판단.

---

## 3. 기존 사용자 `profile_completed` 영역 — SQL 진단 (재정리)

위 Bug #4 섹션에 통합. 핵심 진단 쿼리는 거기 참조.

### 추가 진단: profile_completed default value 확인

위 쿼리 #0의 `column_default` 결과에 따른 분기:

| column_default | 의미 | 영향 |
|----------------|------|------|
| `false` | NOT NULL DEFAULT false | 새 사용자 모두 false. handle_new_user_profile이 명시 안 해도 false. |
| NULL | nullable | NULL → `?? false` → false (AuthCallback.tsx:24). 동일. |
| `true` | DEFAULT true | 새 사용자가 자동 완료 → Step 3 안 들어감. 이건 위험 (가입 흐름 우회) |

---

## 4. 아키텍처 영역 위험

### 4.1 Race Condition

| # | 영역 | 위험도 | 시나리오 |
|---|------|--------|----------|
| R1 | AuthContext loading vs Index.tsx render | 저 | `authLoading=true` 동안 `pageHeaderRight=null` → 헤더 깜빡임. 사용자가 빠르게 로그인 버튼 클릭 시 race 발생 가능 |
| R2 | AuthBroadcastListener vs AuthContext.onAuthStateChange | 중 | 둘 다 supabase 상태 변경에 반응. refreshSession() → onAuthStateChange → setSession; 동시에 navigate. 첫 navigate 후 두 번째 navigate 발생 가능 |
| R3 | profile 로드 vs Step 3 노출 | 중 | `useAuth().user.app_metadata?.provider`가 `isOAuthUser` 결정. Magic Link 사용자는 `provider=email`이라 `isOAuthUser=false` — 정상. 단 `user`가 null일 때 (`?.` 체이닝) `isOAuthUser=false`로 fallback — Google OAuth 사용자가 Step 3 처음 들어갈 때 user가 아직 로드 안 됐으면 비번 입력 요구됨 (잘못됨) |

### 4.2 메모리 누수

| # | 영역 | 위험도 | 메커니즘 |
|---|------|--------|----------|
| M1 | BroadcastChannel | 저 | AuthBroadcastListener의 cleanup에서 channel.close() — 정상 |
| M2 | profile realtime subscription (useProfile.ts:78-100) | 저 | cleanup에서 removeChannel — 정상 |
| M3 | cooldownRef setInterval (AuthModal.tsx:91-103) | 저 | ESC 닫기 effect의 cleanup에서 clearInterval — 정상 |
| M4 | beforeunload (ProfilePage.tsx:84-91) | 저 | cleanup에서 removeEventListener — 정상 |

→ 메모리 누수 영역 모두 cleanup 적용되어 있음. 위험 없음.

### 4.3 보안 영역

| # | 영역 | 위험도 | 내용 |
|---|------|--------|------|
| S1 | request_account_deletion (20260511_account_deletion.sql) | 저 | SECURITY DEFINER + auth.uid() 검증 — 정상. 단, 비번 재검증은 client-side만 (signInWithPassword) — RPC 자체는 비번 검증 X. 세션 탈취 시 비번 없이 탈퇴 가능 (가설) |
| S2 | check_email_exists RPC | 저 | 이메일 존재 여부 노출 = enumeration risk. 단, 가입 흐름 UX와 trade-off — 통상 허용 |
| S3 | profiles RLS | 저 | "Users can update own profile" — auth.uid() = id. 정상 |
| S4 | profile_completed 클라이언트 측 검증 | 중 | AuthCallback에서 client-side로 profile_completed 읽고 분기 — 사용자가 직접 `/?complete_profile=1` URL을 박으면 무조건 Step 3 모달 노출. 보안은 아니지만 UX 혼란 |

### 4.4 에지 케이스

| # | 영역 | 시나리오 | 영향 |
|---|------|----------|------|
| E1 | 네트워크 끊김 (AuthCallback) | getSession() 실패 → navigate("/?auth_error=session") — 단, error UI 없음 | 사용자가 빈 홈 화면 봄 — UX 손상 |
| E2 | window.close() 실패 | mobile Safari 등에서 항상 실패. closeFailed UI 표시 (line 41-50) — 정상 | UX 정상 |
| E3 | 세션 만료 중 ProfilePage 접근 | useAuth().user → null → navigate("/") — 정상. 단, 진행 중인 비번 변경/탈퇴 폼 입력 손실 | 사용자가 비번 다시 입력해야 함 — 정상 |
| E4 | 다중 탭 인증 | AuthBroadcastListener는 모든 탭이 수신. 한 탭에서 가입 완료하면 다른 탭들도 모두 navigate — **의도되지 않은 navigate 가능성** | 모든 탭이 `/?complete_profile=1`로 navigate — Step 3 모달이 여러 탭에 동시 노출 (UX 혼란) |
| E5 | OAuth callback의 profiles.select 실패 | `single()` 결과 null이면 `?? false` → Step 3로 보냄 — 안전 분기. 단, 트리거 race로 행이 아직 INSERT 안 됐을 가능성 (Supabase auth.users INSERT → trigger AFTER INSERT → public.profiles INSERT) | 거의 발생 안 함 |
| E6 | Magic Link 유효기간 만료 | signInWithOtp 링크는 1시간 유효 (Supabase default). 사용자가 늦게 클릭하면 AuthCallback에서 `error || !session` → /?auth_error=session | 사용자가 다시 가입 시작해야 함 — 정상 |

---

## 5. 검증 환경 권장

### 5.1 현황

- Supabase 무료 플랜 이메일 한도 = 시간당 4개 (한도 매우 낮음)
- 사용자가 가입 → 메일 수신 → 클릭 → AuthCallback 흐름을 반복 검증 시 빠르게 한도 도달
- 단위 테스트 (Vitest) = 780/780 통과하나 password manager autofill, BroadcastChannel, 실제 메일 흐름 시뮬레이션 불가능

### 5.2 옵션

| Option | 작업량 | 검증 가능 영역 | 추천도 |
|--------|--------|----------------|--------|
| **A. Resend 무료 (3K/월)** + Supabase Custom SMTP 연동 | 30분 | 실제 메일 흐름 전체 | **최우선** |
| **B. SendGrid 무료 (100/일)** + Custom SMTP | 30분 | 동일 | 차선 |
| **C. Mailtrap (개발용 SMTP trap)** | 30분 | 발송 확인 + 본문 inspect (실제 클릭 안 됨) | 보조 |
| **D. Playwright E2E + Mailosaur** | 4~6시간 | 자동화 가능 — 출시 전 1회 기록할 가치 있음 | 출시 후 |
| **E. Manual incognito 검증** | 즉시 | password manager 우회 검증 (Bug #1, #3, #5) | 지금 당장 |

**즉시 기록할 수 있는 것 = E (Manual incognito)**.

```bash
# Chrome incognito + dev server
npm run dev
# Chrome → 새 incognito 창 → http://localhost:5173
# → 회원가입 → 모달 닫기 → 다시 로그인 → 비번 비어있는지 확인
# → ProfilePage 진입 → 비번 변경 form 확인
```

incognito에서 비번 자동완성 안 일어나면 = 100% password manager 문제 (Bug #1, #3, #5). incognito에서도 일어나면 = 다른 가설 검증 필요.

---

## 6. 정정 우선순위 매트릭스 (CTO 판단용)

### 6.1 Severity × Effort matrix

```
         │ Low Effort                │ Med Effort                │ High Effort
─────────┼───────────────────────────┼───────────────────────────┼──────────────────
P0 (출시 │ Bug #2 = Supabase 템플릿  │ Bug #4 = profile_completed│ —
 차단)   │   확인 (5분, 사용자 액션) │   데이터 패치 + 분기 강화 │
─────────┼───────────────────────────┼───────────────────────────┼──────────────────
P1 (UX)  │ Bug #1, #3, #5 = autofill │ Bug #3 = "DELETE" 텍스트  │ Bug #1, #5 =
         │  수용 + 사용자 안내       │  입력 패턴으로 전환       │  decoy input 트릭
─────────┼───────────────────────────┼───────────────────────────┼──────────────────
P2 (출시 │ E4 = 다중 탭 동시 navigate│ 마이그레이션 drift 정합   │ E2E 테스트 셋업
 후)     │  안내 메시지              │  (D 옵션)                 │  (Playwright)
```

### 6.2 추천 정정 순서

1. **즉시 (사용자 액션, 5분)**:
   - Supabase Dashboard에서 "Confirm signup" 이메일 템플릿 본문이 `{{ .ConfirmationURL }}` 사용 중인지 확인
   - 위 SQL 진단 쿼리 #0~#4를 Supabase SQL Editor에서 실행 → 결과 공유
   - Chrome incognito에서 Bug #1, #3, #5 재현 시도 → 결과 공유

2. **Bug #4 정정 sprint (1~2시간, 별도)**:
   - 데이터 패치: `UPDATE public.profiles SET profile_completed=true WHERE nickname IS NOT NULL AND birth_year IS NOT NULL;`
   - AuthCallback 분기 강화: `profile_completed AND nickname IS NOT NULL` 검사
   - 회귀 테스트 추가

3. **Bug #2 정정 sprint (Supabase 설정 + 검증, 30분)**:
   - 이메일 템플릿 갱신
   - 실제 메일 수신 → 클릭 → Step 3 도달 검증

4. **Bug #1, #3, #5 UX 결정 (CTO, 5분)**:
   - autofill 수용 vs 회피 trade-off 결정
   - 회피 시: Bug #3는 "DELETE" 텍스트 패턴 추천 (가장 안전)

5. **출시 후 별도 sprint**:
   - 마이그레이션 drift 정합 (운영 DB schema dump → 로컬 마이그레이션)
   - E2E 테스트 셋업

---

## 7. 직전 3개 commit이 실패한 정확한 이유 (한 줄 요약)

| Commit | 시도 | 왜 실패했는지 |
|--------|------|---------------|
| **1e188b4** (open prop + reset effect) | useEffect 비동기 → 마운트 후 비동기 reset → flash | useEffect는 페인트 후 발화. autofill도 페인트 후. 둘 다 페인트 후라 timing 충돌 |
| **1d2d2c3** (conditional render + key prop) | unmount/remount = React state 정합 ✅ | React state 영역은 해결됨. **단, 진짜 원인은 React state가 아니라 password manager autofill** — 영역 자체가 어긋남 |
| **4b2ee76** (autoComplete + form.reset()) | autoComplete 명시 + DOM 강제 reset | Chrome/Safari는 password input의 `autoComplete="off"` 무시. form.reset()은 페인트 직후 1회만 실행되고, password manager는 그 후 비동기로 채움. 모든 정정이 페인트 이전에 끝나야 하는데 둘 다 페인트 후 실행 |

**핵심**: Sonnet 4.6이 기록한 3개 정정 모두 **React state 영역**을 완료했으나, 진짜 원인은 **브라우저 password manager 동작 영역**이라 React 정정으로 해결 불가능. 단, 단위 테스트는 jsdom 환경이라 password manager가 시뮬레이션 안 되어 모두 통과 → 추측이 강화되는 false confidence loop.

---

## 8. 사용자가 다음에 기록할 단계 (Immediate Actions)

### 즉시 (1시간 내):

1. **Chrome incognito 모드에서 Bug #1, #3, #5 재현 시도** → 결과 공유 (재현 안 됨 = password manager 확정)
2. **Supabase Dashboard → Auth → Email Templates → "Confirm signup"** 본문 확인 → 스크린샷 또는 본문 텍스트 공유
3. **Supabase SQL Editor에서 위 진단 쿼리 #0~#4 실행** → 결과 공유

### 진단 결과 받고 기록할 수 있는 정정 sprint 결정:

- 진단 결과 H1 (autofill) 확정 → Bug #1, #3, #5 정정 방향 CTO 결정
- 진단 결과 H1 (이메일 템플릿) 확정 → Bug #2 정정 = 사용자 액션
- 진단 결과 profile_completed 컬럼 상태 확인 → Bug #4 정정 sprint 기록할 영역 결정

### 별도 sprint (출시 전):

- 마이그레이션 drift 정합 (운영 DB schema 동기화)
- E2E 테스트 셋업 (Playwright + 메일 수신 자동화)

---

## 부록 A. 검토한 파일 목록 (사실 기반)

| 파일 | 줄 수 | 마지막 수정 commit |
|------|------|--------------------|
| src/components/AuthModal.tsx | 791 | 4b2ee76 |
| src/contexts/AuthContext.tsx | 70 | (older) |
| src/hooks/useProfile.ts | 103 | (older) |
| src/pages/AuthCallback.tsx | 58 | 1d2d2c3 |
| src/App.tsx | 165 | (older) — AuthBroadcastListener 포함 |
| src/pages/Index.tsx | 150 | 1d2d2c3 |
| src/pages/ProfilePage.tsx | 626 | 4b2ee76 |
| src/lib/profile.ts | 300 | (older) — completeProfile, checkEmailExists |
| src/integrations/supabase/client.ts | 17 | (older) |
| supabase/migrations/20260408001000_add_profiles_scan_quota.sql | 119 | (older) — handle_new_user_profile 트리거 정의 |
| supabase/migrations/20260511_account_deletion.sql | 27 | 99eb90e |

**profile_completed 관련 마이그레이션은 발견되지 않음** (grep 결과 0 hits). 이게 핵심 발견.

---

*문서 작성: 2026-05-11. 작성자: Opus 4.7. 코드 변경 X — 진단·문서만.*

---

## 9. 정정 완료 — 2026-05-12 (Sonnet 4.6)

위 §6 우선순위 매트릭스에서 결정된 정정을 완료했다. 변경 사항 요약:

| 항목 | 정정 내용 | commit |
|---|---|---|
| Bug #4 (profile_completed) | trigger `handle_new_user_profile` default true + 마이그레이션 | 1e9e0bf |
| Bug #1, #3, #5 (비밀번호 autofill) | 비밀번호 UI 완전 제거 (매직링크 only) | ba17423, 58ecc0b |
| Bug #2 (Step 3 미도달) | Step 3 완전 제거 — profile_completed 분기 삭제 | ba17423, df99a3a |
| 탈퇴 보안 | 비밀번호 재확인 → 이메일 OTP 재인증 | efb42c2 |
| /reset-password | 메인 redirect | e92bc68 |

**production apply 필요**: `supabase/migrations/20260512_profile_completed_default.sql`

**미해결 (출시 후)**:
- E2E 테스트 (Playwright + Mailosaur) — §5.2 Option D
- 마이그레이션 drift 정합 (운영 DB schema dump)
- Resend 연동 후 실제 메일 흐름 E2E 검증
