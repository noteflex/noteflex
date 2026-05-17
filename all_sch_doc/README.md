# Noteflex 데이터베이스 영역 가이드

> 작성일: 2026-05-17 · 작성자: Noteflex CTO + Claude
> 영역: `all_sch_doc/` (=루트) · Session 1 (README + 01_SCHEMA)

---

## 0. 진입점 영역

이 문서를 박는 사용자 영역:
- **CTO** (전체 흐름 영역 파악)
- **개발자** (테이블 박는·읽는 코드 영역 찾기)
- **다른 영역 협업자** (가입·결제·게임 영역 데이터 흐름 영역 이해)

박는 목적 영역:
> Noteflex 영역 데이터 → 어디서 어떻게 박히는지 한 곳에서 박힘.
> "user_sessions에 INSERT가 어디서 박히는지?" → 03_SQL_FUNCTIONS.md + 01_SCHEMA.md "박는 영역" 항목.

---

## 1. 문서 영역 안내

| 파일 영역 | 박은 영역 | 박힌 시점 |
|---|---|---|
| `README.md` (이 파일) | 전체 가이드 영역 + Phase 영역 | Session 1 |
| `01_SCHEMA.md` | 모든 테이블 영역 (16개) — 컬럼·인덱스·FK·박는 코드·읽는 코드 영역 | Session 1 |
| `02_RLS_POLICIES.md` | 모든 RLS 정책 영역 — 누구 박을 수 있는지 | Session 2 (PENDING) |
| `03_SQL_FUNCTIONS.md` | 모든 RPC·트리거·SECURITY DEFINER 함수 영역 | Session 2 (PENDING) |
| `04_DATA_FLOWS.md` | 기능별 데이터 흐름 영역 (가입→게임→결제→탈퇴) | Session 3 (PENDING) |
| `05_KNOWN_ISSUES.md` | 발견된 누락·silent fail 영역 + 액션 | Session 3 (PENDING) |

---

## 2. Noteflex 영역 큰 그림

### 2.1 영역별 그룹

