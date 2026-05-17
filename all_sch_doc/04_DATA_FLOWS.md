# 04 — DATA FLOWS 영역

> 기능별 영역 데이터 흐름 영역 박음. 사용자 시나리오 → 컴포넌트 → 훅 → 함수 → 테이블 영역.
> 박힌 근거 영역: `src/` 영역 + `supabase/functions/` 영역 + `supabase/migrations/` 영역.

## 0. 진입점 영역

### 0.1 이 문서 영역 박는 영역

"기능 1개 영역 = 어떤 컴포넌트·훅·함수·테이블 영역 거쳐 어떤 데이터 박히는지" 영역 박힘.

박는 시점 영역:
- **디버그**: 게임 종료 후 영역 KPI 영역 박지 X 박힘 영역 → 04_DATA_FLOWS.md §1.1 영역 박음 → silent fail 영역 어디서 박힘 확인
- **신규 개발자**: 결제 영역 어떻게 박는지 → §1.7 영역 박음
- **변경 영향 분석**: `record_game_session` 영역 수정 영역 시 영역 영향 영역 다른 기능 영역 → §1.1 영역 §5 영역 표 영역

### 0.2 흐름 다이어그램 영역 표기 영역

```
사용자 → 컴포넌트 → 훅 → Supabase Client → RPC/INSERT → DB 테이블
```

각 기능 영역 → 10항목 박음:
1. 사용자 시나리오 영역
2. 흐름 다이어그램 영역 (ASCII 영역 박음)
3. 진입점 영역 (어디서 시작 영역)
4. 거치는 영역 (단계별 상세 영역)
5. 박는 테이블 영역 (요약 영역)
6. 영향 영역 (다른 기능 영역)
7. 에러 영역 (silent fail 영역)
8. 주의점·짚을 영역
9. 검증 영역 (SQL 영역)
10. 관련 문서 영역

---

## 1. 기능별 흐름 영역

### 1.1 게임 진행·종료 영역

#### 1. 사용자 시나리오
> 사용자 영역 Lv 1-1 영역 진입 영역 → 게임 영역 박음 → 목숨 영역 0 영역 또는 영역 완료 영역 → 종료 다이얼로그 영역 박힘 영역 → DB 영역 저장 영역.

#### 2. 흐름 다이어그램

```
사용자 ─→ /play (PlayPage)
            │
            ▼
       <NoteGame level={N} sublevel={M}>
            │
            ├─→ useDailyLimit.canStart 영역 체크
            │        │
            │        └─→ daily_sessions SELECT (rpc: get_today_session_count)
            │
            ├─→ useSessionRecorder.startSession(level, sessionType)
            │        │
            │        └─→ 메모리 영역만 (DB 영역 X)
            │
            ├─→ 게임 영역 진행 영역 (음표 영역 박힘)
            │        │
            │        └─→ recorder.recordNote({ note, correct, reactionMs, clef, accidental })
            │                  │
            │                  └─→ 메모리 영역 (DB 영역 X). reactionMs 영역 offset 영역 보정 영역
            │
            ├─→ phase === "success" | "gameover"  ✦ 종료 트리거 영역
            │        │
            │        ▼
            │   recorder.endSession(reason)
            │        │
            │        ├─→ ① supabase.rpc("record_game_session", { ... })
            │        │        │
            │        │        ├─→ user_sessions INSERT
            │        │        ├─→ user_stats_daily UPSERT (ON CONFLICT user_id+stat_date)
            │        │        └─→ profiles.last_practice_date UPDATE
            │        │
            │        └─→ ② RPC 실패 영역 시 fallback:
            │                 supabase.from("user_sessions").insert(...)
            │                 supabase.from("profiles").update({ last_practice_date }).eq("id", uid)
            │
            ├─→ recordAttempt(level, sublevel, attempts, correct, max_streak, gameStatus, avgReactionRatio)
            │        │
            │        └─→ supabase.rpc("record_sublevel_attempt", { ... })
            │                  │
            │                  ├─→ user_sublevel_progress UPSERT
            │                  ├─→ 통과 영역 판정 영역 (10게임·streak 5·acc 85%·reaction 0.35)
            │                  ├─→ 패스트트랙 영역 분기 영역 (premium + sub2+ + 1번째 + 99%)
            │                  └─→ just_passed 영역 시 영역 다음 sublevel INSERT
            │
            └─→ <SublevelPassedDialog> 또는 <GameOverDialog>
```

#### 3. 진입점
- 사용자 액션: 단계 선택 → "시작" 버튼
- 컴포넌트: `src/pages/PlayPage.tsx` → `<NoteGame>` 영역 박음
- 라우트: `/play`

#### 4. 거치는 영역 (단계별)

##### 4.1 게임 시작 영역
- 파일: `src/components/NoteGame.tsx:517` (initial) + `:1280` (재시작)
- 박는 작업:
  - `recorder.startSession(level, sessionType)` — 메모리 영역 박음
  - `useDailyLimit` 영역 체크 (Premium 영역 X → DB 영역 호출 영역)
  - 카운트다운 영역 박음
- 박는 테이블: 없음 (메모리)

##### 4.2 음표 영역 박힘 영역 (진행 영역)
- 파일: `src/components/NoteGame.tsx:1077, 1142, 1206`
- 박는 작업:
  - `recorder.recordNote({ note, correct, reactionMs, clef, accidental })` 영역 박음
  - `getUserEnvOffset()` + `clampReactionMs()` 영역 박은 영역 reactionMs 영역 보정 영역 (§7.3.2)
- 박는 테이블: 없음 (메모리)

##### 4.3 게임 영역 종료 영역
- 파일: `src/components/NoteGame.tsx:540-560`
- 박는 작업:
  - `phase === "success"` 또는 `"gameover"` → `endSession(reason)` 영역 호출
  - 이어서 `recordAttempt(...)` 영역 호출

##### 4.4 `useSessionRecorder.endSession()` 영역
- 파일: `src/hooks/useSessionRecorder.ts:220-408`
- 박는 작업:
  - 통계 계산 (정답률·반응시간·약점/강점 음표·XP breakdown)
  - `supabase.rpc("record_game_session", { ... })` 영역 호출 영역
  - RPC 실패 영역 시 직접 INSERT 영역 폴백 영역 (`useSessionRecorder.ts:344`)
  - 추가 영역 `supabase.from("profiles").update({ last_practice_date }).eq("id", uid)` (`:374`)
- 박는 테이블: `user_sessions`·`user_stats_daily`·`profiles`

##### 4.5 `record_game_session()` RPC 영역
- 파일: `supabase/migrations/20260517_record_game_session_rpc.sql`
- 박는 작업:
  - `user_sessions` INSERT (`EXCEPTION WHEN undefined_table` 폴백)
  - `user_stats_daily` UPSERT
  - `profiles.last_practice_date` UPDATE (NULL OR < v_today)
- 박는 테이블: 3개 동시 (SECURITY DEFINER 영역 박음)

##### 4.6 `useLevelProgress.recordAttempt()` 영역
- 파일: `src/hooks/useLevelProgress.ts:72`
- 호출 시점: 게임 영역 종료 후 영역 (NoteGame.tsx:552)
- 박는 작업: `supabase.rpc("record_sublevel_attempt", { p_level, p_sublevel, p_attempts, p_correct, p_max_streak, p_game_status, p_avg_reaction_ratio })`
- 박는 테이블: `user_sublevel_progress`

##### 4.7 `useDailyLimit.increment()` 영역
- 파일: `src/hooks/useDailyLimit.ts:132`
- 호출 시점: 게임 영역 시작 영역 직전 영역
- 박는 작업: `supabase.rpc("increment_daily_session")`
- 박는 테이블: `daily_sessions`

##### 4.8 `useNoteLogger` 영역 — 매 음표 영역 박음 (Phase 3 Step 4 추가)
- 파일: `src/hooks/useNoteLogger.ts:28` (래퍼 영역) → `src/lib/userNoteLogs.ts:117` (INSERT 영역)
- 호출 시점: `NoteGame.tsx:1067·1132·1196` 영역 음표 영역 박힘 영역 박은 영역 박음
- 박는 작업: `supabase.from("user_note_logs").insert({ user_id, note_key, octave, clef, is_correct, response_time, error_type, level })`
- 박는 테이블: `user_note_logs` INSERT

