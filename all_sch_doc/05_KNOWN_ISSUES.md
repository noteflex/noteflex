# 05 — KNOWN ISSUES 영역

> Session 1·2·3 영역에서 발견된 모든 영역 + Cursor 검증 영역 정리 + Phase 3 영역 액션 목록 영역.
> 우선순위: 🔴 위험 / 🟡 중간 / 🟢 낮음

## 0. 진입점 영역

### 0.1 이 문서 영역 박는 영역
Phase 1 (Session 1-3) 영역 박힘 영역 발견된 영역 모든 영역 영역 → Phase 3 fix 영역 액션 목록 영역.

### 0.2 우선순위 영역
| 영역 | 정의 영역 |
|---|---|
| 🔴 위험 | silent fail / 데이터 영역 누락 / Single Source of Truth 영역 깨짐 / 보안 영역 위험 |
| 🟡 중간 | 중복 영역 / Production 영역 미박힘 영역 / 문서 영역 정합 영역 |
| 🟢 낮음 | 문서 영역 정정 영역 / 죽은 코드 영역 / 정리 영역 |

### 0.3 카테고리 영역 영역
1. 마이그 영역 정의 영역 없는 영역 (Dashboard 직접)
2. 중복 정의 영역 함수
3. 누락 RLS 정책
4. 컬럼 출처 영역 잘못 박힌 영역
5. silent fail 영역
6. 함수 시그니처 영역 불일치
7. 누락 INSERT/UPDATE 위치 영역
8. 죽은 코드 영역

---

## 1. 카테고리별 영역

### 1.1 마이그 정의 없는 영역 (Dashboard 직접 박힘)
**🔴 위험** — Single Source of Truth 깨짐, 다른 환경 영역 재현 X.

#### 테이블 (8개)

| # | 테이블 | 발견 영역 | 영향 영역 |
|---|---|---|---|
| 1 | `user_sessions` | Session 1 | 게임 영역 1회 영역 핵심 영역. 재현 영역 마이그 영역 없음 영역 → staging 영역 박지 X 박힘 영역 |
| 2 | `user_stats_daily` | Session 1 | 대시보드 영역 KPI 영역 박힘 영역 박음 영역. 재현 X 영역 |
| 3 | `note_mastery` | Session 1 | 약점·숙련 영역 박힘 영역 박음 영역. ⚠️ INSERT/UPDATE 진입점 영역 명확 X |
| 4 | `leagues` | Session 1 | UI 영역 비활성 영역. 마스터 데이터 영역 박힘 영역 박음 |
| 5 | `league_members` | Session 1 | UI 영역 비활성 영역. 갱신 영역 메커니즘 영역 확인 X |
| 6 | `admin_actions` | Session 1 | 감사 로그 영역. Edge Function 영역에서 INSERT |
| 7 | `daily_batch_runs` | Session 1 (ALTER만 박힘) | 일일 배치 영역 이력 영역 |
| 8 | `user_streaks` | Session 1 (Cursor) + Session 2 (admin-action 영역) | Edge Function 영역에서 영역 UPDATE 박힘 영역 |
| 9 | `subscriptions` | Session 2 (paddle-webhook 영역) | Edge Function 영역에서 영역 INSERT/UPDATE 박힘 |

#### RPC (1개)

| # | RPC | 발견 영역 | 영향 영역 |
|---|---|---|---|
| 1 | `check_nickname_available(p_nickname TEXT)` | Session 2 (`useNicknameAvailability.ts:38, 73`) | 닉네임 영역 중복 영역 확인 영역. production 영역 박힘 영역 추정 (코드 영역 실패 영역 영역 보고 영역 X) |

#### 박을 영역 (Phase 3)
- [ ] Supabase Dashboard 영역에서 schema 영역 추출 영역 (8개 테이블 + 1개 RPC)
- [ ] 재현 마이그 영역 박음: `supabase/migrations/20260518_phase3_consolidation.sql`
  - `CREATE TABLE IF NOT EXISTS public.user_sessions (...)` 영역 외 8개
  - `CREATE OR REPLACE FUNCTION public.check_nickname_available(...)`
  - RLS 정책 영역 명시 영역
- [ ] staging 영역 박은 영역 영역 검증 영역
- [ ] 영역 박힘 영역 박힘 영역 박힘 영역 → production 영역 영역 박지 X 박힘 영역 (이미 박힘 영역) 영역 박는 영역 영역 박힘 영역 박지 X 박힘 영역

