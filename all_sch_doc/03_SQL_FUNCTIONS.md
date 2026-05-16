# 03 — SQL FUNCTIONS · TRIGGERS 영역

> 모든 함수 영역 (20개 + 1개 누락 영역) + 트리거 영역 (4개) 전수 박음.
> 영역 박힌 근거: `supabase/migrations/*.sql` 영역 + `src/` 영역 + `supabase/functions/` 영역.

## 0. 진입점 영역

### 0.1 SQL 함수 영역 vs 트리거 영역

| 영역 | SQL 함수 영역 | 트리거 영역 |
|---|---|---|
| 호출 영역 | JS/TS 영역 `supabase.rpc('이름', {...})` 또는 다른 SQL | 테이블 영역 INSERT/UPDATE/DELETE 영역 자동 영역 |
| 반환 영역 | 값 영역 (TABLE/VOID/UUID/JSONB 등) | TRIGGER 영역 타입 (NEW/OLD row 영역) |
| 등록 영역 | `GRANT EXECUTE` 영역 | `CREATE TRIGGER` 영역 |

### 0.2 Supabase RPC 영역 호출 영역

```typescript
const { data, error } = await supabase.rpc('함수명', {
  p_param1: 'value',
  p_param2: 123,
});
```

- 클라이언트 영역 = `authenticated` role 영역 박힘 → 함수 영역 `GRANT EXECUTE TO authenticated` 영역 박혀야 호출 영역.
- Edge Function 영역 `service_role` key 영역 박힘 → 모든 함수 영역 호출 영역.

### 0.3 SECURITY DEFINER vs INVOKER 영역

| 모드 영역 | 권한 영역 | 영역 |
|---|---|---|
| DEFINER | 함수 영역 정의자 영역 (보통 postgres) | RLS 영역 우회 영역. SECURITY DEFINER 박힘 영역 시 신중 영역. |
| INVOKER (default) | 호출자 영역 (auth.uid()) | RLS 영역 적용 영역. |

### 0.4 트리거 영역 동작 영역

```
INSERT INTO user_sessions (...) VALUES (...);
              ↓
   AFTER INSERT trigger 영역 박힘
              ↓
   trg_update_profile_after_session() 호출
              ↓
   UPDATE profiles SET last_practice_date = ...
```

- `BEFORE` 영역 = 박힘 전 영역 (NEW row 영역 수정 영역 가능).
- `AFTER` 영역 = 박힘 후 영역 (외부 테이블 영역 갱신 영역).
- `FOR EACH ROW` 영역 = 행마다 영역 박힘.

---

## 1. 함수 카테고리 영역

### 1.1 사용자·인증 영역 (7개)
1. `handle_new_user_profile()` — auth.users INSERT trigger 영역
2. `check_email_exists(p_email)` — 4-state 영역 가입 흐름 분기 영역
3. `check_nickname_available(p_nickname)` — ⚠️ 마이그 영역 없음 (Cursor 발견 영역)
4. `request_account_deletion(reason)` — soft delete 영역
5. `restore_account()` — 30일 영역 내 영역 복구 영역
6. `hard_delete_account(p_email)` — 영구 영역 삭제 영역
7. `hard_delete_expired_accounts()` — 배치 영역 호출

### 1.2 게임·통계 영역 (3개 + 1개 trigger 함수)
1. `record_sublevel_attempt(...)` — sublevel 영역 진행 영역 UPSERT
2. `get_mastery_score(p_level, p_sublevel)` — 4-metric 영역 점수 영역
3. `record_game_session(...)` — 3개 테이블 영역 원자적 영역
4. `update_profile_after_session()` — trigger 영역 함수 영역

### 1.3 일일 한도 영역 (2개)
1. `increment_daily_session()` — UPSERT + count 반환 영역
2. `get_today_session_count()` — UTC 오늘 영역 count 영역 조회

### 1.4 결제·구독 영역 (2개)
1. `apply_payment_topup(...)` — INSERT + scan_quota 갱신 영역
2. `expire_premium_users()` — 만료 영역 배치 영역

### 1.5 일괄 분석 영역 (1개)
1. `run_daily_batch_analysis()` — 일일 영역 약점·숙련 영역 분석 영역

### 1.6 헬퍼·유틸 영역 (6개)
1. `is_admin()` — RLS 영역 정책 영역 헬퍼
2. `is_reviewer()` — 코드 영역 분기 영역 헬퍼
3. `consume_scan_quota()` — 스캔 영역 1회 영역 차감 영역
4. `topup_scan_quota(p_user_id, p_amount)` — 충전 영역
5. `set_updated_at_profiles()` — trigger 영역 함수 영역
6. `set_updated_at_user_scores()` — trigger 영역 함수 영역

> **총 영역 21개** (마이그 영역 박힘) + **1개 누락** (`check_nickname_available`)

---

## 2. 각 함수별 영역 상세 (11항목)