##### 4.9 트리거 영역 박음 — `on_session_complete` (Phase 3 박은 영역)
- 파일: `supabase/migrations/20260518_phase3_consolidation.sql §11-12`
- 시점: user_sessions AFTER INSERT
- 호출 함수: `handle_session_complete()`
- 박는 테이블: `user_stats_daily` UPSERT (RPC 영역 박음 영역 박음 영역 두 번째 영역 갱신 영역 — idempotent) · `profiles` UPDATE (total_xp + last_practice_date) · `note_mastery` UPSERT (note_attempts JSONB 영역 순회 영역 박음)

#### 5. 박는 테이블 (요약)

| 테이블 | 작업 | 박는 위치 | 박는 함수 |
|---|---|---|---|
| `user_sessions` | INSERT | `record_game_session()` RPC | 20260517 |
| `user_stats_daily` | UPSERT | `record_game_session()` + `handle_session_complete()` trigger | 20260517 + 20260518 (Phase 3 박은 영역) |
| `profiles` | UPDATE `last_practice_date` + `total_xp` | RPC + `trg_update_profile_after_session` + `on_session_complete` | 20260516 + 20260517 + 20260518 |
| `note_mastery` | UPSERT (note_attempts JSONB 영역 박음) | `handle_session_complete()` trigger | 20260518 (Phase 3 박은 영역) |
| `user_sublevel_progress` | UPSERT | `record_sublevel_attempt()` RPC | 20260425 + 20260509 |
| `daily_sessions` | UPSERT | `increment_daily_session()` RPC | 20260509_daily_sessions |
| `user_note_logs` | INSERT (매 음표 영역) | `useNoteLogger` → `userNoteLogs.ts:117` | 20260405 |

#### 6. 영향 영역 (다른 기능)
- **대시보드 영역 KPI 카드** — `user_sessions`·`user_stats_daily` 영역 SELECT (`useMyStats.ts`)
- **대시보드 영역 약점 음표** — `note_mastery` 영역 SELECT (배치 영역 박힘 영역 박음)
- **레벨 선택 영역** — `user_sublevel_progress` 영역 SELECT (`useLevelProgress.ts`)
- **일일 한도 모달** — `daily_sessions` 영역 SELECT (`useDailyLimit.ts`)
- **last_practice_date 영역** — 대시보드 영역 isNewUser 영역 분기 영역 박음

#### 7. 에러 영역 (silent fail 영역)
- ⚠️ RPC 영역 실패 영역 시 fallback INSERT 영역 박힘 (정상 영역 박힘)
- ⚠️ RPC + fallback 영역 둘 다 실패 영역 시 영역 `console.error` 영역만 박힘 (UI 영역 알림 X)
- ⚠️ `record_sublevel_attempt` 영역 실패 영역 시 잠금 해제 X 영역 — 사용자 영역 알림 X
- ⚠️ `increment_daily_session` 영역 실패 영역 시 영역 한도 영역 카운트 X
- ⚠️ trigger 영역 `trg_update_profile_after_session` 영역 production 영역 미적용 영역 시 영역 `last_practice_date` 영역 갱신 X 영역 (`record_game_session` 영역 RPC 영역 박힘 영역 박음 영역 직접 UPDATE 영역 박힘)

#### 8. 주의점·짚을 영역
- ⚠️ Session 1: `user_sessions`·`user_stats_daily` 영역 마이그 영역 없음 영역 (Dashboard 직접 영역)
- ⚠️ Session 2: `record_sublevel_attempt` 영역 중복 정의 3번 영역 (20260425 → 20260509_pass_criteria_v2 → 20260509_fast_track)
- ⚠️ `note_mastery` 영역 갱신 영역 진입점 영역 명확 X 영역 — INSERT/UPDATE trigger 영역 박힘 여부 영역 ⚠️ 확인 필요
- 비로그인 영역 시 영역 `endSession` 영역 NULL 영역 반환 영역 (`useSessionRecorder.ts:236`) — DB 영역 박지 X 박힘
- `session_type` 영역: `regular`·`focus_mode`·`custom_score`·`tutorial`

#### 9. 검증 영역
```sql
-- 게임 1회 박은 후 5분 영역 내 영역 모든 테이블 영역 박혔는지 영역
SELECT 'user_sessions' AS tbl, COUNT(*) AS cnt
  FROM public.user_sessions
  WHERE user_id = $1
    AND created_at >= NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 'user_stats_daily', COUNT(*)
  FROM public.user_stats_daily
  WHERE user_id = $1
    AND stat_date = (NOW() AT TIME ZONE 'UTC')::DATE
UNION ALL
SELECT 'user_sublevel_progress (updated_at)', COUNT(*)
  FROM public.user_sublevel_progress
  WHERE user_id = $1
    AND updated_at >= NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 'daily_sessions', COUNT(*)
  FROM public.daily_sessions
  WHERE user_id = $1
    AND session_date = (NOW() AT TIME ZONE 'UTC')::DATE
UNION ALL
SELECT 'profiles.last_practice_date', COUNT(*)
  FROM public.profiles
  WHERE id = $1
    AND last_practice_date = (NOW() AT TIME ZONE 'UTC')::DATE;
```

#### 10. 관련 문서
- `01_SCHEMA.md` §2 `user_sessions`, §3 `user_sublevel_progress`, §5 `user_stats_daily`, §7 `daily_sessions`
- `03_SQL_FUNCTIONS.md` §2.10 `record_game_session`, §2.8 `record_sublevel_attempt`, §2.12 `increment_daily_session`
- `05_KNOWN_ISSUES.md` §1.1 마이그 정의 없는 영역

---

### 1.2 회원가입 영역 (Magic Link + OAuth)

#### 1. 사용자 시나리오
> 이메일 입력 영역 → Magic Link 영역 박힘 영역 → 인증 영역 → profiles 영역 자동 생성 영역.
> 또는 영역 Google OAuth 영역 박음 영역.

#### 2. 흐름 다이어그램

```
사용자 ─→ <AuthModal /> 영역 박음
            │
            ├─→ ① 이메일 입력 영역
            │        │
            │        ▼
            │   profile.ts:checkEmailExists() → supabase.rpc("check_email_exists", { p_email })
            │        │
            │        └─→ 4-state 영역 분기:
            │                · 'new'                → Magic Link 영역 박음
            │                · 'active'             → 로그인 CTA 영역
            │                · 'deleted_recoverable'→ 복구 영역 panel 영역
            │                · 'deleted_expired'    → 미가입 영역 시도 영역
            │
            ├─→ ② Magic Link 영역 박음
            │        │
            │        ▼
            │   supabase.auth.signInWithOtp({ email, options: {...} })
            │        │
            │        ▼
            │   이메일 영역 박힘 영역 (Supabase 영역 박힌 OTP 링크)
            │        │
            │        ▼
            │   사용자 영역 링크 영역 클릭 영역
            │        │
            │        ▼
            │   /auth/callback (AuthCallback.tsx)
            │        │
            │        ├─→ supabase.auth.getSession()
            │        │
            │        ├─→ localStorage.noteflex_consent 영역 박힘 영역 박힘 영역 →
            │        │   supabase.from("profiles").update({ tos/privacy/marketing }).eq("id", uid)
            │        │
            │        └─→ 인증 영역 완료 영역 → window.close()
            │
            └─→ ③ Google OAuth 영역
                     │
                     ▼
                supabase.auth.signInWithOAuth({ provider: "google" })
                     │
                     ▼
                Google 인증 영역
                     │
                     ▼
                /auth/callback (동일 영역)
```

**auth.users INSERT 영역 시 영역 trigger 영역 박힘 영역**:
```
auth.users INSERT
       │
       ▼ AFTER INSERT trigger
on_auth_user_created_profile
       │
       ▼
handle_new_user_profile()
       │
       └─→ profiles INSERT (id, email, display_name, avatar_url, nickname, profile_completed=true, tos/privacy/marketing 동의 시점)
```

#### 3. 진입점
- 사용자 액션: "로그인 / 가입" 버튼 → 이메일 영역 입력
- 컴포넌트: `src/components/AuthModal.tsx`
- 라우트: 모든 영역 (모달 영역)

