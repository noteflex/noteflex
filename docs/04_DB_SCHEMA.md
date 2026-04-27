# 04. Supabase 데이터 모델

> **작성일**: 2026-04-28
> **선행 자료**: `docs/02_ARCHITECTURE.md`
> **자료 출처**: `supabase/migrations/*.sql` 9개, `src/integrations/supabase/types.ts`, `supabase/functions/*/index.ts`

---

## 1. Supabase 프로젝트 정보

| 항목 | 값 |
|---|---|
| Project Ref | `rcwydfzkuhfcnnbqjmpp` |
| URL | `https://rcwydfzkuhfcnnbqjmpp.supabase.co` |
| 클라이언트 초기화 | `src/integrations/supabase/client.ts` (단순 `createClient(URL, ANON_KEY)`) |
| 자동 생성 타입 | `src/integrations/supabase/types.ts` |
| 로컬 환경 | `supabase/config.toml`, 포트 `54321` |

---

## 2. 마이그레이션 이력

| 날짜 | 파일 | 주요 변경 |
|---|---|---|
| 2026-04-04 14:24 | `20260404142430_db7ea540-...sql` | `user_custom_scores` 테이블 + RLS |
| 2026-04-05 14:20 | `20260405142021_28ee1d25-...sql` | `user_note_logs` 테이블 + Realtime publication |
| 2026-04-05 14:27 | `20260405142751_dc015ee6-...sql` | `user_note_logs` RLS 정책을 `authenticated` 역할 명시로 개정 |
| 2026-04-08 00:10 | `20260408001000_add_profiles_scan_quota.sql` | `profiles` 테이블 + 자동 생성 트리거 + `consume_scan_quota` / `topup_scan_quota` 함수 |
| 2026-04-08 00:30 | `20260408003000_add_payment_events.sql` | `payment_events` 테이블 + `apply_payment_topup()` 함수 (멱등) |
| 2026-04-10 16:50 | `20260410165000_add_user_scores_and_practice_logs.sql` | `user_scores` + `practice_logs` 테이블 (악보 연습 메타) |
| 2026-04-10 17:00 | `20260410170000_rls_user_scores_practice_logs.sql` | 위 두 테이블 RLS 정책 |
| 2026-04-24 | `20260424_premium_expiry.sql` | `daily_batch_runs.premium_expired` 컬럼 추가 + `expire_premium_users()` + `run_daily_batch_analysis()` |
| 2026-04-25 | `20260425_sublevel_system.sql` | `user_sublevel_progress` 테이블 + `subscription_tier` 컬럼 + `record_sublevel_attempt()` |

> ⚠️ **주의**: 다음 테이블은 마이그레이션 파일에 정의가 없음 — 외부(Supabase Studio 또는 별도 SQL)에서 생성된 것으로 추정. 코드와 다른 마이그레이션의 ALTER에서 참조만 발견:
> - `daily_batch_runs` (`20260424_premium_expiry.sql:2-3`에서 ALTER만)
> - `note_mastery` (`20260424` 함수 본문에서 사용)
> - `subscriptions` (`paddle-webhook` 함수에서 사용)
> - `user_streaks` (`admin-action` 함수에서 사용)
> - `admin_actions` (`admin-action` 함수에서 사용)
> - `user_sessions` (코드 곳곳에서 사용)

---

## 3. 테이블 카탈로그

### 3.1 `profiles` — 사용자 프로필 (확장)

**원본 정의**: `20260408001000_add_profiles_scan_quota.sql:1-6`
**확장 컬럼**: `20260425_sublevel_system.sql:58-60` + `admin-action` 함수에서 사용된 컬럼

| 컬럼 | 타입 | NOT NULL | DEFAULT | 제약 |
|---|---|---|---|---|
| `id` | UUID | YES | — | PRIMARY KEY, FK → `auth.users(id)` ON DELETE CASCADE |
| `scan_quota` | INTEGER | YES | 3 | CHECK (≥ 0) |
| `created_at` | TIMESTAMPTZ | YES | now() | |
| `updated_at` | TIMESTAMPTZ | YES | now() | (트리거로 갱신) |
| `subscription_tier` | TEXT | NO | `'free'` | CHECK IN ('free', 'pro') |
| `role` | TEXT | NO | NULL | 'user' / 'admin' |
| `is_premium` | BOOLEAN | NO | NULL | Paddle/IAP 결제 시 true |
| `premium_until` | TIMESTAMPTZ | NO | NULL | 프리미엄 만료일 |
| `total_xp` | INTEGER | NO | NULL | 누적 XP |
| `current_streak` | INTEGER | NO | NULL | 연속 학습 일수 |
| `email` | TEXT | NO | NULL | (관리자 페이지에서 표시용) |