### 2.1 `handle_new_user_profile()`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | `auth.users` INSERT 시 영역 `profiles` 자동 영역 생성 (가입 트리거 함수) |
| **2. 시그니처** | `RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | OAuth 영역 메타데이터 (full_name, name, avatar_url) 영역 추출 후 영역 `profiles` 영역 INSERT. 닉네임 영역 `user_<8자>` 자동 생성. 약관 영역 동의 시점 (tos/privacy/marketing) 영역 메타데이터 영역에서 박음. ON CONFLICT 영역 시 약관 영역 동의 시점만 UPDATE. |
| **4. 단계별** | 1. NEW.email·메타데이터 영역 추출 → 2. nickname 영역 자동 생성 → 3. `profiles` 영역 INSERT (id, email, display_name, avatar_url, nickname=`user_<8자>`, profile_completed=true, tos/privacy/marketing 영역 동의 시점) → 4. ON CONFLICT (id) DO UPDATE → tos_agreed_at IS NULL 영역 시 동의 시점 영역 갱신 |
| **5. 박는 테이블** | INSERT: `profiles` |
| **6. 호출 위치** | trigger 영역 `on_auth_user_created_profile` ON `auth.users` AFTER INSERT |
| **7. SECURITY** | DEFINER (auth.users → public.profiles 영역 박음) |
| **8. 변경 이력** | 1) 20260408001000 — 최초 영역 (id, scan_quota 영역만) · 2) 20260512_profile_completed_default — 정정 영역 (display_name, avatar_url, nickname, profile_completed, tos/privacy/marketing 영역 추가) |
| **9. 호출 예시** | SQL 영역 자동 영역 (trigger). 명시 영역 호출 영역 X. |
| **10. 반환 영역** | `NEW` row (TRIGGER 영역 표준). |
| **11. 주의점** | ⚠️ Magic Link 영역 가입 영역 박힘 영역 시 메타데이터 영역 NULL 영역 → `split_part(NEW.email, '@', 1)` 폴백. nickname 영역 충돌 영역 시 `ON CONFLICT (id)` 영역 박힘 영역 박힘 영역 (id 영역 충돌 영역 = 재가입 영역). |

---

### 2.2 `check_email_exists(p_email TEXT)`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 이메일 영역 가입 흐름 영역 4-state 분기 영역 (new / active / deleted_recoverable / deleted_expired) |
| **2. 시그니처** | `RETURNS TABLE(account_status TEXT, recovery_days_left INT) LANGUAGE plpgsql SECURITY DEFINER STABLE` |
| **3. 무엇 박는 영역인지** | auth.users + profiles 영역 LEFT JOIN 영역 박음 → 영역 4가지 상태 영역 반환. 'new' (미가입/미인증), 'active' (활성), 'deleted_recoverable' (30일 영역 내 영역), 'deleted_expired' (30일 초과 영역). |
| **4. 단계별** | 1. auth.users(email_confirmed_at) + profiles(is_deleted, deleted_at) 영역 LEFT JOIN → 2. 미가입/미인증 → 'new' → 3. is_deleted=true → 30일 영역 잔여 영역 계산 → 4. 활성 → 'active' |
| **5. 박는 테이블** | SELECT: `auth.users`, `profiles` |
| **6. 호출 위치** | `src/lib/profile.ts:161` — `supabase.rpc("check_email_exists", { p_email: email })` |
| **7. SECURITY** | DEFINER (auth.users 영역 조회 영역 박음) |
| **8. 변경 이력** | 1) 20260510_check_email_v2 — v2 영역 (user_exists, is_confirmed) · 2) 20260513_account_recovery — v3 영역 (account_status, recovery_days_left) — DROP+재생성 영역 (반환 영역 타입 영역 변경) |
| **9. 호출 예시** | ```ts const { data } = await supabase.rpc("check_email_exists", { p_email: "u@example.com" }); ``` |
| **10. 반환 영역** | `[{ account_status: 'new'\|'active'\|'deleted_recoverable'\|'deleted_expired', recovery_days_left: INT\|null }]` |
| **11. 주의점** | `lower(trim(p_email))` 영역 박힘 영역 = 대소문자·공백 영역 정규화. anon 영역 호출 영역 가능 영역 (GRANT TO anon, authenticated). |

---

### 2.3 `check_nickname_available(p_nickname TEXT)` ⚠️

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 닉네임 영역 사용 영역 가능 영역 확인 영역 (마이그 영역 없음 — Cursor 발견 영역) |
| **2. 시그니처** | ⚠️ **마이그 영역 없음** — 추정 영역 `RETURNS BOOLEAN`. |
| **3. 무엇 박는 영역인지** | 닉네임 영역 활성 영역 계정 영역 중 영역 중복 영역 여부 영역 검사 영역 추정. `profiles_nickname_active_unique` 영역 부분 영역 유니크 영역 인덱스 영역 박힘 영역. |
| **4. 단계별** | ⚠️ 정의 영역 없음. 추정 영역: SELECT 1 FROM profiles WHERE lower(nickname) = lower(p_nickname) AND is_deleted = false LIMIT 1 → NOT EXISTS → TRUE |
| **5. 박는 테이블** | SELECT: `profiles` (추정 영역) |
| **6. 호출 위치** | `src/hooks/useNicknameAvailability.ts:38, 73` |
| **7. SECURITY** | ⚠️ 확인 필요 (DEFINER 영역 추정 영역 — RLS 영역 우회 영역 박음) |
| **8. 변경 이력** | ⚠️ migration 영역 없음. Dashboard 영역 직접 박힘 영역 추정. |
| **9. 호출 예시** | ```ts const { data } = await supabase.rpc("check_nickname_available", { p_nickname: "myname" }); ``` |
| **10. 반환 영역** | `boolean` (true=사용 가능 영역) |
| **11. 주의점** | ⚠️ **Phase 3 fix 영역**: 마이그 영역 재현 영역 박음 영역 필요 영역. 현재 영역 production 영역 박혀 있다면 영역 동작 영역 박힘 (`useNicknameAvailability.ts` 영역 실패 영역 X). |

---

### 2.4 `request_account_deletion(reason TEXT DEFAULT NULL)`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | soft delete 영역 — profiles 영역 GDPR/PIPA 영역 이메일 영역 마스킹 영역 박음 |
| **2. 시그니처** | `RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | 인증 영역 사용자 영역 자신 영역 profiles 영역 영역 마스킹 영역 (deleted_at, is_deleted=true, deletion_reason, email='deleted_<id>@deleted.local'). 30일 영역 안에 영역 `restore_account()` 영역 박음 영역 복구 영역. |
| **4. 단계별** | 1. auth.uid() 영역 확인 → 2. profiles UPDATE (deleted_at=NOW(), is_deleted=true, deletion_reason=reason, email=마스킹 영역 박음) |
| **5. 박는 테이블** | UPDATE: `profiles` |
| **6. 호출 위치** | `src/pages/AuthCallback.tsx:26` — `supabase.rpc("request_account_deletion", { reason })` |
| **7. SECURITY** | DEFINER (RLS 영역 우회 영역 박음 — 영역 자신 영역 row 영역 박음 영역 어쨌든 영역 가능 영역) |
| **8. 변경 이력** | 1) 20260511_account_deletion — 최초 영역 (display_name=NULL, nickname=마스킹, avatar_url=NULL 영역 박음) · 2) 20260513_preserve_nickname — 닉네임·display_name·avatar_url 영역 보존 영역 (복구 영역 박음 영역 박음) |
| **9. 호출 예시** | ```ts await supabase.rpc("request_account_deletion", { reason: "no longer needed" }); ``` |
| **10. 반환 영역** | VOID. 실패 영역 시 'Unauthorized' EXCEPTION. |
| **11. 주의점** | 이메일 영역만 마스킹 영역 (20260513_preserve_nickname). 닉네임·아바타 영역 = 복구 영역 박음. 30일 영역 영구 영역 삭제 영역 = `hard_delete_expired_accounts()` 영역 배치 영역 박음. |