```
┌─────────────────────────────────────────────────────────────┐
│ AUTH 영역 (Supabase 관리)                                    │
│   auth.users  ← Magic Link 가입 영역 (이메일 1개당 1행)      │
│              │                                                │
│              ▼ trigger: handle_new_user_profile()            │
└──────────────┼──────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│ USER 영역                                                    │
│   profiles ─────────────────────────────────────────────┐   │
│     · 기본 정보 (email, nickname, avatar)                │   │
│     · 게임 상태 (current_streak, total_xp, current_league│   │
│                  last_practice_date)                     │   │
│     · 결제 상태 (is_premium, subscription_tier,           │   │
│                  premium_until, scan_quota)              │   │
│     · 탈퇴 상태 (is_deleted, deleted_at)                  │   │
│     · 캘리브레이션 (user_env_offset_ms)                   │   │
└─────────────────────────────────────────────────────────┼───┘
                                                          │
       ┌──────────────┬─────────────┬────────────────┐    │
       ▼              ▼             ▼                ▼    │
┌─────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┴────┐
│ GAME 영역   │ │ STATS영역 │ │ LIMIT 영역    │ │ PAYMENT 영역   │
│             │ │           │ │              │ │                │
│ user_       │ │ user_     │ │ daily_       │ │ payment_       │
│  sessions   │ │  stats_   │ │  sessions    │ │  events        │
│   (게임 1회) │ │  daily    │ │   (한도 카운트)│ │   (결제 1건)    │
│             │ │   (날짜별) │ │              │ │                │
│ user_       │ │           │ │              │ └────────────────┘
│  sublevel_  │ │ note_     │ │              │
│  progress   │ │  mastery  │ │              │
│   (Lv별)    │ │   (음표별) │ │              │
│             │ │           │ │              │
│ user_note_  │ │           │ │              │
│  logs       │ │           │ │              │
│   (음표 시도)│ │           │ │              │
└─────────────┘ └───────────┘ └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LEAGUE 영역 (현재 UI 영역 비활성 — 향후 부활)                  │
│   leagues  ← 리그 정의 (Bronze ~ Diamond)                    │
│   league_members  ← 사용자별 주간 XP·랭킹                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ADMIN 영역                                                   │
│   admin_actions  ← 관리자 액션 감사 로그                      │
│   daily_batch_runs  ← 일일 분석 배치 실행 이력                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ MISC 영역 (low-traffic 또는 deprecated)                      │
│   user_scores  ← 사용자 업로드 악보 (PENDING — 신기능)        │
│   practice_logs  ← 악보 연습 로그 (PENDING)                   │
│   user_custom_scores  ← 사용자 커스텀 점수 (스캔 데이터)      │
│   device_change_events  ← 오디오 장치 변경 추적 (§7.3)       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 핵심 매핑

| 영역 | 박는 테이블 | 박는 함수·코드 |
|---|---|---|
| 가입 | `auth.users` → `profiles` (trigger) | `handle_new_user_profile()` |
| 게임 완료 | `user_sessions` + `user_stats_daily` + `profiles.last_practice_date` | `record_game_session()` RPC (2026-05-17) |
| 레벨 진행 | `user_sublevel_progress` | `record_sublevel_attempt()` RPC |
| 일일 한도 | `daily_sessions` | `increment_daily_session()` RPC |
| 결제 | `payment_events` + `profiles.scan_quota` | `apply_payment_topup()` RPC |
| 탈퇴 | `profiles.is_deleted`/`deleted_at` | `request_account_deletion()` RPC |
| 복구 | `profiles.is_deleted` ← false | `restore_account()` RPC |
| 일일 분석 | `note_mastery` + `daily_batch_runs` | `run_daily_batch_analysis()` RPC |

---

## 3. 마이그레이션 영역 타임라인 (실제 박힌 영역만)

> ⚠️ `supabase/migrations/` 영역 27개 파일 영역 박혔지만, **일부 테이블 (user_sessions, user_stats_daily, note_mastery, leagues, league_members, admin_actions, daily_batch_runs)** 영역 Supabase Dashboard 영역 직접 박힘 → migration 영역 X.

| 시점 영역 | 파일 영역 | 박은 영역 |
|---|---|---|
| 2026-04-04 | `20260404142430_db7ea540-…` | `user_custom_scores` 테이블 영역 박음 |
| 2026-04-05 | `20260405142021_28ee1d25-…` | `user_note_logs` 테이블 영역 박음 |
| 2026-04-05 | `20260405142751_dc015ee6-…` | `user_note_logs` RLS 정책 영역 박음 |
| 2026-04-08 | `20260408001000_add_profiles_scan_quota` | `profiles` 테이블 + `scan_quota` + `handle_new_user_profile` trigger + `consume_scan_quota`/`topup_scan_quota` RPC 박음 |
| 2026-04-08 | `20260408003000_add_payment_events` | `payment_events` 테이블 + `apply_payment_topup` RPC 박음 |
| 2026-04-10 | `20260410165000_add_user_scores_and_practice_logs` | `user_scores` + `practice_logs` 테이블 영역 박음 |
| 2026-04-10 | `20260410170000_rls_user_scores_practice_logs` | `user_scores` + `practice_logs` RLS 영역 박음 |
| 2026-04-24 | `20260424_premium_expiry` | `daily_batch_runs.premium_expired` 컬럼 + `expire_premium_users` + `run_daily_batch_analysis` 영역 박음 |
| 2026-04-25 | `20260425_sublevel_system` | `user_sublevel_progress` 테이블 + `profiles.subscription_tier` + `record_sublevel_attempt` RPC 박음 |
| 2026-05-03 | `20260503_add_device_change_events` | `device_change_events` 테이블 영역 박음 |
| 2026-05-03 | `20260503_add_user_env_offset` | `profiles.user_env_offset_ms` 컬럼 영역 박음 |
| 2026-05-09 | `20260509_daily_sessions` | `daily_sessions` 테이블 + `increment_daily_session` + `get_today_session_count` RPC 박음 |
| 2026-05-09 | `20260509_fast_track` | `user_sublevel_progress.fast_track` + `record_sublevel_attempt` 패스트트랙 분기 박음 |
| 2026-05-09 | `20260509_mastery_score` | `get_mastery_score` RPC 박음 |
| 2026-05-09 | `20260509_pass_criteria_v2` | `user_sublevel_progress.avg_reaction_ratio` + 통과 기준 정정 영역 박음 |
| 2026-05-10 | `20260510_check_email_v2` | `check_email_exists` v2 박음 (미인증/인증 분기) |
| 2026-05-10 | `20260510_rls_audit` | 전 테이블 RLS 영역 보강 + `is_admin()` 헬퍼 박음 |
| 2026-05-11 | `20260511_account_deletion` | `profiles.{deleted_at,is_deleted,deletion_reason}` + `request_account_deletion` RPC 박음 |
| 2026-05-12 | `20260512_profile_completed_default` | `profiles.profile_completed` default 정정 + `handle_new_user_profile` 갱신 영역 박음 |
| 2026-05-13 | `20260513_account_recovery` | `check_email_exists` v3 (4상태) + `restore_account` + `hard_delete_expired_accounts` 박음 |
| 2026-05-13 | `20260513_hard_delete_by_email` | `hard_delete_account(p_email)` 영역 박음 (비인증 호출 허용) |
| 2026-05-13 | `20260513_hard_delete_with_auth` | "새로 시작" — profiles + auth.users 모두 영구 삭제 영역 박음 |
| 2026-05-13 | `20260513_preserve_nickname` | 탈퇴 시 닉네임·아바타 보존 영역 박음 |
| 2026-05-14 | `20260514_fresh_start` | soft-delete 계정 프로필 영구 삭제 영역 박음 |
| 2026-05-15 | `20260515_reviewer_role` | `profiles.role` CHECK 추가 + `is_reviewer()` + `forpaddle@noteflex.app` 계정 영역 박음 |
| 2026-05-16 | `20260516_reviewer_sessions_rls` | `user_sessions` RLS + `trg_update_profile_after_session` trigger 영역 박음 |
| 2026-05-17 | `20260517_record_game_session_rpc` | `record_game_session()` SECURITY DEFINER RPC 영역 박음 (3개 테이블 원자적 영역 박음) |
| 2026-05-18 | `20260518_phase3_consolidation` | **Phase 3 Step 1-2** — Dashboard 직접 박힌 영역 10개 테이블 (`user_sessions`·`user_stats_daily`·`note_mastery`·`leagues`·`league_groups` 신규·`league_members`·`admin_actions`·`daily_batch_runs`·`user_streaks` 컬럼 3개 추가·`subscriptions`) + 3개 함수 (`handle_session_complete`·`check_nickname_available`·`get_my_league_group_id` 신규) + 1개 트리거 (`on_session_complete`) + 1개 DROP (`record_sublevel_attempt` 6-arg dead) 영역 마이그 영역 재현 박음. ⚠️ 함수 본문 영역 임시 — Step 1-3 영역 박음 영역 박음 정확 본문 영역 박음 |
| 2026-05-18 | `20260518_device_change_events_update_policy` | **Phase 3 Step 1** — UPDATE 정책 영역 누락 영역 박음 (`userEnvironmentOffset.ts:135` silent fail 영역 해결 영역) |

### 3.1 마이그레이션 외 Dashboard 직접 박은 영역 → Phase 3 영역에서 재현 완료 ✅

> 아래 10개 테이블·3개 함수·1개 트리거는 Production Dashboard에서 직접 생성됐으나,
> **Phase 3 Step 1-2 (2026-05-18) 마이그레이션 재현 완료** — `20260518_phase3_consolidation.sql`.
> 다른 환경(staging, 신규 dev)에서도 동일하게 박힘.

| 테이블 | 박힌 근거 | Phase 3 재현 |
|---|---|---|
| `user_sessions` | `useSessionRecorder.ts` + `useMyStats.ts` | ✅ `20260518_phase3_consolidation.sql` §1 |
| `user_stats_daily` | `useMyStats.ts` + `useUserStats.ts` | ✅ §2 |
| `note_mastery` | `useMyStats.ts` + `useMasteryDetails.ts` + `useUserMastery.ts` | ✅ §3 |
| `leagues` | `useUserStats.ts` | ✅ §4 |
| `league_groups` (Phase 3 신규 발견) | `get_my_league_group_id()` 영역 박음 | ✅ §5 |
| `league_members` | `useUserStats.ts` | ✅ §6 |
| `admin_actions` | `useAdminLogs.ts` + `admin-action` Edge Function | ✅ §7 |
| `daily_batch_runs` | `20260424_premium_expiry.sql` ALTER + `useBatchRuns.ts` | ✅ §8 |
| `user_streaks` (컬럼 3개 추가 발견) | `admin-action` Edge Function | ✅ §9 |
| `subscriptions` | `paddle-webhook` Edge Function | ✅ §10 |
| 함수 `handle_session_complete` | `user_sessions` AFTER INSERT 트리거 함수 | ✅ §11 |
| 트리거 `on_session_complete` | `user_sessions` 게임 종료 박음 | ✅ §12 |
| 함수 `check_nickname_available` | `useNicknameAvailability.ts:38, 73` | ✅ §13 |
| 함수 `get_my_league_group_id` (신규 발견) | `league_members` RLS 정책 영역 박음 | ✅ §0 |

---

## 4. Phase 영역

### Phase 1 — 전수 조사 + 문서화 ✅ 완료
- ✅ Session 1: README + 01_SCHEMA
- ✅ Session 2: 02_RLS_POLICIES + 03_SQL_FUNCTIONS
- ✅ Session 3: 04_DATA_FLOWS + 05_KNOWN_ISSUES

### Phase 2 — 검증 쿼리 영역 박음 ✅ 완료
- 각 테이블 영역 행 수·최근 INSERT·RLS 위반 영역 검증 쿼리 영역 박음
- Supabase Dashboard 영역 직접 박힌 영역 ↔ migration 영역 ↔ src/ 영역 박힌 영역 정합 영역 검증
- Cursor 검증 결과: 9건 불일치 발견 + Production 영역 직접 확인 영역 박음

### Phase 3 — SSoT 회복 + silent fail 해소 ✅ 완료
- ✅ **Step 1-1 (2026-05-18)** — Production schema 추출 SQL 박음
  - `scripts/phase3/01_extract_production_schema.sql` — 13개 섹션(A~M)
- ✅ **Step 1-2 (2026-05-18)** — Production schema → 마이그레이션 재현
  - `supabase/migrations/20260518_phase3_consolidation.sql` — 10개 테이블 + 3개 함수 + 1개 트리거 + 1개 DROP
  - 신규 발견: `league_groups` 테이블 + `get_my_league_group_id` 함수 + `user_streaks` 컬럼 3개
  - 중복 정책 정리 + DROP IF EXISTS → CREATE 통일 명명
- ✅ **Step 1-3 (2026-05-18)** — 함수 본문 Production 정확본 정정
  - `handle_session_complete`: user_stats_daily UPSERT + profiles.total_xp/last_practice_date UPDATE + note_mastery UPSERT (mastery_level 5단계 95/90/80/70/50% 재계산)
  - `check_nickname_available`: 형식 1차 검증 (3-20자 + 정규식 `^[a-z][a-z0-9_]{2,19}$`) + 중복 검사
  - `get_my_league_group_id`: LANGUAGE sql STABLE — 최근 joined_at 영역 group_id
- ✅ **Step 2-A (2026-05-18)** — device_change_events UPDATE 정책 silent fail 해소
  - `supabase/migrations/20260518_device_change_events_update_policy.sql`
- ✅ **Step 2-B (2026-05-18)** — `record_sublevel_attempt` 6개 인자 dead 함수 DROP
- ✅ **Step 3 (2026-05-18)** — 중복 정의 함수 6개 production 확인 (이미 최신 영역)
- ✅ **Step 4 (2026-05-18)** — 문서 정정 (19건) — 이 영역

### Phase 4 — 로그·Admin (출시 후)
- Sentry 박음
- `app_logs` 테이블 박음
- `logger` 유틸 박음
- silent fail 영역 사용자 토스트 박음
- `/admin/logs` 페이지 박음

### 출시 박을 영역
- 결제 시스템 (Paddle Checkout — 현재 IAP만 박힌 영역)
- Phase 4 영역 (Sentry + app_logs + logger)
- Phase 5 영역 (Admin `/logs` 페이지)
- About·Contact·FAQ·OG image·PWA manifest
- Paddle·AdSense 심사 박음

---

## 5. 박는 규칙

1. **추측 X.** `supabase/migrations/` 영역 + `src/` 영역에서 박힌 영역만 박음.
2. 박지 X 박힌 영역 = `⚠️ TODO·확인 필요` 영역 박음.
3. 컬럼 영역 default·NULL 영역 = migration 영역에서 박힌 영역 그대로.
4. 박는 영역·읽는 영역 = `file:line` 영역 박음 (grep 영역 박힌 결과).
5. 데이터 예시 영역 = 실제 데이터 영역 박힘 영역 (production 영역 박힌 영역 그대로 박지 X — schema 영역만).