#### 4. 거치는 영역 (단계별)

##### 4.1 이메일 존재 영역 체크
- 파일: `src/lib/profile.ts:161` — `checkEmailExists(email)`
- 박는 작업: `supabase.rpc("check_email_exists", { p_email: email })`
- 박는 테이블: `auth.users`·`profiles` (SELECT, SECURITY DEFINER)
- 반환: `{ account_status, recovery_days_left }`

##### 4.2 신규 영역 가입 영역 (Magic Link)
- 파일: `src/components/AuthModal.tsx:162, 208, 234`
- 박는 작업: `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: true|false, data: { ... } } })`
- TOS 영역 동의 시점 영역 = `options.data` 영역 박음 → `auth.users.raw_user_meta_data` 영역 박음
- 박는 테이블: `auth.users` (Magic Link 영역 박힘 영역 시 INSERT)

##### 4.3 OAuth 영역 가입
- 파일: `src/components/AuthModal.tsx:141`
- 박는 작업: `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`
- 박는 테이블: `auth.users` (OAuth 콜백 영역 박힘 영역 시 INSERT)

##### 4.4 `on_auth_user_created_profile` trigger 영역
- 파일: `supabase/migrations/20260408001000:62 + 20260512:trigger`
- 박는 작업: auth.users INSERT 영역 박힌 영역 박음 영역 `handle_new_user_profile()` 영역 호출 영역
- 박는 함수: `handle_new_user_profile()`
  - profiles INSERT (id, email, display_name=`COALESCE(meta.full_name, meta.name, split_part(email,'@',1))`, avatar_url=meta.avatar_url, nickname=`user_<8자>`, profile_completed=true, tos/privacy/marketing 영역 동의 시점)
  - ON CONFLICT (id) DO UPDATE (tos_agreed_at IS NULL 영역 시 동의 시점 영역 갱신)
- 박는 테이블: `profiles`

##### 4.5 AuthCallback 영역 동의 영역 반영
- 파일: `src/pages/AuthCallback.tsx:62-71`
- 박는 작업: localStorage 영역 `noteflex_consent` 영역 박힘 영역 박힘 영역 → `supabase.from("profiles").update(consent).eq("id", session.user.id)`
- 박는 테이블: `profiles`
- ⚠️ silent fail 영역: try/catch 영역 박힘 영역 → 실패 영역 시 영역 인증 영역 차단 X

#### 5. 박는 테이블 (요약)

| 테이블 | 작업 | 박는 위치 | 박는 함수 |
|---|---|---|---|
| `auth.users` | INSERT | Magic Link/OAuth 영역 박힘 영역 | Supabase Auth |
| `profiles` | INSERT (trigger) | `handle_new_user_profile()` | 20260408001000 + 20260512 |
| `profiles` | UPDATE consent | `AuthCallback.tsx:66` | direct |

#### 6. 영향 영역
- **대시보드 영역** — profiles 영역 박힘 영역 박힘 영역 KPI 영역 박지 X 박힘 영역 가능 영역 (NewUserView 영역)
- **온보딩 영역** — `profile_completed = true` 영역 박힘 영역 박힘 영역 → 온보딩 영역 영역 박지 X 박힘 영역 가능
- **닉네임 영역** — `user_<8자>` 영역 자동 생성 영역 → 사용자 영역 수정 영역 박음 영역 가능

#### 7. 에러 영역 (silent fail)
- ⚠️ AuthCallback `noteflex_consent` UPDATE 영역 실패 영역 시 영역 영역 무시 영역 (try/catch)
- ⚠️ Magic Link 영역 박힘 영역 박지 X 박힐 영역 가능 영역 (Supabase 영역 박힘 영역 박지 X 박힘 영역) → 사용자 영역 알림 X
- ⚠️ OAuth 영역 인증 영역 실패 영역 시 영역 `/?auth_error=session` 영역 박힘 영역

#### 8. 주의점·짚을 영역
- ⚠️ `handle_new_user_profile` 영역 = 가입 영역 영역 의존 함수 영역. 실패 영역 시 영역 가입 영역 차단 영역 박힘 영역 → idempotent 영역 박힘 (ON CONFLICT DO UPDATE).
- ⚠️ 닉네임 영역 = `user_<8자>` 영역 자동 영역 — 부분 영역 유니크 영역 인덱스 영역 `profiles_nickname_active_unique` 영역 박힘 영역 (20260513_preserve_nickname).
- Magic Link 영역 redirect 영역 = `/auth/callback`.
- `shouldCreateUser: true` 영역 박힘 영역 = 신규 영역 가입 영역. `false` 영역 박힘 영역 = 기존 영역 사용자 영역 박음.

#### 9. 검증 영역
```sql
-- 가입 영역 박은 후 영역 profiles 영역 박혔는지 영역
SELECT * FROM auth.users WHERE email = 'newuser@example.com';
SELECT * FROM public.profiles WHERE email = 'newuser@example.com';

-- 닉네임 영역 박혔는지 영역
SELECT id, nickname, tos_agreed_at, privacy_agreed_at FROM public.profiles WHERE id = $1;
```

#### 10. 관련 문서
- `01_SCHEMA.md` §1 `profiles`
- `03_SQL_FUNCTIONS.md` §2.1 `handle_new_user_profile`, §2.2 `check_email_exists`

---

### 1.3 로그인 영역

#### 1. 사용자 시나리오
> 기존 영역 활성 영역 계정 영역 사용자 영역 Magic Link 영역 박음 영역 → 로그인 영역 완료 영역.

#### 2. 흐름 다이어그램

```
사용자 ─→ <AuthModal /> ─→ checkEmailExists() ─→ 'active' 분기
            │                                          │
            │                                          ▼
            │                              <LoginPanel /> (CTA: "로그인 영역 박음")
            │                                          │
            │                                          ▼
            │                          supabase.auth.signInWithOtp({ email })
            │                                          │
            │                                          ▼
            │                              이메일 영역 박힌 Magic Link
            │                                          │
            │                                          ▼
            │                              /auth/callback (AuthCallback.tsx)
            │                                          │
            │                                          ▼
            │                              supabase.auth.getSession() → SESSION 영역 박힘
            │                                          │
            │                                          ▼
            │                              BroadcastChannel + localStorage 영역 박음 → 원본 영역 탭 영역 박힘 영역
            │                                          │
            │                                          ▼
            └────────────────────────────────── window.close()
```

#### 3. 진입점
- 사용자 액션: 이메일 영역 입력 → Magic Link 클릭
- 컴포넌트: `src/components/AuthModal.tsx`

#### 4. 거치는 영역
- 4.1 `checkEmailExists` → 'active' 분기 영역 (`AuthModal.tsx`)
- 4.2 `signInWithOtp({ email, options: { shouldCreateUser: false } })` 박음
- 4.3 AuthCallback 영역 `getSession()` 영역 박음
- 4.4 BroadcastChannel `noteflex_auth` 영역 박은 영역 원본 영역 탭 영역 통신 영역
- 4.5 `AuthContext.onAuthStateChange` 영역 박혀 영역 user 영역 갱신 영역

#### 5. 박는 테이블

| 테이블 | 작업 | 박는 위치 |
|---|---|---|
| `auth.users` | SELECT (Magic Link 검증) | Supabase Auth |
| `profiles` | 영역 (가입 영역 X 영역) | — |

#### 6. 영향 영역
- 모든 영역 페이지 영역 `user` 영역 박힘 영역 영역 분기 영역 박음

#### 7. 에러 영역
- ⚠️ Magic Link 영역 박지 X 박힐 영역 가능 영역 (스팸함 영역)
- ⚠️ Magic Link 영역 만료 영역 시 `/?auth_error=session` 영역 박힘

#### 8. 주의점
- `shouldCreateUser: false` 영역 박음 영역 = 기존 영역 사용자 영역만 영역 박음 영역
- 탈퇴 영역 30일 영역 내 영역 = `restore_account` 분기 영역 (§1.4 영역 박음)

#### 9. 검증 영역
```sql
SELECT id, email, email_confirmed_at, last_sign_in_at FROM auth.users WHERE email = $1;
```

#### 10. 관련 문서
- `03_SQL_FUNCTIONS.md` §2.2 `check_email_exists`