---

### 2.5 `restore_account()`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 30일 영역 이내 영역 soft-delete 영역 복구 영역 (이메일 영역 복원 영역 + flag 영역 해제) |
| **2. 시그니처** | `RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | 인증 영역 후 영역 (Magic Link 영역 박힘 영역) 영역 30일 영역 내 영역 자신 영역 profiles 영역 복구. email 영역 auth.users 영역에서 다시 영역 박음. |
| **4. 단계별** | 1. auth.uid() 영역 확인 → 2. auth.users.email 영역 조회 → 3. profiles UPDATE (is_deleted=false, deleted_at=NULL, deletion_reason=NULL, email=원본 영역) WHERE deleted_at > NOW() - 30 DAYS |
| **5. 박는 테이블** | UPDATE: `profiles` · SELECT: `auth.users` |
| **6. 호출 위치** | `src/pages/AuthCallback.tsx:42` — `supabase.rpc("restore_account")` |
| **7. SECURITY** | DEFINER (auth.users 영역 조회 영역 박음) |
| **8. 변경 이력** | 20260513_account_recovery — 최초 |
| **9. 호출 예시** | ```ts await supabase.rpc("restore_account"); ``` |
| **10. 반환 영역** | VOID. 30일 초과 영역 시 'Account not recoverable' EXCEPTION. |
| **11. 주의점** | 인증 영역 직후 영역 (Magic Link 클릭 후) 영역 박음 필수 영역. 안되면 `auth.uid()` NULL → 'Unauthorized'. |

---

### 2.6 `hard_delete_account(p_email TEXT)`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 영구 삭제 영역 — profiles + auth.users CASCADE 영역 박음 |
| **2. 시그니처** | `RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth` |
| **3. 무엇 박는 영역인지** | 이메일 영역 박은 영역 30일 영역 내 영역 soft-delete 영역 계정 영역 profiles + auth.users 영역 영구 영역 삭제. CASCADE 영역 박힘 auth.identities·sessions·refresh_tokens 영역 등 자동 영역 정리. |
| **4. 단계별** | 1. auth.users.id 영역 이메일 영역 조회 → 2. soft-delete 영역 + 30일 영역 내 영역 검증 → 3. profiles DELETE → 4. auth.users DELETE (CASCADE 영역 박힘) |
| **5. 박는 테이블** | DELETE: `profiles`, `auth.users` (CASCADE 영역 박힘 영역 auth 영역 sub 영역 테이블 영역) |
| **6. 호출 위치** | `src/components/AuthModal.tsx:256` — `supabase.rpc("hard_delete_account", { p_email: email })` |
| **7. SECURITY** | DEFINER (auth.users 영역 직접 영역 박음) |
| **8. 변경 이력** | 1) 20260513_hard_delete_by_email — 최초 영역 (profiles 영역만 삭제) · 2) 20260513_hard_delete_with_auth — auth.users 영역 + auth schema 영역 search_path 영역 박음 · 3) 20260514_fresh_start — idempotent 영역 재정의 영역 (auth.users 영역 미박힘 — search_path 영역에 영역 auth 영역 없음) |
| **9. 호출 예시** | ```ts await supabase.rpc("hard_delete_account", { p_email: "u@example.com" }); ``` |
| **10. 반환 영역** | VOID. 'User not found' / 'Account not eligible for hard delete' EXCEPTION. |
| **11. 주의점** | ⚠️ **3번 정의 영역** (20260513_hard_delete_by_email → 20260513_hard_delete_with_auth → 20260514_fresh_start). 마지막 영역 (20260514) 영역 `auth` schema 영역 search_path 영역 박힘 영역 X → auth.users 영역 삭제 영역 미박힐 영역 가능. ⚠️ **확인 필요**: production 영역 현재 영역 어느 버전 영역 박힘 영역. anon 영역 호출 영역 가능 영역 (비인증 영역 가입 흐름 영역 박음). |

---

### 2.7 `hard_delete_expired_accounts()`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 30일 영역 경과 영역 soft-delete 영역 사용자 ID 목록 영역 반환 (배치 영역 박음) |
| **2. 시그니처** | `RETURNS TABLE(expired_user_id UUID) LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | profiles.is_deleted=true AND deleted_at <= NOW() - 30 days 영역 영역 행 영역 ID 영역 목록 영역 반환. 실제 영역 삭제 영역 = service_role 영역 Edge Function 영역 박음. |
| **4. 단계별** | 1. SELECT id FROM profiles WHERE is_deleted=true AND deleted_at <= NOW()-30d 영역 |
| **5. 박는 테이블** | SELECT: `profiles` |
| **6. 호출 위치** | ⚠️ src/ 영역 호출 영역 없음. Edge Function 영역 박을 영역 예정 (TODO 영역) |
| **7. SECURITY** | DEFINER |
| **8. 변경 이력** | 20260513_account_recovery — 최초 |
| **9. 호출 예시** | service_role 영역 박힘 영역 Edge Function 영역 박음. anon/authenticated 영역 REVOKE 영역 박힘. |
| **10. 반환 영역** | UUID 목록 |
| **11. 주의점** | `REVOKE EXECUTE FROM anon, authenticated` 박힘 → service_role 영역만 호출 영역. **TODO**: Edge Function 영역 cron 영역 박음. |

---

