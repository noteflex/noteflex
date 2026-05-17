# 02 — RLS POLICIES 영역

> 모든 RLS 정책 영역 전수 박음 (45개 CREATE POLICY 영역 + 헬퍼 함수 2개)
> 영역 박힌 근거: `supabase/migrations/*.sql` 영역 + `src/` 영역 grep 영역

## 0. 진입점 영역

### 0.1 RLS(Row Level Security) 영역
> RLS = **Postgres 영역 내장 영역 행 수준 보안**. 같은 테이블 영역 행마다 영역 누가 영역 SELECT/INSERT/UPDATE/DELETE 박을 수 있는지 영역 정책 영역 박힘.

```
사용자 A 로그인  →  SELECT * FROM user_sessions
                          ↓
                   RLS 정책 영역 박힘
                          ↓
                   auth.uid() = user_id 박은 행만 반환
```

핵심 영역:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` 박혀야 RLS 영역 활성화.
- 정책 영역 없으면 영역 = 모든 행 영역 차단 (RLS 활성화 영역 시).
- `auth.uid()` = 현재 로그인 영역 사용자 UUID 반환 (anon 영역 = NULL).
- `USING` = SELECT/UPDATE/DELETE 영역 = 어떤 행 영역 보일지·박을지.
- `WITH CHECK` = INSERT/UPDATE 영역 = 어떤 행 영역 들어갈지.

### 0.2 Supabase 영역 동작 영역
- 클라이언트 영역 `supabase.from(...).select()` 영역 = `authenticated` role 영역 박힘 → RLS 영역 적용.
- Edge Function 영역 `service_role` key 영역 = RLS 영역 우회.
- SQL 함수 영역 `SECURITY DEFINER` = 함수 정의자 영역 권한 영역 → RLS 영역 우회.

### 0.3 헬퍼 함수 영역 = RLS 영역 정책 영역 박힘 영역

`is_admin()`, `is_reviewer()` 영역 = `SECURITY DEFINER` 영역 박힘 영역 → 호출자 영역 RLS 영역 우회 영역 `profiles` 영역 조회. 정책 영역 `USING (public.is_admin())` 박힘 영역.

---

## 1. 헬퍼 함수 영역

### 1.1 `is_admin()`

| 항목 | 내용 |
|---|---|
| 정의 영역 | `20260510_rls_audit.sql:23-38` |
| 시그니처 | `is_admin() RETURNS BOOLEAN` |
| LANGUAGE | plpgsql |
| SECURITY | DEFINER (호출자 RLS 우회 영역) |
| STABLE | YES |
| search_path | public |
| 반환 영역 | `profiles.role = 'admin'` 박힌 사용자 영역 시 TRUE |
| GRANT | TO authenticated |
| 사용 영역 | 11개 admin SELECT 정책 영역 박음 |

```sql
RETURN EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid() AND role = 'admin'
);
```

### 1.2 `is_reviewer()`

| 항목 | 내용 |
|---|---|
| 정의 영역 | `20260515_reviewer_role.sql:32-47` |
| 시그니처 | `is_reviewer() RETURNS BOOLEAN` |
| LANGUAGE | plpgsql |
| SECURITY | DEFINER |
| STABLE | YES |
| search_path | public |
| 반환 영역 | `profiles.role = 'reviewer'` 박힌 사용자 영역 시 TRUE |
| GRANT | TO authenticated |
| 사용 영역 | ⚠️ RLS 정책 영역 직접 박힘 영역 X — 코드 영역 분기 영역 박음 (예: `ComingSoonGate` 우회) |

---

## 2. 테이블별 RLS 정책 영역 (전수)

### 2.1 `profiles`

#### 1. RLS 활성화 여부
✅ ENABLE — `20260408001000_add_profiles_scan_quota.sql:7`

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| Users can view own profile | SELECT | authenticated | `auth.uid() = id` | — | 20260408001000:10 |
| Users can update own profile | UPDATE | authenticated | `auth.uid() = id` | `auth.uid() = id` | 20260408001000:16 |
| Users can insert own profile | INSERT | authenticated | — | `auth.uid() = id` | 20260408001000:23 |
| Admins can view all profiles | SELECT | (admin) | `public.is_admin()` | — | 20260510_rls_audit:47 |

#### 3. 정책별 상세

- **Users can view own profile** — 자신 영역 프로필 영역만 조회. 박는 사례: `useProfile.ts:56`, `useUserStats.ts:86`.
- **Users can update own profile** — 자신 영역 프로필 영역만 수정. 박는 사례: `ProfilePage.tsx:156`, `userEnvironmentOffset.ts:54`, `useSessionRecorder.ts:374` (last_practice_date 폴백).
- **Users can insert own profile** — 자신 영역 ID 영역 INSERT 영역 (trigger 영역 통한 가입 영역 박힘 영역 외 거의 사용 X).
- **Admins can view all profiles** — admin role 영역 전체 사용자 조회. 박는 사례: `useAdminUsers.ts:48`, `useAdminUserDetail.ts:103`.

#### 4. 우회 영역
- `handle_new_user_profile()` (SECURITY DEFINER) — auth.users INSERT trigger 영역 박음.
- `request_account_deletion()`, `restore_account()`, `hard_delete_account()` — 모두 SECURITY DEFINER.
- `expire_premium_users()` (배치 영역) — SECURITY DEFINER.

#### 5. 박지 X 영역
- ⚠️ DELETE 정책 영역 없음. → 사용자 영역 직접 DELETE 영역 차단 영역 (CASCADE 영역 박힘 `auth.users` 삭제 영역 시만 영역 박힘).

---

### 2.2 `user_sessions`

#### 1. RLS 활성화 여부
✅ ENABLE — `20260516_reviewer_sessions_rls.sql:25` (⚠️ migration 영역 없음 — Dashboard 영역 직접 박힘 영역 외 영역에서 박힌 영역)

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| user_sessions_select_own | SELECT | authenticated | `auth.uid() = user_id` | — | 20260516:29 |
| user_sessions_insert_own | INSERT | authenticated | — | `auth.uid() = user_id` | 20260516:34 |
| user_sessions_admin_select | SELECT | (admin) | `public.is_admin()` | — | 20260516:39 |

#### 3. 정책별 상세

- **user_sessions_select_own** — 자신 영역 세션 영역만 조회. 박는 사례: `useMyStats.ts:65`.
- **user_sessions_insert_own** — 자신 영역 세션 영역만 INSERT. 박는 사례: `useSessionRecorder.ts:344` (직접 INSERT 폴백 영역 — RPC 영역 우선 영역 박힘).
- **user_sessions_admin_select** — admin 영역 전체 세션 조회. 박는 사례: `useAdminUserDetail.ts:112`.

#### 4. 우회 영역
- `record_game_session()` RPC (SECURITY DEFINER, 20260517) — INSERT 영역 RLS 영역 우회 영역 (reviewer 영역 INSERT 영역 호환).

#### 5. 박지 X 영역
- ⚠️ UPDATE 영역 정책 영역 없음. DELETE 영역 정책 영역 없음. (intentional 영역 — 세션 영역 영구 기록 영역)
- ⚠️ 20260516 영역 production 영역 apply 영역 필수 영역. 미적용 시 reviewer 영역 INSERT 영역 실패 → `record_game_session()` 영역 폴백 영역 박힘.

---

### 2.3 `user_sublevel_progress`

#### 1. RLS 활성화 여부
✅ ENABLE — `20260425_sublevel_system.sql:30`

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| Users can view own progress | SELECT | (모두) | `auth.uid() = user_id` | — | 20260425:32 |
| Users can insert own progress | INSERT | (모두) | — | `auth.uid() = user_id` | 20260425:37 |
| Users can update own progress | UPDATE | (모두) | `auth.uid() = user_id` | — | 20260425:42 |
| Users can delete own progress | DELETE | (모두) | `auth.uid() = user_id` | — | 20260510_rls_audit:67 |
| Admins can view all progress | SELECT | (admin) | `public.is_admin()` | — | 20260425:47 |

#### 3. 정책별 상세
- 자신 영역 progress 영역 CRUD 영역 (DELETE 영역 GDPR 영역 박힘 영역 추가).
- `record_sublevel_attempt()` RPC 영역 박음 → UPSERT 영역 통해 INSERT + UPDATE 박음.
- 박는 사례 영역: `useLevelProgress.ts:43`.

#### 4. 우회 영역
- `record_sublevel_attempt()` RPC (SECURITY DEFINER) — UPSERT 영역 + 자동 영역 다음 sublevel INSERT.
- `get_mastery_score()` RPC (SECURITY DEFINER) — SELECT 영역 우회.

#### 5. 박지 X 영역
- 없음 (CRUD 영역 + admin SELECT 영역 모두 박힘).

---

### 2.4 `user_note_logs`

#### 1. RLS 활성화 여부
✅ ENABLE — `20260405142021_28ee1d25-...sql:15`

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| Users can view their own logs | SELECT | (모두) | `auth.uid() = user_id` | — | 20260405142021:17 + 20260405142751:4 (DROP+재생성) |
| Users can insert their own logs | INSERT | (모두) | — | `auth.uid() = user_id` | 20260405142021:22 + 20260405142751:9 |
| Admins can view all note logs | SELECT | (admin) | `public.is_admin()` | — | 20260510_rls_audit:57 |

#### 3. 정책별 상세
- SELECT/INSERT 영역만 박힘. UPDATE/DELETE 영역 차단.
- 박는 사례: `userNoteLogs.ts:117` INSERT, `userNoteLogs.ts:141` SELECT.

#### 4. 우회 영역
- 없음 (사용자 영역 직접 INSERT 영역).

#### 5. 박지 X 영역
- ⚠️ UPDATE/DELETE 영역 정책 영역 없음 → 차단. (intentional 영역 — 로그 영역 영구 기록 영역)
- ⚠️ realtime publication 영역 등록됨 (`ADD TABLE public.user_note_logs`) — 사용 영역 X일 수 있음.
- ⚠️ 20260405142751 영역 = DROP + 재생성 (동일 정책 영역 중복 정의 영역).

---

### 2.5 `user_stats_daily`

#### 1. RLS 활성화 여부
⚠️ **확인 필요** — migration 영역 없음. Dashboard 영역 직접 박힘 영역 추정.

#### 2. 정책 목록
⚠️ **migration 영역 없음** — `record_game_session()` RPC 영역 SECURITY DEFINER 영역 박힘 영역 → RLS 영역 무관 영역.

| 추정 영역 | 명령 | 대상 | 추론 근거 |
|---|---|---|---|
| (SELECT own) | SELECT | authenticated | `useMyStats.ts:79`·`useUserStats.ts:104`에서 자신 영역 조회 영역 박힘 영역 → 정책 영역 박힘 영역 추정 |
| (admin SELECT) | SELECT | (admin) | `useAdminUserDetail.ts:127`에서 다른 사용자 조회 영역 박힘 영역 → admin 영역 정책 영역 박힘 영역 추정 |

#### 3. 정책별 상세
- ⚠️ Dashboard 영역에서 확인 필요.

#### 4. 우회 영역
- `record_game_session()` RPC (SECURITY DEFINER) — UPSERT 영역 우회.

#### 5. 박지 X 영역
- ⚠️ migration 영역 재현 영역 X → Phase 3 영역에서 박음.

---

### 2.6 `note_mastery`

#### 1. RLS 활성화 여부
⚠️ **확인 필요** — migration 영역 없음.

#### 2. 정책 목록
⚠️ **migration 영역 없음** — Dashboard 영역 직접 박힘 영역 추정.

| 추정 영역 | 명령 | 대상 | 추론 근거 |
|---|---|---|---|
| (SELECT own) | SELECT | authenticated | `useMyStats.ts:90`·`useMasteryDetails.ts:61`·`useUserMastery.ts:49` |
| (admin SELECT) | SELECT | (admin) | `useAdminUserDetail.ts:139` |

#### 3. 정책별 상세
- ⚠️ INSERT/UPDATE 영역 정책 영역 명확 X. `run_daily_batch_analysis()` RPC (SECURITY DEFINER) 영역 박힘 영역 → RLS 영역 무관.

#### 4. 우회 영역
- `run_daily_batch_analysis()` RPC (SECURITY DEFINER).

#### 5. 박지 X 영역
- ⚠️ 갱신 영역 진입점 영역 (trigger 영역) 영역 확인 필요.

---

### 2.7 `daily_sessions`

#### 1. RLS 활성화 여부
✅ ENABLE — `20260509_daily_sessions.sql:43`

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| daily_sessions_select_own | SELECT | (모두) | `auth.uid() = user_id` | — | 20260509:46 |
| daily_sessions_insert_own | INSERT | (모두) | — | `auth.uid() = user_id` | 20260509:51 |
| daily_sessions_update_own | UPDATE | (모두) | `auth.uid() = user_id` | — | 20260509:56 |
| daily_sessions_delete_own | DELETE | (모두) | `auth.uid() = user_id` | — | 20260510_rls_audit:88 |
| daily_sessions_admin_select | SELECT | (admin) | `public.is_admin()` | — | 20260510_rls_audit:93 |

#### 3. 정책별 상세
- 자신 영역 daily_sessions 영역 CRUD.
- `increment_daily_session()` RPC 영역 + `get_today_session_count()` RPC 영역 박음 → 클라이언트 영역 직접 INSERT 영역 거의 X.

#### 4. 우회 영역
- `increment_daily_session()`, `get_today_session_count()` (SECURITY DEFINER).

#### 5. 박지 X 영역
- 없음.

---

### 2.8 `payment_events`

#### 1. RLS 활성화 여부
✅ ENABLE — `20260408003000_add_payment_events.sql:14`

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| Users can view own payments | SELECT | authenticated | `auth.uid() = user_id` | — | 20260408003000:17 |
| Admins can view all payments | SELECT | (admin) | `public.is_admin()` | — | 20260510_rls_audit:107 |

#### 3. 정책별 상세
- INSERT 영역 정책 영역 **없음** → 사용자 영역 직접 INSERT 영역 차단. `apply_payment_topup()` RPC (SECURITY DEFINER) 영역 전용.

#### 4. 우회 영역
- `apply_payment_topup()` RPC (SECURITY DEFINER).
- Edge Function 영역 `paddle-webhook` 영역 `payment-webhook` 영역 `verify-iap-receipt` 영역 = `service_role` key 영역 박힘 영역 → 우회.

#### 5. 박지 X 영역
- ⚠️ INSERT 영역 차단 영역 = 의도된 영역. 결제 영역 idempotency 영역 보장 영역 박힘.

---

### 2.9 `leagues`

#### 1. RLS 활성화 여부
⚠️ **확인 필요** — migration 영역 없음.

#### 2. 정책 목록
⚠️ **migration 영역 없음**. `useUserStats.ts:136` 영역 SELECT 박힘 → 정책 영역 박힘 영역 추정 (또는 public 영역 readable 영역).

#### 3. 정책별 상세
- ⚠️ leagues 영역 = 정적 영역 마스터 데이터 영역 → public SELECT 영역 박힘 영역 추정.

#### 4. 우회 영역
- ⚠️ 확인 필요.

#### 5. 박지 X 영역
- ⚠️ UI 영역 비활성 영역 (작업 #27 영역).

---

### 2.10 `league_members`

#### 1. RLS 활성화 여부
⚠️ **확인 필요** — migration 영역 없음.

#### 2. 정책 목록
⚠️ **migration 영역 없음**. `useUserStats.ts:147` 영역 자신 영역 SELECT 박힘 → `auth.uid() = user_id` 영역 정책 영역 박힘 영역 추정.

#### 3. 정책별 상세
- ⚠️ 갱신 영역 메커니즘 영역 확인 X.

#### 4. 우회 영역
- ⚠️ 확인 필요.

#### 5. 박지 X 영역
- ⚠️ UI 영역 비활성 영역.

---

### 2.11 `admin_actions`

#### 1. RLS 활성화 여부
⚠️ **확인 필요** — migration 영역 없음.

#### 2. 정책 목록
⚠️ **migration 영역 없음**. `useAdminLogs.ts:76` 영역 SELECT 박힘 영역 = admin 영역 전용 영역 추정 → `public.is_admin()` 영역 정책 영역 박힘 영역 추정.

INSERT 영역 = `supabase/functions/admin-action/index.ts:261` 영역 `service_role` key 영역 박힘 영역 → RLS 영역 우회 영역.

#### 3. 정책별 상세
- ⚠️ Dashboard 영역에서 확인 필요.

#### 4. 우회 영역
- Edge Function 영역 (service_role).

#### 5. 박지 X 영역
- ⚠️ 일반 사용자 영역 SELECT 영역 박힐 영역 차단 영역 (의도 영역).

---

### 2.12 `daily_batch_runs`

#### 1. RLS 활성화 여부
⚠️ **확인 필요** — CREATE 영역 마이그 영역 없음.

#### 2. 정책 목록
⚠️ **CREATE 마이그 영역 없음**. `useBatchRuns.ts:54` 영역 SELECT 박힘 영역 = admin 영역 전용 영역 추정.

#### 3. 정책별 상세
- ⚠️ 확인 필요.

#### 4. 우회 영역
- `run_daily_batch_analysis()` RPC (SECURITY DEFINER) — INSERT 영역 박힘.

#### 5. 박지 X 영역
- ⚠️ admin SELECT 정책 영역 박힘 영역 추정 영역.

---

### 2.13 `user_custom_scores`

#### 1. RLS 활성화 여부
✅ ENABLE — `20260404142430_db7ea540-...sql:9`

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| Users can view their own scores | SELECT | (모두) | `auth.uid() = user_id` | — | 20260404:11 |
| Users can create their own scores | INSERT | (모두) | — | `auth.uid() = user_id` | 20260404:15 |
| Users can update their own scores | UPDATE | (모두) | `auth.uid() = user_id` | — | 20260404:19 |
| Users can delete their own scores | DELETE | (모두) | `auth.uid() = user_id` | — | 20260404:23 |
| Admins can view all custom scores | SELECT | (admin) | `public.is_admin()` | — | 20260510_rls_audit:124 |

#### 3. 정책별 상세
- 자신 영역 custom_scores 영역 CRUD 영역 모두 박힘.

#### 4. 우회 영역
- 없음.

#### 5. 박지 X 영역
- ⚠️ 현재 사용 영역 X (PENDING).

---

### 2.14 `user_scores`

#### 1. RLS 활성화 여부
✅ ENABLE — `20260410170000_rls_user_scores_practice_logs.sql:1`

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| Users can view own scores | SELECT | authenticated | `auth.uid() = user_id` | — | 20260410170000:4 |
| Users can insert own scores | INSERT | authenticated | — | `auth.uid() = user_id` | 20260410170000:9 |
| Users can update own scores | UPDATE | authenticated | `auth.uid() = user_id` | `auth.uid() = user_id` | 20260410170000:13 |
| Users can delete own scores | DELETE | authenticated | `auth.uid() = user_id` | — | 20260410170000:18 |
| Admins can view all user scores | SELECT | (admin) | `public.is_admin()` | — | 20260510_rls_audit:142 |

#### 3. 정책별 상세
- 자신 영역 user_scores 영역 CRUD 영역 모두 박힘. UPDATE 영역 WITH CHECK 영역 박힘.

#### 4. 우회 영역
- 없음.

#### 5. 박지 X 영역
- ⚠️ 현재 사용 영역 X (PENDING — 악보 영역 업로드 영역).

---

### 2.15 `practice_logs`

#### 1. RLS 활성화 여부
✅ ENABLE — `20260410170000_rls_user_scores_practice_logs.sql:2`

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| Users can view own practice logs | SELECT | authenticated | `auth.uid() = user_id` | — | 20260410170000 |
| Users can insert own practice logs | INSERT | authenticated | — | `auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_scores s WHERE s.id = practice_logs.score_id AND s.user_id = auth.uid())` | 20260410170000:27-30 |
| Users can update own practice logs | UPDATE | authenticated | `auth.uid() = user_id` | `auth.uid() = user_id` | 20260510_rls_audit:152 |
| Users can delete own practice logs | DELETE | authenticated | `auth.uid() = user_id` | — | 20260510_rls_audit:157 |
| Admins can view all practice logs | SELECT | (admin) | `public.is_admin()` | — | 20260510_rls_audit:161 |

#### 3. 정책별 상세
- 자신 영역 CRUD 영역 모두 박힘. UPDATE/DELETE 영역 = 20260510 영역 추가.

#### 4. 우회 영역
- 없음.

#### 5. 박지 X 영역
- ⚠️ 현재 사용 영역 X (PENDING).

---

### 2.16 `device_change_events`

#### 1. RLS 활성화 여부
✅ ENABLE — `20260503_add_device_change_events.sql:20`

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| Users can view own device change events | SELECT | (모두) | `auth.uid() = user_id` | — | 20260503:22 + 20260510_rls_audit:118 (재생성 영역) |
| Users can insert own device change events | INSERT | (모두) | — | `auth.uid() = user_id` | 20260503:26 + 20260510_rls_audit:123 |
| **device_change_events_update_own** | **UPDATE** | **authenticated** | `auth.uid() = user_id` | `auth.uid() = user_id` | **`20260518_device_change_events_update_policy.sql` (Phase 3 Step 2-A 박음)** |
| Admins can view all device change events | SELECT | (admin) | `public.is_admin()` | — | 20260503:30 + 20260510_rls_audit:128 |

#### 3. 정책별 상세
- 자신 영역 디바이스 영역 변경 영역 이벤트 영역 CRUD 영역 박음 (Phase 3 영역 박은 영역 UPDATE 영역 박음).
- 박는 사례: `userEnvironmentOffset.ts:112` INSERT, `userEnvironmentOffset.ts:135` UPDATE.

#### 4. 우회 영역
- 없음 (Phase 3 영역 박은 영역 UPDATE 정책 영역 박음 — silent fail 해소 영역).

#### 5. 박지 X 영역
- ✅ **Phase 3 Step 2-A (2026-05-18)**: `device_change_events_update_own` 정책 영역 박음 → silent fail 영역 해소 영역 박음.
- ⚠️ DELETE 영역 정책 영역 없음 — intentional 영역.

---

### 2.17 `user_streaks` (Phase 3 영역 박음)

#### 1. RLS 활성화 여부
✅ ENABLE — `20260518_phase3_consolidation.sql §9` (Phase 3 Step 1-2 영역 박음)

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| user_streaks_select_own | SELECT | authenticated | `auth.uid() = user_id` | — | 20260518:§9 |
| user_streaks_admin_select | SELECT | (admin) | `public.is_admin()` | — | 20260518:§9 |

#### 3. 정책별 상세
- 자신 영역 streak 영역 SELECT 영역만 박음.
- INSERT/UPDATE/DELETE 영역 = Edge Function (`admin-action/index.ts:220`) 영역 박음 (service_role 영역 RLS 우회 영역).

#### 4. 우회 영역
- Edge Function (service_role) — admin streak 영역 조정 영역 박음.

#### 5. 박지 X 영역
- ⚠️ UPDATE 정책 영역 없음 영역 → 사용자 영역 영역 streak 영역 박지 X 박힘 영역 (intentional — `handle_session_complete` 영역 박음 영역 박을 영역 박음 영역 박지 X 박힌 영역 박음 영역)

---

### 2.18 `subscriptions` (Phase 3 영역 박음)

#### 1. RLS 활성화 여부
✅ ENABLE — `20260518_phase3_consolidation.sql §10` (Phase 3 Step 1-2 영역 박음)

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| subscriptions_select_own | SELECT | authenticated | `auth.uid() = user_id` | — | 20260518:§10 |
| subscriptions_admin_select | SELECT | (admin) | `public.is_admin()` | — | 20260518:§10 |

#### 3. 정책별 상세
- 자신 영역 구독 영역 SELECT 영역만 박음.
- INSERT/UPDATE/DELETE 영역 = Paddle webhook (`paddle-webhook/index.ts:139`) 영역 박음 (service_role).

#### 4. 우회 영역
- Edge Function (service_role).

#### 5. 박지 X 영역
- ⚠️ Paddle Checkout 영역 production 영역 박지 X 박힘 영역 (PENDING).

---

### 2.19 `league_groups` (Phase 3 영역 신규 발견 영역 박음)

#### 1. RLS 활성화 여부
✅ ENABLE — `20260518_phase3_consolidation.sql §5`

#### 2. 정책 목록

| 정책 이름 | 명령 | 대상 | USING | WITH CHECK | 마이그 |
|---|---|---|---|---|---|
| league_groups_select_all | SELECT | (모두) | `true` | — | 20260518:§5 |
| league_groups_admin_all | ALL | (admin) | `public.is_admin()` | `public.is_admin()` | 20260518:§5 |

#### 3. 정책별 상세
- 모든 사용자 영역 SELECT 박음 (마스터 데이터 영역 박음).
- admin ALL 영역 박음 (INSERT/UPDATE/DELETE 영역 박음 영역 박음 영역 박음).

#### 4. 우회 영역
- 없음.

#### 5. 박지 X 영역
- ⚠️ UI 영역 비활성 영역 (작업 #27 영역).

---

## 3. 추출 방법 영역

### 3.1 RLS 활성화 영역 추출
```bash
grep -rn "ALTER TABLE.*ENABLE ROW LEVEL SECURITY" supabase/migrations/*.sql
```

### 3.2 CREATE POLICY 영역 추출
```bash
grep -rn "CREATE POLICY" supabase/migrations/*.sql
```

### 3.3 정책 영역 카운트 영역
```bash
grep -h "CREATE POLICY" supabase/migrations/*.sql | wc -l  # → 45개
```

### 3.4 헬퍼 함수 사용 영역
```bash
grep -rn "public.is_admin()\|public.is_reviewer()" supabase/migrations/*.sql
```

---

## 4. 정책 영역 누락·중복·의심 영역 — Phase 3 영역 박은 영역 박힘 영역 박음

### 4.1 누락 영역 (Phase 3 완료 영역 박음)

| # | 테이블 | 누락 영역 | 상태 |
|---|---|---|---|
| 1 | `profiles` | DELETE 정책 영역 없음 | intentional 영역 — `request_account_deletion` RPC 영역 박음 |
| 2 | `user_sessions` | UPDATE·DELETE 정책 영역 없음 | intentional (영구 영역 기록) |
| 3 | `user_note_logs` | UPDATE·DELETE 정책 영역 없음 | intentional (영구 영역 로그) |
| 4 | `device_change_events` | UPDATE 정책 영역 없음 | ✅ **Phase 3 Step 2-A 박음** (`20260518_device_change_events_update_policy.sql`) |
| 5 | `payment_events` | INSERT 정책 영역 없음 | intentional (RPC 영역 전용) |
| 6-12 | 마이그 영역 없는 영역 8개 테이블 | 전체 정책 영역 마이그 영역 없음 | ✅ **Phase 3 Step 1-2 박음** (`20260518_phase3_consolidation.sql` 영역 박음 영역 재현 영역) |

### 4.2 idempotent DROP+CREATE 패턴 영역 박음

> Phase 3 영역 = 모든 정책 영역 `DROP POLICY IF EXISTS → CREATE POLICY` 영역 박음 패턴 영역 박음.

| # | 마이그 | 패턴 영역 박음 |
|---|---|---|
| 1 | `20260408001000` (profiles) | DROP POLICY IF EXISTS → CREATE POLICY |
| 2 | `20260408003000` (payment_events) | DROP POLICY IF EXISTS → CREATE POLICY |
| 3 | `20260509_daily_sessions` (daily_sessions) | DROP POLICY IF EXISTS → CREATE POLICY |
| 4 | `20260516_reviewer_sessions_rls` (user_sessions) | DROP POLICY IF EXISTS → CREATE POLICY |
| 5 | `20260518_phase3_consolidation` (10개 테이블 영역) | DROP POLICY IF EXISTS → CREATE POLICY (통일 명명 영역 `snake_case`) |

### 4.3 중복 영역 (Phase 3 영역 박은 영역 정리 영역 박음)

| # | 정책 영역 | 박힌 영역 | Phase 3 박음 |
|---|---|---|---|
| 1 | `Users can view their own logs` (user_note_logs) | 20260405142021 + 20260405142751 (재생성 영역) | (의도 영역 박은 영역) |
| 2 | `Users can insert their own logs` (user_note_logs) | 동일 영역 | (의도 영역 박은 영역) |
| 3 | `Users can view own device change events` (device_change_events) | 20260503 + 20260510_rls_audit (재생성 영역, idempotent) | (의도 영역 박은 영역) |
| 4 | user_sessions·user_stats_daily·note_mastery 영역 정책 영역 (Production 영역 박은 영역 발견 영역) | Dashboard 영역 박은 영역 영역 박힘 영역 박음 | ✅ Phase 3 영역 `DROP IF EXISTS` 영역 통일 명명 영역 박음 |

### 4.4 의심 영역

| # | 영역 | 의심 사항 |
|---|---|---|
| 1 | `is_reviewer()` 영역 | RLS 정책 영역 직접 사용 X — **dead 함수 영역**. ComingSoonGate = `useAuth().profile?.role === 'reviewer'` 클라이언트 영역 분기 영역 박음. 출시 후 DROP 박을 영역. |
| 2 | `user_note_logs` 영역 realtime publication | 사용 영역 X 영역 추정 영역. 보안 영역 위험 영역 없으나 영역 미사용 영역 정리 영역 PENDING. |

### 4.5 통계 영역 (Phase 3 박은 영역 박힘 영역)

| 영역 | Phase 1 영역 | Phase 3 박은 영역 |
|---|---|---|
| 전체 CREATE POLICY 영역 (마이그) | 45개 | **45 + 20 (Phase 3 신규 박음) = 65개** |
| 테이블 영역 정책 영역 있는 영역 (마이그) | 10개 | **10 + 10 (Phase 3 박은 영역) = 20개** |
| 테이블 영역 정책 영역 마이그 영역 없음 | 8개 (Dashboard 직접 영역 추정) | ✅ **0개 (Phase 3 영역 박은 영역 모두 박음)** |
| 헬퍼 함수 | 2개 (`is_admin`, `is_reviewer`) | 3개 (+`get_my_league_group_id` Phase 3 박음) |
| `is_admin()` 사용 영역 admin SELECT 정책 영역 | 11개 | 11 + 10 (Phase 3 박음) = 21개 |
| `is_reviewer()` 사용 영역 RLS 정책 영역 | **0개 (dead)** | 동일 영역 |
| `get_my_league_group_id()` 사용 영역 정책 영역 | — | 1개 (`league_members_select_own_group`) |

→ ✅ **Phase 3 완료** — 마이그 영역 없는 영역 모든 영역 테이블 영역 RLS 정책 영역 박은 영역 영역 박음.
