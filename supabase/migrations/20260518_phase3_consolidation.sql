-- ════════════════════════════════════════════════════════════════
-- Migration: 20260518_phase3_consolidation.sql
-- ════════════════════════════════════════════════════════════════
-- 목적: Production Dashboard 영역 직접 박힌 영역 테이블·함수·트리거 영역
--      마이그레이션 영역 재현 영역 박음 SSoT (Single Source of Truth) 회복 영역.
--
-- 박힌 영역 (Phase 1 + Phase 2 + Cursor 검증 + Dashboard 직접 확인 영역):
--   - 10개 테이블 영역: user_sessions·user_stats_daily·note_mastery·
--                    leagues·league_groups (신규 발견)·league_members·
--                    admin_actions·daily_batch_runs·user_streaks·subscriptions
--   - 3개 함수 영역: handle_session_complete·check_nickname_available·
--                  get_my_league_group_id (신규 발견)
--   - 1개 트리거 영역: on_session_complete
--                    (trg_update_profile_after_session 영역
--                    20260516_reviewer_sessions_rls.sql 영역 박혀있음)
--   - 1개 DROP 영역: record_sublevel_attempt 6개 인자 dead 함수
--
-- 원칙:
--   - IF NOT EXISTS / OR REPLACE 박음 → Production 영역 박지 X 박힘 영역 깨짐 영역
--   - DROP POLICY IF EXISTS → CREATE POLICY 패턴 (idempotent)
--   - 다른 환경 (staging, 신규 dev) 영역 박힘 영역 박은 영역 영역 박음 영역 영역 동일 영역 상태
--
-- ✅ Step 1-3 (2026-05-18) — 함수 3개 본문 영역 Production 영역 추출 영역 박음 영역 박음
--    정확 영역 본문 영역 박은 영역 박음. 임시 영역 본문 영역 없음 영역.
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor 영역 박음.
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- 0. 헬퍼 함수 영역 — get_my_league_group_id (정책 영역 의존 영역)
-- ════════════════════════════════════════════════════════════════
-- 박힌 영역: league_members 영역 RLS 정책 영역 박은 영역 사용 영역. 정책 영역 박기 전 영역 박혀야 함.
-- 본문 영역 출처: Production Dashboard 영역 추출 영역 (Step 1-1 영역 박은 영역).
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_league_group_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT group_id FROM league_members
  WHERE user_id = auth.uid()
  ORDER BY joined_at DESC
  LIMIT 1
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_league_group_id() TO authenticated;