**추가 추정 컬럼** (코드에서 사용되지만 마이그레이션 외부 정의):
- `display_name`, `nickname`, `avatar_url`
- `longest_streak`, `current_league`, `last_practice_date`
- `is_minor`, `profile_completed`, `onboarding_completed`
- `locale`, 생년월일, 국가 등

**트리거**:
- `trg_profiles_updated_at` — BEFORE UPDATE → `set_updated_at_profiles()`
- `on_auth_user_created_profile` — AFTER INSERT ON `auth.users` → `handle_new_user_profile()` (scan_quota=3 기본값으로 자동 생성)

**인덱스**: `idx_profiles_tier (subscription_tier)`

**RLS** (`20260408001000:8-27`):

| 정책 | 행동 | 조건 |
|---|---|---|
| Users can view own profile | SELECT | `auth.uid() = id` |
| Users can update own profile | UPDATE | `auth.uid() = id` (USING + WITH CHECK) |
| Users can insert own profile | INSERT | `auth.uid() = id` |

> 📌 admin role의 SELECT/UPDATE 정책은 마이그레이션에 명시 없음 — `admin-action` Edge Function이 service_role 키로 우회.

---

### 3.2 `user_custom_scores` — 사용자 커스텀 악보

**정의**: `20260404142430_db7ea540-...sql:1-7`

| 컬럼 | 타입 | NOT NULL | DEFAULT |
|---|---|---|---|
| `id` | UUID | YES | `gen_random_uuid()` |
| `user_id` | UUID | YES | — (FK → `auth.users(id)` CASCADE) |
| `score_title` | TEXT | YES | — |
| `note_data` | JSONB | YES | — |
| `created_at` | TIMESTAMPTZ | YES | now() |

**인덱스**: `idx_user_custom_scores_user_id (user_id)`

**RLS** (`:11-25`): 자신의 user_id 기준 SELECT/INSERT/UPDATE/DELETE 허용.

---

### 3.3 `user_note_logs` — 음표 학습 기록 (게임 핵심 로그)

**정의**: `20260405142021_28ee1d25-...sql:1-12`

| 컬럼 | 타입 | NOT NULL | DEFAULT |
|---|---|---|---|
| `id` | UUID | YES | `gen_random_uuid()` |
| `user_id` | UUID | YES | — |
| `note_key` | TEXT | YES | — (예: "C", "F#", "Bb") |
| `octave` | INTEGER | YES | — |
| `clef` | TEXT | YES | `'treble'` |
| `is_correct` | BOOLEAN | YES | — |
| `response_time` | NUMERIC(5,2) | NO | NULL (초 단위) |
| `error_type` | TEXT | NO | NULL ('wrong_button' / 'timeout') |
| `level` | INTEGER | YES | 0 |
| `created_at` | TIMESTAMPTZ | YES | now() |

**인덱스**:
- `idx_note_logs_user_id (user_id)`
- `idx_note_logs_created_at (created_at DESC)`

**Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE user_note_logs;` — 실시간 UI 갱신 가능.

**RLS** (`20260405142751:4-12`): authenticated 역할만 자신의 로그 SELECT/INSERT.

> 🔗 INSERT 위치: `useNoteLogger.ts:11-55` (정답·오답·타임아웃 모두 1행씩)

---

### 3.4 `user_scores` — 사용자 악보 연습 메타데이터

**정의**: `20260410165000:2-12`

| 컬럼 | 타입 | NOT NULL | DEFAULT | 제약 |
|---|---|---|---|---|
| `id` | BIGSERIAL | YES | — | PRIMARY KEY |
| `user_id` | UUID | YES | — | FK → `auth.users(id)` CASCADE |
| `title` | VARCHAR(255) | YES | — | |
| `status` | VARCHAR(50) | NO | `'IN_PROGRESS'` | CHECK IN ('IN_PROGRESS', 'COMPLETED', 'DISCONTINUED') |
| `discontinued_at` | TIMESTAMPTZ | NO | NULL | |
| `created_at` | TIMESTAMPTZ | NO | NOW() | |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | |

**트리거**: `trg_user_scores_updated_at` → `set_updated_at_user_scores()`

**RLS** (`20260410170000:4-19`): authenticated 역할 자신의 데이터 SELECT/INSERT/UPDATE/DELETE.

---

### 3.5 `practice_logs` — 마이크로 학습 기록 (초견 속도)

**정의**: `20260410165000:31-41`

| 컬럼 | 타입 | NOT NULL | DEFAULT |
|---|---|---|---|
| `id` | BIGSERIAL | YES | — |
| `score_id` | BIGINT | YES | — (FK → user_scores CASCADE) |
| `user_id` | UUID | YES | — (FK → auth.users CASCADE) |
| `measure_number` | INT | YES | — |
| `expected_note` | VARCHAR(10) | YES | — |
| `played_note` | VARCHAR(10) | NO | NULL |
| `reaction_time_ms` | INT | YES | — |
| `is_correct` | BOOLEAN | YES | — |
| `created_at` | TIMESTAMPTZ | NO | NOW() |

**인덱스**: `idx_practice_logs_user_score (user_id, score_id)`

**RLS** (`20260410170000:21-30`):
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id` AND EXISTS subquery → 자신의 score에만 INSERT 가능

---

### 3.6 `payment_events` — 결제 이벤트 (IAP / scan_quota)

**정의**: `20260408003000:1-12`

| 컬럼 | 타입 | NOT NULL | DEFAULT | 제약 |
|---|---|---|---|---|
| `id` | UUID | YES | `gen_random_uuid()` | PRIMARY KEY |
| `provider` | TEXT | YES | `'iap'` | |
| `event_id` | TEXT | YES | — | UNIQUE (멱등성) |
| `checkout_session_id` | TEXT | NO | NULL | |
| `user_id` | UUID | YES | — | FK → auth.users CASCADE |
| `package_id` | TEXT | YES | — | |
| `credits_added` | INTEGER | YES | — | CHECK (> 0) |
| `amount_cents` | INTEGER | NO | NULL | |
| `currency` | TEXT | NO | NULL | |
| `status` | TEXT | YES | `'completed'` | |
| `created_at` | TIMESTAMPTZ | YES | now() | |

**인덱스**: `idx_payment_events_user_id_created_at (user_id, created_at DESC)`

**RLS** (`:17-21`): authenticated 역할 자신의 결제 SELECT만 (INSERT는 service_role/RPC만).

---

### 3.7 `user_sublevel_progress` — 21단계 진행도 (게임 핵심)

**정의**: `20260425_sublevel_system.sql:11-27`

| 컬럼 | 타입 | NOT NULL | DEFAULT | 제약 |
|---|---|---|---|---|
| `user_id` | UUID | YES | — | FK → profiles(id) CASCADE |
| `level` | INT | YES | — | CHECK (1~7), PK |
| `sublevel` | INT | YES | — | CHECK (1~3), PK |
| `play_count` | INT | YES | 0 | |
| `best_streak` | INT | YES | 0 | |
| `total_attempts` | INT | YES | 0 | |
| `total_correct` | INT | YES | 0 | |
| `passed` | BOOLEAN | YES | false | |
| `passed_at` | TIMESTAMPTZ | NO | NULL | |
| `unlocked_at` | TIMESTAMPTZ | YES | NOW() | |
| `updated_at` | TIMESTAMPTZ | YES | NOW() | |

**복합 PK**: `(user_id, level, sublevel)`

**인덱스**:
- `idx_progress_user (user_id)`
- `idx_progress_passed (user_id, passed)`

**RLS** (`:31-49`):