---

### 1.2 중복 정의 함수 (6개)
**🟡 중간** — Production 영역 영역 어느 버전 영역 박힘 영역 ⚠️ 미확인 영역.

| # | 함수 | 중복 횟수 | 변경 영역 마이그 |
|---|---|---|---|
| 1 | `record_sublevel_attempt` | 3번 | 20260425 (6 param) → 20260509_pass_criteria_v2 (7 param) → 20260509_fast_track (7 param + 패스트트랙 분기) |
| 2 | `get_mastery_score` | 2번 | 20260509_mastery_score → 20260509_fast_track (tier 영역 정정 영역) |
| 3 | `hard_delete_account` | 3번 | 20260513_hard_delete_by_email (profiles 영역만) → 20260513_hard_delete_with_auth (profiles + auth.users) → 20260514_fresh_start (profiles 영역만 — search_path 영역 박힘 영역 X) |
| 4 | `request_account_deletion` | 2번 | 20260511_account_deletion (display_name=NULL, nickname=마스킹) → 20260513_preserve_nickname (이메일 영역만 마스킹) |
| 5 | `check_email_exists` | 2번 | 20260510 (v2) → 20260513_account_recovery (v3) — DROP+재생성 영역 |
| 6 | `handle_new_user_profile` | 2번 | 20260408001000 → 20260512_profile_completed_default |

#### 박을 영역 (Phase 3)
- [ ] Production 영역 영역 어느 함수 영역 박힘 영역 확인 영역:
  ```sql
  SELECT routine_name, routine_definition
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN (
        'record_sublevel_attempt', 'get_mastery_score', 'hard_delete_account',
        'request_account_deletion', 'check_email_exists', 'handle_new_user_profile'
      );
  ```
- [ ] **`hard_delete_account` 영역 최우선 영역** — auth.users 영역 삭제 영역 여부 영역 확인 영역. 20260514 영역 박힘 영역 박힘 영역 → auth.users 영역 잔존 영역 박힘 영역 → "새로 시작" 영역 실패 영역 가능
- [ ] 가장 최신 영역 정의 영역 = `_consolidated/` 영역 박은 영역 보관 영역 (옛 마이그 영역 deprecate 명시)

---

### 1.3 누락 RLS 정책
**🔴 위험** — silent fail 또는 권한 영역.

#### 영역

| # | 테이블 | 누락 영역 | 영향 영역 |
|---|---|---|---|
| 1 | `device_change_events` | UPDATE 정책 영역 없음 | `userEnvironmentOffset.ts:135` 영역 silent fail 영역 가능 영역 (Session 2 발견) |
| 2 | `user_sessions` | UPDATE·DELETE 정책 영역 없음 | intentional 영역 (영구 영역 기록) — Phase 3 영역 영역 명시 영역 |
| 3 | `user_note_logs` | UPDATE·DELETE 정책 영역 없음 | intentional 영역 — Phase 3 영역 영역 명시 영역 |
| 4 | `profiles` | DELETE 정책 영역 없음 | intentional 영역 — `request_account_deletion` 영역 박음 |
| 5 | `payment_events` | INSERT 정책 영역 없음 | intentional 영역 — `apply_payment_topup` 영역 RPC 영역 전용 |
| 6 | `user_stats_daily`·`note_mastery`·`leagues`·`league_members`·`admin_actions`·`daily_batch_runs`·`user_streaks`·`subscriptions` | **전체 정책 영역 마이그 영역 없음** | §1.1 영역 박힘 영역 박음 |

#### 박을 영역 (Phase 3)
- [ ] `device_change_events.UPDATE` 정책 영역 박음:
  ```sql
  CREATE POLICY "Users can update own device change events"
    ON public.device_change_events FOR UPDATE
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ```
- [ ] 마이그 영역 없는 영역 8개 테이블 영역 RLS 정책 영역 박음 (§1.1 영역 박은 영역 합침 영역)
- [ ] 마이그레이션 영역 박음: `20260518_rls_completeness.sql`

---

### 1.4 컬럼 출처 잘못 박힌 영역 (Session 1 Cursor 발견)
**🟢 낮음** — 문서 영역만 영향 영역.

#### 영역