-- ════════════════════════════════════════════════════════════════
-- 1. user_sessions  (게임 1회 영역 INSERT 영역)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level             integer       NOT NULL CHECK (level >= 0 AND level <= 7),
  started_at        timestamptz   NOT NULL,
  ended_at          timestamptz   NOT NULL,
  duration_seconds  integer       NOT NULL CHECK (duration_seconds >= 0),
  total_notes       integer       NOT NULL DEFAULT 0,
  correct_notes     integer       NOT NULL DEFAULT 0,
  accuracy          numeric(5,4),
  avg_reaction_ms   integer,
  xp_earned         integer       NOT NULL DEFAULT 0,
  session_type      text          NOT NULL DEFAULT 'regular'
                       CHECK (session_type = ANY (ARRAY['regular', 'focus_mode', 'custom_score', 'tutorial'])),
  note_attempts     jsonb,
  summary           jsonb,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_date
  ON public.user_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_level
  ON public.user_sessions (user_id, level, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_date
  ON public.user_sessions (started_at DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 중복 정책 영역 정리 영역 박음 (Production 영역 박힌 영역 박힘 영역 박지 X 박힌 영역 박음):
DROP POLICY IF EXISTS "Users can view own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.user_sessions;
DROP POLICY IF EXISTS user_sessions_select_own ON public.user_sessions;
DROP POLICY IF EXISTS user_sessions_insert_own ON public.user_sessions;
DROP POLICY IF EXISTS user_sessions_admin_select ON public.user_sessions;

CREATE POLICY user_sessions_select_own ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_sessions_insert_own ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_sessions_admin_select ON public.user_sessions
  FOR SELECT USING (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 2. user_stats_daily  (사용자 × 날짜 영역 = 1행)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_stats_daily (
  user_id                uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stat_date              date          NOT NULL,
  sessions_count         integer       NOT NULL DEFAULT 0,
  total_notes            integer       NOT NULL DEFAULT 0,
  correct_notes          integer       NOT NULL DEFAULT 0,
  total_duration_seconds integer       NOT NULL DEFAULT 0,
  xp_earned              integer       NOT NULL DEFAULT 0,
  avg_accuracy           numeric(5,4),
  avg_reaction_ms        integer,
  sessions_by_level      jsonb,
  weak_notes             jsonb,
  updated_at             timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_stats_daily_user_recent
  ON public.user_stats_daily (user_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_stats_daily_date
  ON public.user_stats_daily (stat_date DESC);

ALTER TABLE public.user_stats_daily ENABLE ROW LEVEL SECURITY;

-- 중복 정책 영역 정리 영역
DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats_daily;
DROP POLICY IF EXISTS "Admins can view all stats" ON public.user_stats_daily;
DROP POLICY IF EXISTS "Admins can view all daily stats" ON public.user_stats_daily;
DROP POLICY IF EXISTS user_stats_daily_select_own ON public.user_stats_daily;
DROP POLICY IF EXISTS user_stats_daily_admin_select ON public.user_stats_daily;

CREATE POLICY user_stats_daily_select_own ON public.user_stats_daily
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_stats_daily_admin_select ON public.user_stats_daily
  FOR SELECT USING (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 3. note_mastery  (사용자 × 음표 영역 = 1행)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.note_mastery (
  user_id                  uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note_key                 text          NOT NULL,
  clef                     text          NOT NULL CHECK (clef = ANY (ARRAY['treble', 'bass'])),
  total_attempts           integer       NOT NULL DEFAULT 0,
  correct_count            integer       NOT NULL DEFAULT 0,
  avg_reaction_ms          integer,
  mastery_level            integer       NOT NULL DEFAULT 0 CHECK (mastery_level >= 0 AND mastery_level <= 5),
  recent_accuracy          numeric(5,4),
  trend                    text          DEFAULT 'stable' CHECK (trend = ANY (ARRAY['improving', 'stable', 'declining'])),
  first_seen_at            timestamptz   DEFAULT now(),
  last_seen_at             timestamptz   DEFAULT now(),
  updated_at               timestamptz   DEFAULT now(),
  weakness_flag            boolean       DEFAULT false,
  weakness_flagged_at      timestamptz,
  mastery_flag             boolean       DEFAULT false,
  mastery_flagged_at       timestamptz,
  last_batch_analyzed_at   timestamptz,
  PRIMARY KEY (user_id, note_key, clef)
);

CREATE INDEX IF NOT EXISTS idx_mastery_user
  ON public.note_mastery (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mastery_weak
  ON public.note_mastery (user_id, mastery_level, last_seen_at DESC)
  WHERE mastery_level < 3;
CREATE INDEX IF NOT EXISTS idx_note_mastery_weakness
  ON public.note_mastery (user_id, weakness_flag)
  WHERE weakness_flag = true;
CREATE INDEX IF NOT EXISTS idx_note_mastery_mastery
  ON public.note_mastery (user_id, mastery_flag)
  WHERE mastery_flag = true;

ALTER TABLE public.note_mastery ENABLE ROW LEVEL SECURITY;

-- 중복 정책 영역 정리 영역
DROP POLICY IF EXISTS "Users can view own mastery" ON public.note_mastery;
DROP POLICY IF EXISTS "Admins can view all mastery" ON public.note_mastery;
DROP POLICY IF EXISTS "Admins can view all note mastery" ON public.note_mastery;
DROP POLICY IF EXISTS note_mastery_select_own ON public.note_mastery;
DROP POLICY IF EXISTS note_mastery_admin_select ON public.note_mastery;

CREATE POLICY note_mastery_select_own ON public.note_mastery
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY note_mastery_admin_select ON public.note_mastery
  FOR SELECT USING (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 4. leagues  (리그 정의 영역 — UI 비활성 영역)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.leagues (
  id                  serial        PRIMARY KEY,
  name                text          NOT NULL UNIQUE,
  rank                integer       NOT NULL UNIQUE CHECK (rank >= 1 AND rank <= 6),
  min_xp_to_promote   integer       NOT NULL,
  icon                text          NOT NULL,
  color               text          NOT NULL,
  description         text,
  created_at          timestamptz   DEFAULT now()
);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view leagues" ON public.leagues;
DROP POLICY IF EXISTS "Admins can manage leagues" ON public.leagues;
DROP POLICY IF EXISTS leagues_select_all ON public.leagues;
DROP POLICY IF EXISTS leagues_admin_all ON public.leagues;

CREATE POLICY leagues_select_all ON public.leagues
  FOR SELECT USING (true);

CREATE POLICY leagues_admin_all ON public.leagues
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 5. league_groups (신규 발견 영역 — leagues FK + 주간 그룹 영역)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.league_groups (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id       integer       NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  week_start      date          NOT NULL,
  week_end        date          NOT NULL,
  status          text          NOT NULL DEFAULT 'active',
  member_count    integer       NOT NULL DEFAULT 0,
  created_at      timestamptz   DEFAULT now(),
  finalized_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_league_groups_league_week
  ON public.league_groups (league_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_league_groups_week
  ON public.league_groups (week_start DESC);
CREATE INDEX IF NOT EXISTS idx_league_groups_active
  ON public.league_groups (status)
  WHERE status = 'active';

ALTER TABLE public.league_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view league groups" ON public.league_groups;
DROP POLICY IF EXISTS "Admins can view all groups" ON public.league_groups;
DROP POLICY IF EXISTS league_groups_select_all ON public.league_groups;
DROP POLICY IF EXISTS league_groups_admin_all ON public.league_groups;

CREATE POLICY league_groups_select_all ON public.league_groups
  FOR SELECT USING (true);

CREATE POLICY league_groups_admin_all ON public.league_groups
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 6. league_members  (사용자 × 리그 그룹 = 1행)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.league_members (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid          NOT NULL REFERENCES public.league_groups(id) ON DELETE CASCADE,
  user_id         uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekly_xp       integer       NOT NULL DEFAULT 0,
  rank_in_group   integer,
  promoted        boolean       DEFAULT false,
  demoted         boolean       DEFAULT false,
  joined_at       timestamptz   DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_league_members_group_xp
  ON public.league_members (group_id, weekly_xp DESC);
CREATE INDEX IF NOT EXISTS idx_league_members_user
  ON public.league_members (user_id);

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own group members" ON public.league_members;
DROP POLICY IF EXISTS "Admins can view all members" ON public.league_members;
DROP POLICY IF EXISTS league_members_select_own_group ON public.league_members;
DROP POLICY IF EXISTS league_members_admin_all ON public.league_members;

CREATE POLICY league_members_select_own_group ON public.league_members
  FOR SELECT USING (group_id = public.get_my_league_group_id());

CREATE POLICY league_members_admin_all ON public.league_members
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 7. admin_actions  (관리자 감사 로그 영역)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid          NOT NULL REFERENCES public.profiles(id),
  action_type     text          NOT NULL CHECK (action_type = ANY (ARRAY[
                      'grant_premium', 'revoke_premium', 'extend_premium', 'issue_refund',
                      'ban_user', 'unban_user', 'reset_streak', 'grant_xp', 'change_league',
                      'update_profile', 'delete_data', 'view_sensitive', 'other'
                    ])),
  target_user_id  uuid          REFERENCES public.profiles(id),
  details         jsonb,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin
  ON public.admin_actions (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target
  ON public.admin_actions (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type
  ON public.admin_actions (action_type, created_at DESC);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all admin actions" ON public.admin_actions;
DROP POLICY IF EXISTS "Admins can insert admin actions" ON public.admin_actions;
DROP POLICY IF EXISTS admin_actions_select ON public.admin_actions;
DROP POLICY IF EXISTS admin_actions_insert ON public.admin_actions;

CREATE POLICY admin_actions_select ON public.admin_actions
  FOR SELECT USING (public.is_admin());

CREATE POLICY admin_actions_insert ON public.admin_actions
  FOR INSERT WITH CHECK (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 8. daily_batch_runs  (일일 배치 영역 이력 영역)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.daily_batch_runs (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date            date          NOT NULL UNIQUE,
  users_analyzed      integer       DEFAULT 0,
  weakness_flagged    integer       DEFAULT 0,
  mastery_flagged     integer       DEFAULT 0,
  weakness_released   integer       DEFAULT 0,
  duration_ms         integer,
  status              text          DEFAULT 'success' CHECK (status = ANY (ARRAY['success', 'partial', 'failed'])),
  error_message       text,
  created_at          timestamptz   DEFAULT now(),
  premium_expired     integer       NOT NULL DEFAULT 0
);

ALTER TABLE public.daily_batch_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view batch runs" ON public.daily_batch_runs;
DROP POLICY IF EXISTS daily_batch_runs_admin_select ON public.daily_batch_runs;

CREATE POLICY daily_batch_runs_admin_select ON public.daily_batch_runs
  FOR SELECT USING (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 9. user_streaks  (사용자 streak 영역 — 컬럼 3개 추가 발견 영역)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id                    uuid          PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak             integer       NOT NULL DEFAULT 0,
  longest_streak             integer       NOT NULL DEFAULT 0,
  last_practice_date         date,
  streak_freezes_available   integer       NOT NULL DEFAULT 0,
  freezes_used_this_month    integer       NOT NULL DEFAULT 0,
  freezes_reset_month        date,
  updated_at                 timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own streaks" ON public.user_streaks;
DROP POLICY IF EXISTS "Admins can view all streaks" ON public.user_streaks;
DROP POLICY IF EXISTS user_streaks_select_own ON public.user_streaks;
DROP POLICY IF EXISTS user_streaks_admin_select ON public.user_streaks;

CREATE POLICY user_streaks_select_own ON public.user_streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_streaks_admin_select ON public.user_streaks
  FOR SELECT USING (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 10. subscriptions  (Paddle/Stripe 영역 webhook 영역)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  paddle_customer_id       text,
  paddle_subscription_id   text          UNIQUE,
  paddle_price_id          text,
  status                   text          NOT NULL DEFAULT 'inactive',
  plan                     text          NOT NULL DEFAULT 'free',
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean       NOT NULL DEFAULT false,
  canceled_at              timestamptz,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions (status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_admin_select ON public.subscriptions;

CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY subscriptions_admin_select ON public.subscriptions
  FOR SELECT USING (public.is_admin());


-- ════════════════════════════════════════════════════════════════
-- 11. handle_session_complete  (user_sessions INSERT trigger 영역 함수)
-- ════════════════════════════════════════════════════════════════
-- 박힌 영역: user_stats_daily UPSERT + profiles UPDATE (total_xp·last_practice_date) +
--           note_mastery UPSERT (note_attempts JSONB 영역 음표별 영역 박은 영역 mastery_level 재계산 영역).
-- 본문 영역 출처: Production Dashboard 영역 추출 영역 (Step 1-1 영역 박은 영역).
-- ⚠️ search_path 영역 박지 X 박힘 영역 — Production 영역 본문 영역 박지 X 박은 영역 박은 영역 그대로 영역.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_session_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  session_date DATE;
  note_record RECORD;
BEGIN
  -- 세션 날짜 (사용자의 timezone은 나중에 고려, 일단 UTC 기준)
  session_date := (NEW.started_at AT TIME ZONE 'UTC')::DATE;

  -- ═════════════════════════════════════════════════════════
  -- 1. user_stats_daily 업데이트 (UPSERT)
  -- ═════════════════════════════════════════════════════════
  INSERT INTO user_stats_daily (
    user_id, stat_date, sessions_count, total_notes, correct_notes,
    total_duration_seconds, xp_earned, avg_accuracy, avg_reaction_ms,
    sessions_by_level, updated_at
  ) VALUES (
    NEW.user_id, session_date, 1, NEW.total_notes, NEW.correct_notes,
    NEW.duration_seconds, NEW.xp_earned, NEW.accuracy, NEW.avg_reaction_ms,
    jsonb_build_object(NEW.level::text, 1),
    now()
  )
  ON CONFLICT (user_id, stat_date) DO UPDATE SET
    sessions_count = user_stats_daily.sessions_count + 1,
    total_notes = user_stats_daily.total_notes + NEW.total_notes,
    correct_notes = user_stats_daily.correct_notes + NEW.correct_notes,
    total_duration_seconds = user_stats_daily.total_duration_seconds + NEW.duration_seconds,
    xp_earned = user_stats_daily.xp_earned + NEW.xp_earned,
    avg_accuracy = CASE
      WHEN (user_stats_daily.total_notes + NEW.total_notes) > 0
      THEN ((user_stats_daily.correct_notes + NEW.correct_notes)::numeric /
            (user_stats_daily.total_notes + NEW.total_notes))
      ELSE 0
    END,
    avg_reaction_ms = CASE
      WHEN user_stats_daily.avg_reaction_ms IS NULL THEN NEW.avg_reaction_ms
      WHEN NEW.avg_reaction_ms IS NULL THEN user_stats_daily.avg_reaction_ms
      ELSE (user_stats_daily.avg_reaction_ms + NEW.avg_reaction_ms) / 2
    END,
    sessions_by_level = user_stats_daily.sessions_by_level ||
      jsonb_build_object(
        NEW.level::text,
        COALESCE((user_stats_daily.sessions_by_level->>NEW.level::text)::int, 0) + 1
      ),
    updated_at = now();

  -- ═════════════════════════════════════════════════════════
  -- 2. profiles 업데이트 (XP 누적, 마지막 연습 날짜)
  -- ═════════════════════════════════════════════════════════
  UPDATE profiles SET
    total_xp = total_xp + NEW.xp_earned,
    last_practice_date = session_date,
    updated_at = now()
  WHERE id = NEW.user_id;

  -- ═════════════════════════════════════════════════════════
  -- 3. note_mastery 업데이트 (note_attempts JSONB 순회)
  -- ═════════════════════════════════════════════════════════
  IF NEW.note_attempts IS NOT NULL THEN
    FOR note_record IN
      SELECT
        (attempt->>'note')::TEXT AS note_key,
        COALESCE((attempt->>'clef')::TEXT, 'treble') AS clef,
        (attempt->>'correct')::BOOLEAN AS is_correct,
        (attempt->>'reaction_ms')::INT AS reaction_ms
      FROM jsonb_array_elements(NEW.note_attempts) AS attempt
    LOOP
      INSERT INTO note_mastery (
        user_id, note_key, clef, total_attempts, correct_count,
        avg_reaction_ms, first_seen_at, last_seen_at, updated_at
      ) VALUES (
        NEW.user_id, note_record.note_key, note_record.clef, 1,
        CASE WHEN note_record.is_correct THEN 1 ELSE 0 END,
        note_record.reaction_ms, now(), now(), now()
      )
      ON CONFLICT (user_id, note_key, clef) DO UPDATE SET
        total_attempts = note_mastery.total_attempts + 1,
        correct_count = note_mastery.correct_count +
          CASE WHEN note_record.is_correct THEN 1 ELSE 0 END,
        avg_reaction_ms = CASE
          WHEN note_mastery.avg_reaction_ms IS NULL THEN note_record.reaction_ms
          WHEN note_record.reaction_ms IS NULL THEN note_mastery.avg_reaction_ms
          ELSE (note_mastery.avg_reaction_ms * note_mastery.total_attempts +
                note_record.reaction_ms) / (note_mastery.total_attempts + 1)
        END,
        -- mastery_level 재계산
        mastery_level = CASE
          WHEN (note_mastery.correct_count +
                CASE WHEN note_record.is_correct THEN 1 ELSE 0 END)::numeric /
               (note_mastery.total_attempts + 1) >= 0.95 THEN 5
          WHEN (note_mastery.correct_count +
                CASE WHEN note_record.is_correct THEN 1 ELSE 0 END)::numeric /
               (note_mastery.total_attempts + 1) >= 0.90 THEN 4
          WHEN (note_mastery.correct_count +
                CASE WHEN note_record.is_correct THEN 1 ELSE 0 END)::numeric /
               (note_mastery.total_attempts + 1) >= 0.80 THEN 3
          WHEN (note_mastery.correct_count +
                CASE WHEN note_record.is_correct THEN 1 ELSE 0 END)::numeric /
               (note_mastery.total_attempts + 1) >= 0.70 THEN 2
          WHEN (note_mastery.correct_count +
                CASE WHEN note_record.is_correct THEN 1 ELSE 0 END)::numeric /
               (note_mastery.total_attempts + 1) >= 0.50 THEN 1
          ELSE 0
        END,
        last_seen_at = now(),
        updated_at = now();
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;


-- ════════════════════════════════════════════════════════════════
-- 12. on_session_complete  (user_sessions AFTER INSERT 트리거 영역)
-- ════════════════════════════════════════════════════════════════
-- 박힌 영역: user_sessions INSERT 영역 박힘 영역 박음 영역 handle_session_complete 영역 호출 영역.
-- trg_update_profile_after_session 영역 = 20260516_reviewer_sessions_rls.sql 영역 박힘 영역.
-- ════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_session_complete ON public.user_sessions;

CREATE TRIGGER on_session_complete
  AFTER INSERT ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_session_complete();


-- ════════════════════════════════════════════════════════════════
-- 13. check_nickname_available  (닉네임 영역 중복 영역 확인)
-- ════════════════════════════════════════════════════════════════
-- 박힌 영역: 형식 1차 검증 (3-20자 영역 + 정규식 영역 `^[a-z][a-z0-9_]{2,19}$`) +
--           profiles.nickname 영역 중복 검사 (lower 영역 비교 영역).
-- 본문 영역 출처: Production Dashboard 영역 추출 영역 (Step 1-1 영역 박은 영역).
-- ⚠️ is_deleted 영역 박지 X 박힘 영역 — Production 영역 본문 영역 박지 X 박은 영역 박은 영역 그대로 영역.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_nickname_available(p_nickname text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 형식 1차 검증
  IF p_nickname IS NULL OR LENGTH(p_nickname) < 3 OR LENGTH(p_nickname) > 20 THEN
    RETURN FALSE;
  END IF;

  IF p_nickname !~ '^[a-z][a-z0-9_]{2,19}$' THEN
    RETURN FALSE;
  END IF;

  -- 중복 체크 (대소문자 무시)
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE LOWER(nickname) = LOWER(p_nickname)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_nickname_available(text) TO anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- 14. record_sublevel_attempt 6개 인자 dead 함수 영역 DROP
-- ════════════════════════════════════════════════════════════════
-- 박힌 영역: 7개 인자 영역 버전 영역 (p_avg_reaction_ratio NUMERIC) 영역만 영역 박음 영역.
-- 6개 인자 영역 = dead 영역 박힘 영역 → DROP 영역.
-- ════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.record_sublevel_attempt(
  integer,    -- p_level
  integer,    -- p_sublevel
  integer,    -- p_attempts
  integer,    -- p_correct
  integer,    -- p_max_streak
  text        -- p_game_status
);


-- ════════════════════════════════════════════════════════════════
-- 검증 영역 영역 박음 영역 박힘 영역 박은 영역 박음
-- ════════════════════════════════════════════════════════════════
-- 1. 모든 테이블 영역 박혔는지 영역:
--    SELECT table_name FROM information_schema.tables
--      WHERE table_schema = 'public'
--      ORDER BY table_name;
--
-- 2. 모든 RLS 정책 영역 박혔는지 영역:
--    SELECT schemaname, tablename, policyname, cmd
--      FROM pg_policies
--      WHERE schemaname = 'public'
--      ORDER BY tablename, cmd, policyname;
--
-- 3. 함수 영역 박혔는지 영역:
--    SELECT routine_name FROM information_schema.routines
--      WHERE routine_schema = 'public'
--        AND routine_name IN ('handle_session_complete', 'check_nickname_available', 'get_my_league_group_id');
--
-- 4. 트리거 영역 박혔는지 영역:
--    SELECT trigger_name FROM information_schema.triggers
--      WHERE event_object_schema = 'public'
--        AND event_object_table = 'user_sessions';
--
-- 5. record_sublevel_attempt 6개 인자 버전 영역 박지 X 박혔는지 영역:
--    SELECT pg_get_function_identity_arguments(p.oid) AS args
--      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public' AND p.proname = 'record_sublevel_attempt';
--    → 1행 영역만 박힌 영역 박음 영역 (7개 인자 영역).
-- ════════════════════════════════════════════════════════════════
