-- ════════════════════════════════════════════════════════════════
-- Migration: 20260518_phase3_consolidation.sql
-- ════════════════════════════════════════════════════════════════
-- 목적: Production Dashboard 영역 직접 박힌 영역 테이블·함수·트리거 영역
--      마이그레이션 영역 재현 영역 박음 SSoT 회복 영역.
--
-- 박힌 영역 (Phase 1 + Phase 2 영역 검증 영역):
--   - 8개 테이블 영역: user_sessions·user_stats_daily·note_mastery·
--                    leagues·league_members·admin_actions·daily_batch_runs·
--                    user_streaks·subscriptions
--   - 2개 함수 영역: check_nickname_available·handle_session_complete
--   - 1개 트리거 영역: on_session_complete (trg_update_profile_after_session 영역
--                  영역 20260516_reviewer_sessions_rls.sql 영역 박힘 영역)
--
-- 원칙:
--   - IF NOT EXISTS / OR REPLACE 박음 → Production 영역 박지 X 박힘 영역 깨짐 영역
--   - DROP POLICY IF EXISTS → CREATE POLICY 패턴 (idempotent)
--   - 다른 환경 (staging, 신규 dev) 영역 박힘 영역 박은 영역 영역 박음 영역 영역 동일 영역 상태
--
-- ⚠️ 박힌 영역 박은 영역 박음 영역 박은 영역 박힘 영역 → scripts/phase3/01_extract_production_schema.sql 영역
--    Supabase SQL Editor 영역 박음 → 결과 영역 박음 영역 Claude 영역 짚어줌 영역 박음 영역 정확 schema 영역 박음.
--
-- 이 파일 영역 현재 영역 = **TODO 골격 영역**. Step 1-1 결과 영역 박은 영역 박음 영역 → 정확 schema 영역 박음.
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 1. user_sessions  (게임 1회 영역 INSERT 영역 박힘 영역)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_sessions (
  -- TODO[Step 1-1 결과 박은 영역 박음]:
  --   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  --   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  --   level INT NOT NULL,
  --   started_at TIMESTAMPTZ NOT NULL,
  --   ended_at TIMESTAMPTZ,
  --   duration_seconds INT,
  --   total_notes INT NOT NULL,
  --   correct_notes INT NOT NULL,
  --   accuracy FLOAT,
  --   avg_reaction_ms INT,
  --   xp_earned INT NOT NULL DEFAULT 0,
  --   session_type TEXT,
  --   note_attempts JSONB,
  --   summary JSONB,
  --   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()  -- ⚠️ 임시 영역 박힘 — Step 1-1 결과 영역 박은 영역 박음 정확 영역 컬럼 박음
);

-- TODO[인덱스 영역 Step 1-1 결과 박은 영역 박음]:
-- CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id_started_at
--   ON public.user_sessions (user_id, started_at DESC);