| 정책 | 행동 | 조건 |
|---|---|---|
| Users can view own progress | SELECT | `auth.uid() = user_id` |
| Users can insert own progress | INSERT | `auth.uid() = user_id` |
| Users can update own progress | UPDATE | `auth.uid() = user_id` |
| **Admins can view all progress** | SELECT | `public.is_admin()` |

---

### 3.8 `daily_batch_runs` — 일일 배치 분석 이력 ⚠️ 외부 정의

마이그레이션에 정의 없음. `20260424_premium_expiry.sql:2-3`에서 `premium_expired` 컬럼만 ALTER로 추가.

**추정 스키마** (함수 본문 + 코드 사용처에서 역추적):

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `run_date` | DATE | UNIQUE (1일 1회) |
| `users_analyzed` | INTEGER | |
| `weakness_flagged` | INTEGER | weakness 신규 부여 |
| `mastery_flagged` | INTEGER | mastery 신규 부여 |
| `weakness_released` | INTEGER | weakness 해제 |
| `premium_expired` | INTEGER | 프리미엄 만료 처리된 사용자 수 |
| `duration_ms` | INTEGER | |
| `status` | TEXT | 'success' / 'error' |
| `error_message` | TEXT | |

> 🔗 사용: `useBatchRuns.ts`, `pages/admin/AdminBatchRuns.tsx`

---

### 3.9 `note_mastery` — 음표별 약점/숙달 플래그 ⚠️ 외부 정의

`20260424_premium_expiry.sql` 함수 본문에서 사용 + `useUserMastery.ts`에서 SELECT.

**추정 스키마**:

| 컬럼 | 타입 |
|---|---|
| `user_id` | UUID |
| `clef` | TEXT |
| `note_key` | TEXT |
| `weakness_flag` | BOOLEAN |
| `weakness_flagged_at` | TIMESTAMPTZ |
| `mastery_flag` | BOOLEAN |
| `mastery_flagged_at` | TIMESTAMPTZ |
| `last_batch_analyzed_at` | TIMESTAMPTZ |
| `last_seen_at` | TIMESTAMPTZ |
| `total_attempts` | INTEGER |
| `recent_accuracy` | NUMERIC |
| `avg_reaction_ms` | INTEGER |

---

### 3.10 `subscriptions` — Paddle 구독 정보 ⚠️ 외부 정의

`paddle-webhook/index.ts:139`에서 UPSERT.

**추정 스키마**:

| 컬럼 | 타입 |
|---|---|
| `user_id` | UUID |
| `stripe_customer_id` | TEXT (Paddle customer_id 재활용 — 컬럼명만 stripe) |
| `stripe_subscription_id` | TEXT (Paddle subscription id) — UNIQUE |
| `stripe_price_id` | TEXT |
| `status` | TEXT |
| `plan` | TEXT ('premium_monthly' / 'premium_yearly') |
| `current_period_start` | TIMESTAMPTZ |
| `current_period_end` | TIMESTAMPTZ |
| `cancel_at_period_end` | BOOLEAN |
| `canceled_at` | TIMESTAMPTZ |

> 📌 컬럼명이 `stripe_*`인 이유: 초기 Stripe 통합 → Paddle로 전환하면서 컬럼만 재활용 (코드 주석 확인 필요).

---

### 3.11 `user_streaks` — 연속 학습 ⚠️ 외부 정의

`admin-action/index.ts:220-222`에서 사용.

| 컬럼 | 타입 |
|---|---|
| `user_id` | UUID |
| `current_streak` | INTEGER |

`profiles.current_streak`와 동기화 필요.

---

### 3.12 `admin_actions` — 관리자 활동 로그 ⚠️ 외부 정의

`admin-action/index.ts:261-268`에서 INSERT.

| 컬럼 | 타입 |
|---|---|
| `admin_id` | UUID |
| `action_type` | TEXT |
| `target_user_id` | UUID |
| `details` | JSONB ({reason, before, after, requested_action}) |
| `ip_address` | TEXT |
| `user_agent` | TEXT |
| `created_at` | TIMESTAMPTZ |

**action_type 값들**:
- `update_profile` (`update_role` 매핑)
- `grant_premium` / `revoke_premium`
- `grant_xp`
- `reset_streak`

> 🔗 조회: `useAdminLogs.ts`, `pages/admin/AdminLogs.tsx`

---

