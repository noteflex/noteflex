-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260613_report_history_rpc.sql
-- Purpose: 과거 보고서 다시 보기 — RPC tier 게이팅 + 지난 기간 목록.
--
-- 변경 요약:
--   1) public.is_pro()  신규 헬퍼 (SECURITY DEFINER, profiles 조회)
--      = admin OR subscription_tier='pro' OR is_premium=TRUE
--      클라이언트 getUserTier()와 동일 판정.
--
--   2) public.get_daily_report(date)  REPLACE
--      - p_date = KST 오늘 → Free 허용 (기존 동작 유지)
--      - p_date < KST 오늘 → 과거. is_pro() 통과해야 함.
--      - p_date > KST 오늘 → 기존대로 거부.
--
--   3) public.get_weekly_report(date)  REPLACE
--      public.get_monthly_report(int,int) REPLACE
--      - 현재·과거 무관 Pro 필수 (auth 체크 직후 is_pro 가드).
--      - 프론트 가드만 있던 우회 경로(RPC 직접 호출) 차단.
--
--   4) public.list_report_periods(text,int,int) 신규
--      - user_analytics_rollup에서 호출자 본인의 period_start·period_end 목록
--        + 핵심 메타(sessions_count, total_attempts, overall_accuracy) 최신순.
--      - period_type ∈ ('day','week','month').
--      - Pro 필수.
--      - LIMIT/OFFSET 페이지네이션, 총 row 수도 함께 반환.
--
-- 거부 신호: RAISE EXCEPTION 'pro_required' USING ERRCODE='42501'.
--   - PostgREST가 HTTP 403으로 매핑 → 프론트는 error.message='pro_required'로
--     ProLockScreen 흐름과 결합 가능 (별도 UI 작업).
--
-- 무변경:
--   - 집계 배치(run_daily_analytics_rollup, build_period_rollup)
--   - cron 일정(noteflex-daily-batch)
--   - user_analytics_rollup 스키마/RLS/인덱스
--   - tutorial 격리 (기존 RPC 본문 그대로)
--   - 오늘(라이브) 일간 보고서 동작
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. is_pro() 헬퍼 ───────────────────────────────────────────
-- profiles.role='admin' OR profiles.subscription_tier='pro' OR profiles.is_premium=TRUE
-- SECURITY DEFINER: 호출자 RLS 우회해 profiles 직접 조회.
CREATE OR REPLACE FUNCTION public.is_pro()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $func$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        role = 'admin'
        OR subscription_tier = 'pro'
        OR is_premium = TRUE
      )
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.is_pro() TO authenticated;


