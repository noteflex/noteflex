-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260517_record_game_session_rpc.sql
-- ═══════════════════════════════════════════════════════════════
-- 게임 종료 후 3개 테이블 원자적 업데이트 (RLS 우회).
--
-- 배경:
--   - user_sessions INSERT RLS 정책 미적용 → reviewer INSERT 실패
--   - user_stats_daily 트리거 없음 → 데이터 미축적
--   - profiles.last_practice_date 트리거 없음 → 대시보드 상태 오분류
--
-- 이 RPC:
--   SECURITY DEFINER → 호출자 RLS를 우회해 3개 테이블 처리.
--   1. user_sessions INSERT
--   2. user_stats_daily UPSERT (날짜별 누적 — 여러 게임 올바르게 합산)
--   3. profiles.last_practice_date UPDATE (오늘 날짜만 갱신)
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 실행.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_game_session(
  p_level            INT,
  p_started_at       TIMESTAMPTZ,
  p_ended_at         TIMESTAMPTZ,
  p_duration_seconds INT,
  p_total_notes      INT,
  p_correct_notes    INT,
  p_accuracy         FLOAT,
  p_avg_reaction_ms  INT,
  p_xp_earned        INT,
  p_session_type     TEXT    DEFAULT NULL,
  p_note_attempts    JSONB   DEFAULT NULL,
  p_summary          JSONB   DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id   UUID := auth.uid();
  v_session_id UUID;
  v_today     DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ─── 1. user_sessions INSERT ────────────────────────────────
  BEGIN
    INSERT INTO public.user_sessions (
      user_id, level, started_at, ended_at, duration_seconds,
      total_notes, correct_notes, accuracy, avg_reaction_ms, xp_earned,
      session_type, note_attempts, summary
    ) VALUES (
      v_user_id, p_level, p_started_at, p_ended_at, p_duration_seconds,
      p_total_notes, p_correct_notes, p_accuracy, p_avg_reaction_ms, p_xp_earned,
      p_session_type, p_note_attempts, p_summary
    )
    RETURNING id INTO v_session_id;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'user_sessions not found — skipping INSERT';
    v_session_id := gen_random_uuid();
  END;

  -- ─── 2. user_stats_daily UPSERT (날짜별 누적) ──────────────
  BEGIN
    INSERT INTO public.user_stats_daily (
      user_id, stat_date,
      sessions_count, total_notes, correct_notes,
      xp_earned, avg_accuracy, avg_reaction_ms, total_duration_seconds
    ) VALUES (
      v_user_id, v_today,
      1, p_total_notes, p_correct_notes,
      p_xp_earned, p_accuracy, p_avg_reaction_ms, p_duration_seconds
    )
    ON CONFLICT (user_id, stat_date) DO UPDATE SET
      sessions_count        = public.user_stats_daily.sessions_count + 1,
      total_notes           = public.user_stats_daily.total_notes + p_total_notes,
      correct_notes         = public.user_stats_daily.correct_notes + p_correct_notes,
      xp_earned             = public.user_stats_daily.xp_earned + p_xp_earned,
      avg_accuracy          = CASE
        WHEN (public.user_stats_daily.total_notes + p_total_notes) > 0
        THEN (public.user_stats_daily.correct_notes + p_correct_notes)::FLOAT
              / (public.user_stats_daily.total_notes + p_total_notes)
        ELSE NULL
      END,
      avg_reaction_ms       = (
        (COALESCE(public.user_stats_daily.avg_reaction_ms, p_avg_reaction_ms)
          * public.user_stats_daily.sessions_count + p_avg_reaction_ms)
        / (public.user_stats_daily.sessions_count + 1)
      )::INT,
      total_duration_seconds = public.user_stats_daily.total_duration_seconds + p_duration_seconds;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'user_stats_daily not found — skipping UPSERT';
  END;

  -- ─── 3. profiles.last_practice_date UPDATE ──────────────────
  UPDATE public.profiles
  SET last_practice_date = v_today
  WHERE id = v_user_id
    AND (last_practice_date IS NULL OR last_practice_date < v_today);

  RETURN COALESCE(v_session_id, gen_random_uuid());
END;
$func$;

GRANT EXECUTE ON FUNCTION public.record_game_session(
  INT, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT, INT, FLOAT, INT, INT, TEXT, JSONB, JSONB
) TO authenticated;

-- ─── 검증 쿼리 (apply 후 확인) ────────────────────────────────
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_name = 'record_game_session' AND routine_schema = 'public';