### 3.13 `user_sessions` — 게임 세션 로그 ⚠️ 외부 정의

`useSessionRecorder.ts`에서 INSERT, `useUserStats` / `useMyStats` / `useAdminUserDetail`에서 조회.

**추정 컬럼** (코드에서 추출):
- `id`, `user_id`, `level`, `sublevel`
- `score`, `total_attempts`, `total_correct`, `accuracy`, `best_streak`
- `xp_earned`, `xp_breakdown` (JSONB — base/speed/streak/completion/accuracy)
- `status` ('completed' / 'gameover')
- `started_at`, `ended_at`, `duration_ms`
- `created_at`

> 🔧 코드에서 정확한 컬럼 확인 필요 (`useSessionRecorder.ts` 본문 — 코드에서 확인 필요).

---

## 4. 외래키 관계 다이어그램

```
auth.users (Supabase Auth, id UUID)
   │
   ├─(1:1, ON DELETE CASCADE)──── profiles.id
   │                                  │
   │                                  ├─(1:N) user_sublevel_progress.user_id
   │                                  └─(1:N) user_streaks.user_id (외부)
   │
   ├─(1:N, CASCADE) user_custom_scores.user_id
   ├─(1:N, CASCADE) user_note_logs.user_id           [Realtime publication]
   ├─(1:N, CASCADE) user_scores.id ─┐
   │                                 └─(1:N, CASCADE) practice_logs.score_id
   ├─(1:N, CASCADE) practice_logs.user_id
   ├─(1:N, CASCADE) payment_events.user_id
   │
   ├─(1:N) user_sessions.user_id           (외부 정의)
   ├─(1:N) note_mastery.user_id            (외부 정의)
   ├─(1:N) subscriptions.user_id           (외부 정의)
   └─(1:N) admin_actions.target_user_id    (외부 정의)
            └ admin_actions.admin_id → profiles.id (외부)

(독립 테이블)
daily_batch_runs (run_date UNIQUE, 외부 정의)
```

---

## 5. RLS 정책 종합

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | own | own | own | (none) |
| `user_custom_scores` | own | own | own | own |
| `user_note_logs` | own (auth) | own (auth) | — | — |
| `user_scores` | own (auth) | own (auth) | own (auth) | own (auth) |
| `practice_logs` | own (auth) | own + own score (auth) | — | — |
| `payment_events` | own (auth) | (RPC만) | — | — |
| `user_sublevel_progress` | own + admin | own | own | — |
| `note_mastery` | (확인 필요) | | | |
| `subscriptions` | (확인 필요) | | | |
| `admin_actions` | (확인 필요) | | | |
| `user_sessions` | (확인 필요) | | | |
| `daily_batch_runs` | (확인 필요) | | | |

> 📌 외부 정의 테이블의 RLS는 마이그레이션에 없으므로 Supabase Studio에서 확인 필요.

---

## 6. SQL 함수 목록

### 6.1 트리거 함수

| 함수 | 출처 | 동작 |
|---|---|---|
| `set_updated_at_profiles()` | `20260408001000:29-37` | profiles UPDATE 시 updated_at = now() |
| `set_updated_at_user_scores()` | `20260410165000:15-23` | user_scores UPDATE 시 updated_at = now() |
| `handle_new_user_profile()` | `20260408001000:45-57` | auth.users INSERT 시 profiles 자동 생성 (scan_quota=3) |

### 6.2 비즈니스 RPC (클라이언트 호출)

#### `consume_scan_quota()` — `20260408001000:70-96`

- 보안: `SECURITY DEFINER`
- 동작: 인증된 사용자의 `profiles.scan_quota` 1 감소
- 반환: TABLE(remaining_quota INTEGER)
- 0 이하면 결과 없음 (UPDATE 실패) → 호출 측이 422/402 처리

#### `topup_scan_quota(p_user_id UUID, p_amount INTEGER)` — `20260408001000:98-119`

- 보안: `SECURITY DEFINER`
- 동작: scan_quota 증가 (UPSERT: ON CONFLICT DO UPDATE)
- 반환: 업데이트된 scan_quota

#### `apply_payment_topup(...)` — `20260408003000:26-91`