-- ─── 2. get_daily_report — 과거(<오늘 KST)에만 Pro 가드 추가 ────
CREATE OR REPLACE FUNCTION public.get_daily_report(p_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_user_id   uuid := auth.uid();
  v_today_kst date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_date      date := COALESCE(p_date, v_today_kst);
  v_start_ts  timestamptz;
  v_end_ts    timestamptz;

  v_rollup    public.user_analytics_rollup%ROWTYPE;
  v_baseline  jsonb := '{}'::jsonb;
  v_sessions  jsonb := '[]'::jsonb;
  v_live_agg  jsonb;
  v_streak    int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_date > v_today_kst THEN
    RAISE EXCEPTION 'Future date not allowed: %', v_date;
  END IF;

  -- ── 과거(어제 이전) 조회는 Pro 필수 ──
  IF v_date < v_today_kst AND NOT public.is_pro() THEN
    RAISE EXCEPTION 'pro_required' USING ERRCODE = '42501';
  END IF;

  -- ── 과거: rollup에서만 읽기 ──
  IF v_date < v_today_kst THEN
    SELECT * INTO v_rollup
    FROM public.user_analytics_rollup
    WHERE user_id = v_user_id
      AND period_type = 'day'
      AND period_start = v_date;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'status', 'no_data',
        'date', v_date,
        'source', 'rollup'
      );
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'level', level,
      'started_at', started_at, 'ended_at', ended_at,
      'total_notes', total_notes, 'correct_notes', correct_notes,
      'accuracy', accuracy, 'avg_reaction_ms', avg_reaction_ms,
      'duration_seconds', duration_seconds, 'session_type', session_type
    ) ORDER BY started_at), '[]'::jsonb)
    INTO v_sessions
    FROM public.user_sessions
    WHERE user_id = v_user_id
      AND session_type <> 'tutorial'
      AND started_at >= (v_date::timestamp) AT TIME ZONE 'Asia/Seoul'
      AND started_at <  ((v_date + 1)::timestamp) AT TIME ZONE 'Asia/Seoul';

    RETURN to_jsonb(v_rollup) || jsonb_build_object(
      'source', 'rollup',
      'sessions', v_sessions
    );
  END IF;

  -- ── 오늘: 라이브 계산 (Free 허용) ──
  v_start_ts := (v_today_kst::timestamp) AT TIME ZONE 'Asia/Seoul';
  v_end_ts   := ((v_today_kst + 1)::timestamp) AT TIME ZONE 'Asia/Seoul';

  SELECT jsonb_build_object(
    'baseline_accuracy',        AVG(overall_accuracy),
    'baseline_avg_reaction_ms', AVG(avg_reaction_ms)::int,
    'baseline_days',            COUNT(*)
  ) INTO v_baseline
  FROM public.user_analytics_rollup
  WHERE user_id = v_user_id
    AND period_type = 'day'
    AND period_start >= v_today_kst - 14
    AND period_start <  v_today_kst;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'level', level,
    'started_at', started_at, 'ended_at', ended_at,
    'total_notes', total_notes, 'correct_notes', correct_notes,
    'accuracy', accuracy, 'avg_reaction_ms', avg_reaction_ms,
    'duration_seconds', duration_seconds, 'session_type', session_type
  ) ORDER BY started_at), '[]'::jsonb)
  INTO v_sessions
  FROM public.user_sessions
  WHERE user_id = v_user_id
    AND session_type <> 'tutorial'
    AND started_at >= v_start_ts AND started_at < v_end_ts;

  WITH valid_logs AS (
    SELECT
      l.note_key, l.octave, l.clef, l.is_correct,
      (l.response_time * 1000)::numeric AS ms,
      l.level, l.interval_from_prev, l.created_at
    FROM public.user_note_logs l
    WHERE l.user_id = v_user_id
      AND l.created_at >= v_start_ts
      AND l.created_at <  v_end_ts
      AND NOT EXISTS (
        SELECT 1 FROM public.user_sessions s
        WHERE s.user_id = v_user_id
          AND s.session_type = 'tutorial'
          AND l.created_at >= s.started_at
          AND l.created_at <= s.ended_at
      )
  ),
  overall AS (
    SELECT
      COUNT(*) AS attempts,
      COUNT(*) FILTER (WHERE is_correct) AS correct,
      AVG(ms) FILTER (WHERE ms IS NOT NULL)::int AS avg_ms,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)
        FILTER (WHERE ms IS NOT NULL))::int AS median_ms
    FROM valid_logs
  ),
  wrong_today AS (
    SELECT jsonb_agg(jsonb_build_object(
      'note_key', note_key, 'octave', octave, 'clef', clef,
      'attempts', n, 'errors', err
    ) ORDER BY err DESC, n DESC) AS j
    FROM (
      SELECT note_key, octave, clef,
             COUNT(*) AS n,
             COUNT(*) FILTER (WHERE NOT is_correct) AS err
      FROM valid_logs
      GROUP BY note_key, octave, clef
      HAVING COUNT(*) FILTER (WHERE NOT is_correct) > 0
      ORDER BY err DESC, n DESC
      LIMIT 10
    ) t
  )
  SELECT jsonb_build_object(
    'total_attempts', o.attempts,
    'correct_attempts', o.correct,
    'overall_accuracy', (o.correct::numeric / NULLIF(o.attempts,0))::numeric(5,4),
    'avg_reaction_ms', o.avg_ms,
    'median_reaction_ms', o.median_ms,
    'wrong_notes_today', COALESCE(wt.j, '[]'::jsonb)
  )
  INTO v_live_agg
  FROM overall o LEFT JOIN wrong_today wt ON true;

  WITH active_days AS (
    SELECT DISTINCT (created_at AT TIME ZONE 'Asia/Seoul')::date AS d
    FROM public.user_note_logs
    WHERE user_id = v_user_id
      AND created_at >= ((v_today_kst - 60)::timestamp) AT TIME ZONE 'Asia/Seoul'
      AND created_at <  ((v_today_kst + 1)::timestamp) AT TIME ZONE 'Asia/Seoul'
  ),
  walked AS (
    SELECT d,
           ROW_NUMBER() OVER (ORDER BY d DESC) AS rn,
           (v_today_kst - (ROW_NUMBER() OVER (ORDER BY d DESC) - 1)::int) AS expected
    FROM active_days
    WHERE d <= v_today_kst
  )
  SELECT COUNT(*) INTO v_streak
  FROM walked WHERE d = expected;

  RETURN jsonb_build_object(
    'source', 'live',
    'date', v_today_kst,
    'period_type', 'day',
    'streak_days', v_streak,
    'sessions', v_sessions
  ) || COALESCE(v_live_agg, '{}'::jsonb)
    || COALESCE(v_baseline,  '{}'::jsonb);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_daily_report(date) TO authenticated;