| # | 박힌 영역 | 실제 영역 | 박을 영역 |
|---|---|---|---|
| 1 | `profiles.display_name` "20260512" 박힘 | 실제 ALTER 영역 없음 — Dashboard 영역 박힘 영역 추정 영역 | 01_SCHEMA.md 정정 |
| 2 | `profiles.avatar_url` "20260512" 박힘 | 동일 영역 | 01_SCHEMA.md 정정 |
| 3 | `profiles.nickname` "20260512" 박힘 | 동일 영역 | 01_SCHEMA.md 정정 |
| 4 | `profiles.{current_streak, longest_streak, total_xp, current_league, last_practice_date}` | 마이그 영역 없음 — Dashboard 직접 박힘 영역 추정 영역 | 01_SCHEMA.md 정정 영역 박음 영역 박힘 영역 박힘 영역 |
| 5 | `profiles.tier` 컬럼 영역 존재 여부 영역 | `20260509_mastery_score` 영역 `p.tier` 박힘 영역 → 20260509_fast_track 영역에서 정정 영역 박힘 영역 박힘 영역 박은 영역 박힘 영역 → 컬럼 영역 존재 영역 ⚠️ | 01_SCHEMA.md 영역 ⚠️ 박은 영역 박힘 |
| 6 | `note_mastery` 6개 컬럼 영역 "20260424" 박힘 | 20260424 영역 = ALTER 영역 박힌 영역 박음 영역 박지 X 박힘 영역. 컬럼 영역 박힘 영역 박힘 영역 박힘 영역 → 마이그 영역 없음 영역 | 01_SCHEMA.md 정정 |

#### 박을 영역 (Phase 3)
- [ ] Supabase Dashboard 영역에서 실제 컬럼 영역 확인 영역:
  ```sql
  SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
    ORDER BY ordinal_position;
  ```
- [ ] 01_SCHEMA.md 영역 정정 영역 박음:
  - "박힌 영역 = Dashboard 직접 박힘 영역" 영역 명시 영역

---

### 1.5 silent fail 영역
**🔴 위험** — 사용자 영역에서 알 수 없음 영역. Phase 3에서 #2·#7 해소.

#### 영역

| # | 위치 | 영역 영역 박힘 영역 | 분류 | 상태 |
|---|---|---|---|---|
| 1 | `useSessionRecorder.ts:344` 폴백 INSERT 실패 | `console.error` 영역만 박힘 영역. UI 영역 알림 X | 🔴 silent fail | ⏸ Phase 4 |
| 2 | `userEnvironmentOffset.ts:135` 영역 `device_change_events` UPDATE | UPDATE 정책 영역 없음 → 실패 박힘 알림 X | 🔴 silent fail | ✅ **Phase 3 Step 2-A 해소** (`20260518_device_change_events_update_policy.sql`) |
| 3 | `useLevelProgress.ts:72` 영역 `record_sublevel_attempt` 실패 | 잠금 해제 X 영역 — 사용자 알림 X | 🔴 silent fail | ⏸ Phase 4 |
| 4 | `useDailyLimit.ts:132` 영역 `increment_daily_session` 실패 | 한도 영역 카운트 X 영역 — 게임 차단 X | 🟡 부분 fail | ⏸ Phase 4 |
| 5 | `AuthCallback.tsx:66` 영역 consent UPDATE 실패 | try/catch 박힘 영역 무시 영역 | 🟢 무시 | 의도된 영역 |
| 6 | trigger `trg_update_profile_after_session` 영역 미적용 영역 | `last_practice_date` 영역 갱신 X — `record_game_session` 폴백 박힘 | 🟡 폴백 박힘 | ✅ **Phase 3 Step 1-3 해소** (트리거 + `handle_session_complete` 박음) |
| 7 | `note_mastery` 영역 갱신 영역 진입점 영역 명확 X | 일일 배치 영역 박지 X 박힐 영역 가능 | 🔴 데이터 누락 | ✅ **Phase 3 Step 1-3 해소** (`handle_session_complete` 영역 `note_mastery` UPSERT 박음 — note_attempts JSONB 순회) |

#### 박을 영역 (Phase 4 — 로그·Admin)
- [ ] Sentry 영역 박음
- [ ] `app_logs` 테이블 영역 박음 (level, scope, message, context JSONB, user_id, created_at)
- [ ] `logger` 유틸 영역 박음 (`src/lib/logger.ts`)
- [ ] 핵심 영역 로그 영역 박음 (게임 종료·결제·인증·RPC 실패)
- [ ] `/admin/logs` 페이지 영역 박음 (필터링·검색)
- [ ] UI 영역 토스트 영역 박음 — silent fail 영역 박힘 영역 박힘 영역 사용자 영역 알림 영역

