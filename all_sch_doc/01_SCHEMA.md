# 01 — SCHEMA 영역

> 모든 테이블 영역 전수 박음 (총 16개) · 각 테이블 영역 13항목 박음.
> 박힌 근거 영역: `supabase/migrations/` 영역 + `src/` 영역 (grep 영역).

## 목차 영역

### USER 영역
1. [`profiles`](#1-profiles) — 사용자 프로필·게임 상태·결제 상태·탈퇴 상태 영역
### GAME 영역
2. [`user_sessions`](#2-user_sessions) — 게임 1회 영역 기록 (⚠️ migration 없음)
3. [`user_sublevel_progress`](#3-user_sublevel_progress) — 21단계 레벨 진행 영역
4. [`user_note_logs`](#4-user_note_logs) — 음표 1개 시도 영역 (deprecated 가능성)
### STATS 영역
5. [`user_stats_daily`](#5-user_stats_daily) — 사용자 영역 날짜별 통계 (⚠️ migration 없음)
6. [`note_mastery`](#6-note_mastery) — 음표별 숙련도 (⚠️ migration 없음)
### LIMIT 영역
7. [`daily_sessions`](#7-daily_sessions) — 일일 세션 한도 카운터 영역
### PAYMENT 영역
8. [`payment_events`](#8-payment_events) — 결제 영역 이벤트
### LEAGUE 영역 (UI 비활성)
9. [`leagues`](#9-leagues) — 리그 정의 (⚠️ migration 없음)
10. [`league_members`](#10-league_members) — 사용자별 리그 + 주간 XP (⚠️ migration 없음)
### ADMIN 영역
11. [`admin_actions`](#11-admin_actions) — 관리자 액션 감사 로그 (⚠️ migration 없음)
12. [`daily_batch_runs`](#12-daily_batch_runs) — 일일 분석 배치 이력 (⚠️ CREATE 마이그 없음, ALTER만 박힘)
### MISC 영역
13. [`user_custom_scores`](#13-user_custom_scores) — 사용자 커스텀 점수 (스캔)
14. [`user_scores`](#14-user_scores) — 사용자 업로드 악보 (PENDING)
15. [`practice_logs`](#15-practice_logs) — 악보 연습 로그 (PENDING)
16. [`device_change_events`](#16-device_change_events) — 오디오 장치 변경 추적 (§7.3)

---

## 1. `profiles`

### 1.1 한 줄 요약 영역
> 사용자 프로필 1행 = `auth.users` 영역 1행. 게임 상태·결제 상태·탈퇴 상태 영역 다 박힘.

### 1.2 무엇 박는 영역인지
- 사용자 영역 식별 + 표시 정보 (email, nickname, display_name, avatar_url, locale, country_code, timezone)
- 게임 영역 누적 상태 (current_streak, longest_streak, total_xp, current_league, last_practice_date)
- 결제 영역 상태 (is_premium, subscription_tier, premium_until, scan_quota, stripe_customer_id)
- 탈퇴 영역 상태 (is_deleted, deleted_at, deletion_reason)
- 캘리브레이션 영역 (user_env_offset_ms)
- 약관 동의 영역 시점 (tos_agreed_at, privacy_agreed_at, marketing_agreed_at)
- 권한 영역 (role: NULL | 'user' | 'admin' | 'reviewer')

### 1.3 어디에 박는 영역인지 (사용 영역)
- Dashboard 영역 KPI 카드 (current_streak, total_xp 영역 박음)
- 게임 영역 일일 한도 영역 (subscription_tier·is_premium·role 영역 박음)
- ProfilePage 영역 표시·수정 영역
- AdminUserDetail 영역 전체 컬럼 영역 박음

### 1.4 컬럼 영역 (전체)

| 컬럼 | 타입 | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | UUID PK | NO | — | 20260408001000 | `auth.users.id` 영역 FK (ON DELETE CASCADE) |
| `email` | TEXT | YES | — | 추론 (TS 타입 영역) | 사용자 이메일 (탈퇴 시 마스킹) |
| `display_name` | TEXT | YES | — | 20260512 | OAuth 영역 표시 이름 (탈퇴 시 보존) |
| `nickname` | TEXT | YES | `user_<8자>` | 20260512 | 자동 생성 영역 닉네임 (8자 prefix) |
| `avatar_url` | TEXT | YES | — | 20260512 | OAuth 영역 아바타 URL |
| `role` | TEXT | YES | NULL | 20260515 | CHECK: NULL OR 'user'/'admin'/'reviewer' |
| `is_premium` | BOOLEAN | YES | false | 추론 | Premium 상태 영역 |
| `subscription_tier` | TEXT | YES | 'free' | 20260425 | CHECK: 'free'/'pro' |
| `premium_until` | TIMESTAMPTZ | YES | — | 20260424 | Premium 만료 영역 (배치 영역 박음) |
| `stripe_customer_id` | TEXT | YES | — | 추론 (AdminUserDetail) | Stripe customer 영역 (현재 사용 X) |
| `scan_quota` | INTEGER | NO | 3 | 20260408001000 | 스캔 영역 잔여 영역 (CHECK >= 0) |
| `current_streak` | INTEGER | YES | 0 | 추론 | 연속 영역 연습일 영역 |
| `longest_streak` | INTEGER | YES | 0 | 추론 | 최장 영역 연속 영역 |
| `total_xp` | BIGINT | YES | 0 | 추론 | 누적 XP 영역 |
| `current_league` | TEXT | YES | — | 추론 | 현재 리그 영역 이름 |
| `last_practice_date` | DATE | YES | — | 20260516 trigger | 마지막 연습일 영역 (trg_update_profile_after_session 영역 박음) |
| `user_env_offset_ms` | INTEGER | YES | NULL | 20260503 | 캘리브레이션 영역 오프셋 (§7.3.2) |
| `locale` | TEXT | YES | — | 추론 (AdminUserDetail) | 언어 영역 (ko/en) |
| `country_code` | TEXT | YES | — | 추론 | 국가 영역 |
| `timezone` | TEXT | YES | — | 추론 | 타임존 영역 |
| `is_minor` | BOOLEAN | YES | — | 추론 | 미성년 영역 플래그 |
| `birth_year` | INTEGER | YES | — | 추론 | 생년 영역 |
| `birth_month` | INTEGER | YES | — | 추론 | 생월 영역 |
| `birth_day` | INTEGER | YES | — | 추론 | 생일 영역 |
| `profile_completed` | BOOLEAN | YES | true | 20260512 | 프로필 영역 완성 영역 (drift 정정) |
| `onboarding_completed` | BOOLEAN | YES | — | 추론 | 온보딩 영역 완료 영역 |
| `tos_agreed_at` | TIMESTAMPTZ | YES | — | 20260512 | TOS 영역 동의 시점 |
| `privacy_agreed_at` | TIMESTAMPTZ | YES | — | 20260512 | 개인정보 영역 동의 시점 |
| `marketing_agreed_at` | TIMESTAMPTZ | YES | — | 20260512 | 마케팅 영역 동의 시점 |
| `is_deleted` | BOOLEAN | YES | false | 20260511 | 탈퇴 영역 플래그 |
| `deleted_at` | TIMESTAMPTZ | YES | — | 20260511 | 탈퇴 시점 영역 |
| `deletion_reason` | TEXT | YES | — | 20260511 | 탈퇴 사유 영역 |
| `tier` | TEXT | YES | — | ⚠️ 확인 필요 | 20260509_mastery_score 영역 `COALESCE(p.tier, 'free')` 박힘 영역 (현재 컬럼 영역 존재 영역 추정) |
| `created_at` | TIMESTAMPTZ | NO | now() | 20260408001000 | 가입 영역 시점 |
| `updated_at` | TIMESTAMPTZ | NO | now() | 20260408001000 | trg_profiles_updated_at 영역 박음 |

### 1.5 인덱스 영역
- PK: `id`
- `idx_profiles_tier` ON `(subscription_tier)` (20260425)
- 부분 유니크 영역 nickname 영역 (20260513_preserve_nickname 영역 추정 — ⚠️ 확인 필요)

### 1.6 외래 키 영역
- `id` → `auth.users(id)` ON DELETE CASCADE

### 1.7 RLS 정책 영역 (요약)
- SELECT: `auth.uid() = id` (`Users can view own profile`)
- INSERT: `auth.uid() = id` (`Users can insert own profile`)
- UPDATE: `auth.uid() = id` (`Users can update own profile`)
- SELECT (admin): `public.is_admin()` (`Admins can view all profiles`)
> 상세 영역 → `02_RLS_POLICIES.md`

### 1.8 박는 영역 (INSERT/UPDATE)
| 코드 영역 | 박는 영역 |
|---|---|
| `handle_new_user_profile()` trigger (20260408001000 + 20260512) | INSERT (auth.users INSERT trigger 영역) |
| `src/lib/profile.ts:57` | UPDATE (프로필 영역 편집) |
| `src/lib/userEnvironmentOffset.ts:54` | UPDATE `user_env_offset_ms` |
| `src/hooks/useSessionRecorder.ts:374` | UPDATE `last_practice_date` (RPC 폴백 영역) |
| `src/pages/ProfilePage.tsx:102` | UPDATE `locale` |
| `src/pages/ProfilePage.tsx:156` | UPDATE (전체 영역 박음) |
| `src/pages/AuthCallback.tsx:66` | UPDATE consent 영역 (tos/privacy/marketing) |
| `request_account_deletion()` RPC (20260511 + 20260513_preserve_nickname) | UPDATE (탈퇴 마스킹) |
| `restore_account()` RPC (20260513) | UPDATE (탈퇴 복구) |
| `expire_premium_users()` RPC (20260424) | UPDATE `is_premium = false` |
| `trg_update_profile_after_session` (20260516) | UPDATE `last_practice_date` (user_sessions INSERT trigger) |

### 1.9 읽는 영역 (SELECT)
| 코드 영역 | 박는 영역 |
|---|---|
| `src/hooks/useProfile.ts:56` | 사용자 영역 프로필 영역 |
| `src/hooks/useUserStats.ts:86` | KPI 영역 (`current_streak`, `total_xp`, `current_league`, `last_practice_date`) |
| `src/lib/profile.ts:56` | 프로필 영역 조회 |
| `src/lib/userEnvironmentOffset.ts:53,65` | `user_env_offset_ms` 영역 |
| `src/hooks/useAdminUserDetail.ts:103` | 관리자 영역 전체 컬럼 영역 |
| `src/hooks/useAdminLogs.ts:63,112` | 관리자 영역 + 프로필 일괄 영역 |
| `src/hooks/useAdminUsers.ts:48` | 관리자 영역 사용자 목록 영역 |
| `check_email_exists()` RPC (20260513) | `is_deleted`, `deleted_at` 영역 |

### 1.10 관련 SQL 함수 영역
- `handle_new_user_profile()` — auth.users INSERT trigger
- `set_updated_at_profiles()` — UPDATE trigger
- `consume_scan_quota()`, `topup_scan_quota()` — 스캔 영역 차감/충전
- `request_account_deletion()`, `restore_account()`, `hard_delete_account()` — 탈퇴/복구/영구삭제
- `expire_premium_users()` — 일일 배치 영역
- `is_admin()`, `is_reviewer()` — 권한 영역 헬퍼

### 1.11 주의 영역 / 짚을 점
- ⚠️ `tier` 컬럼 영역 = `20260509_mastery_score.sql` 영역에서 `p.tier` 박힘. 후속 영역 20260509_fast_track 영역에서 `is_premium + subscription_tier + role` 영역 박힘으로 정정. `tier` 컬럼 영역 현재 존재 여부 영역 ⚠️ 확인 필요.
- ⚠️ `current_league`, `current_streak`, `longest_streak`, `total_xp`, `last_practice_date` 영역 = migration 영역 X. Dashboard 영역 직접 박힘 영역 추정.
- 탈퇴 시 닉네임·display_name·avatar_url 영역 보존 (20260513_preserve_nickname). 이메일만 마스킹 (`deleted_<id>@deleted.local`).
- `profile_completed` default = true (20260512 drift 정정).

### 1.12 데이터 예시 영역
```json
{
  "id": "uuid-xxxx",
  "email": "user@example.com",
  "nickname": "user_abcd1234",
  "display_name": "John",
  "role": null,
  "is_premium": false,
  "subscription_tier": "free",
  "scan_quota": 3,
  "current_streak": 5,
  "total_xp": 1234,
  "last_practice_date": "2026-05-17",
  "user_env_offset_ms": 150,
  "is_deleted": false,
  "created_at": "2026-04-15T10:00:00Z"
}
```

### 1.13 연관 테이블 영역 (조인 영역)
- `auth.users` (1:1, FK)
- `user_sessions` (1:N, user_id) — 게임 1회 영역
- `user_stats_daily` (1:N, user_id) — 날짜별 통계
- `user_sublevel_progress` (1:21, (user_id, level, sublevel))
- `daily_sessions` (1:N, user_id) — 일일 한도
- `payment_events` (1:N, user_id) — 결제 이력
- `note_mastery` (1:N, user_id) — 음표별 숙련도
- `league_members` (1:N, user_id) — 리그 멤버십
- `admin_actions` (1:N, admin_id / target_user_id)

---

## 2. `user_sessions`

### 2.1 한 줄 요약 영역
> 게임 1회 영역 종료 시 1행 INSERT 영역. 모든 게임 영역 결과 영역 박힘.

### 2.2 무엇 박는 영역인지
- 게임 1회 영역 시작/종료/duration 영역
- 정답 수·정확도·평균 반응시간·획득 XP 영역
- 음표별 시도 영역 (note_attempts JSONB)
- 요약 영역 (summary JSONB — 약점/강점 음표, end_reason, xp_breakdown, raw 반응시간, offset)

### 2.3 어디에 박는 영역인지 (사용 영역)
- 대시보드 영역 LastActivityCard (최근 세션 영역 박음)
- AI Coaching 영역 게임 결과 다이얼로그 (summary 영역 박음)
- 관리자 영역 사용자 상세 영역 (최근 20개)

### 2.4 컬럼 영역 (전체)

> ⚠️ **migration 영역 없음** — `src/` 영역 사용에서 추론.

| 컬럼 | 타입 (추론) | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | UUID PK | NO | gen_random_uuid() | useMyStats:67 | 세션 영역 식별자 |
| `user_id` | UUID FK | NO | — | useSessionRecorder:346 | `auth.users(id)` 영역 |
| `level` | INTEGER | NO | — | useSessionRecorder:347 | 게임 영역 레벨 (0=custom, 1-7=고정 영역) |
| `started_at` | TIMESTAMPTZ | NO | — | useSessionRecorder:348 | 게임 시작 영역 |
| `ended_at` | TIMESTAMPTZ | YES | — | useSessionRecorder:349 | 게임 종료 영역 |
| `duration_seconds` | INTEGER | YES | — | useSessionRecorder:350 | 게임 영역 진행 시간(초) |
| `total_notes` | INTEGER | NO | — | useSessionRecorder:351 | 출제 음표 수 |
| `correct_notes` | INTEGER | NO | — | useSessionRecorder:352 | 정답 음표 수 |
| `accuracy` | FLOAT | YES | — | useSessionRecorder:353 | 정확도 (0.0 ~ 1.0) |
| `avg_reaction_ms` | INTEGER | YES | — | useSessionRecorder:354 | 평균 반응시간(ms) — offset 적용된 영역 |
| `xp_earned` | INTEGER | NO | — | useSessionRecorder:355 | 획득 XP 영역 |
| `session_type` | TEXT | YES | NULL | useSessionRecorder:356 | 'regular'/'focus_mode'/'custom_score'/'tutorial' |
| `note_attempts` | JSONB | YES | — | useSessionRecorder:357 | 음표별 시도 (note·correct·reaction_ms·clef·accidental 영역) |
| `summary` | JSONB | YES | — | useSessionRecorder:358 | weak_notes·strong_notes·clefs·accidentals·xp_breakdown·offset 영역 |

### 2.5 인덱스 영역
- ⚠️ 확인 필요 (migration 영역 X). `user_id`, `started_at DESC` 영역 박힘 영역 추정.

### 2.6 외래 키 영역
- `user_id` → `auth.users(id)` (추정)

### 2.7 RLS 정책 영역
- SELECT: `auth.uid() = user_id` (`user_sessions_select_own`, 20260516)
- INSERT: `auth.uid() = user_id` (`user_sessions_insert_own`, 20260516)
- SELECT (admin): `public.is_admin()` (`user_sessions_admin_select`, 20260516)

### 2.8 박는 영역 (INSERT)
| 코드 영역 | 박는 영역 |
|---|---|
| `record_game_session()` RPC (20260517, SECURITY DEFINER) | INSERT — RLS 우회 영역 (reviewer 호환) |
| `src/hooks/useSessionRecorder.ts:344` | 직접 INSERT (RPC 실패 시 폴백) |

### 2.9 읽는 영역 (SELECT)
| 코드 영역 | 박는 영역 |
|---|---|
| `src/hooks/useMyStats.ts:65` | 최근 20개 (대시보드 영역) |
| `src/hooks/useAdminUserDetail.ts:112` | 관리자 영역 최근 20개 |

### 2.10 관련 SQL 함수 영역
- `record_game_session()` RPC (20260517) — INSERT + user_stats_daily UPSERT + profiles UPDATE 영역 원자적
- `update_profile_after_session()` trigger 함수 (20260516)

### 2.11 주의 영역 / 짚을 점
- ⚠️ **migration 영역 없음** — Supabase Dashboard 영역 직접 박힘 영역. 재현 가능 영역 X.
- ⚠️ `record_game_session()` RPC + 20260516 RLS migration 영역 = production apply 영역 필수. 미적용 시 reviewer 영역 INSERT 실패.
- `summary.offset_ms_applied` 영역 = 환경 보정 영역 추적 영역 (§7.3.2).
- `note_attempts[].reaction_ms` 영역 = corrected 영역, `reaction_ms_raw` 영역 = raw 영역.

### 2.12 데이터 예시 영역
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "level": 3,
  "started_at": "2026-05-17T10:00:00Z",
  "ended_at": "2026-05-17T10:01:30Z",
  "duration_seconds": 90,
  "total_notes": 20,
  "correct_notes": 18,
  "accuracy": 0.9,
  "avg_reaction_ms": 850,
  "xp_earned": 35,
  "session_type": "regular",
  "note_attempts": [
    { "note": "C4", "correct": true, "reaction_ms": 700, "reaction_ms_raw": 850, "clef": "treble", "accidental": null }
  ],
  "summary": {
    "weak_notes": ["F#4"],
    "strong_notes": ["C4", "G4"],
    "clefs": { "treble": 15, "bass": 5 },
    "accidentals": { "natural": 18, "sharp": 2 },
    "perfect": false,
    "end_reason": "completed",
    "xp_breakdown": { "basePoints": 18, "speedBonus": 12, "streakBonus": 5, "completionBonus": 20, "accuracyBonus": 15, "total": 70 },
    "avg_reaction_ms_raw": 1000,
    "offset_ms_applied": 150
  }
}
```

### 2.13 연관 테이블 영역
- `profiles` (user_id)
- `user_stats_daily` (record_game_session() 영역 원자적 UPSERT)

---

## 3. `user_sublevel_progress`

### 3.1 한 줄 요약 영역
> 21단계 영역 (Lv 1-1 ~ Lv 7-3) 사용자별 영역 진행 영역 1행씩.

### 3.2 무엇 박는 영역인지
- 각 sublevel 영역 누적 영역 (play_count, best_streak, total_attempts, total_correct, avg_reaction_ratio)
- 통과 여부 (passed, passed_at)
- 패스트트랙 (fast_track) — Premium 영역 1회 차 통과 영역
- 잠금 해제 시점 (unlocked_at)

### 3.3 어디에 박는 영역인지 (사용 영역)
- 레벨 선택 영역 (`useLevelProgress.ts` 영역 박음)
- 다음 sublevel 자동 잠금 해제 영역 (`record_sublevel_attempt()` 영역 박음)
- Mastery Score 계산 영역 (`get_mastery_score()` 영역 박음)

### 3.4 컬럼 영역 (전체)

| 컬럼 | 타입 | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `user_id` | UUID PK | NO | — | 20260425 | `profiles(id)` 영역 FK |
| `level` | INTEGER PK | NO | — | 20260425 | CHECK: 1-7 |
| `sublevel` | INTEGER PK | NO | — | 20260425 | CHECK: 1-3 |
| `play_count` | INTEGER | NO | 0 | 20260425 | 누적 플레이 영역 |
| `best_streak` | INTEGER | NO | 0 | 20260425 | 최장 연속 영역 |
| `total_attempts` | INTEGER | NO | 0 | 20260425 | 누적 시도 영역 |
| `total_correct` | INTEGER | NO | 0 | 20260425 | 누적 정답 영역 |
| `avg_reaction_ratio` | NUMERIC | YES | — | 20260509_pass_criteria_v2 | 평균 반응 영역 비율 (rolling avg) |
| `passed` | BOOLEAN | NO | false | 20260425 | 통과 영역 |
| `passed_at` | TIMESTAMPTZ | YES | — | 20260425 | 통과 시점 영역 |
| `fast_track` | BOOLEAN | NO | false | 20260509_fast_track | 패스트트랙 통과 영역 |
| `unlocked_at` | TIMESTAMPTZ | NO | NOW() | 20260425 | 잠금 해제 영역 |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | 20260425 | 갱신 시점 영역 |

### 3.5 인덱스 영역
- PK: `(user_id, level, sublevel)`
- `idx_progress_user` ON `(user_id)`
- `idx_progress_passed` ON `(user_id, passed)`

### 3.6 외래 키 영역
- `user_id` → `profiles(id)` ON DELETE CASCADE

### 3.7 RLS 정책 영역
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id` (20260510_rls_audit)
- SELECT (admin): `public.is_admin()`

### 3.8 박는 영역 (INSERT/UPDATE)
- `record_sublevel_attempt()` RPC (20260425 → 20260509_pass_criteria_v2 → 20260509_fast_track) — UPSERT
- 자동 잠금 해제 영역: 통과 시 다음 sublevel 자동 INSERT (RPC 영역)

### 3.9 읽는 영역 (SELECT)
| 코드 영역 | 박는 영역 |
|---|---|
| `src/hooks/useLevelProgress.ts:43` | 레벨 선택 영역 (`useLevelProgress` RPC 영역 박음) |
| `get_mastery_score()` RPC (20260509_mastery_score) | mastery 영역 계산 |

### 3.10 관련 SQL 함수 영역
- `record_sublevel_attempt(p_level, p_sublevel, p_attempts, p_correct, p_max_streak, p_game_status, p_avg_reaction_ratio)` — UPSERT + 통과 판정 + 자동 잠금 해제 + 패스트트랙
- `get_mastery_score(p_level, p_sublevel)` — 4-metric 25% 가중 영역 (0-100)

### 3.11 주의 영역 / 짚을 점
- 통과 기준 영역 (20260509_pass_criteria_v2): `play_count >= 10 AND best_streak >= 5 AND accuracy >= 0.85 AND avg_reaction_ratio <= 0.35`
- 패스트트랙 영역 조건: `tier in (premium/admin) AND sublevel >= 2 AND play_count == 0 AND session_accuracy >= 0.99 AND avg_reaction_ratio <= 0.5`
- mastery 영역 = 패스트트랙 통과 시 score=100 강제.

### 3.12 데이터 예시 영역
```json
{
  "user_id": "uuid",
  "level": 1,
  "sublevel": 2,
  "play_count": 12,
  "best_streak": 8,
  "total_attempts": 240,
  "total_correct": 220,
  "avg_reaction_ratio": 0.32,
  "passed": true,
  "passed_at": "2026-05-15T14:00:00Z",
  "fast_track": false,
  "unlocked_at": "2026-05-10T10:00:00Z"
}
```

### 3.13 연관 테이블 영역
- `profiles` (user_id, FK)

---

## 4. `user_note_logs`

### 4.1 한 줄 요약 영역
> 음표 1개 시도 영역 1행 (deprecated 가능성 — `user_sessions.note_attempts` JSONB 영역 박힘 영역).

### 4.2 무엇 박는 영역인지
- 음표 1개 영역 정답/오답 영역
- 응답 영역 시간 (response_time NUMERIC)
- 에러 영역 분류 (error_type TEXT)

### 4.3 어디에 박는 영역인지 (사용 영역)
- 통계 영역 (현재 영역 사용 영역 거의 X — `user_sessions` 영역 박음 영역으로 이동 추정)

### 4.4 컬럼 영역

| 컬럼 | 타입 | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | UUID PK | NO | gen_random_uuid() | 20260405 | — |
| `user_id` | UUID | NO | — | 20260405 | (FK 영역 X — `REFERENCES auth.users` 영역 없음) |
| `note_key` | TEXT | NO | — | 20260405 | 음표 영역 (예: "C4") |
| `octave` | INTEGER | NO | — | 20260405 | 옥타브 영역 |
| `clef` | TEXT | NO | 'treble' | 20260405 | treble/bass |
| `is_correct` | BOOLEAN | NO | — | 20260405 | 정답 여부 |
| `response_time` | NUMERIC(5,2) | YES | — | 20260405 | 응답 시간(초) |
| `error_type` | TEXT | YES | — | 20260405 | 에러 분류 |
| `level` | INTEGER | NO | 0 | 20260405 | 게임 영역 레벨 |
| `created_at` | TIMESTAMPTZ | NO | now() | 20260405 | 시도 시점 |

### 4.5 인덱스 영역
- `idx_note_logs_user_id` ON `(user_id)`
- `idx_note_logs_created_at` ON `(created_at DESC)`

### 4.6 외래 키 영역
- ⚠️ `user_id` 영역 FK 영역 명시 X (20260405 영역). 가입 영역 외 사용자 영역 INSERT 영역 가능 영역.

### 4.7 RLS 정책 영역
- SELECT: `auth.uid() = user_id` (TO authenticated 영역 X)
- INSERT: `auth.uid() = user_id`
- SELECT (admin): `public.is_admin()` (20260510_rls_audit)

### 4.8 박는 영역 (INSERT)
- `src/lib/userNoteLogs.ts:118` — INSERT

### 4.9 읽는 영역 (SELECT)
- `src/lib/userNoteLogs.ts:141` — SELECT

### 4.10 관련 SQL 함수 영역
- 없음

### 4.11 주의 영역 / 짚을 점
- ⚠️ **deprecated 가능성** — `user_sessions.note_attempts` JSONB 영역으로 동일 영역 데이터 영역 박힘.
- realtime publication 영역 등록됨 (20260405): `ALTER PUBLICATION supabase_realtime ADD TABLE public.user_note_logs;`
- FK 영역 없음 → 사용자 영역 삭제 영역 시 orphan 영역.

### 4.12 데이터 예시 영역
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "note_key": "C",
  "octave": 4,
  "clef": "treble",
  "is_correct": true,
  "response_time": 0.85,
  "error_type": null,
  "level": 3,
  "created_at": "2026-05-17T10:00:00Z"
}
```

### 4.13 연관 테이블 영역
- 없음 (FK 영역 없음)

---

## 5. `user_stats_daily`

### 5.1 한 줄 요약 영역
> 사용자 영역 × 날짜 영역 = 1행. 일일 집계 영역 (sessions, notes, XP, accuracy).

### 5.2 무엇 박는 영역인지
- 해당 날짜 영역 총 세션 수, 총 음표 수, 총 정답 수, 획득 XP
- 평균 정확도, 평균 반응시간, 총 진행 시간

### 5.3 어디에 박는 영역인지
- 대시보드 영역 30일 영역 차트
- 관리자 영역 사용자 상세 영역 (30일 영역)
- 주간 영역 KPI (`useUserStats.ts` 영역 박음 영역 7일 영역)

### 5.4 컬럼 영역

> ⚠️ **migration 영역 없음** — `src/` 영역 사용에서 추론.

| 컬럼 | 타입 (추론) | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `user_id` | UUID | NO | — | useMyStats:83 | (FK 추정) |
| `stat_date` | DATE | NO | — | useMyStats:85 | UTC 영역 날짜 |
| `sessions_count` | INTEGER | NO | 0 | useMyStats:81 | 해당 날짜 영역 세션 수 |
| `total_notes` | INTEGER | NO | 0 | useMyStats:81 | 해당 날짜 영역 총 음표 수 |
| `correct_notes` | INTEGER | NO | 0 | useMyStats:81 | 해당 날짜 영역 정답 수 |
| `xp_earned` | INTEGER | NO | 0 | useMyStats:81 | 해당 날짜 영역 획득 XP |
| `avg_accuracy` | FLOAT | YES | — | useMyStats:81 | 평균 정확도 |
| `avg_reaction_ms` | INTEGER | YES | — | useMyStats:81 | 평균 반응시간(ms) |
| `total_duration_seconds` | INTEGER | NO | 0 | useMyStats:81 | 총 진행 시간 |

### 5.5 인덱스 영역
- PK 영역 추정: `(user_id, stat_date)` (record_game_session 영역 `ON CONFLICT (user_id, stat_date)` 박힘)
- ⚠️ 추가 인덱스 영역 확인 필요

### 5.6 외래 키 영역
- `user_id` → `auth.users(id)` (추정)

### 5.7 RLS 정책 영역
- ⚠️ 확인 필요 (migration 영역 X). `auth.uid() = user_id` 영역 박힘 영역 추정.

### 5.8 박는 영역 (INSERT/UPDATE)
- `record_game_session()` RPC (20260517) — UPSERT (`ON CONFLICT (user_id, stat_date) DO UPDATE`)
  - sessions_count + 1
  - total_notes + p_total_notes
  - correct_notes + p_correct_notes
  - xp_earned + p_xp_earned
  - avg_accuracy = (correct_notes + p_correct_notes) / (total_notes + p_total_notes)
  - avg_reaction_ms = rolling 영역 계산
  - total_duration_seconds + p_duration_seconds

### 5.9 읽는 영역 (SELECT)
| 코드 영역 | 박는 영역 |
|---|---|
| `src/hooks/useMyStats.ts:79` | 30일 영역 |
| `src/hooks/useUserStats.ts:104` | 7일 영역 |
| `src/hooks/useAdminUserDetail.ts:127` | 관리자 영역 30일 |

### 5.10 관련 SQL 함수 영역
- `record_game_session()` RPC (UPSERT)

### 5.11 주의 영역 / 짚을 점
- ⚠️ **migration 영역 없음** — Dashboard 직접 박힘.
- ⚠️ record_game_session 영역 미적용 시 `user_stats_daily` 영역 절대 박지 X (silent fail).
- UTC 영역 기준 영역 (`(NOW() AT TIME ZONE 'UTC')::DATE`).

### 5.12 데이터 예시 영역
```json
{
  "user_id": "uuid",
  "stat_date": "2026-05-17",
  "sessions_count": 3,
  "total_notes": 60,
  "correct_notes": 54,
  "xp_earned": 105,
  "avg_accuracy": 0.9,
  "avg_reaction_ms": 850,
  "total_duration_seconds": 270
}
```

### 5.13 연관 테이블 영역
- `profiles` (user_id)
- `user_sessions` (간접 영역 — record_game_session 영역 박음)

---

## 6. `note_mastery`

### 6.1 한 줄 요약 영역
> 사용자 영역 × 음표 영역 = 1행. 음표별 영역 누적 영역 숙련도.

### 6.2 무엇 박는 영역인지
- 음표별 영역 누적 시도·정답
- 최근 정확도 (rolling — 영역 산출 함수 미상)
- 평균 반응시간
- 약점 영역 플래그 (weakness_flag) — 일일 배치 영역 박음
- 숙련 영역 플래그 (mastery_flag) — 일일 배치 영역 박음
- trend 영역 (improving/stable/declining 영역 추정)

### 6.3 어디에 박는 영역인지
- 대시보드 영역 약점 음표 영역 Top 5
- 관리자 영역 사용자 상세 영역
- 일일 배치 영역 (run_daily_batch_analysis)

### 6.4 컬럼 영역

> ⚠️ **migration 영역 없음** — 20260424 영역 `note_mastery` 영역 ALTER 영역 박힘 영역 + `src/` 영역 사용 영역 추론.

| 컬럼 | 타입 (추론) | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `user_id` | UUID | NO | — | useMyStats:94 | (FK 추정) |
| `note_key` | TEXT | NO | — | useMyStats:92 | 음표 영역 (예: "C4") |
| `clef` | TEXT | NO | — | useMyStats:92 | treble/bass |
| `total_attempts` | INTEGER | NO | 0 | useMyStats:92 | 누적 시도 |
| `correct_count` | INTEGER | NO | 0 | useMyStats:92 | 누적 정답 |
| `recent_accuracy` | FLOAT | YES | — | useMyStats:92 | 최근 영역 정확도 (산출 영역 미상) |
| `mastery_level` | INTEGER | YES | — | useAdminUserDetail:141 | 영역 0-N (정의 영역 미상) |
| `avg_reaction_ms` | INTEGER | YES | — | useMyStats:92 | 평균 반응시간 |
| `trend` | TEXT | YES | — | useMyStats:92 | 영역 (improving/stable/declining 추정) |
| `last_seen_at` | TIMESTAMPTZ | YES | — | 20260424 | 마지막 시도 영역 |
| `weakness_flag` | BOOLEAN | NO | false | 20260424 | 약점 영역 플래그 |
| `weakness_flagged_at` | TIMESTAMPTZ | YES | — | 20260424 | 약점 영역 박힌 시점 |
| `mastery_flag` | BOOLEAN | NO | false | 20260424 | 숙련 영역 플래그 |
| `mastery_flagged_at` | TIMESTAMPTZ | YES | — | 20260424 | 숙련 영역 박힌 시점 |
| `last_batch_analyzed_at` | TIMESTAMPTZ | YES | — | 20260424 | 마지막 배치 영역 분석 시점 |

### 6.5 인덱스 영역
- PK 영역 추정: `(user_id, note_key, clef)` ⚠️ 확인 필요

### 6.6 외래 키 영역
- `user_id` → `auth.users(id)` (추정)

### 6.7 RLS 정책 영역
- ⚠️ 확인 필요 (migration 영역 X).

### 6.8 박는 영역 (INSERT/UPDATE)
- ⚠️ **INSERT 영역 코드 영역 X** — `user_sessions` INSERT 영역 trigger 영역 박힘 영역 추정 (확인 필요)
- `run_daily_batch_analysis()` RPC (20260424) — weakness_flag, mastery_flag 영역 UPDATE

### 6.9 읽는 영역 (SELECT)
| 코드 영역 | 박는 영역 |
|---|---|
| `src/hooks/useMyStats.ts:90` | 약점 영역 Top 10 |
| `src/hooks/useMasteryDetails.ts:61` | 상세 영역 |
| `src/hooks/useUserMastery.ts:49` | 전체 영역 |
| `src/hooks/useAdminUserDetail.ts:139` | 관리자 영역 |

### 6.10 관련 SQL 함수 영역
- `run_daily_batch_analysis()` (20260424) — weakness/mastery 영역 박힘

### 6.11 주의 영역 / 짚을 점
- ⚠️ **INSERT/UPDATE 영역 진입점 영역 명확 X** — note_mastery 영역 갱신 trigger 영역 박힘 여부 영역 ⚠️ 확인 필요. 미박힐 영역 시 일일 배치 영역에서 dataset 영역 0건 영역.
- 약점 영역 정의: `total_attempts >= 5 AND (recent_accuracy < 0.60 OR avg_reaction_ms > 3000)` (20260424)
- 약점 영역 해제: `recent_accuracy >= 0.85`
- 숙련 영역 정의: `total_attempts >= 20 AND recent_accuracy >= 0.95`

### 6.12 데이터 예시 영역
```json
{
  "user_id": "uuid",
  "note_key": "F",
  "clef": "treble",
  "total_attempts": 30,
  "correct_count": 24,
  "recent_accuracy": 0.78,
  "mastery_level": 2,
  "avg_reaction_ms": 950,
  "trend": "improving",
  "weakness_flag": false,
  "mastery_flag": false,
  "last_seen_at": "2026-05-17T10:00:00Z"
}
```

### 6.13 연관 테이블 영역
- `profiles` (user_id)
- `user_sessions` (간접 영역 — 갱신 영역 진입점 영역 ⚠️ 확인 필요)

---

## 7. `daily_sessions`

### 7.1 한 줄 요약 영역
> 사용자 영역 × UTC 날짜 영역 = 1행. 일일 영역 한도 카운터.

### 7.2 무엇 박는 영역인지
- 사용자 영역 일일 영역 게임 시작 횟수 영역 (한도: Guest 3 / Free 7 / Premium 무제한)

### 7.3 어디에 박는 영역인지
- 게임 영역 시작 직전 영역 (`useDailyLimit.ts` 영역 박음)

### 7.4 컬럼 영역

| 컬럼 | 타입 | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | UUID PK | NO | gen_random_uuid() | 20260509 | — |
| `user_id` | UUID | NO | — | 20260509 | `auth.users(id)` FK ON DELETE CASCADE |
| `session_date` | DATE | NO | — | 20260509 | UTC 영역 날짜 |
| `session_count` | INTEGER | NO | 0 | 20260509 | 해당 날짜 영역 누적 영역 카운트 |
| `created_at` | TIMESTAMPTZ | NO | NOW() | 20260509 | — |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | 20260509 | — |

### 7.5 인덱스 영역
- UNIQUE: `(user_id, session_date)`
- `idx_daily_sessions_user_date` ON `(user_id, session_date DESC)`

### 7.6 외래 키 영역
- `user_id` → `auth.users(id)` ON DELETE CASCADE

### 7.7 RLS 정책 영역
- SELECT: `auth.uid() = user_id` (`daily_sessions_select_own`)
- INSERT: `auth.uid() = user_id` (`daily_sessions_insert_own`)
- UPDATE: `auth.uid() = user_id` (`daily_sessions_update_own`)
- DELETE: `auth.uid() = user_id` (`daily_sessions_delete_own`, 20260510_rls_audit)
- SELECT (admin): `public.is_admin()` (20260510_rls_audit)

### 7.8 박는 영역 (INSERT/UPDATE)
- `increment_daily_session()` RPC (20260509) — UPSERT (`ON CONFLICT (user_id, session_date)`)
- 호출 영역: `src/hooks/useDailyLimit.ts:132`

### 7.9 읽는 영역 (SELECT)
- `get_today_session_count()` RPC (20260509)
- 호출 영역: `src/hooks/useDailyLimit.ts:110`

### 7.10 관련 SQL 함수 영역
- `increment_daily_session()` — UPSERT + count 반환
- `get_today_session_count()` — UTC 오늘 영역 count 조회 (STABLE)

### 7.11 주의 영역 / 짚을 점
- UTC 영역 기준 — 한국 영역 시점 00:00 ≠ UTC 영역 00:00.
- Premium 영역 = DB 영역 호출 X (클라이언트 영역 분기).
- `tier_snapshot` 컬럼 영역 없음 — tier 영역 = profiles 영역 자체.

### 7.12 데이터 예시 영역
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "session_date": "2026-05-17",
  "session_count": 5,
  "created_at": "2026-05-17T09:00:00Z",
  "updated_at": "2026-05-17T14:30:00Z"
}
```

### 7.13 연관 테이블 영역
- `profiles` (user_id)

---

## 8. `payment_events`

### 8.1 한 줄 요약 영역
> 결제 영역 1건 = 1행. `event_id` 영역 UNIQUE = idempotent 영역 보장.

### 8.2 무엇 박는 영역인지
- 결제 영역 provider (iap), event_id, checkout_session_id
- 적립 영역 credits, 금액, 통화
- 상태 (status = 'completed' 기본)

### 8.3 어디에 박는 영역인지
- Stripe/IAP 영역 webhook 영역 박음 (PENDING — 영역 현재 production 미박힘)

### 8.4 컬럼 영역

| 컬럼 | 타입 | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | UUID PK | NO | gen_random_uuid() | 20260408003000 | — |
| `provider` | TEXT | NO | 'iap' | 20260408003000 | — |
| `event_id` | TEXT UNIQUE | NO | — | 20260408003000 | Idempotency key |
| `checkout_session_id` | TEXT | YES | — | 20260408003000 | — |
| `user_id` | UUID | NO | — | 20260408003000 | `auth.users(id)` FK ON DELETE CASCADE |
| `package_id` | TEXT | NO | — | 20260408003000 | — |
| `credits_added` | INTEGER | NO | — | 20260408003000 | CHECK > 0 |
| `amount_cents` | INTEGER | YES | — | 20260408003000 | — |
| `currency` | TEXT | YES | — | 20260408003000 | — |
| `status` | TEXT | NO | 'completed' | 20260408003000 | — |
| `created_at` | TIMESTAMPTZ | NO | now() | 20260408003000 | — |

### 8.5 인덱스 영역
- PK: `id`
- UNIQUE: `event_id`
- `idx_payment_events_user_id_created_at` ON `(user_id, created_at DESC)`

### 8.6 외래 키 영역
- `user_id` → `auth.users(id)` ON DELETE CASCADE

### 8.7 RLS 정책 영역
- SELECT: `auth.uid() = user_id` (`Users can view own payments`)
- INSERT: ⚠️ 직접 INSERT 영역 금지 — `apply_payment_topup()` RPC 영역 전용 (SECURITY DEFINER)
- SELECT (admin): `public.is_admin()` (20260510_rls_audit)

### 8.8 박는 영역 (INSERT)
- `apply_payment_topup()` RPC (20260408003000) — INSERT + `topup_scan_quota` 호출 영역 원자적

### 8.9 읽는 영역 (SELECT)
- ⚠️ src/ 영역 참조 영역 X (아직 사용 영역 X)

### 8.10 관련 SQL 함수 영역
- `apply_payment_topup(p_event_id, p_user_id, p_package_id, p_credits_added, p_checkout_session_id, p_amount_cents, p_currency)` — INSERT + ON CONFLICT DO NOTHING + scan_quota 갱신

### 8.11 주의 영역 / 짚을 점
- idempotent 영역 = 동일 `event_id` 영역 재전송 영역 시 INSERT 영역 X, 기존 quota 영역만 반환.
- 결제 영역 시스템 영역 production 영역 박힘 영역 X (PENDING).

### 8.12 데이터 예시 영역
```json
{
  "id": "uuid",
  "provider": "iap",
  "event_id": "stripe_evt_abc123",
  "user_id": "uuid",
  "package_id": "scan_pack_10",
  "credits_added": 10,
  "amount_cents": 990,
  "currency": "USD",
  "status": "completed",
  "created_at": "2026-05-17T10:00:00Z"
}
```

### 8.13 연관 테이블 영역
- `profiles` (scan_quota 영역 박음)

---

## 9. `leagues`

### 9.1 한 줄 요약 영역
> 리그 영역 정의 영역 (Bronze, Silver, ..., Diamond). 현재 UI 영역 비활성 영역.

### 9.2 무엇 박는 영역인지
- 리그 영역 이름, 랭크, 아이콘, 색상, 설명

### 9.3 어디에 박는 영역인지
- ⚠️ UI 영역 비활성 (`/dashboard` 영역에서 LEAGUE 영역 제거 — 작업 #27)
- `useUserStats.ts:136` 영역 박힘 영역 (legacy 영역)

### 9.4 컬럼 영역

> ⚠️ **migration 영역 없음** — `useUserStats.ts` 영역에서 추론.

| 컬럼 | 타입 (추론) | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | INTEGER PK | NO | — | useUserStats:137 | — |
| `name` | TEXT | NO | — | useUserStats:137 | 리그 영역 이름 |
| `rank` | INTEGER | NO | — | useUserStats:137 | 순위 영역 |
| `icon` | TEXT | YES | — | useUserStats:137 | 아이콘 |
| `color` | TEXT | YES | — | useUserStats:137 | 색상 |
| `description` | TEXT | YES | — | useUserStats:137 | 설명 |

### 9.5 인덱스 영역
- ⚠️ 확인 필요

### 9.6 외래 키 영역
- 없음

### 9.7 RLS 정책 영역
- ⚠️ 확인 필요

### 9.8 박는 영역 (INSERT)
- ⚠️ migration X, src/ 영역 INSERT X — Dashboard 영역 seed 영역 박힘 영역 추정

### 9.9 읽는 영역 (SELECT)
- `src/hooks/useUserStats.ts:136`

### 9.10 관련 SQL 함수 영역
- 없음

### 9.11 주의 영역 / 짚을 점
- ⚠️ UI 영역 비활성 영역 — 향후 영역 부활 영역 PENDING.

### 9.12 데이터 예시 영역
```json
{ "id": 1, "name": "Bronze", "rank": 1, "icon": "🥉", "color": "#cd7f32", "description": "..." }
```

### 9.13 연관 테이블 영역
- `profiles.current_league` (TEXT — name 영역 박힘 영역 매칭)
- `league_members` (간접)

---

## 10. `league_members`

### 10.1 한 줄 요약 영역
> 사용자 영역 × 리그 영역 그룹 = 1행. 주간 영역 XP·랭킹.

### 10.2 무엇 박는 영역인지
- 주간 영역 XP 누적 영역
- 그룹 내 랭킹 (rank_in_group)
- 그룹 ID (group_id)

### 10.3 어디에 박는 영역인지
- ⚠️ UI 영역 비활성

### 10.4 컬럼 영역

> ⚠️ **migration 영역 없음** — `useUserStats.ts:148` 영역에서 추론.

| 컬럼 | 타입 (추론) | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `user_id` | UUID | NO | — | useUserStats:149 | — |
| `weekly_xp` | INTEGER | NO | 0 | useUserStats:148 | 주간 영역 XP |
| `rank_in_group` | INTEGER | YES | — | useUserStats:148 | 그룹 내 랭킹 |
| `group_id` | TEXT | NO | — | useUserStats:148 | 그룹 영역 식별 |
| `joined_at` | TIMESTAMPTZ | YES | — | useUserStats:148 | 가입 시점 |

### 10.5 인덱스 영역
- ⚠️ 확인 필요

### 10.6 외래 키 영역
- ⚠️ 확인 필요 (`user_id` FK 추정)

### 10.7 RLS 정책 영역
- ⚠️ 확인 필요

### 10.8 박는 영역
- ⚠️ migration X, src/ 영역 INSERT X

### 10.9 읽는 영역 (SELECT)
- `src/hooks/useUserStats.ts:147`

### 10.10 관련 SQL 함수 영역
- ⚠️ 확인 필요

### 10.11 주의 영역
- ⚠️ UI 영역 비활성, 주간 영역 갱신 영역 메커니즘 영역 확인 X.

### 10.12 데이터 예시 영역
```json
{ "user_id": "uuid", "weekly_xp": 350, "rank_in_group": 5, "group_id": "wk_2026_20_bronze_001", "joined_at": "2026-05-13T00:00:00Z" }
```

### 10.13 연관 테이블 영역
- `profiles` (user_id)
- `leagues` (간접)

---

## 11. `admin_actions`

### 11.1 한 줄 요약 영역
> 관리자 영역 액션 영역 감사 로그.

### 11.2 무엇 박는 영역인지
- 관리자 ID, 액션 유형, 대상 사용자 ID, 상세 (JSONB), IP, User-Agent

### 11.3 어디에 박는 영역인지
- 관리자 영역 페이지 영역 로그 영역 표시

### 11.4 컬럼 영역

> ⚠️ **migration 영역 없음** — `useAdminLogs.ts` 영역에서 추론.

| 컬럼 | 타입 (추론) | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | UUID PK | NO | gen_random_uuid() | useAdminLogs:78 | — |
| `admin_id` | UUID | NO | — | useAdminLogs:78 | profiles(id) 영역 |
| `action_type` | TEXT | NO | — | useAdminLogs:78 | grant_premium/revoke_premium/... |
| `target_user_id` | UUID | YES | — | useAdminLogs:78 | profiles(id) 영역 |
| `details` | JSONB | YES | — | useAdminLogs:78 | — |
| `ip_address` | TEXT | YES | — | useAdminLogs:78 | — |
| `user_agent` | TEXT | YES | — | useAdminLogs:78 | — |
| `created_at` | TIMESTAMPTZ | NO | now() | useAdminLogs:78 | — |

### 11.5 인덱스 영역
- ⚠️ 확인 필요

### 11.6 외래 키 영역
- ⚠️ 확인 필요 (`admin_id`/`target_user_id` 영역 FK 추정)

### 11.7 RLS 정책 영역
- ⚠️ 확인 필요 (관리자 영역만 SELECT 추정)

### 11.8 박는 영역 (INSERT)
- ⚠️ src/ 영역 INSERT 영역 없음 — 별도 영역 RPC 영역 박힘 영역 추정

### 11.9 읽는 영역 (SELECT)
- `src/hooks/useAdminLogs.ts:76`

### 11.10 관련 SQL 함수 영역
- ⚠️ 확인 필요

### 11.11 주의 영역
- ⚠️ migration 영역 없음.
- action_type 영역 라벨 (KO): `useAdminLogs.ts:28-42`.

### 11.12 데이터 예시 영역
```json
{ "id": "uuid", "admin_id": "uuid", "action_type": "grant_premium", "target_user_id": "uuid",
  "details": { "days": 30 }, "ip_address": "1.2.3.4", "user_agent": "Mozilla/...", "created_at": "2026-05-17T10:00:00Z" }
```

### 11.13 연관 테이블 영역
- `profiles` (admin_id, target_user_id)

---

## 12. `daily_batch_runs`

### 12.1 한 줄 요약 영역
> 일일 배치 영역 실행 영역 1건 = 1행. 영역 메타 (성공/실패/duration).

### 12.2 무엇 박는 영역인지
- run_date, users_analyzed, weakness_flagged, mastery_flagged, weakness_released, premium_expired, duration_ms, status, error_message

### 12.3 어디에 박는 영역인지
- 관리자 영역 페이지 (`useBatchRuns.ts` 영역 박음)

### 12.4 컬럼 영역

> ⚠️ **CREATE 영역 마이그 X** — `20260424_premium_expiry.sql` 영역에서 `premium_expired` 컬럼 ALTER 영역만 박힘. `useBatchRuns.ts` 영역에서 추론.

| 컬럼 | 타입 (추론) | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | UUID PK | NO | gen_random_uuid() | useBatchRuns:5 | — |
| `run_date` | DATE | NO | — | useBatchRuns:6 | UNIQUE 영역 추정 (재실행 영역 차단 영역 박힘) |
| `users_analyzed` | INTEGER | NO | 0 | useBatchRuns:7 | — |
| `weakness_flagged` | INTEGER | NO | 0 | useBatchRuns:8 | — |
| `mastery_flagged` | INTEGER | NO | 0 | useBatchRuns:9 | — |
| `weakness_released` | INTEGER | NO | 0 | useBatchRuns:10 | — |
| `premium_expired` | INTEGER | NO | 0 | 20260424 | — |
| `duration_ms` | INTEGER | NO | 0 | useBatchRuns:12 | — |
| `status` | TEXT | NO | — | useBatchRuns:13 | 'success'/'partial'/'failed' |
| `error_message` | TEXT | YES | — | useBatchRuns:14 | — |
| `created_at` | TIMESTAMPTZ | NO | now() | useBatchRuns:15 | — |

### 12.5 인덱스 영역
- PK: `id`
- UNIQUE 추정: `run_date` (20260424 영역 `ON CONFLICT (run_date)` 박힘)

### 12.6 외래 키 영역
- 없음

### 12.7 RLS 정책 영역
- ⚠️ 확인 필요 (관리자 영역만 SELECT 추정)

### 12.8 박는 영역 (INSERT)
- `run_daily_batch_analysis()` RPC (20260424) — INSERT (성공/실패 영역 모두)

### 12.9 읽는 영역 (SELECT)
- `src/hooks/useBatchRuns.ts:54` — 최근 30일

### 12.10 관련 SQL 함수 영역
- `run_daily_batch_analysis()` (20260424)
- `expire_premium_users()` (20260424)

### 12.11 주의 영역
- ⚠️ CREATE 영역 마이그 X.
- 동일 영역 run_date 영역 = 재실행 영역 차단 영역 (NOTICE 영역 박힘).

### 12.12 데이터 예시 영역
```json
{ "id": "uuid", "run_date": "2026-05-17", "users_analyzed": 142,
  "weakness_flagged": 8, "mastery_flagged": 3, "weakness_released": 5,
  "premium_expired": 0, "duration_ms": 1250, "status": "success", "error_message": null,
  "created_at": "2026-05-17T00:00:01Z" }
```

### 12.13 연관 테이블 영역
- `note_mastery` (UPDATE 영역 박힘)
- `profiles` (is_premium 영역 박힘)

---

## 13. `user_custom_scores`

### 13.1 한 줄 요약 영역
> 사용자 영역 커스텀 점수 영역 (스캔 영역 결과 영역 박힘 영역).

### 13.2 무엇 박는 영역인지
- 스캔 영역 곡 제목 + JSONB note_data

### 13.3 어디에 박는 영역인지
- 스캔 영역 결과 영역 저장 영역 (PENDING)

### 13.4 컬럼 영역

| 컬럼 | 타입 | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | UUID PK | NO | gen_random_uuid() | 20260404 | — |
| `user_id` | UUID | NO | — | 20260404 | `auth.users(id)` ON DELETE CASCADE |
| `score_title` | TEXT | NO | — | 20260404 | — |
| `note_data` | JSONB | NO | — | 20260404 | 스캔 영역 결과 |
| `created_at` | TIMESTAMPTZ | NO | now() | 20260404 | — |

### 13.5 인덱스 영역
- `idx_user_custom_scores_user_id` ON `(user_id)`

### 13.6 외래 키 영역
- `user_id` → `auth.users(id)` ON DELETE CASCADE

### 13.7 RLS 정책 영역
- SELECT/INSERT/UPDATE/DELETE: `auth.uid() = user_id`
- SELECT (admin): `public.is_admin()` (20260510_rls_audit)

### 13.8 박는 영역 (INSERT)
- ⚠️ src/ 영역 INSERT 영역 코드 영역 X (현재)

### 13.9 읽는 영역 (SELECT)
- ⚠️ src/ 영역 SELECT 영역 코드 영역 X (현재)

### 13.10 관련 SQL 함수 영역
- 없음

### 13.11 주의 영역
- ⚠️ 현재 사용 영역 X (PENDING).

### 13.12 데이터 예시 영역
```json
{ "id": "uuid", "user_id": "uuid", "score_title": "곡 제목", "note_data": [/* ... */], "created_at": "..." }
```

### 13.13 연관 테이블 영역
- `profiles` (user_id)

---

## 14. `user_scores`

### 14.1 한 줄 요약 영역
> 사용자 영역 업로드 영역 악보 영역 (1곡 = 1행). 영역 PENDING.

### 14.2 무엇 박는 영역인지
- 곡 제목, 상태 (IN_PROGRESS/COMPLETED/DISCONTINUED), discontinued_at

### 14.3 어디에 박는 영역인지
- ⚠️ PENDING

### 14.4 컬럼 영역

| 컬럼 | 타입 | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | BIGSERIAL PK | NO | — | 20260410165000 | — |
| `user_id` | UUID | NO | — | 20260410165000 | `auth.users(id)` ON DELETE CASCADE |
| `title` | VARCHAR(255) | NO | — | 20260410165000 | — |
| `status` | VARCHAR(50) | YES | 'IN_PROGRESS' | 20260410165000 | CHECK: IN_PROGRESS/COMPLETED/DISCONTINUED |
| `discontinued_at` | TIMESTAMPTZ | YES | — | 20260410165000 | — |
| `created_at` | TIMESTAMPTZ | YES | NOW() | 20260410165000 | — |
| `updated_at` | TIMESTAMPTZ | YES | NOW() | 20260410165000 | trg_user_scores_updated_at |

### 14.5 인덱스 영역
- PK: `id`

### 14.6 외래 키 영역
- `user_id` → `auth.users(id)` ON DELETE CASCADE

### 14.7 RLS 정책 영역
- SELECT/INSERT/UPDATE/DELETE: `auth.uid() = user_id`
- SELECT (admin): `public.is_admin()` (20260510_rls_audit)

### 14.8 박는 영역 (INSERT)
- ⚠️ src/ 영역 INSERT X

### 14.9 읽는 영역
- ⚠️ src/ 영역 SELECT X

### 14.10 관련 SQL 함수 영역
- `set_updated_at_user_scores()` trigger

### 14.11 주의 영역
- ⚠️ 현재 사용 영역 X (PENDING).

### 14.12 데이터 예시 영역
```json
{ "id": 1, "user_id": "uuid", "title": "Moonlight Sonata", "status": "IN_PROGRESS",
  "discontinued_at": null, "created_at": "...", "updated_at": "..." }
```

### 14.13 연관 테이블 영역
- `practice_logs` (1:N)

---

## 15. `practice_logs`

### 15.1 한 줄 요약 영역
> 악보 영역 1마디 영역 1음표 영역 영역 시도 = 1행. 영역 PENDING.

### 15.2 무엇 박는 영역인지
- 마디 번호, 예상 음표, 연주 음표, 반응시간, 정답 여부

### 15.3 어디에 박는 영역인지
- ⚠️ PENDING

### 15.4 컬럼 영역

| 컬럼 | 타입 | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | BIGSERIAL PK | NO | — | 20260410165000 | — |
| `score_id` | BIGINT | NO | — | 20260410165000 | `user_scores(id)` ON DELETE CASCADE |
| `user_id` | UUID | NO | — | 20260410165000 | `auth.users(id)` ON DELETE CASCADE |
| `measure_number` | INTEGER | NO | — | 20260410165000 | — |
| `expected_note` | VARCHAR(10) | NO | — | 20260410165000 | — |
| `played_note` | VARCHAR(10) | YES | — | 20260410165000 | — |
| `reaction_time_ms` | INTEGER | NO | — | 20260410165000 | — |
| `is_correct` | BOOLEAN | NO | — | 20260410165000 | — |
| `created_at` | TIMESTAMPTZ | YES | NOW() | 20260410165000 | — |

### 15.5 인덱스 영역
- `idx_practice_logs_user_score` ON `(user_id, score_id)`

### 15.6 외래 키 영역
- `score_id` → `user_scores(id)` ON DELETE CASCADE
- `user_id` → `auth.users(id)` ON DELETE CASCADE

### 15.7 RLS 정책 영역
- SELECT/INSERT: `auth.uid() = user_id` (20260410170000)
- UPDATE/DELETE: `auth.uid() = user_id` (20260510_rls_audit)
- SELECT (admin): `public.is_admin()` (20260510_rls_audit)

### 15.8 박는 영역
- ⚠️ src/ 영역 INSERT X

### 15.9 읽는 영역
- ⚠️ src/ 영역 SELECT X

### 15.10 관련 SQL 함수 영역
- 없음

### 15.11 주의 영역
- ⚠️ 현재 사용 영역 X (PENDING).

### 15.12 데이터 예시 영역
```json
{ "id": 1, "score_id": 1, "user_id": "uuid", "measure_number": 3,
  "expected_note": "C4", "played_note": "C4", "reaction_time_ms": 850, "is_correct": true,
  "created_at": "..." }
```

### 15.13 연관 테이블 영역
- `user_scores` (score_id, FK)

---

## 16. `device_change_events`

### 16.1 한 줄 요약 영역
> 오디오 영역 장치 영역 변경 영역 = 1행. §7.3 영역 캘리브레이션 영역 트리거 추적.

### 16.2 무엇 박는 영역인지
- 장치 종류 (TEXT[]), 재캘리브레이션 트리거 여부, 이전/신규 offset_ms, User-Agent

### 16.3 어디에 박는 영역인지
- `src/lib/userEnvironmentOffset.ts` (오디오 영역 디바이스 영역 변경 감지)

### 16.4 컬럼 영역

| 컬럼 | 타입 | NULL | default | 박힌 영역 | 설명 |
|---|---|---|---|---|---|
| `id` | UUID PK | NO | gen_random_uuid() | 20260503 | — |
| `user_id` | UUID | NO | — | 20260503 | `auth.users(id)` ON DELETE CASCADE |
| `event_at` | TIMESTAMPTZ | NO | NOW() | 20260503 | — |
| `device_kinds` | TEXT[] | NO | — | 20260503 | — |
| `triggered_recalibration` | BOOLEAN | NO | FALSE | 20260503 | — |
| `previous_offset_ms` | INTEGER | YES | — | 20260503 | — |
| `new_offset_ms` | INTEGER | YES | — | 20260503 | — |
| `user_agent` | TEXT | YES | — | 20260503 | — |
| `created_at` | TIMESTAMPTZ | NO | NOW() | 20260503 | — |

### 16.5 인덱스 영역
- `idx_device_change_events_user_id` ON `(user_id)`
- `idx_device_change_events_event_at` ON `(event_at DESC)`

### 16.6 외래 키 영역
- `user_id` → `auth.users(id)` ON DELETE CASCADE

### 16.7 RLS 정책 영역
- SELECT: `auth.uid() = user_id` (`Users can view own device change events`)
- INSERT: `auth.uid() = user_id` (`Users can insert own device change events`)
- SELECT (admin): `public.is_admin()`

### 16.8 박는 영역 (INSERT/UPDATE)
- `src/lib/userEnvironmentOffset.ts:112` — INSERT (장치 변경 감지 영역)
- `src/lib/userEnvironmentOffset.ts:135` — UPDATE `new_offset_ms` (재캘리브레이션 영역 완료 후)

### 16.9 읽는 영역 (SELECT)
- ⚠️ src/ 영역 SELECT 영역 직접 영역 없음 — 관리자 영역 분석 영역 박힘 영역 PENDING

### 16.10 관련 SQL 함수 영역
- 없음

### 16.11 주의 영역
- §7.10: false positive 영역 빈도 영역 분석 후 audio output 전용 감지 영역 보강 영역 PENDING.

### 16.12 데이터 예시 영역
```json
{ "id": "uuid", "user_id": "uuid", "event_at": "...",
  "device_kinds": ["audioinput", "audiooutput"],
  "triggered_recalibration": true,
  "previous_offset_ms": 150, "new_offset_ms": 175,
  "user_agent": "Mozilla/...", "created_at": "..." }
```

### 16.13 연관 테이블 영역
- `profiles` (user_env_offset_ms 영역 박힘 영역 연동)

---

## 부록 — 박지 X 박힌 영역 정리

> 이 문서 영역 박힘 시점 영역 (2026-05-17) 기준 영역 ⚠️ 확인 필요 영역.

1. **`profiles.tier` 컬럼 영역 존재 여부** — `20260509_mastery_score.sql` 영역 `p.tier` 박힘 영역. `20260509_fast_track.sql` 영역에서 후속 영역 정정 영역 박힘.
2. **`user_sessions` migration 영역** — Dashboard 직접 박힘. CREATE TABLE 영역 재현 영역 마이그 영역 박는 영역 영역 권장.
3. **`user_stats_daily` migration 영역** — 동일.
4. **`note_mastery` migration 영역** — 동일. INSERT/UPDATE 영역 진입점 영역 명확 X (trigger 영역 박힘 여부 영역 확인 영역 필요).
5. **`leagues` / `league_members` migration 영역** — 동일. UI 영역 비활성 영역.
6. **`admin_actions` migration 영역** — 동일.
7. **`daily_batch_runs` CREATE 영역 마이그** — `20260424` 영역 ALTER 영역만 박힘.
8. **`user_note_logs` 영역 deprecation 영역** — `user_sessions.note_attempts` JSONB 영역 박힘 영역으로 중복 영역.
9. **`profiles.{current_streak, longest_streak, total_xp, current_league, last_practice_date}` migration 영역** — Dashboard 직접 박힘 영역 추정.

→ Phase 3 영역 (Session 3) 영역에서 정리 영역 + `CREATE TABLE IF NOT EXISTS` 영역 재현 영역 마이그 영역 박음 영역.