---

### 1.4 계정 영역 삭제·복구 영역

#### 1. 사용자 시나리오
> A) 탈퇴 영역 → 30일 영역 soft-delete 영역.
> B) 30일 영역 내 영역 재방문 영역 → 복구 영역.
> C) "새로 시작" 영역 → profiles + auth.users 영역 영구 영역 삭제 영역.

#### 2. 흐름 다이어그램

```
[A] 탈퇴 영역
사용자 → ProfilePage → 탈퇴 영역 박음 → Magic Link 영역 박음 (action=confirm_deletion)
                                                  │
                                                  ▼
                                          /auth/callback?action=confirm_deletion
                                                  │
                                                  ▼
                                  supabase.rpc("request_account_deletion", { reason })
                                                  │
                                                  ├─→ profiles UPDATE (is_deleted=true, deleted_at=NOW, email=마스킹)
                                                  │
                                                  └─→ supabase.auth.signOut()

[B] 복구 영역
사용자 → AuthModal → email 영역 입력 → checkEmailExists → 'deleted_recoverable' 분기
                                                              │
                                                              ▼
                                              <RecoveryPanel /> ("복구 영역 박음")
                                                              │
                                                              ▼
                                              signInWithOtp({ email, action: "restore" })
                                                              │
                                                              ▼
                                              /auth/callback?action=restore
                                                              │
                                                              ▼
                                              supabase.rpc("restore_account")
                                                              │
                                                              └─→ profiles UPDATE (is_deleted=false, deleted_at=NULL, email=원본)

[C] 새로 시작 영역
사용자 → AuthModal → email 영역 입력 → 'deleted_recoverable' → "새로 시작" 영역 박음
                                                                  │
                                                                  ▼
                                              supabase.rpc("hard_delete_account", { p_email })
                                                                  │
                                                                  ├─→ profiles DELETE
                                                                  │
                                                                  └─→ auth.users DELETE (CASCADE 영역 박힘)
                                                                  ▼
                                              signInWithOtp({ email, shouldCreateUser: true })
                                                                  ▼
                                              auth.users INSERT → trigger → 신규 profiles
```

#### 3. 진입점
- A) `src/pages/ProfilePage.tsx` → 탈퇴 영역 박음
- B) `src/components/AuthModal.tsx` → 'deleted_recoverable' 분기 영역 → RecoveryPanel
- C) AuthModal RecoveryPanel → "새로 시작" 영역 박음

#### 4. 거치는 영역

##### 4.1 탈퇴 (A) — `request_account_deletion(reason)`
- 파일: `src/pages/AuthCallback.tsx:26` — `supabase.rpc("request_account_deletion", { reason })`
- 박는 작업: profiles 영역 마스킹 영역 (email 영역만 — 20260513_preserve_nickname 영역 박은 영역 박음)
- 박는 테이블: `profiles` UPDATE
- 박힘 영역 후 영역 `supabase.auth.signOut()` 영역 박힘

##### 4.2 복구 (B) — `restore_account()`
- 파일: `src/pages/AuthCallback.tsx:42` — `supabase.rpc("restore_account")`
- 박는 작업: profiles 영역 복구 (is_deleted=false, deleted_at=NULL, email=auth.users.email)
- 박는 테이블: `profiles` UPDATE, `auth.users` SELECT
- 조건: `deleted_at > NOW() - INTERVAL '30 days'` 영역

##### 4.3 새로 시작 (C) — `hard_delete_account(p_email)`
- 파일: `src/components/AuthModal.tsx:256` — `supabase.rpc("hard_delete_account", { p_email: email })`
- 박는 작업: profiles DELETE + auth.users DELETE 영역 (마이그 영역 영역 박은 영역 박음 영역 — ⚠️ production 영역 영역 어느 버전 영역 박힘 영역 확인 영역)
- 박는 테이블: `profiles` DELETE, `auth.users` DELETE
- 조건: `is_deleted=true AND deleted_at > NOW() - 30 days`

#### 5. 박는 테이블

| 시나리오 | 테이블 | 작업 | 박는 함수 |
|---|---|---|---|
| A | `profiles` | UPDATE 마스킹 | `request_account_deletion()` |
| B | `profiles` | UPDATE 복구 | `restore_account()` |
| C | `profiles` + `auth.users` | DELETE | `hard_delete_account(p_email)` |

#### 6. 영향 영역
- 30일 영역 후 영역 `hard_delete_expired_accounts()` 영역 박은 영역 영구 삭제 영역 (cron 영역 박힘 영역 영역 PENDING)

#### 7. 에러 영역
- ⚠️ A: RPC 실패 영역 시 `/?auth_error=deletion_failed` 영역 박힘
- ⚠️ B: RPC 실패 영역 시 `/?auth_error=restore_failed` 영역 박힘. 30일 영역 초과 영역 시 'Account not recoverable' EXCEPTION
- ⚠️ C: 'User not found' / 'Account not eligible for hard delete' EXCEPTION

#### 8. 주의점
- ⚠️ `hard_delete_account` 영역 = 3번 정의 영역 (20260513_hard_delete_by_email → 20260513_hard_delete_with_auth → 20260514_fresh_start). 최신 영역 20260514 영역 = profiles 영역만 영역 삭제 영역. **production 영역 어느 버전 영역 박힘 영역 확인 필요**.
- 닉네임 영역 보존 영역 → 복구 영역 영역 박힘 영역 박힘 영역 후 영역 원래 영역 닉네임 영역 박힘 영역.
- "새로 시작" 영역 = 가입 영역 흐름 영역 박혀 영역 박힘 영역 박힘 영역 신규 profiles 영역 박힘.

#### 9. 검증 영역
```sql
-- 탈퇴 영역 확인
SELECT id, email, is_deleted, deleted_at, deletion_reason
  FROM public.profiles WHERE id = $1;

-- 30일 영역 초과 영역 영역 영구 삭제 영역 대상 영역
SELECT * FROM public.hard_delete_expired_accounts();
```

#### 10. 관련 문서
- `03_SQL_FUNCTIONS.md` §2.4-2.7

---

### 1.5 프로필 영역 (닉네임 변경·언어·약관)

#### 1. 사용자 시나리오
> 사용자 영역 프로필 영역 → 닉네임 영역 수정 영역 / 언어 영역 변경 영역 / 약관 영역 동의 영역 박음.

#### 2. 흐름 다이어그램

```
사용자 ─→ /profile (ProfilePage)
            │
            ├─→ ① 닉네임 변경 영역
            │        │
            │        ├─→ useNicknameAvailability(nickname)
            │        │        │
            │        │        └─→ supabase.rpc("check_nickname_available", { p_nickname })  ⚠️ 마이그 영역 없음
            │        │                  │
            │        │                  └─→ profiles SELECT (lower(nickname) AND is_deleted=false)
            │        │
            │        └─→ ProfilePage.handleSave → supabase.from("profiles").update({ nickname }).eq("id", uid)
            │
            ├─→ ② 언어 변경 영역
            │        │
            │        └─→ supabase.from("profiles").update({ locale: newLang }).eq("id", uid)
            │
            └─→ ③ 약관 영역 박음 (가입 영역 박힘 영역 시 영역 박음)
                     │
                     └─→ AuthCallback.tsx:66 — supabase.from("profiles").update(consent).eq("id", uid)
```

#### 3. 진입점
- 컴포넌트: `src/pages/ProfilePage.tsx`
- 라우트: `/profile`

#### 4. 거치는 영역
- 4.1 `useNicknameAvailability` 영역 박음 (`useNicknameAvailability.ts:38, 73`)
- 4.2 닉네임 영역 UPDATE (`ProfilePage.tsx:155-156`)
- 4.3 언어 영역 UPDATE (`ProfilePage.tsx:102`)
- 4.4 약관 영역 UPDATE (`AuthCallback.tsx:66`)

#### 5. 박는 테이블

| 테이블 | 작업 | 박는 위치 | 박는 함수 |
|---|---|---|---|
| `profiles` | UPDATE nickname | `ProfilePage.tsx:155` | direct |
| `profiles` | UPDATE locale | `ProfilePage.tsx:102` | direct |
| `profiles` | UPDATE consent | `AuthCallback.tsx:66` | direct |