---

### 1.6 함수 시그니처 영역 불일치 영역
**🟡 중간** — 문서 영역.

#### 영역

| # | 함수 | 불일치 영역 |
|---|---|---|
| 1 | `apply_payment_topup` | Cursor 검증 영역 박힌 영역 인자 순서 영역 불일치 영역 (Session 1) |

마이그 영역 시그니처:
```sql
public.apply_payment_topup(
  p_event_id            TEXT,
  p_user_id             UUID,
  p_package_id          TEXT,
  p_credits_added       INTEGER,
  p_checkout_session_id TEXT,
  p_amount_cents        INTEGER,
  p_currency            TEXT
)
```

#### 박을 영역 (Phase 3)
- [ ] 03_SQL_FUNCTIONS.md §2.14 영역 시그니처 영역 정확 영역 박은 영역 검증 영역

---

### 1.7 누락된 INSERT/UPDATE 위치 영역
**🟢 낮음** — 문서 영역.

#### 영역

| # | 누락 영역 | 박을 영역 |
|---|---|---|
| 1 | `profiles` UPDATE 영역 — `record_game_session` 영역 박힘 영역 박은 영역 + `admin-action/index.ts:232` Edge Function 영역 | 01_SCHEMA.md §1.8 영역 박음 (이미 박힘 — 영역 검증 영역) |
| 2 | `admin_actions` INSERT 영역 — `admin-action/index.ts:261` Edge Function 영역 | 01_SCHEMA.md §11.8 영역 박음 |
| 3 | `user_streaks` UPDATE — `admin-action/index.ts:220` Edge Function | 01_SCHEMA.md (신규 §17) 박음 — 현재 영역 박지 X |
| 4 | `subscriptions` INSERT/UPDATE — `paddle-webhook/index.ts:139` | 01_SCHEMA.md (신규 §18) 박음 — 현재 영역 박지 X |
| 5 | `payment_events` 영역 INSERT 영역 — Edge Function 영역 박을 영역 (현재 PENDING) | 01_SCHEMA.md §8.8 영역 박음 (이미 박힘 — `apply_payment_topup` 영역 박힘 영역) |

#### 박을 영역 (Phase 3)
- [ ] 01_SCHEMA.md 영역 §17 (user_streaks) + §18 (subscriptions) 영역 박음
- [ ] Edge Function 영역 박는 영역 박지 X 박힌 영역 박은 영역 영역 INSERT/UPDATE 영역 위치 영역 박음

---

### 1.8 죽은 코드 영역
**🟢 낮음** — 정리 영역.

#### 영역