- 보안: `SECURITY DEFINER`
- 매개변수: `event_id, checkout_session_id, user_id, package_id, credits_added, amount_cents, currency`
- 동작:
  1. `payment_events` INSERT (`ON CONFLICT (event_id) DO NOTHING` — 멱등)
  2. 신규 INSERT인 경우만 `topup_scan_quota` 호출
- 반환: TABLE { applied BOOLEAN, remaining_quota INTEGER }

#### `record_sublevel_attempt(...)` — `20260425_sublevel_system.sql:68-164`

- 보안: `SECURITY DEFINER`
- 매개변수: `level, sublevel, attempts, correct, max_streak, game_status`
- 동작:
  1. `user_sublevel_progress` UPSERT (`ON CONFLICT (user_id, level, sublevel) DO UPDATE`)
  2. play_count++, total_attempts/total_correct 누적, best_streak는 max
  3. 통과 조건 검사 → `passed=true`, `passed_at=now()`
  4. `just_passed=true`인 경우 다음 단계 자동 unlock (행 INSERT)
- 반환: JSONB (level, sublevel, play_count, total_attempts, total_correct, accuracy, best_streak, passed, just_passed)

#### `expire_premium_users()` — `20260424_premium_expiry.sql:6-27`

- 보안: `SECURITY DEFINER`
- 동작: `is_premium=true AND premium_until < now() AND role != 'admin'`인 행에 대해 `is_premium=false`로 UPDATE
- 반환: INTEGER (영향 행 수)

#### `run_daily_batch_analysis()` — `20260424_premium_expiry.sql:30-116`

- 보안: `SECURITY DEFINER`
- 동작:
  1. `daily_batch_runs.run_date = today()` 존재 시 즉시 종료 (1일 1회 보장)
  2. `note_mastery` 갱신 — 사용자별 weakness_flag / mastery_flag (recent_accuracy / avg_reaction_ms 기준)
  3. `expire_premium_users()` 호출
  4. 결과 요약을 `daily_batch_runs`에 INSERT
  5. 예외 시 status='error', error_message 기록
- 반환: UUID (`daily_batch_runs.id`)

#### `is_admin()` ⚠️ 외부 정의

- 마이그레이션에 정의 없음 — Supabase Studio에서 직접 생성된 것으로 추정
- RLS 정책에서 사용 (`20260425_sublevel_system.sql:49`: `USING (public.is_admin())`)
- 추정: `auth.uid()`로 `profiles.role='admin'` 확인하는 SECURITY DEFINER 함수

#### `check_nickname_available(p_nickname TEXT)` ⚠️ 외부 정의

- `useNicknameAvailability.ts`에서 호출
- 추정: 닉네임 정규화 + 중복 체크 + 추천

---

## 7. 트리거 종합

| 트리거 | 테이블 | 시점 | 함수 |
|---|---|---|---|
| `trg_profiles_updated_at` | profiles | BEFORE UPDATE | set_updated_at_profiles() |
| `trg_user_scores_updated_at` | user_scores | BEFORE UPDATE | set_updated_at_user_scores() |
| `on_auth_user_created_profile` | auth.users | AFTER INSERT | handle_new_user_profile() |

---

## 8. 인덱스 종합

| 인덱스 | 테이블 | 컬럼 |
|---|---|---|
| `idx_user_custom_scores_user_id` | user_custom_scores | user_id |
| `idx_note_logs_user_id` | user_note_logs | user_id |
| `idx_note_logs_created_at` | user_note_logs | created_at DESC |
| `idx_practice_logs_user_score` | practice_logs | (user_id, score_id) |
| `idx_payment_events_user_id_created_at` | payment_events | (user_id, created_at DESC) |
| `idx_progress_user` | user_sublevel_progress | user_id |
| `idx_progress_passed` | user_sublevel_progress | (user_id, passed) |
| `idx_profiles_tier` | profiles | subscription_tier |

---

## 9. 뷰

현재 정의된 뷰 없음 (`types.ts` `Views: { [_ in never]: never }`).

---