#### 6. 영향 영역
- 닉네임 영역 = `useUserStats` 영역 박은 영역 KPI 영역 박힘 영역
- 언어 영역 = i18n 영역 박힘 영역 박힘 영역
- 약관 영역 = `tos_agreed_at`, `privacy_agreed_at`, `marketing_agreed_at`

#### 7. 에러 영역
- ⚠️ `check_nickname_available` 영역 = ⚠️ 마이그 영역 없음 영역 → production 영역 미박힘 영역 시 영역 닉네임 영역 영역 차단 영역 X
- 닉네임 영역 중복 영역 시 영역 부분 영역 유니크 영역 인덱스 영역 박힘 영역 박힘 영역 박힘 영역 INSERT 영역 실패 영역

#### 8. 주의점
- 부분 영역 유니크 영역 인덱스 영역 = 활성 영역 사용자 영역만 영역 (탈퇴 영역 사용자 영역 닉네임 영역 충돌 영역 박지 X)
- `lower(nickname)` 영역 박힘 영역 → 대소문자 영역 구분 영역 X

#### 9. 검증 영역
```sql
-- 닉네임 영역 중복 영역 검사 영역
SELECT id, nickname FROM public.profiles
  WHERE lower(nickname) = lower('myname') AND is_deleted = false;
```

#### 10. 관련 문서
- `01_SCHEMA.md` §1 `profiles`
- `03_SQL_FUNCTIONS.md` §2.3 `check_nickname_available` ⚠️

---

### 1.6 일일 한도 영역

#### 1. 사용자 시나리오
> 사용자 영역 게임 영역 시작 영역 박음 영역 → 일일 한도 영역 박힘 영역 (Guest 3 / Free 7 / Premium 무제한) 영역 박은 영역 박음.

#### 2. 흐름 다이어그램

```
useDailyLimit() ─→ 로드 영역
       │
       ├─→ ① 카운트 조회 영역
       │        │
       │        └─→ supabase.rpc("get_today_session_count")
       │                  │
       │                  └─→ daily_sessions SELECT WHERE user_id+session_date
       │
       └─→ ② 카운트 증가 영역 (게임 시작 직전 영역)
                │
                └─→ supabase.rpc("increment_daily_session")
                          │
                          └─→ daily_sessions UPSERT (session_count + 1)
```

#### 3. 진입점
- 훅: `src/hooks/useDailyLimit.ts:110, 132`

#### 4. 거치는 영역
- 4.1 `get_today_session_count` 영역 호출 (`useDailyLimit.ts:110`) — STABLE 영역
- 4.2 `increment_daily_session` 호출 (`useDailyLimit.ts:132`) — UPSERT

#### 5. 박는 테이블
| 테이블 | 작업 | 박는 위치 | 박는 함수 |
|---|---|---|---|
| `daily_sessions` | SELECT | `useDailyLimit.ts:110` | `get_today_session_count()` |
| `daily_sessions` | UPSERT | `useDailyLimit.ts:132` | `increment_daily_session()` |

#### 6. 영향 영역
- 게임 영역 시작 영역 직전 영역 박힘 영역 박힘 영역
- Premium 영역 = 클라이언트 영역 분기 영역 → DB 영역 호출 X

#### 7. 에러 영역
- ⚠️ `get_today_session_count` 영역 = anon 영역 → 0 반환 영역
- ⚠️ `increment_daily_session` 영역 실패 영역 시 영역 한도 영역 카운트 X 영역 — 게임 영역 시작 영역 차단 영역 박지 X 영역

#### 8. 주의점
- UTC 영역 기준 영역. 한국 영역 시점 영역 00:00 ≠ UTC 영역 00:00.
- session_date 영역 UNIQUE 영역 박힘 영역 = 동일 영역 사용자 영역 동일 영역 날짜 영역 1행 영역만

#### 9. 검증 영역
```sql
SELECT user_id, session_date, session_count
  FROM public.daily_sessions
  WHERE user_id = $1
  ORDER BY session_date DESC LIMIT 7;
```

#### 10. 관련 문서
- `01_SCHEMA.md` §7 `daily_sessions`
- `03_SQL_FUNCTIONS.md` §2.12 `increment_daily_session`, §2.13 `get_today_session_count`

---

### 1.7 결제 영역 (Paddle/IAP/Stripe webhook)

> ⚠️ **결제 시스템 영역 production 영역 박힘 영역 X (PENDING)**. 영역 정의된 영역 만큼 영역 박음.

#### 1. 사용자 시나리오
> 사용자 영역 Paddle/IAP 영역 결제 영역 → webhook 영역 박힘 영역 → scan_quota 영역 충전 영역.

#### 2. 흐름 다이어그램

```
사용자 ─→ Pricing 페이지 ─→ 결제 영역 박음
                              │
                              ▼
                       Paddle/IAP 영역 박은 영역 결제 영역 처리
                              │
                              ▼
                       webhook ─→ supabase/functions/paddle-webhook
                                       │
                                       ├─→ subscriptions 영역 INSERT/UPDATE (service_role 영역)
                                       │
                                       └─→ supabase.rpc("apply_payment_topup", { ... })
                                                 │
                                                 ├─→ payment_events INSERT ON CONFLICT (event_id) DO NOTHING
                                                 │
                                                 └─→ profiles.scan_quota += credits (via topup_scan_quota)
```

#### 3. 진입점 (정정 영역 — Phase 3 Step 4)

| 영역 | 상태 |
|---|---|
| `supabase/functions/paddle-webhook/index.ts:139` | ⚠️ 박혔으나 production 영역 박지 X 박힘 영역 |
| `supabase/functions/payment-webhook/` | ⚠️ **빈 폴더** 영역 (현재 영역 박지 X 박힌 영역) |
| `supabase/functions/create-checkout-session/` | ⚠️ **빈 폴더** 영역 (현재 영역 박지 X 박힌 영역) |
| `supabase/functions/verify-iap-receipt/index.ts:475` | ✅ **유일 영역 활성 영역 — Production 영역 IAP 영역만 박음** |
| `src/pages/Pricing.tsx` | ⚠️ 단순 영역 navigate 영역 박음 — 결제 영역 호출 영역 X 영역 |
| `src/lib/paddle.ts:70 openCheckout` | ⚠️ 정의 영역만 박음 — 호출자 영역 X 영역 |

#### 4. 거치는 영역

##### 4.1 Pricing 페이지 영역
- 파일: `src/pages/Pricing.tsx`
- 박는 작업: **현재 영역 단순 영역 페이지 영역 박음** — 결제 영역 호출 영역 박지 X 박힌 영역 박음.
- `/api/create-checkout-session` 영역 호출 영역 X 영역 (Edge Function 영역 빈 영역).
- **Paddle Checkout 영역 박을 영역 = 출시 박을 영역 (Phase 결제 영역)**.

##### 4.2 IAP webhook 영역 — 유일 영역 활성 영역
- 파일: `supabase/functions/verify-iap-receipt/index.ts:475`
- 박는 작업: IAP receipt 영역 검증 영역 → `apply_payment_topup()` RPC 호출
- 박는 테이블: `payment_events` INSERT · `profiles.scan_quota` UPDATE

##### 4.3 Paddle webhook 영역 — production 영역 박지 X 박힘 영역
- 파일: `supabase/functions/paddle-webhook/index.ts:139`
- 박는 작업: 시그니처 영역 검증 영역 → `subscriptions` INSERT/UPDATE
- 박는 테이블: `subscriptions` (✅ Phase 3 영역 박은 영역 마이그 영역 박은 영역 박음)

##### 4.4 `apply_payment_topup()` 영역
- 파일: `supabase/migrations/20260408003000_add_payment_events.sql`
- 박는 작업: idempotent INSERT + scan_quota 영역 갱신 영역
- 박는 테이블: `payment_events` INSERT · `profiles.scan_quota` UPDATE

#### 5. 박는 테이블

| 테이블 | 작업 | 박는 위치 | 박는 함수 |
|---|---|---|---|
| `subscriptions` | INSERT/UPDATE | `paddle-webhook/index.ts:139` | service_role direct |
| `payment_events` | INSERT idempotent | `apply_payment_topup()` | RPC |
| `profiles.scan_quota` | UPDATE | `topup_scan_quota()` (apply_payment_topup 내부 영역) | RPC |