| # | 영역 | 영역 |
|---|---|---|
| 1 | `user_note_logs` 영역 활성 사용 박음 (deprecation 영역 X) | NoteGame.tsx:1067·1132·1196 → useNoteLogger.ts → userNoteLogs.ts:117 INSERT (매 음표 박힘). WeakSlowNotesCards.tsx:4·AICoachingDetail.tsx:5 SELECT. 출시 후 정리 박을 영역 |
| 2 | `get_mastery_score` RPC 영역 호출 X | `MasteryHeroCard` 영역 제거 영역 박음 (작업 #28) → 함수 영역 박지 X 박힘 영역. **dead 함수 영역** |
| 3 | `is_reviewer()` 영역 RLS 영역 직접 사용 X | RLS 정책 영역 영역 grep 0건 영역. ComingSoonGate 영역 = `useAuth().profile?.role === 'reviewer'` 클라이언트 영역 분기. **dead 함수 영역 (출시 후 DROP 박을 영역)** |
| 4 | `hard_delete_expired_accounts()` 영역 호출 X | service_role 영역 전용 영역. cron 영역 박힘 영역 영역 PENDING — TODO 박힘 |
| 5 | `leagues`·`league_members` 영역 | UI 영역 비활성 영역 박힘 영역 (작업 #27). 향후 부활 영역 PENDING |
| 6 | `user_scores`·`practice_logs`·`user_custom_scores` 영역 | 현재 사용 X (PENDING — 스캔 영역 박힘 영역 영역 박은 영역 박힘 영역 박지 X 박은 영역 박힘) |

#### 박을 영역 (Phase 3 또는 출시 후)
- [ ] `user_note_logs` 영역 deprecation 영역 결정 영역. 사용 영역 박지 X 박힘 영역 → 마이그 영역 영역 `DROP TABLE` 영역 박음 영역 박은 영역 박힘 영역 (출시 영역 후 박힘 영역 박음 영역 박힘 영역)
- [ ] 사용 영역 X 영역 함수 영역 cron 영역 박음 영역 박은 영역 박힘 영역 박은 영역 영역 박음
- [ ] 사용 영역 X 영역 테이블 영역 PENDING 영역 명시 영역 (01_SCHEMA.md 영역 박힘 영역 박음)

---

## 2. Phase 3 작업 영역 우선순위 영역 — 모두 ✅ 완료 (2026-05-18)

| 우선순위 | # | 영역 | 작업 영역 | 상태 |
|---|---|---|---|---|
| 🔴 1 | 1.1 | 마이그 정의 영역 없는 10개 테이블 + 3개 함수 + 1개 트리거 | Dashboard schema 영역 추출 + 재현 마이그 영역 박음 | ✅ **Step 1-1·1-2·1-3 박힘** (`20260518_phase3_consolidation.sql`) |
| 🔴 2 | 1.3 | 누락 RLS 정책 영역 (`device_change_events.UPDATE`) | UPDATE 정책 영역 박음 | ✅ **Step 2-A 박힘** (`20260518_device_change_events_update_policy.sql`) |
| 🔴 2b | 1.3 | 마이그 없는 영역 10개 테이블 영역 RLS 정책 | §1.1 영역 합침 영역 | ✅ Step 1-2 영역 영역 박힘 영역 |
| 🟡 3 | 1.2 | 중복 정의 함수 6개 (특히 `hard_delete_account`) | Production 영역 영역 확인 + 정리 영역 박음 | ✅ **Step 3 박힘** (Production 영역 최신 영역 박힌 영역 확인 영역) |
| 🟡 4 | 1.6 | `apply_payment_topup` 시그니처 정정 영역 | 03_SQL_FUNCTIONS.md 정정 | ✅ **Step 4 박힘** |
| 🟢 5 | 1.4 | 컬럼 출처 영역 정정 영역 (profiles + note_mastery 영역) | Step 1-1 영역 박은 영역 영역 영역 정정 영역 | ✅ **Step 4 박힘** (Dashboard 직접 박음 영역 표기) |
| 🟢 6 | 1.7 | 누락 INSERT/UPDATE 위치 영역 (user_streaks, subscriptions) | 01_SCHEMA.md §17·18 영역 박음 | ✅ **Step 4 박힘** (§17·§18·§19 신규) |
| 🟢 7 | 1.8 | 죽은 코드 영역 정리 영역 — `record_sublevel_attempt` 6개 인자 영역 | DROP 박음 | ✅ **Step 2-B 박힘** (`20260518_phase3_consolidation.sql` §14) |

### 2.1 Phase 3 박은 영역 박힘 영역 박은 영역 = 모두 영역 박은 영역

**Step 1-1 (2026-05-18)**: `scripts/phase3/01_extract_production_schema.sql` — Production schema 추출 SQL 13개 섹션.
**Step 1-2 (2026-05-18)**: `supabase/migrations/20260518_phase3_consolidation.sql` — 10개 테이블 + 3개 함수 + 1개 트리거 + 1개 DROP.
**Step 1-3 (2026-05-18)**: 함수 본문 Production 정확본 정정 (`handle_session_complete`·`check_nickname_available`·`get_my_league_group_id`).
**Step 2-A (2026-05-18)**: `supabase/migrations/20260518_device_change_events_update_policy.sql` — silent fail 해소.
**Step 2-B (2026-05-18)**: `record_sublevel_attempt` 6개 인자 dead 함수 DROP.
**Step 3 (2026-05-18)**: 중복 정의 함수 6개 Production 확인 — 모두 최신 영역 박힘.
**Step 4 (2026-05-18)**: 6개 문서 19건 정정 박음 (이 영역).

---

## 3. Phase 4 작업 영역 (로그·Admin)

| # | 영역 | 박을 영역 |
|---|---|---|
| 1 | Sentry 영역 박음 | 환경 변수 + `src/lib/sentry.ts` |
| 2 | `app_logs` 테이블 영역 박음 | 마이그 + RLS (admin SELECT 전용) |
| 3 | `logger` 유틸 영역 박음 | `src/lib/logger.ts` |
| 4 | 핵심 영역 로그 영역 박음 | 게임 종료·결제·인증·RPC 실패 |
| 5 | `/admin/logs` 페이지 영역 박음 | 필터·검색·페이지네이션 |
| 6 | 토스트 영역 박음 | silent fail 영역 박힘 영역 영역 박은 영역 박음 사용자 영역 알림 영역 |

---

## 4. 출시 영역 일정 영역 영향 영역

### 4.1 박을 영역 일정 영역

| 영역 | 영역 영역 박힘 영역 | 일수 영역 |
|---|---|---|
| Phase 3 영역 | 마이그 영역 정리 + RLS + 중복 정의 영역 정리 영역 + 문서 영역 정정 영역 | ~2일 |
| Phase 4 영역 | 로그·Sentry·Admin 페이지 | ~2일 |
| Phase 5 영역 | Admin 페이지 + Edge Function 영역 정리 영역 | ~1일 |
| 추가 영역 | About·Contact·FAQ·OG·PWA·Paddle·AdSense 영역 | ~3일 |

**합계 영역 ≈ 8일** — 5/17 영역에서 영역 시작 영역 시 영역 6/14 영역 예상 영역 (5/31 영역 무리 영역 박힘).

### 4.2 출시 영역 박힘 영역 박은 영역 박지 X 박힐 영역 박힌 영역

| 영역 | 영역 |
|---|---|
| 🔴 §1.1 마이그 영역 정리 영역 | Single Source of Truth — 영역 박지 X 박힘 영역 staging 영역 박지 X 박힘 영역 |
| 🔴 §1.5 silent fail 영역 | 사용자 영역 알림 X 영역 → 데이터 누락 영역 박힘 영역 알림 X 영역 박힘 영역 박힐 영역 박힘 |
| 🟡 §1.2 중복 정의 영역 | Production 영역 박은 영역 영역 박지 X 박힘 영역 시 영역 hard_delete 영역 실패 영역 가능 |
| 🟢 그 외 영역 | 문서 영역 영역 박힘 영역 출시 영역 박지 X 박힘 영역 |

---

## 5. 검증 영역 영역 SQL

### 5.1 Production 영역 영역 함수 영역 정의 영역 확인 영역
```sql
SELECT routine_name, pg_get_function_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS returns
  FROM information_schema.routines r
  JOIN pg_proc p ON p.proname = r.routine_name
  WHERE r.routine_schema = 'public'
    AND r.routine_name IN (
      'record_sublevel_attempt', 'get_mastery_score', 'hard_delete_account',
      'request_account_deletion', 'check_email_exists', 'handle_new_user_profile',
      'record_game_session', 'apply_payment_topup', 'run_daily_batch_analysis',
      'is_admin', 'is_reviewer', 'check_nickname_available'
    )
  ORDER BY routine_name;
```

### 5.2 Production 영역 영역 테이블 영역 확인 영역
```sql
SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name;
```

### 5.3 Production 영역 영역 RLS 정책 영역 확인 영역
```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, cmd;
```

### 5.4 Production 영역 영역 트리거 영역 확인 영역
```sql
SELECT trigger_name, event_manipulation, event_object_table, action_statement
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
  ORDER BY event_object_table;
```

### 5.5 마이그 영역 영역 없는 테이블 영역 RLS 영역 검증 영역
```sql
-- 8개 테이블 영역 영역 RLS 영역 박힘 여부 영역
SELECT relname AS table_name, relrowsecurity AS rls_enabled,
       relforcerowsecurity AS rls_forced
  FROM pg_class
  WHERE relkind = 'r'
    AND relnamespace = 'public'::regnamespace
    AND relname IN (
      'user_sessions', 'user_stats_daily', 'note_mastery',
      'leagues', 'league_members', 'admin_actions',
      'daily_batch_runs', 'user_streaks', 'subscriptions'
    );
```

---

## 6. 발견 영역 영역 추가 (Session 3 박는 중 영역)

### 6.1 §1.7 결제 영역 영역 추가 발견 영역
- `subscriptions` 영역 = `paddle-webhook/index.ts:139` 영역 박힘 영역 영역 마이그 영역 없음
- `create-checkout-session` Edge Function 영역 존재 영역 (`supabase/functions/`)
- `payment-webhook` + `verify-iap-receipt` Edge Function 영역 = ⚠️ 박힌 영역 박힘 영역 박은 영역 영역 production 영역 영역 박지 X 박힐 영역 가능

### 6.2 §1.15 스캔 영역 영역 박는 영역
- `analyze-sheet-music/index.ts:355` 영역 = `consume_scan_quota` RPC 영역 박음
- `analyze-sheet-music/index.ts:178` 영역 = `profiles` SELECT 영역 박음
- ⚠️ 스캔 영역 결과 영역 영역 `user_custom_scores` 영역 INSERT 영역 박지 X 박힘 영역 — UI 영역 박힌 영역 박힘 영역 박지 X 박힌 영역 박은 영역 박힘 영역

### 6.3 useUserMastery·useMasteryDetails·useAdminUserDetail 영역 영역 박힘 영역
- 3개 영역 영역 `note_mastery` 영역 SELECT 박힘 영역
- ⚠️ INSERT 영역 진입점 영역 명확 X 영역 (Session 1 영역 박은 영역 박힘 영역) → 일일 배치 영역 박힘 영역 영역 dataset 영역 0건 영역 가능

---

## 7. Phase 1·2·3 완료 영역 박음

### 7.1 박힌 영역

| Phase | 박힘 | 영역 |
|---|---|---|
| Phase 1 Session 1 | `README.md` + `01_SCHEMA.md` | 16 + 3개 신규 (user_streaks·subscriptions·league_groups) = 19개 테이블 |
| Phase 1 Session 2 | `02_RLS_POLICIES.md` + `03_SQL_FUNCTIONS.md` | 45 + 신규 정책 + 22 + 1개 신규 (`get_my_league_group_id`) 함수 + 4 + 1개 (`on_session_complete`) 트리거 |
| Phase 1 Session 3 | `04_DATA_FLOWS.md` + `05_KNOWN_ISSUES.md` | 12개 기능 + 8개 카테고리 |
| Phase 2 | Cursor 검증 + Production Dashboard 직접 확인 | 9건 불일치 + 신규 발견 영역 박힘 |
| Phase 3 Step 1-1 | `scripts/phase3/01_extract_production_schema.sql` | Production schema 추출 SQL |
| Phase 3 Step 1-2 | `supabase/migrations/20260518_phase3_consolidation.sql` | 10 테이블 + 3 함수 + 1 트리거 + 1 DROP |
| Phase 3 Step 1-3 | 함수 본문 Production 정확본 정정 | `handle_session_complete`·`check_nickname_available`·`get_my_league_group_id` |
| Phase 3 Step 2-A | `supabase/migrations/20260518_device_change_events_update_policy.sql` | silent fail 해소 |
| Phase 3 Step 2-B | `record_sublevel_attempt(6-arg)` DROP | dead 함수 정리 |
| Phase 3 Step 3 | 중복 정의 함수 6개 Production 확인 | 모두 최신 영역 박힘 |
| Phase 3 Step 4 | 6개 문서 19건 정정 | 이 영역 |

### 7.2 통계 영역

| 영역 | 카운트 |
|---|---|
| 박힌 테이블 영역 | 19개 (8개 신규 마이그 영역 박은 영역 추가 영역) |
| 박힌 정책 영역 | 45 + 20 (Phase 3 새로 박은 영역) = **65개** |
| 박힌 함수 영역 | 22 + 1 (`get_my_league_group_id`) = **23개** |
| 박힌 트리거 영역 | 4 + 1 (`on_session_complete`) = **5개** |
| 박힌 기능 영역 | 12개 (04_DATA_FLOWS) |
| Phase 3 박힘 영역 = silent fail 해소 | 2건 (#2 device_change_events + #7 note_mastery) |
| Phase 4 박을 영역 = silent fail 박지 X 박힌 영역 | 5건 (#1·#3·#4 + 새로 박힐 영역) |

### 7.3 출시 박을 영역 (Phase 4·5·5+)
- **Phase 4** (로그·Sentry): Sentry + `app_logs` + `logger` + 토스트 박음
- **Phase 5** (Admin): `/admin/logs` 페이지 박음
- **결제 시스템 영역 박음** (Paddle Checkout — 현재 IAP 영역만)
- **About·Contact·FAQ·OG·PWA·Paddle·AdSense 심사**