-- RLS 영역 (20260516_reviewer_sessions_rls.sql 영역 박힘 영역 — idempotent 영역 박힘 영역)
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_sessions_select_own ON public.user_sessions;
CREATE POLICY user_sessions_select_own ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_sessions_insert_own ON public.user_sessions;
CREATE POLICY user_sessions_insert_own ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_sessions_admin_select ON public.user_sessions;
CREATE POLICY user_sessions_admin_select ON public.user_sessions
  FOR SELECT USING (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 2. user_stats_daily  (사용자 영역 × 날짜 영역 = 1행)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_stats_daily (
  -- TODO[Step 1-1 결과 박은 영역 박음]:
  --   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  --   stat_date DATE NOT NULL,
  --   sessions_count INT NOT NULL DEFAULT 0,
  --   total_notes INT NOT NULL DEFAULT 0,
  --   correct_notes INT NOT NULL DEFAULT 0,
  --   xp_earned INT NOT NULL DEFAULT 0,
  --   avg_accuracy FLOAT,
  --   avg_reaction_ms INT,
  --   total_duration_seconds INT NOT NULL DEFAULT 0,
  --   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  --   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  --   PRIMARY KEY (user_id, stat_date)
  user_id UUID NOT NULL,  -- ⚠️ 임시 영역 박힘
  stat_date DATE NOT NULL,
  PRIMARY KEY (user_id, stat_date)
);

ALTER TABLE public.user_stats_daily ENABLE ROW LEVEL SECURITY;

-- TODO[RLS 정책 영역 Step 1-1 결과 박은 영역 박음]


-- ════════════════════════════════════════════════════════════════
-- 3. note_mastery  (사용자 영역 × 음표 영역 = 1행)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.note_mastery (
  -- TODO[Step 1-1 결과 박은 영역 박음 — Section M 영역 박은 영역 정확 컬럼 영역 박음]:
  --   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  --   note_key TEXT NOT NULL,
  --   clef TEXT NOT NULL,
  --   total_attempts INT NOT NULL DEFAULT 0,
  --   correct_count INT NOT NULL DEFAULT 0,
  --   recent_accuracy FLOAT,
  --   mastery_level INT,
  --   avg_reaction_ms INT,
  --   trend TEXT,
  --   last_seen_at TIMESTAMPTZ,
  --   weakness_flag BOOLEAN NOT NULL DEFAULT false,
  --   weakness_flagged_at TIMESTAMPTZ,
  --   mastery_flag BOOLEAN NOT NULL DEFAULT false,
  --   mastery_flagged_at TIMESTAMPTZ,
  --   last_batch_analyzed_at TIMESTAMPTZ,
  --   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  --   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  --   PRIMARY KEY (user_id, note_key, clef)
  user_id UUID NOT NULL,  -- ⚠️ 임시 영역 박힘
  note_key TEXT NOT NULL,
  clef TEXT NOT NULL,
  PRIMARY KEY (user_id, note_key, clef)
);

ALTER TABLE public.note_mastery ENABLE ROW LEVEL SECURITY;

-- TODO[RLS 정책 영역 Step 1-1 결과 박은 영역 박음]


-- ════════════════════════════════════════════════════════════════
-- 4. leagues  (리그 정의 영역 — UI 비활성 영역)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.leagues (
  -- TODO[Step 1-1 결과 박은 영역 박음]:
  --   id INT PRIMARY KEY,
  --   name TEXT NOT NULL UNIQUE,
  --   rank INT NOT NULL,
  --   icon TEXT,
  --   color TEXT,
  --   description TEXT,
  --   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  id INT PRIMARY KEY  -- ⚠️ 임시 영역 박힘
);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- TODO[RLS 정책 영역 Step 1-1 결과 박은 영역 박음 — public SELECT 영역 박힘 영역 추정]


-- ════════════════════════════════════════════════════════════════
-- 5. league_members  (사용자 영역 × 리그 그룹 = 1행)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.league_members (
  -- TODO[Step 1-1 결과 박은 영역 박음]:
  --   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  --   group_id TEXT NOT NULL,
  --   weekly_xp INT NOT NULL DEFAULT 0,
  --   rank_in_group INT,
  --   joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  --   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  --   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  --   PRIMARY KEY (user_id, group_id)
  user_id UUID NOT NULL,  -- ⚠️ 임시 영역 박힘
  group_id TEXT NOT NULL,
  PRIMARY KEY (user_id, group_id)
);

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

-- TODO[RLS 정책 영역 Step 1-1 결과 박은 영역 박음]


-- ════════════════════════════════════════════════════════════════
-- 6. admin_actions  (관리자 감사 로그)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_actions (
  -- TODO[Step 1-1 결과 박은 영역 박음]:
  --   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  --   admin_id UUID NOT NULL REFERENCES public.profiles(id),
  --   action_type TEXT NOT NULL,
  --   target_user_id UUID REFERENCES public.profiles(id),
  --   details JSONB,
  --   ip_address TEXT,
  --   user_agent TEXT,
  --   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()  -- ⚠️ 임시 영역 박힘
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- TODO[RLS 정책 영역 Step 1-1 결과 박은 영역 박음 — admin SELECT 영역만 영역 박힘 영역 추정]


-- ════════════════════════════════════════════════════════════════
-- 7. daily_batch_runs  (일일 배치 영역 이력)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.daily_batch_runs (
  -- TODO[Step 1-1 결과 박은 영역 박음]:
  --   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  --   run_date DATE NOT NULL UNIQUE,
  --   users_analyzed INT NOT NULL DEFAULT 0,
  --   weakness_flagged INT NOT NULL DEFAULT 0,
  --   mastery_flagged INT NOT NULL DEFAULT 0,
  --   weakness_released INT NOT NULL DEFAULT 0,
  --   premium_expired INT NOT NULL DEFAULT 0,
  --   duration_ms INT NOT NULL DEFAULT 0,
  --   status TEXT NOT NULL,
  --   error_message TEXT,
  --   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()  -- ⚠️ 임시 영역 박힘
);

ALTER TABLE public.daily_batch_runs ENABLE ROW LEVEL SECURITY;

-- TODO[RLS 정책 영역 Step 1-1 결과 박은 영역 박음 — admin SELECT 영역만 영역 박힘 영역 추정]


-- ════════════════════════════════════════════════════════════════
-- 8. user_streaks  (사용자 영역 streak 영역 박힘 영역 — admin-action Edge Function 영역 박음)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_streaks (
  -- TODO[Step 1-1 결과 박은 영역 박음]:
  --   user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  --   current_streak INT NOT NULL DEFAULT 0,
  --   longest_streak INT NOT NULL DEFAULT 0,
  --   last_practice_date DATE,
  --   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  --   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  user_id UUID PRIMARY KEY  -- ⚠️ 임시 영역 박힘
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- TODO[RLS 정책 영역 Step 1-1 결과 박은 영역 박음]


-- ════════════════════════════════════════════════════════════════
-- 9. subscriptions  (Paddle/Stripe webhook 영역 박음)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscriptions (
  -- TODO[Step 1-1 결과 박은 영역 박음]:
  --   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  --   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  --   provider TEXT NOT NULL,
  --   external_id TEXT NOT NULL,
  --   status TEXT NOT NULL,
  --   plan_id TEXT,
  --   current_period_start TIMESTAMPTZ,
  --   current_period_end TIMESTAMPTZ,
  --   cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  --   metadata JSONB,
  --   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  --   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  --   UNIQUE (provider, external_id)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()  -- ⚠️ 임시 영역 박힘
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- TODO[RLS 정책 영역 Step 1-1 결과 박은 영역 박음]


-- ════════════════════════════════════════════════════════════════
-- 10. handle_session_complete  (user_sessions INSERT trigger 영역 함수)
-- ════════════════════════════════════════════════════════════════
-- 박힌 영역: note_mastery·user_stats_daily·profiles 영역 갱신 영역
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_session_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- TODO[Step 1-1 Section H 결과 박은 영역 박음 — Production 영역 박은 영역 정확 본문 영역 박음]:
  --   - note_mastery UPSERT (NEW.note_attempts JSONB 박은 영역 음표별 영역 박음)
  --   - user_stats_daily UPSERT (sessions_count, total_notes, correct_notes, xp_earned, avg_accuracy, avg_reaction_ms, total_duration_seconds 영역 누적 영역)
  --   - profiles 갱신 영역 (current_streak·longest_streak·total_xp·last_practice_date 영역 박힘 영역 박지 X 박힌 영역 박은 영역 박음)
  --
  -- ⚠️ 임시 영역 박힘 — Step 1-1 영역 박은 영역 박음 영역 박힌 영역 박은 영역 박은 영역 정확 영역 본문 영역 박음.
  RAISE NOTICE 'handle_session_complete: placeholder — Step 1-1 결과 박은 영역 박은 영역 본문 박음';
  RETURN NEW;
END;
$func$;


-- ════════════════════════════════════════════════════════════════
-- 11. on_session_complete  (user_sessions AFTER INSERT trigger)
-- ════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_session_complete ON public.user_sessions;
CREATE TRIGGER on_session_complete
  AFTER INSERT ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_session_complete();


-- ════════════════════════════════════════════════════════════════
-- 12. check_nickname_available  (닉네임 영역 중복 영역 확인)
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_nickname_available(p_nickname TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $func$
BEGIN
  -- TODO[Step 1-1 Section J 결과 박은 영역 박음 — Production 영역 박은 영역 정확 본문 영역 박음]:
  --   RETURN NOT EXISTS (
  --     SELECT 1 FROM public.profiles
  --     WHERE lower(nickname) = lower(trim(p_nickname))
  --       AND is_deleted = false
  --   );
  --
  -- ⚠️ 임시 영역 박힘 — Step 1-1 영역 박은 영역 박음 영역 정확 영역 본문 영역 박음.
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(nickname) = lower(trim(p_nickname))
      AND COALESCE(is_deleted, false) = false
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.check_nickname_available(TEXT) TO anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 13. record_sublevel_attempt 6개 인자 dead 함수 영역 DROP
-- ════════════════════════════════════════════════════════════════
-- 박힌 영역: Phase 1 영역 박은 영역 박힘 영역 박은 영역 6개 인자 영역 + 7개 인자 영역 영역 중복 영역 박힘 영역.
--          현재 src/hooks/useLevelProgress.ts:72 영역 박은 영역 7개 인자 영역만 박음 영역 박지 X 박힌 영역.
--          6개 인자 영역 = dead 영역 박은 영역 → DROP 영역.
-- ⚠️ 7개 인자 버전 (p_avg_reaction_ratio NUMERIC) 영역 유지 영역.
-- ════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.record_sublevel_attempt(
  INT,    -- p_level
  INT,    -- p_sublevel
  INT,    -- p_attempts
  INT,    -- p_correct
  INT,    -- p_max_streak
  TEXT    -- p_game_status
);


-- ════════════════════════════════════════════════════════════════
-- 끝 영역
-- ════════════════════════════════════════════════════════════════
-- 박은 영역 후 영역 박힌 영역 검증 영역:
--   1. SELECT * FROM information_schema.tables WHERE table_schema = 'public' 영역 박음 — 9개 테이블 영역 박힘 영역
--   2. SELECT * FROM pg_policies WHERE schemaname = 'public' 영역 박음 — 45개 + 박은 영역 박힘 영역
--   3. SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('handle_session_complete', 'check_nickname_available') — 박힘 영역
--   4. SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'user_sessions' — on_session_complete + trg_update_profile_after_session 영역 박힘 영역
-- ════════════════════════════════════════════════════════════════