#### 6. 영향 영역
- 스캔 영역 1회 영역 = `consume_scan_quota()` 영역 박음 영역 → quota 영역 -1
- Premium 영역 = ⚠️ 미박힘 영역 (PENDING)

#### 7. 에러 영역
- ⚠️ webhook 영역 박지 X 박힐 영역 가능 영역 → 결제 영역 박힘 영역 박힘 영역 박은 영역 quota 영역 박지 X 박힘 영역 — 사용자 영역 알림 영역 박지 X
- ⚠️ webhook 영역 시그니처 영역 검증 영역 실패 영역 시 영역 401 영역 반환 영역
- ⚠️ event_id 영역 중복 영역 = ON CONFLICT DO NOTHING 영역 박음 (정상 영역 박힘 영역)

#### 8. 주의점
- 결제 시스템 영역 production 영역 미박힘 영역 (PENDING — Phase 4 영역)
- `subscriptions` 영역 마이그 영역 없음 — Dashboard 영역 직접 박힘 영역
- `payment_events.event_id` UNIQUE 영역 박힘 → idempotency 영역 보장 영역

#### 9. 검증 영역
```sql
SELECT * FROM public.payment_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10;
SELECT scan_quota FROM public.profiles WHERE id = $1;
```

#### 10. 관련 문서
- `01_SCHEMA.md` §8 `payment_events`
- `03_SQL_FUNCTIONS.md` §2.14 `apply_payment_topup`, §2.20 `topup_scan_quota`

---

### 1.8 구독·Premium 영역

#### 1. 사용자 시나리오
> A) Premium 영역 박힘 영역 박힘 영역 → 무제한 영역 게임 영역.
> B) `premium_until` 영역 경과 영역 영역 일일 배치 영역 박힘 영역 박은 영역 영역 is_premium=false 영역 박힘.

#### 2. 흐름 다이어그램

```
[A] Premium 영역 박힘
사용자 → 게임 영역 시작 → useDailyLimit → tier 영역 분기
              │
              ▼
          tier = premium → DB 영역 호출 X (무제한)

[B] 만료 영역
일일 배치 영역 (cron 영역 박힘 영역 PENDING)
       │
       ▼
run_daily_batch_analysis() ─→ expire_premium_users()
                                    │
                                    └─→ profiles UPDATE is_premium=false
                                        WHERE is_premium=true AND premium_until<NOW() AND role != 'admin'
```

#### 3. 진입점
- 만료: `supabase/migrations/20260424_premium_expiry.sql`
- 만료 함수: `expire_premium_users()`
- 호출: `run_daily_batch_analysis()` 영역 내부 영역 박음

#### 4. 거치는 영역

##### 4.1 클라이언트 영역 분기
- 파일: `src/hooks/useDailyLimit.ts` + `useProfile.ts`
- 박는 작업: `profiles.is_premium` 영역 박은 영역 분기 영역
- 박는 테이블: `profiles` SELECT

##### 4.2 만료 배치 영역
- 파일: `supabase/migrations/20260424_premium_expiry.sql`
- 박는 작업: `is_premium=true AND premium_until<NOW() AND role!='admin'` 영역 → `is_premium=false`
- 박는 테이블: `profiles` UPDATE

#### 5. 박는 테이블

| 테이블 | 작업 | 박는 위치 | 박는 함수 |
|---|---|---|---|
| `profiles` | SELECT | `useProfile.ts` | direct |
| `profiles` | UPDATE (만료 배치) | `expire_premium_users()` | 20260424 |

#### 6. 영향 영역
- 만료 영역 = 일일 한도 영역 박힘 영역 박힘 (Free 7회/일 영역)
- AI 분석 영역 = 잠금 영역 박힘

#### 7. 에러 영역
- ⚠️ cron 영역 박힘 영역 X 영역 (PENDING) — 만료 영역 박힘 영역 박지 X 박힐 영역 가능 영역

#### 8. 주의점
- admin role 영역 제외 영역. reviewer role 영역 = Premium 영역 X (Free tier 영역 박음).

#### 9. 검증 영역
```sql
SELECT id, email, is_premium, premium_until, role
  FROM public.profiles
  WHERE is_premium = true OR premium_until IS NOT NULL
  ORDER BY premium_until ASC;
```

#### 10. 관련 문서
- `03_SQL_FUNCTIONS.md` §2.15 `expire_premium_users`, §2.16 `run_daily_batch_analysis`

---

### 1.9 레벨·서브레벨 잠금 해제 영역

#### 1. 사용자 시나리오
> 사용자 영역 Lv 1-1 영역 통과 영역 박음 → Lv 1-2 영역 자동 영역 잠금 해제 영역.

#### 2. 흐름 다이어그램

```
게임 영역 종료 (§1.1 영역 박힘)
       │
       ▼
recordAttempt(level, sublevel, ...)
       │
       ▼
record_sublevel_attempt() RPC
       │
       ├─→ user_sublevel_progress UPSERT
       │
       ├─→ 통과 영역 판정 영역 (play_count>=10 AND streak>=5 AND acc>=0.85 AND reaction<=0.35)
       │
       ├─→ 패스트트랙 영역 분기 영역 (premium + sub2+ + 1st + 99% + reaction<=0.5)
       │        │
       │        └─→ passed=true, fast_track=true 영역 강제 영역
       │
       └─→ just_passed=true 영역 시 영역 다음 sublevel INSERT
                │
                ├─→ sublevel<3 → (level, sublevel+1) INSERT
                │
                └─→ sublevel=3 → (level+1, 1) INSERT
```

#### 3. 진입점
- 호출: `src/hooks/useLevelProgress.ts:72`

#### 4. 거치는 영역
- 4.1 NoteGame 영역 종료 영역 → `recordAttempt(...)` 영역 호출 영역 (`NoteGame.tsx:552`)
- 4.2 `record_sublevel_attempt()` RPC 영역 박음
- 4.3 통과 영역 판정 영역 + 패스트트랙 영역 분기 영역
- 4.4 just_passed 영역 시 영역 다음 sublevel INSERT

#### 5. 박는 테이블

| 테이블 | 작업 | 박는 위치 | 박는 함수 |
|---|---|---|---|
| `user_sublevel_progress` | UPSERT | `record_sublevel_attempt()` | 20260425 + 20260509 |