## 10. Realtime Publication

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE user_note_logs;
```

- `user_note_logs` 만 Realtime publication에 등록
- 클라이언트 구독 사용 여부는 코드에서 확인 필요 (현재 명시적 구독 코드 발견되지 않음)

---

## 11. Edge Functions (`supabase/functions/`)

### 11.1 `admin-action/index.ts` (282줄)

**용도**: 관리자가 다른 사용자의 권한·프리미엄·XP·스트릭을 조정.

**플로우**:
1. `Authorization` 헤더의 JWT를 `service_role` 클라이언트로 검증 → 호출자 user_id 추출
2. `profiles.role !== 'admin'` 이면 403
3. 5가지 `action_type` 분기:
   - `update_role`: user ↔ admin (자기 자신 불가)
   - `grant_premium`: `is_premium=true`, `premium_until` 설정
   - `revoke_premium`: `is_premium=false`, `premium_until=null`
   - `adjust_xp`: `total_xp += delta`
   - `adjust_streak`: `current_streak` 조정 + `user_streaks` 동기화
4. `admin_actions` INSERT (before/after JSONB + IP/UA)
5. 응답: `{ success: true, details: { reason, before, after } }`

**호출처**: `lib/adminActions.ts → callAdminAction()` → 관리자 다이얼로그 4종.

### 11.2 `paddle-webhook/index.ts` (219줄)

**용도**: Paddle.com 결제 이벤트를 DB에 동기화.

**플로우**:
1. `Paddle-Signature: ts=...;h1=...` 헤더 HMAC-SHA256 검증
2. 이벤트 타입 분기:
   - `subscription.created/updated/activated/resumed/paused/canceled` → `handleSubscriptionEvent()`
   - `transaction.completed` → 로깅만
3. `subscriptions` 테이블 UPSERT (`ON CONFLICT (stripe_subscription_id) DO UPDATE`)
4. plan 매핑은 환경변수 `VITE_PADDLE_PRICE_MONTHLY` / `VITE_PADDLE_PRICE_YEARLY` 비교
5. 응답: `{ received: true }`

> 📌 컬럼이 `stripe_*`인 이유: 초기 Stripe 도입 → Paddle로 전환하면서 재활용.

### 11.3 `verify-iap-receipt/index.ts` (510줄)

**용도**: iOS / Android IAP 영수증 검증 + scan_quota 충전.

**경로**:
- **RevenueCat 웹훅**: `Authorization: Bearer ${REVENUECAT_WEBHOOK_AUTH}` 검증 → RevenueCat API로 subscriber 조회
- **직접 영수증**: iOS `verifyReceipt` (sandbox/production 자동 분기) / Android Google Publisher API
- **TEST 모드** (`IAP_TEST_MODE=true`): `TEST_VALID` / `TEST_REFUND` / `TEST_INVALID` 접두사 영수증 처리

**패키지 매핑**:
- `scan_pack_10` → 10 credits
- `scan_pack_30` → 30 credits

**최종 처리**: `apply_payment_topup()` RPC 호출 (멱등) → `payment_events` 기록 + `scan_quota` 증가.

**응답**: `{ success, duplicate, creditsAdded, remainingScanQuota }`

### 11.4 `analyze-sheet-music/index.ts` (391줄)

**용도**: 악보 이미지를 AI로 분석 → 음표 추출 → scan_quota 1 차감.

**플로우**:
1. `Authorization` 검증
2. `scan_quota === 0` → 402 Payment Required
3. **Lovable AI Gateway** (Google Gemini 2.5 Flash) 호출:
   - `imageBase64` 전송
   - Tool calling으로 `extract_notes` 함수 강제 호출
   - 시스템 프롬프트: `notes` 배열 (key, octave, accidental) 추출
4. `sanitizeNotes()`:
   - key (C-G), octave (1-7), accidental (#/b) 검증
   - 신뢰도 점수 = `validCount - dropped*0.35 - clamped*0.1 - removed*0.08`
5. `consume_scan_quota()` RPC → 1 차감
6. 응답: `{ notes, confidenceScore, validation, remainingScanQuota }`

> 📌 펜딩: 사용자 악보 OCR 기능 (`docs/PENDING_BACKLOG.md §4.3`)

### 11.5 `payment-webhook/` ⚠️ 미완성

폴더만 존재 — `index.ts` 없음. 구현 보류.

### 11.6 `create-checkout-session/` ⚠️ 미완성

폴더만 존재 — `index.ts` 없음. 현재 결제는 `lib/paddle.ts:openCheckout()`이 클라이언트에서 직접 Paddle.Checkout.open()을 호출.

---

## 12. 데이터 흐름 (DB 관점)

### 12.1 신규 가입

```
사용자 가입 (Supabase Auth)
   ↓