-- ─── 3. get_weekly_report — Pro 가드 추가 (현재·과거 무관) ──────
CREATE OR REPLACE FUNCTION public.get_weekly_report(p_week_start date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_user_id   uuid := auth.uid();
  v_today_kst date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_default_mon date := v_today_kst
                       - (EXTRACT(ISODOW FROM v_today_kst)::int - 1)
                       - 7;  -- 지난주 월요일
  v_week_start date := COALESCE(p_week_start, v_default_mon);
  v_rollup     public.user_analytics_rollup%ROWTYPE;
  v_daily_acc  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_pro() THEN
    RAISE EXCEPTION 'pro_required' USING ERRCODE = '42501';
  END IF;

  IF EXTRACT(ISODOW FROM v_week_start) <> 1 THEN
    RAISE EXCEPTION 'p_week_start must be Monday (ISODOW=1)';
  END IF;

  SELECT * INTO v_rollup
  FROM public.user_analytics_rollup
  WHERE user_id = v_user_id
    AND period_type = 'week'
    AND period_start = v_week_start;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'no_data',
      'week_start', v_week_start,
      'source', 'rollup'
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', period_start,
    'accuracy', overall_accuracy,
    'avg_ms', avg_reaction_ms,
    'attempts', total_attempts,
    'sessions', sessions_count
  ) ORDER BY period_start), '[]'::jsonb)
  INTO v_daily_acc
  FROM public.user_analytics_rollup
  WHERE user_id = v_user_id
    AND period_type = 'day'
    AND period_start BETWEEN v_week_start AND (v_week_start + 6);

  RETURN to_jsonb(v_rollup) || jsonb_build_object(
    'source', 'rollup',
    'days', v_daily_acc
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_weekly_report(date) TO authenticated;


-- ─── 4. get_monthly_report — Pro 가드 추가 (현재·과거 무관) ─────
CREATE OR REPLACE FUNCTION public.get_monthly_report(p_year int DEFAULT NULL, p_month int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_user_id   uuid := auth.uid();
  v_today_kst date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_target_year int;
  v_target_month int;
  v_month_start date;
  v_month_end   date;
  v_rollup    public.user_analytics_rollup%ROWTYPE;
  v_weeks     jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_pro() THEN
    RAISE EXCEPTION 'pro_required' USING ERRCODE = '42501';
  END IF;

  IF p_year IS NULL OR p_month IS NULL THEN
    v_target_year  := EXTRACT(YEAR  FROM (v_today_kst - INTERVAL '1 month'))::int;
    v_target_month := EXTRACT(MONTH FROM (v_today_kst - INTERVAL '1 month'))::int;
  ELSE
    v_target_year  := p_year;
    v_target_month := p_month;
  END IF;

  v_month_start := make_date(v_target_year, v_target_month, 1);
  v_month_end   := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::date;

  SELECT * INTO v_rollup
  FROM public.user_analytics_rollup
  WHERE user_id = v_user_id
    AND period_type = 'month'
    AND period_start = v_month_start;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'no_data',
      'year', v_target_year, 'month', v_target_month,
      'source', 'rollup'
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'week_start', period_start,
    'week_end', period_end,
    'accuracy', overall_accuracy,
    'avg_ms', avg_reaction_ms,
    'attempts', total_attempts,
    'sessions', sessions_count,
    'graduated_count', graduated_count,
    'regressed_count', regressed_count
  ) ORDER BY period_start), '[]'::jsonb)
  INTO v_weeks
  FROM public.user_analytics_rollup
  WHERE user_id = v_user_id
    AND period_type = 'week'
    AND period_start >= v_month_start - 6
    AND period_start <= v_month_end;

  RETURN to_jsonb(v_rollup) || jsonb_build_object(
    'source', 'rollup',
    'weeks', v_weeks
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_monthly_report(int, int) TO authenticated;


-- ─── 5. list_report_periods — 지난 기간 목록 (Pro 필수) ─────────
-- 입력: p_period_type ∈ ('day','week','month'), p_limit, p_offset
-- 반환 jsonb:
--   {
--     "period_type": "...",
--     "limit": 30,
--     "offset": 0,
--     "total": <int>,
--     "periods": [
--       { "period_start": "YYYY-MM-DD", "period_end": "YYYY-MM-DD",
--         "sessions_count": int, "total_attempts": int,
--         "overall_accuracy": numeric(5,4) },
--       ...
--     ]
--   }
-- - 최신순(period_start DESC).
-- - rollup에 들어가 있는 모든 row 그대로 — 일간 어제까지, 주간 지난주까지,
--   월간 지난달까지(cron이 채우는 범위) = 자동으로 "과거".
-- - SECURITY INVOKER: user_analytics_rollup RLS(본인 SELECT)로 보호.
CREATE OR REPLACE FUNCTION public.list_report_periods(
  p_period_type text,
  p_limit int DEFAULT 30,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit   int  := COALESCE(p_limit, 30);
  v_offset  int  := COALESCE(p_offset, 0);
  v_total   int;
  v_rows    jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_pro() THEN
    RAISE EXCEPTION 'pro_required' USING ERRCODE = '42501';
  END IF;

  IF p_period_type IS NULL OR p_period_type NOT IN ('day','week','month') THEN
    RAISE EXCEPTION 'Invalid period_type: % (must be day|week|month)', p_period_type;
  END IF;

  IF v_limit <= 0 OR v_limit > 100 THEN
    RAISE EXCEPTION 'Invalid limit: % (1..100)', v_limit;
  END IF;

  IF v_offset < 0 THEN
    RAISE EXCEPTION 'Invalid offset: % (>=0)', v_offset;
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.user_analytics_rollup
  WHERE user_id = v_user_id
    AND period_type = p_period_type;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'period_start',     period_start,
    'period_end',       period_end,
    'sessions_count',   sessions_count,
    'total_attempts',   total_attempts,
    'overall_accuracy', overall_accuracy
  ) ORDER BY period_start DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT period_start, period_end, sessions_count, total_attempts, overall_accuracy
    FROM public.user_analytics_rollup
    WHERE user_id = v_user_id
      AND period_type = p_period_type
    ORDER BY period_start DESC
    LIMIT v_limit OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'period_type', p_period_type,
    'limit',       v_limit,
    'offset',      v_offset,
    'total',       v_total,
    'periods',     v_rows
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.list_report_periods(text, int, int) TO authenticated;