#### 6. 영향 영역
- 레벨 선택 영역 (`useLevelProgress.ts:43`) — passed=true 영역 박힘 영역 박힘 영역 다음 sublevel 영역 박힘 영역 박힘 영역
- `MasteryHeroCard` 영역 제거 영역 박힘 (작업 #28) → `get_mastery_score` 영역 호출 영역 X

#### 7. 에러 영역
- ⚠️ RPC 영역 실패 영역 시 영역 잠금 해제 X 영역 — 사용자 영역 알림 X
- ⚠️ 비로그인 영역 시 영역 result=null 영역 → fake payload 영역 박힘 (`NoteGame.tsx:564`)

#### 8. 주의점
- ⚠️ `record_sublevel_attempt` 영역 = 3번 정의 영역 (20260425/v2/fast_track) — production 영역 어느 버전 영역 박힘 영역 확인 필요
- 패스트트랙 영역 박힘 영역 박힘 영역 = `get_mastery_score` 영역 score=100 영역 강제 영역

#### 9. 검증 영역
```sql
SELECT user_id, level, sublevel, play_count, total_attempts, total_correct,
       best_streak, avg_reaction_ratio, passed, passed_at, fast_track
  FROM public.user_sublevel_progress
  WHERE user_id = $1
  ORDER BY level, sublevel;
```

#### 10. 관련 문서
- `03_SQL_FUNCTIONS.md` §2.8 `record_sublevel_attempt`, §2.9 `get_mastery_score`

---

### 1.10 일괄 분석 영역 (`run_daily_batch_analysis`)

#### 1. 사용자 시나리오
> 관리자 영역 영역 일일 영역 배치 영역 박음 → note_mastery 영역 약점·숙련 영역 플래그 + premium 만료 영역.

#### 2. 흐름 다이어그램

```
관리자 → /admin/batch-runs ─→ 수동 실행 영역 박음
                                       │
                                       ▼
                      supabase.rpc("run_daily_batch_analysis")
                                       │
                                       ├─→ daily_batch_runs ON CONFLICT (run_date) 영역 박힘 영역 박지 X
                                       │
                                       ├─→ note_mastery WEAKNESS UPDATE (acc<0.6 OR rxn>3000)
                                       ├─→ note_mastery RELEASE UPDATE (acc>=0.85)
                                       ├─→ note_mastery MASTERY UPDATE (attempts>=20 AND acc>=0.95)
                                       │
                                       ├─→ expire_premium_users() ─→ profiles UPDATE
                                       │
                                       └─→ daily_batch_runs INSERT (status='success' 또는 'failed')
```

#### 3. 진입점
- 클라이언트: `src/hooks/useBatchRuns.ts:91`
- 관리자 페이지: `src/pages/admin/` 영역

#### 4. 거치는 영역
- 4.1 `run_daily_batch_analysis()` RPC 영역 박음
- 4.2 약점·해제·숙련 영역 UPDATE
- 4.3 `expire_premium_users()` 호출 영역
- 4.4 `daily_batch_runs` INSERT

#### 5. 박는 테이블

| 테이블 | 작업 | 박는 위치 | 박는 함수 |
|---|---|---|---|
| `note_mastery` | UPDATE | `run_daily_batch_analysis()` | 20260424 |
| `profiles` | UPDATE is_premium | `expire_premium_users()` | 20260424 |
| `daily_batch_runs` | INSERT | `run_daily_batch_analysis()` | 20260424 |

#### 6. 영향 영역
- 대시보드 영역 약점 음표 영역 (`useMyStats.ts:90`)
- AdminUserDetail 영역 약점 영역 영역 박힘 영역 박힘

#### 7. 에러 영역
- ⚠️ 동일 영역 run_date 영역 재실행 영역 차단 영역 — NOTICE + NULL 반환 영역
- ⚠️ EXCEPTION 영역 박힘 영역 박힘 영역 박힘 영역 daily_batch_runs status='failed' 영역 INSERT + RAISE
- ⚠️ cron 영역 박힘 영역 영역 PENDING — 자동 영역 박지 X 박힘 영역

#### 8. 주의점
- `expire_premium_users()` 영역 박힘 영역 admin 영역 제외 영역 박음. reviewer 영역 = 영역 박지 X 박힘 영역 (premium 영역 박힘 영역 박지 X 박은 영역 의도 영역)
- ⚠️ `note_mastery` 영역 갱신 영역 진입점 영역 명확 X — game 영역 박힘 영역 시 영역 trigger 영역 박힘 여부 영역 ⚠️ 확인 필요

#### 9. 검증 영역
```sql
SELECT * FROM public.daily_batch_runs ORDER BY run_date DESC LIMIT 10;
```

#### 10. 관련 문서
- `01_SCHEMA.md` §6 `note_mastery`, §12 `daily_batch_runs`
- `03_SQL_FUNCTIONS.md` §2.16 `run_daily_batch_analysis`

---

### 1.11 사용자 환경 영역 보정 영역 (offset 영역)

#### 1. 사용자 시나리오
> 사용자 영역 영역 최초 영역 게임 영역 박은 영역 박음 영역 → 캘리브레이션 영역 박음 → offset 영역 박힘 영역 → 모든 영역 게임 영역 박힘 영역 박힘 영역 보정 영역.

#### 2. 흐름 다이어그램

```
[A] 최초 영역 캘리브레이션 영역
사용자 → 캘리브레이션 영역 박은 영역 → userEnvironmentOffset.setUserEnvOffset(ms)
            │
            └─→ supabase.from("profiles").update({ user_env_offset_ms: ms }).eq("id", uid)

[B] 게임 영역 진행 영역
recorder.recordNote({ reactionMs }) ─→ clampReactionMs(reactionMs, offset) ─→ corrected
                                                                                    │
                                                                                    └─→ user_sessions.note_attempts[].reaction_ms

[C] 디바이스 영역 변경 영역
audio device 영역 변경 영역 박힘 영역 박힘 영역 → onDeviceChange()
            │
            ├─→ supabase.from("device_change_events").insert({ device_kinds, previous_offset_ms, ... })
            │
            └─→ 재캘리브레이션 영역 박은 영역 박힘 영역 박힘 영역 → supabase.from("device_change_events").update({ new_offset_ms })  ⚠️ UPDATE 정책 영역 없음
```

#### 3. 진입점
- 캘리브레이션: `src/lib/userEnvironmentOffset.ts:54`
- 변경 영역 감지: `src/lib/userEnvironmentOffset.ts:111-135`

#### 4. 거치는 영역
- 4.1 캘리브레이션 영역 박은 영역 박힘 영역 → `profiles.user_env_offset_ms` UPDATE
- 4.2 게임 영역 박힘 영역 박힘 영역 → `getUserEnvOffset()` 영역 박은 영역 reactionMs 영역 보정 영역
- 4.3 디바이스 영역 변경 영역 박힘 영역 박힘 영역 → `device_change_events` INSERT
- 4.4 재캘리브레이션 영역 박힘 영역 박힘 영역 → `device_change_events.new_offset_ms` UPDATE

#### 5. 박는 테이블

| 테이블 | 작업 | 박는 위치 | 박는 함수 |
|---|---|---|---|
| `profiles.user_env_offset_ms` | UPDATE | `userEnvironmentOffset.ts:54` | direct |
| `device_change_events` | INSERT | `userEnvironmentOffset.ts:112` | direct |
| `device_change_events` | UPDATE | `userEnvironmentOffset.ts:135` ⚠️ | direct (UPDATE 정책 없음) |

#### 6. 영향 영역
- `user_sessions.note_attempts[].reaction_ms` 영역 = corrected 영역
- `user_sessions.note_attempts[].reaction_ms_raw` 영역 = raw 영역
- `user_sessions.summary.offset_ms_applied` 영역 = 박힘 영역 박힘 영역 추적 영역

#### 7. 에러 영역
- ⚠️ **`device_change_events` UPDATE 영역 정책 영역 없음** (Session 2 발견 영역) → `:135` 영역 silent fail 영역 가능 영역

#### 8. 주의점
- `user_env_offset_ms` 영역 NULL 영역 = 미캘리브레이션 영역. `0` 영역 = 캘리브레이션 영역 박힘 영역 박음 영역 보정 영역 박지 X 박힘.
- §7.10: false positive 영역 빈도 영역 분석 영역 영역 PENDING.

#### 9. 검증 영역
```sql
SELECT id, user_env_offset_ms FROM public.profiles WHERE id = $1;
SELECT * FROM public.device_change_events WHERE user_id = $1 ORDER BY event_at DESC LIMIT 10;
```

#### 10. 관련 문서
- `01_SCHEMA.md` §16 `device_change_events`
- `02_RLS_POLICIES.md` §2.16 (UPDATE 정책 영역 누락 영역)

---

### 1.12 관리자 작업 영역 (admin actions)

#### 1. 사용자 시나리오
> 관리자 영역 영역 grant_premium / revoke_premium / ban_user / reset_streak / ... 영역 박음 → admin_actions 영역 박힘 영역 박힘 영역.

#### 2. 흐름 다이어그램

```
관리자 → AdminUserDetail 영역 → 액션 영역 박음
            │
            ▼
       /api/admin-action (Edge Function)
            │
            ├─→ admin 영역 검증 영역 (profile.role === 'admin' 영역)
            │
            ├─→ profiles UPDATE (action_type 영역 박은 영역 박힘 영역)
            │
            ├─→ user_streaks UPDATE 영역 박힘 영역 박음 영역 (action_type === 'reset_streak' 영역 박힘)
            │
            └─→ admin_actions INSERT (감사 로그 영역)
```

#### 3. 진입점
- 클라이언트: `src/lib/adminActions.ts:56` — Edge Function 영역 박음
- Edge Function: `supabase/functions/admin-action/index.ts`

#### 4. 거치는 영역
- 4.1 클라이언트 영역 → 액세스 토큰 영역 박은 영역 Edge Function 영역 박음
- 4.2 Edge Function 영역 → admin role 영역 검증 (`admin-action/index.ts:92`)
- 4.3 profiles UPDATE 영역 박음 (`admin-action/index.ts:232`)
- 4.4 user_streaks UPDATE 영역 박힘 영역 박음 영역 (reset_streak 영역) (`admin-action/index.ts:220`) ⚠️ user_streaks 영역 마이그 영역 없음
- 4.5 admin_actions INSERT (`admin-action/index.ts:261`)

#### 5. 박는 테이블

| 테이블 | 작업 | 박는 위치 | 박는 함수 |
|---|---|---|---|
| `profiles` | UPDATE | `admin-action/index.ts:232` | service_role direct |
| `user_streaks` | UPDATE | `admin-action/index.ts:220` ⚠️ | service_role direct |
| `admin_actions` | INSERT | `admin-action/index.ts:261` | service_role direct |

#### 6. 영향 영역
- AdminLogs 영역 (`useAdminLogs.ts:76`) — admin_actions 영역 박힘
- AdminUserDetail 영역 — 갱신된 영역 profile 영역 박힘

#### 7. 에러 영역
- ⚠️ admin 영역 검증 영역 실패 영역 시 영역 401 영역
- ⚠️ Edge Function 영역 박힘 영역 박힘 영역 박힘 영역 RLS 영역 우회 영역 박힘 영역 (service_role 영역)

#### 8. 주의점
- ⚠️ `user_streaks` 영역 = ⚠️ 마이그 영역 없음 (Cursor 발견 영역)
- ⚠️ `admin_actions` 영역 = ⚠️ 마이그 영역 없음
- 모든 영역 액션 영역 = 감사 로그 영역 (ip, user_agent, details JSONB)

#### 9. 검증 영역
```sql
SELECT * FROM public.admin_actions
  WHERE admin_id = $1
  ORDER BY created_at DESC LIMIT 50;
```

#### 10. 관련 문서
- `01_SCHEMA.md` §11 `admin_actions`

---

### 1.13 닉네임 영역 중복 영역 확인 영역

→ §1.5 영역 박은 영역 포함 영역.

---

### 1.14 비밀번호 재설정·이메일 인증 영역

#### 1. 사용자 시나리오
> Magic Link 영역 박힘 영역 박음 영역 = 비밀번호 영역 없음 영역. 이메일 영역 인증 영역 = `email_confirmed_at` 영역 박힘 영역 박힘 영역.

#### 2. 흐름 다이어그램

```
비밀번호 재설정 영역 — Magic Link 영역 박은 영역 박힘 영역 (별도 영역 박지 X)

이메일 영역 인증 영역
사용자 → SignUp/SignIn → signInWithOtp → 이메일 영역 박힘 → 클릭 → email_confirmed_at 영역 자동 영역 박힘
```

#### 3. 진입점 (정정 영역 — Phase 3 Step 4)
- `src/pages/ResetPasswordPage.tsx` (현재 영역 박지 X 박힘 영역 — Magic Link 영역 박음 영역 박힘)
- `src/components/AuthModal.tsx:269` = **`handleFreshStart` 박는 영역** (재가입 영역 박는 영역, OTP 재전송 X)
- `src/components/AuthModal.tsx:289-312` = **진짜 OTP 재전송 영역** (handleResend 영역 박음 — line 293·302·312 영역 영역 `signInWithOtp` 박음)

#### 4. 거치는 영역
- `signInWithOtp({ email, options: { shouldCreateUser: false } })` 영역 박음
- Supabase Auth 영역 박은 영역 영역 매직 링크 영역 발송 영역

#### 5-10. (Magic Link 영역 §1.2·1.3 영역 박힌 영역 박음)

---

### 1.15 그 외 영역 (Reviewer 영역, 스캔 영역)

#### Reviewer 영역
- 파일: `src/pages/ReviewerLogin.tsx`
- 박는 작업: `/api/reviewer-login` 영역 박은 영역 액세스 토큰 영역 박음 → `supabase.auth.setSession({ access_token, refresh_token })`
- 박는 테이블: 없음 (auth 영역만)

#### 악보 영역 스캔 영역
- Edge Function: `supabase/functions/analyze-sheet-music/index.ts`
- 박는 작업:
  - `supabase.auth.getUser()` — 인증 영역 검증 영역
  - `profiles.scan_quota` 영역 SELECT 영역 박은 영역 quota 영역 박지 X 박힘 영역 차단
  - GPT-4 Vision 영역 호출 영역
  - `supabase.rpc("consume_scan_quota")` — quota 영역 -1
- 박는 테이블: `profiles.scan_quota` UPDATE

---

## 2. 요약 영역 — 모든 RPC 호출 영역 박힘 영역 표

| RPC | 호출 위치 | 기능 영역 § | 박는 테이블 |
|---|---|---|---|
| `check_email_exists` | `lib/profile.ts:161` | §1.2 가입 영역, §1.3 로그인, §1.4 복구 | `auth.users`+`profiles` SELECT |
| `check_nickname_available` ⚠️ | `useNicknameAvailability.ts:38, 73` | §1.5 프로필 | `profiles` SELECT (추정) |
| `request_account_deletion` | `pages/AuthCallback.tsx:26` | §1.4 탈퇴 | `profiles` UPDATE |
| `restore_account` | `pages/AuthCallback.tsx:42` | §1.4 복구 | `profiles` UPDATE |
| `hard_delete_account` | `components/AuthModal.tsx:256` | §1.4 새로 시작 | `profiles` DELETE (+`auth.users`) |
| `record_sublevel_attempt` | `hooks/useLevelProgress.ts:72` | §1.1 게임, §1.9 잠금 해제 | `user_sublevel_progress` UPSERT |
| `record_game_session` | `hooks/useSessionRecorder.ts:322` | §1.1 게임 | `user_sessions`+`user_stats_daily`+`profiles` |
| `increment_daily_session` | `hooks/useDailyLimit.ts:132` | §1.1 게임, §1.6 한도 | `daily_sessions` UPSERT |
| `get_today_session_count` | `hooks/useDailyLimit.ts:110` | §1.6 한도 | `daily_sessions` SELECT |
| `run_daily_batch_analysis` | `hooks/useBatchRuns.ts:91` | §1.10 배치 | `note_mastery`+`profiles`+`daily_batch_runs` |
| `consume_scan_quota` | `functions/analyze-sheet-music:355` | §1.15 스캔 | `profiles.scan_quota` UPDATE |

---

## 3. 발견된 silent fail 영역 영역 정리 영역

| # | 위치 | 영역 영역 박힘 영역 | 분류 |
|---|---|---|---|
| 1 | `useSessionRecorder.ts:344` 폴백 INSERT 영역 실패 시 | console.error 영역만 박힘. UI 영역 알림 X | 🔴 silent fail |
| 2 | `userEnvironmentOffset.ts:135` 영역 device_change_events UPDATE | UPDATE 정책 영역 없음 → 실패 영역 박힘 영역 박힘 영역 알림 X | 🔴 silent fail |
| 3 | `useLevelProgress.ts:72` 영역 record_sublevel_attempt 실패 | 잠금 해제 X 영역 — 사용자 영역 알림 X | 🔴 silent fail |
| 4 | `useDailyLimit.ts:132` 영역 increment_daily_session 실패 | 한도 영역 카운트 X 영역 — 게임 영역 차단 영역 X | 🟡 부분 영역 fail |
| 5 | `AuthCallback.tsx:66` 영역 consent UPDATE 실패 | try/catch 영역 박힘 영역 영역 무시 영역 | 🟢 무시 영역 박힘 (인증 영역 박지 X 박은 영역 박힘) |
| 6 | trigger `trg_update_profile_after_session` 영역 미적용 영역 | last_practice_date 영역 갱신 X 영역 박힘 — record_game_session 영역 박은 영역 폴백 영역 박힘 | 🟡 폴백 영역 박힘 |
| 7 | `note_mastery` 영역 갱신 영역 진입점 영역 명확 X | 일일 배치 영역 박힘 영역 박지 X 박힐 영역 가능 | 🔴 데이터 영역 누락 |

→ Phase 4 영역 = 로그·Admin 페이지 영역 박음 영역 박은 영역 silent fail 영역 영역 박음 영역 박은 영역 영역 박힘 영역.