auth.users INSERT
   ↓ trigger: on_auth_user_created_profile
profiles 자동 생성 (scan_quota=3, subscription_tier='free')
```

### 12.2 음표 학습

```
NoteGame 정답/오답
   ↓
useNoteLogger.logNote()
   ↓ INSERT (RLS: auth.uid()=user_id)
user_note_logs (Realtime publication)
   ↓ (옵션) 클라 구독
관리자/통계 화면 즉시 갱신
```

### 12.3 게임 세션 종료

```
phase = 'success' | 'gameover'
   ↓
useSessionRecorder.endSession()
   ↓
user_sessions INSERT (XP 계산 결과 포함)
   ↓
useLevelProgress.recordAttempt()
   ↓ RPC
record_sublevel_attempt()
   ↓
user_sublevel_progress UPSERT
   ↓ if just_passed
다음 단계 자동 unlock
```

### 12.4 일일 배치

```
(매일 UTC 15:00 — 한국 자정, cron 또는 수동 트리거)
   ↓
run_daily_batch_analysis() RPC
   ├─→ note_mastery 갱신 (weakness/mastery 플래그)
   ├─→ expire_premium_users() (premium_until 지난 사용자)
   └─→ daily_batch_runs INSERT (요약)
```

### 12.5 결제

```
Web 결제 (Paddle)
   ├─ 클라: lib/paddle.ts → Paddle.Checkout.open()
   └─ 서버: Paddle 웹훅 → paddle-webhook 함수 → subscriptions UPSERT + profiles.is_premium 동기화

Mobile IAP (iOS/Android)
   ├─ 클라: RevenueCat SDK → 결제 완료
   ├─ 서버: RevenueCat 웹훅 → verify-iap-receipt
   │        또는 직접 receipt 검증
   └─ apply_payment_topup() RPC → payment_events INSERT + scan_quota 충전
```

### 12.6 관리자 액션

```
관리자 화면 → callAdminAction(...)
   ↓
admin-action Edge Function
   ├─ JWT 검증 + role 확인
   ├─ profiles UPDATE (or user_streaks)
   └─ admin_actions INSERT (감사 로그)
```

---

## 13. 설계 특징

1. **자동 프로필 생성**: `auth.users` 트리거로 수동 관리 불필요.
2. **3중 결제 통합**: Web(Paddle) + Mobile(RevenueCat) + 직접 영수증 모두 `payment_events` / `subscriptions`로 흡수.
3. **멱등 결제 처리**: `payment_events.event_id` UNIQUE + RPC ON CONFLICT — 중복 webhook 안전.
4. **배치 1일 1회 보장**: `daily_batch_runs.run_date`로 락.
5. **RLS 우선**: 클라이언트는 자기 데이터만, 관리자 액션은 service_role을 가진 Edge Function 경유.
6. **스키마 표류**: 일부 테이블이 마이그레이션 외부에서 생성 — 신규 환경 셋업 시 누락 위험 (🔴 출시 전 정리 필요).

---

## 14. 미해결 / 확인 필요

| 항목 | 비고 |
|---|---|
| `note_mastery`, `daily_batch_runs`, `subscriptions`, `user_streaks`, `admin_actions`, `user_sessions` 테이블 정의 | 마이그레이션에 없음 — Supabase Studio 또는 별도 SQL 확인 필요 |
| `is_admin()` SQL 함수 본체 | 마이그레이션에 없음 |
| `check_nickname_available()` 함수 본체 | 마이그레이션에 없음 |
| Realtime 구독 클라이언트 코드 | publication은 있으나 클라 구독 미확인 |
| `payment-webhook` / `create-checkout-session` Edge Function | 폴더만 존재 — 구현 미완 |

---

다음: `docs/05_FEATURES.md` (사용자 관점 기능 카탈로그)