### 2.8 `record_sublevel_attempt(p_level, p_sublevel, p_attempts, p_correct, p_max_streak, p_game_status, p_avg_reaction_ratio)`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | sublevel 영역 진행 영역 UPSERT + 통과 영역 판정 + 다음 sublevel 자동 잠금 해제 |
| **2. 시그니처** | `RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | 게임 영역 종료 후 영역 `user_sublevel_progress` 영역 UPSERT (play_count, total_attempts, total_correct, best_streak, avg_reaction_ratio rolling avg). 통과 영역 판정: `play_count >= 10 AND best_streak >= 5 AND accuracy >= 0.85 AND avg_reaction_ratio <= 0.35`. 패스트트랙 영역: tier=premium/admin + sublevel>=2 + play_count=0 + session_accuracy>=0.99 + avg_reaction_ratio<=0.5 → score=100 영역 강제. just_passed 영역 시 다음 sublevel INSERT (sublevel<3 → +1 sublevel · sublevel=3 → next level+1 sub1). |
| **4. 단계별** | 1. auth.uid() + level/sublevel 검증 → 2. 사용자 tier 조회 (is_premium, subscription_tier, role) → 3. INSERT ON CONFLICT DO NOTHING (행 영역 생성 영역) → 4. 현재 행 영역 조회 → 5. 누적 값 영역 계산 → 6. 패스트트랙 영역 분기 → 7. 통과 판정 → 8. UPDATE (passed, fast_track, passed_at) → 9. just_passed 영역 다음 sublevel INSERT |
| **5. 박는 테이블** | SELECT: `profiles` · UPSERT: `user_sublevel_progress` |
| **6. 호출 위치** | `src/hooks/useLevelProgress.ts:72` — `supabase.rpc("record_sublevel_attempt", { p_level, p_sublevel, p_attempts, p_correct, p_max_streak, p_game_status })` |
| **7. SECURITY** | DEFINER |
| **8. 변경 이력** | 1) 20260425_sublevel_system — 최초 영역 (5게임/85%/streak 5) · 2) 20260509_pass_criteria_v2 — 정정 영역 (10게임/85%/streak 5/avg_reaction_ratio 0.35) + avg_reaction_ratio 영역 컬럼 영역 + 파라미터 영역 · 3) 20260509_fast_track — 패스트트랙 영역 분기 + fast_track 영역 컬럼 영역 |
| **9. 호출 예시** | ```ts const { data } = await supabase.rpc("record_sublevel_attempt", { p_level: 1, p_sublevel: 2, p_attempts: 20, p_correct: 18, p_max_streak: 8, p_game_status: "completed", p_avg_reaction_ratio: 0.32 }); ``` |
| **10. 반환 영역** | JSONB: `{ level, sublevel, play_count, total_attempts, total_correct, accuracy, best_streak, avg_reaction_ratio, passed, just_passed, fast_track }` |
| **11. 주의점** | ⚠️ **3번 정의 영역** — 시그니처 영역 변경 영역 (파라미터 영역 추가 영역). production 영역 최신 영역 = 7개 파라미터 영역 (p_avg_reaction_ratio DEFAULT NULL). 안전 영역 영역 박힘 (NULL 영역 박힘 영역 시 이전 영역 avg_reaction_ratio 영역 유지). |

---

### 2.9 `get_mastery_score(p_level INT, p_sublevel INT)`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 4-metric 25% 가중 영역 점수 영역 (0~100). 패스트트랙 영역 score=100 강제 영역. |
| **2. 시그니처** | `RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | accuracy_score (LEAST(acc/0.85, 1)*25) + reaction_score (LEAST(0.35/reaction, 1)*25) + count_score (LEAST(count/10, 1)*25) + streak_score (LEAST(streak/5, 1)*25). free/guest 영역 → `{ score }` 영역만. premium/admin → 모든 metric 영역 반환. |
| **4. 단계별** | 1. user_sublevel_progress 조회 → 2. fast_track=true 영역 시 100 영역 반환 → 3. tier 조회 (is_premium + subscription_tier + role) → 4. 4개 metric 영역 계산 → 5. tier 영역 분기 영역 반환 |
| **5. 박는 테이블** | SELECT: `user_sublevel_progress`, `profiles` |
| **6. 호출 위치** | ⚠️ src/ 영역 호출 영역 없음 영역 ⚠️ 확인 필요 (예전 영역 박힘 영역 가능 영역 또는 영역 미사용 영역) |
| **7. SECURITY** | DEFINER |
| **8. 변경 이력** | 1) 20260509_mastery_score — 최초 영역 (tier 영역 `p.tier` 박힘 영역 — 컬럼 영역 X 추정) · 2) 20260509_fast_track — 패스트트랙 영역 score=100 + tier 영역 정정 영역 (is_premium + subscription_tier + role 영역 박음) |
| **9. 호출 예시** | ```ts const { data } = await supabase.rpc("get_mastery_score", { p_level: 1, p_sublevel: 2 }); ``` |
| **10. 반환 영역** | JSONB: `{ score: 0-100, accuracy?, reaction_ratio?, play_count?, best_streak?, fast_track? }` |
| **11. 주의점** | ⚠️ src/ 영역 직접 호출 영역 없음 — `MasteryHeroCard` 영역 제거 영역 박힘 (작업 #28). 향후 영역 부활 영역 시 영역 호출 영역. |

---

### 2.10 `record_game_session(p_level, p_started_at, p_ended_at, p_duration_seconds, p_total_notes, p_correct_notes, p_accuracy, p_avg_reaction_ms, p_xp_earned, p_session_type, p_note_attempts, p_summary)`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 게임 종료 영역 3개 테이블 영역 원자적 영역 박음 (user_sessions INSERT + user_stats_daily UPSERT + profiles.last_practice_date UPDATE) |
| **2. 시그니처** | `RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | reviewer 영역 RLS 영역 우회 영역. SECURITY DEFINER 영역 박힘 영역 박음 영역 3개 테이블 영역 원자적 영역. 미적용 영역 시 영역 reviewer 영역 user_sessions INSERT 영역 실패. |
| **4. 단계별** | 1. auth.uid() 검증 → 2. user_sessions INSERT (EXCEPTION WHEN undefined_table 영역 폴백) → 3. user_stats_daily UPSERT (sessions_count+1, total_notes+, correct_notes+, xp_earned+, avg_accuracy=재계산, avg_reaction_ms=rolling avg, total_duration_seconds+) → 4. profiles.last_practice_date UPDATE (last_practice_date IS NULL OR < v_today 영역 시) |
| **5. 박는 테이블** | INSERT: `user_sessions` · UPSERT: `user_stats_daily` · UPDATE: `profiles` |
| **6. 호출 위치** | `src/hooks/useSessionRecorder.ts:322` — `supabase.rpc("record_game_session", { p_level, p_started_at, ..., p_note_attempts, p_summary })` |
| **7. SECURITY** | DEFINER (3개 테이블 영역 RLS 영역 우회 영역) |
| **8. 변경 이력** | 20260517 — 최초 영역 (Task D, 2026-05-17) |
| **9. 호출 예시** | ```ts const { data: sessionId } = await supabase.rpc("record_game_session", { p_level: 3, p_started_at: "2026-05-17T10:00:00Z", p_ended_at: "...", p_duration_seconds: 90, p_total_notes: 20, p_correct_notes: 18, p_accuracy: 0.9, p_avg_reaction_ms: 850, p_xp_earned: 35, p_session_type: "regular", p_note_attempts: [...], p_summary: {...} }); ``` |
| **10. 반환 영역** | UUID — session_id 영역 (user_sessions 없을 시 `gen_random_uuid()` 폴백) |
| **11. 주의점** | ⚠️ **Phase 3 fix 영역**: production 영역 apply 영역 필수 영역. 미적용 시 reviewer 영역 직접 INSERT 폴백 영역 박힘 (`useSessionRecorder.ts:344`). `EXCEPTION WHEN undefined_table` 박힘 → 테이블 영역 없어도 영역 함수 영역 실행 영역 박힘. |

---

### 2.11 `update_profile_after_session()` (trigger 영역 함수)

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | user_sessions INSERT 시 영역 profiles.last_practice_date 영역 자동 갱신 영역 |
| **2. 시그니처** | `RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | user_sessions INSERT 영역 박힌 후 영역 자동 영역 박힘 영역 NEW.started_at 영역 박은 영역 UTC DATE 영역 박음 → profiles.last_practice_date 갱신 영역 (NULL 영역 박힘 영역 또는 영역 < 영역 박힘 영역 시). |
| **4. 단계별** | 1. NEW.started_at 영역 UTC DATE 변환 → 2. UPDATE profiles SET last_practice_date=DATE, updated_at=NOW() WHERE id=NEW.user_id AND (NULL OR <) |
| **5. 박는 테이블** | UPDATE: `profiles` |
| **6. 호출 위치** | trigger 영역 `trg_update_profile_after_session` ON `user_sessions` AFTER INSERT |
| **7. SECURITY** | DEFINER |
| **8. 변경 이력** | 20260516_reviewer_sessions_rls — 최초 |
| **9. 호출 예시** | 자동 (trigger) |
| **10. 반환 영역** | `NEW` row |
| **11. 주의점** | ⚠️ user_sessions 영역 직접 INSERT 영역 박힘 영역 시만 영역 박힘. `record_game_session()` RPC 영역 박힘 영역 박음 영역 = INSERT 영역 박힘 영역 → trigger 영역 박힘 영역 박음. ⚠️ **확인 필요**: production 영역 apply 영역 여부. |

---

### 2.12 `increment_daily_session()`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 일일 세션 카운트 영역 UPSERT + 갱신 영역 count 영역 반환 |
| **2. 시그니처** | `RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | 게임 영역 시작 직전 영역 박음. `daily_sessions(user_id, session_date, session_count)` UPSERT 영역. 영역 새로 영역 INSERT 영역 시 영역 count=1, 영역 ON CONFLICT 영역 시 영역 +1. |
| **4. 단계별** | 1. auth.uid() 검증 → 2. UTC v_today 계산 → 3. INSERT ON CONFLICT (user_id, session_date) DO UPDATE SET session_count = +1 → 4. RETURNING session_count |
| **5. 박는 테이블** | UPSERT: `daily_sessions` |
| **6. 호출 위치** | `src/hooks/useDailyLimit.ts:132` — `supabase.rpc("increment_daily_session")` |
| **7. SECURITY** | DEFINER |
| **8. 변경 이력** | 20260509_daily_sessions — 최초 |
| **9. 호출 예시** | ```ts const { data: count } = await supabase.rpc("increment_daily_session"); ``` |
| **10. 반환 영역** | INTEGER — 갱신 후 영역 count 영역 |
| **11. 주의점** | UTC 영역 기준 영역. Premium 영역 = 클라이언트 영역 분기 영역 → DB 영역 호출 영역 X. |

---

### 2.13 `get_today_session_count()`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | UTC 영역 오늘 영역 세션 영역 count 영역 조회 (STABLE) |
| **2. 시그니처** | `RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER STABLE` |
| **3. 무엇 박는 영역인지** | 미인증 영역 = 0 반환. 인증 영역 = UTC 영역 오늘 영역 daily_sessions.session_count 영역 SELECT (NULL → 0). |
| **4. 단계별** | 1. auth.uid() NULL → 0 → 2. UTC v_today 계산 → 3. SELECT session_count → COALESCE 0 |
| **5. 박는 테이블** | SELECT: `daily_sessions` |
| **6. 호출 위치** | `src/hooks/useDailyLimit.ts:110` — `supabase.rpc("get_today_session_count")` |
| **7. SECURITY** | DEFINER STABLE |
| **8. 변경 이력** | 20260509_daily_sessions — 최초 |
| **9. 호출 예시** | ```ts const { data: count } = await supabase.rpc("get_today_session_count"); ``` |
| **10. 반환 영역** | INTEGER — 0 ~ N |
| **11. 주의점** | STABLE 영역 박힘 영역 → 호출 영역 단위 영역 캐싱 영역 가능 영역. anon 영역 호출 영역 시 0 반환 영역 (예외 영역 X). |

---

### 2.14 `apply_payment_topup(p_event_id, p_user_id, p_package_id, p_credits_added, p_checkout_session_id, p_amount_cents, p_currency)`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 결제 영역 idempotent INSERT + scan_quota 영역 갱신 영역 |
| **2. 시그니처** | `RETURNS TABLE(applied BOOLEAN, remaining_quota INTEGER) LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | webhook 영역 박힘 영역 = idempotent 영역 박음. event_id 영역 UNIQUE 영역 박힘 영역 박힘 영역 동일 영역 event 영역 재전송 영역 시 영역 INSERT 영역 X. inserted=true 영역 시만 영역 `topup_scan_quota` 영역 호출. |
| **4. 단계별** | 1. credits 영역 검증 → 2. payment_events INSERT ON CONFLICT (event_id) DO NOTHING → 3. ROW_COUNT 확인 → 4. inserted=true 영역 → topup_scan_quota → 5. profiles.scan_quota 영역 조회 영역 반환 |
| **5. 박는 테이블** | INSERT: `payment_events` · UPDATE: `profiles.scan_quota` (via `topup_scan_quota`) · SELECT: `profiles` |
| **6. 호출 위치** | Edge Function 영역 박음 영역 (Stripe/Paddle/IAP webhook) — 현재 production 영역 미박힘 영역 추정 영역 |
| **7. SECURITY** | DEFINER (payment_events INSERT 영역 RLS 영역 우회 영역) |
| **8. 변경 이력** | 20260408003000_add_payment_events — 최초 |
| **9. 호출 예시** | ```ts const { data } = await supabase.rpc("apply_payment_topup", { p_event_id: "...", p_user_id: "...", p_package_id: "scan_pack_10", p_credits_added: 10, ... }); ``` |
| **10. 반환 영역** | `[{ applied: BOOLEAN, remaining_quota: INTEGER }]` |
| **11. 주의점** | event_id 영역 idempotency 영역 보장. 결제 영역 시스템 영역 production 영역 박힘 영역 X 영역 (PENDING). |

---

### 2.15 `expire_premium_users()`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 일일 배치 영역 박음 — premium_until 영역 경과 영역 사용자 영역 is_premium=false |
| **2. 시그니처** | `RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | profiles.is_premium=true AND premium_until < NOW() AND role != 'admin' 영역 영역 → is_premium=false UPDATE. admin 영역 제외 영역 박음. |
| **4. 단계별** | 1. UPDATE profiles SET is_premium=false WHERE is_premium=true AND premium_until IS NOT NULL AND premium_until < NOW() AND role != 'admin' → 2. ROW_COUNT 영역 반환 |
| **5. 박는 테이블** | UPDATE: `profiles` |
| **6. 호출 위치** | `run_daily_batch_analysis()` 영역 내부 영역 호출 |
| **7. SECURITY** | DEFINER |
| **8. 변경 이력** | 20260424_premium_expiry — 최초 |
| **9. 호출 예시** | SQL 영역 내부 호출 영역. `SELECT public.expire_premium_users();` |
| **10. 반환 영역** | INTEGER — 영향 행 수 영역 |
| **11. 주의점** | admin role 영역 제외 영역. reviewer role 영역 제외 영역 X — premium 영역 박지 X 박힘 영역 의도 영역 박힘. |

---

### 2.16 `run_daily_batch_analysis()`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 일일 영역 약점·숙련 영역 플래그 영역 + premium 영역 만료 영역 + 배치 영역 이력 영역 박음 |
| **2. 시그니처** | `RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | note_mastery 영역 약점 영역 플래그 (`total_attempts>=5 AND (recent_accuracy<0.60 OR avg_reaction_ms>3000)`) + 숙련 영역 플래그 (`total_attempts>=20 AND recent_accuracy>=0.95`) + 약점 영역 해제 (`recent_accuracy>=0.85`) + premium 만료 영역 + daily_batch_runs 영역 INSERT. |
| **4. 단계별** | 1. 동일 영역 run_date 영역 시 영역 NOTICE + RETURN NULL → 2. users_analyzed 영역 영역 카운트 → 3. 약점 영역 플래그 UPDATE → 4. 약점 영역 해제 UPDATE → 5. 숙련 영역 플래그 UPDATE → 6. `expire_premium_users()` 호출 → 7. duration 계산 → 8. daily_batch_runs INSERT (status='success' 또는 EXCEPTION 영역 박힘 영역 시 'failed') |
| **5. 박는 테이블** | UPDATE: `note_mastery` · UPDATE: `profiles` (expire_premium_users 경유) · INSERT: `daily_batch_runs` |
| **6. 호출 위치** | `src/hooks/useBatchRuns.ts:91` — `supabase.rpc("run_daily_batch_analysis")` (관리자 수동 실행 영역) |
| **7. SECURITY** | DEFINER |
| **8. 변경 이력** | 20260424_premium_expiry — 최초 영역 (premium_expired 영역 + expire_premium_users 영역 통합) |
| **9. 호출 예시** | ```ts const { data: runId } = await supabase.rpc("run_daily_batch_analysis"); ``` |
| **10. 반환 영역** | UUID (run_id) · NULL (오늘 이미 실행 영역 박힘 영역) |
| **11. 주의점** | 동일 영역 run_date 영역 재실행 영역 차단. EXCEPTION 영역 박힘 영역 시 영역 daily_batch_runs 영역 'failed' 영역 INSERT 영역 (ON CONFLICT 영역 UPDATE 영역 박음) + RAISE. cron 영역 박힘 영역 영역 PENDING. |

---

### 2.17 `is_admin()` — 헬퍼

→ §1.1 영역 박힘 영역 박음.

### 2.18 `is_reviewer()` — 헬퍼

→ §1.2 영역 박힘 영역 박음.

### 2.19 `consume_scan_quota()`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 스캔 영역 1회 영역 차감 영역 + 잔여 영역 반환 |
| **2. 시그니처** | `RETURNS TABLE(remaining_quota INTEGER) LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | profiles.scan_quota -= 1 영역 박음 (WHERE scan_quota > 0). NOT FOUND 영역 시 영역 빈 영역 반환. |
| **4. 단계별** | 1. auth.uid() 검증 → 2. UPDATE profiles SET scan_quota = scan_quota - 1 WHERE id = uid AND scan_quota > 0 → 3. RETURNING |
| **5. 박는 테이블** | UPDATE: `profiles` |
| **6. 호출 위치** | `supabase/functions/analyze-sheet-music/index.ts:355` — `supabase.rpc("consume_scan_quota")` |
| **7. SECURITY** | DEFINER |
| **8. 변경 이력** | 20260408001000 — 최초 |
| **9. 호출 예시** | ```ts const { data } = await supabase.rpc("consume_scan_quota"); ``` |
| **10. 반환 영역** | `[{ remaining_quota: INTEGER }]` 영역 또는 영역 빈 영역 배열 |
| **11. 주의점** | scan_quota 영역 0 영역 시 영역 빈 영역 배열 영역 반환 → 호출자 영역 분기 영역 박음. |

---

### 2.20 `topup_scan_quota(p_user_id UUID, p_amount INTEGER)`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | 스캔 영역 영역 충전 영역 (INSERT OR UPDATE) |
| **2. 시그니처** | `RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER` |
| **3. 무엇 박는 영역인지** | profiles INSERT ON CONFLICT 영역 박음 SET scan_quota += EXCLUDED. INVALID 영역 박힘 영역 시 영역 'INVALID_TOPUP_AMOUNT' EXCEPTION. |
| **4. 단계별** | 1. p_amount > 0 검증 → 2. INSERT profiles (id, scan_quota) VALUES (p_user_id, p_amount) ON CONFLICT (id) DO UPDATE SET scan_quota = profiles.scan_quota + EXCLUDED.scan_quota |
| **5. 박는 테이블** | UPSERT: `profiles` |
| **6. 호출 위치** | `apply_payment_topup()` 영역 내부 영역 |
| **7. SECURITY** | DEFINER |
| **8. 변경 이력** | 20260408001000 — 최초 |
| **9. 호출 예시** | `SELECT public.topup_scan_quota('uuid', 10);` |
| **10. 반환 영역** | INTEGER — 갱신 후 영역 scan_quota |
| **11. 주의점** | profiles 영역 없으면 영역 INSERT 영역 박음 (scan_quota = p_amount). |

---

### 2.21 `set_updated_at_profiles()` (trigger 함수)

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | profiles 영역 UPDATE 영역 시 영역 updated_at = NOW() |
| **2. 시그니처** | `RETURNS TRIGGER LANGUAGE plpgsql` (SECURITY 명시 영역 X → INVOKER) |
| **3. 무엇 박는 영역인지** | NEW.updated_at = NOW() 영역 박음. profiles 영역 UPDATE 영역 시 자동 영역. |
| **4. 단계별** | 1. NEW.updated_at = now() → 2. RETURN NEW |
| **5. 박는 테이블** | 영역 (자기 자신 행 영역 갱신 영역) |
| **6. 호출 위치** | trigger 영역 `trg_profiles_updated_at` BEFORE UPDATE ON profiles |
| **7. SECURITY** | INVOKER (기본) |
| **8. 변경 이력** | 20260408001000 — 최초 |
| **9. 호출 예시** | 자동 (trigger) |
| **10. 반환 영역** | `NEW` row |
| **11. 주의점** | UPDATE 영역 박힐 영역 때마다 영역 박힘. trigger 영역 박힘 영역 박힘 영역 = profile 영역 갱신 영역 박음 영역 즉시 영역 박힘. |

---

### 2.22 `set_updated_at_user_scores()` (trigger 함수)

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | user_scores 영역 UPDATE 영역 시 영역 updated_at = NOW() |
| **2. 시그니처** | `RETURNS TRIGGER LANGUAGE plpgsql` |
| **3. 무엇 박는 영역인지** | `set_updated_at_profiles()` 영역과 영역 동일 영역 패턴 영역 박음. |
| **4. 단계별** | 1. NEW.updated_at = NOW() → 2. RETURN NEW |
| **5. 박는 테이블** | 영역 |
| **6. 호출 위치** | trigger 영역 `trg_user_scores_updated_at` BEFORE UPDATE ON user_scores |
| **7. SECURITY** | INVOKER |
| **8. 변경 이력** | 20260410165000_add_user_scores_and_practice_logs — 최초 |
| **9. 호출 예시** | 자동 |
| **10. 반환 영역** | `NEW` |
| **11. 주의점** | user_scores 영역 사용 영역 PENDING 영역. |

---

## 3. 트리거 영역 (4개)

### 3.1 `trg_profiles_updated_at`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | profiles UPDATE 영역 시 영역 updated_at 영역 자동 갱신 |
| **2. 시점** | BEFORE UPDATE |
| **3. 대상 테이블** | `profiles` |
| **4. 호출 함수** | `set_updated_at_profiles()` |
| **5. 박힘 위치** | `20260408001000:43-48` |
| **6. 동작** | 행 UPDATE 시점 영역 박힘 영역 박힘 영역 NEW.updated_at = now() |
| **7. 주의점** | 모든 UPDATE 영역 박힘 영역 = updated_at 영역 자동. 클라이언트 영역 명시 영역 박을 영역 필요 X. |

---

### 3.2 `on_auth_user_created_profile`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | auth.users 영역 INSERT 영역 시 영역 profiles 자동 영역 생성 |
| **2. 시점** | AFTER INSERT |
| **3. 대상 테이블** | `auth.users` |
| **4. 호출 함수** | `handle_new_user_profile()` |
| **5. 박힘 위치** | `20260408001000:62-67` |
| **6. 동작** | 신규 영역 가입 영역 박힘 영역 박힘 영역 profiles 영역 INSERT + 닉네임 영역 자동 생성 + 약관 영역 동의 영역 박음 |
| **7. 주의점** | Magic Link 가입 영역 의존 영역 함수 영역. 실패 영역 시 영역 가입 영역 차단. 반드시 영역 idempotent 영역 박힘 영역 박음 (ON CONFLICT DO UPDATE). |

---

### 3.3 `trg_user_scores_updated_at`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | user_scores UPDATE 영역 시 영역 updated_at 영역 갱신 |
| **2. 시점** | BEFORE UPDATE |
| **3. 대상 테이블** | `user_scores` |
| **4. 호출 함수** | `set_updated_at_user_scores()` |
| **5. 박힘 위치** | `20260410165000:26-29` |
| **6. 동작** | NEW.updated_at = NOW() |
| **7. 주의점** | user_scores 영역 사용 영역 PENDING. |

---

### 3.4 `trg_update_profile_after_session`

| 항목 | 내용 |
|---|---|
| **1. 한 줄 요약** | user_sessions INSERT 영역 시 영역 profiles.last_practice_date 영역 자동 갱신 |
| **2. 시점** | AFTER INSERT |
| **3. 대상 테이블** | `user_sessions` |
| **4. 호출 함수** | `update_profile_after_session()` |
| **5. 박힘 위치** | `20260516_reviewer_sessions_rls:78-82` |
| **6. 동작** | NEW.started_at UTC 영역 박은 영역 DATE 영역 박음 → profiles.last_practice_date 갱신 영역 (NULL 영역 박힘 영역 또는 영역 < 영역 박힘 영역 시) |
| **7. 주의점** | ⚠️ **`record_game_session()` RPC 영역 박힘 영역 박음 영역 = user_sessions INSERT 영역 박힘 영역 박힘 영역 영역 trigger 박힘 영역. 직접 INSERT 영역 박힘 영역 박힘 영역 박힘 영역. ⚠️ production 영역 apply 영역 여부 영역 확인 필요. |

---

## 4. 누락·중복·의심 영역

### 4.1 마이그 영역 없는 RPC 영역 (Cursor 발견 영역 박힘 영역)

| # | RPC | 호출 위치 | 영역 |
|---|---|---|---|
| 1 | `check_nickname_available(p_nickname)` | `useNicknameAvailability.ts:38, 73` | ⚠️ Dashboard 영역 직접 박힘 영역 추정 → Phase 3 영역에서 마이그 영역 재현 영역 박음 |

### 4.2 중복 정의 영역 (시그니처 변경 영역 박힘 영역)

| # | 함수 | 변경 이력 |
|---|---|---|
| 1 | `record_sublevel_attempt` | 20260425 (6개 param) → 20260509_pass_criteria_v2 (7개 param + avg_reaction_ratio) → 20260509_fast_track (7개 param + 패스트트랙 분기 영역) |
| 2 | `get_mastery_score` | 20260509_mastery_score → 20260509_fast_track (tier 영역 조회 영역 정정 영역) |
| 3 | `hard_delete_account` | 20260513_hard_delete_by_email (profiles 영역만) → 20260513_hard_delete_with_auth (profiles + auth.users) → 20260514_fresh_start (profiles 영역만 영역 — search_path 영역 박힘 영역 X) |
| 4 | `request_account_deletion` | 20260511_account_deletion (display_name=NULL, nickname=마스킹) → 20260513_preserve_nickname (이메일 영역만 마스킹) |
| 5 | `check_email_exists` | 20260510 (v2) → 20260513_account_recovery (v3 — DROP+재생성 영역) |
| 6 | `handle_new_user_profile` | 20260408001000 (id+scan_quota) → 20260512 (display_name+avatar_url+nickname+profile_completed+tos/privacy/marketing) |

### 4.3 의심 영역

| # | 영역 | 의심 사항 |
|---|---|---|
| 1 | `hard_delete_account` 영역 최신 정의 영역 | 20260514_fresh_start 영역 = auth.users 영역 삭제 영역 미박힘. 20260513_hard_delete_with_auth 영역 = auth.users 영역 박힘. **production 영역 어느 버전 영역 박힘 영역?** ⚠️ 확인 필요 영역. |
| 2 | `get_mastery_score` 영역 | src/ 영역 직접 호출 영역 없음. `MasteryHeroCard` 제거 후 영역 미사용 영역. |
| 3 | `hard_delete_expired_accounts` 영역 | service_role 영역 전용 영역. 호출 영역 cron 영역 박힘 영역 X (TODO). |
| 4 | `apply_payment_topup` 영역 | 결제 영역 시스템 영역 production 영역 박힘 영역 X (PENDING). |
| 5 | `trg_update_profile_after_session` 영역 | record_game_session RPC 영역 박음 영역 박힘 = INSERT trigger 박힘 영역. 직접 INSERT (폴백) 영역 박힘 영역 박힘 영역. ⚠️ 두 경로 영역 모두 영역 박힘 영역 검증 영역 필요. |

### 4.4 통계 영역

| 영역 | 카운트 |
|---|---|
| 정의된 함수 영역 (마이그 영역) | 21개 (`is_admin`·`is_reviewer`·`handle_new_user_profile`·`set_updated_at_profiles`·`set_updated_at_user_scores`·`consume_scan_quota`·`topup_scan_quota`·`check_email_exists`·`request_account_deletion`·`restore_account`·`hard_delete_account`·`hard_delete_expired_accounts`·`record_sublevel_attempt`·`get_mastery_score`·`record_game_session`·`update_profile_after_session`·`increment_daily_session`·`get_today_session_count`·`apply_payment_topup`·`expire_premium_users`·`run_daily_batch_analysis`) |
| 누락 함수 영역 (코드 호출 영역 + 마이그 영역 X) | 1개 (`check_nickname_available`) |
| 정의된 트리거 영역 | 4개 (`trg_profiles_updated_at`·`on_auth_user_created_profile`·`trg_user_scores_updated_at`·`trg_update_profile_after_session`) |
| SECURITY DEFINER 영역 함수 | 17개 |
| SECURITY INVOKER 영역 함수 (기본 영역) | 4개 (trigger 영역 함수 2개 + `set_updated_at_*` 2개 영역 박힘 영역) |
| GRANT TO anon | 3개 (`check_email_exists`, `hard_delete_account`, `apply_payment_topup` 추정 영역) |
| GRANT TO authenticated | 대부분 영역 |
| REVOKE FROM anon, authenticated | 1개 (`hard_delete_expired_accounts` — service_role 영역 전용 영역) |

→ Phase 3 영역 = (1) `check_nickname_available` 마이그 영역 재현 영역 박음 (2) `hard_delete_account` 영역 production 영역 버전 영역 영역 검증 영역 (3) `trg_update_profile_after_session` 영역 production 영역 영역 검증 영역.
