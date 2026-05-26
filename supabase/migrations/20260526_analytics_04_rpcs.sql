-- Migration: 20260526_analytics_read_rpcs.sql
-- Purpose: 일/주/월 보고서 read RPC. RLS 본인만(auth.uid()).
-- 보안: SECURITY INVOKER — RLS가 자체 보호. user_analytics_rollup·user_note_status·user_sessions·user_note_logs 모두 own-only SELECT 정책 적용됨.

-- =====================================================================
-- get_daily_report(p_date)
--   p_date < today_kst : user_analytics_rollup에서 읽기
--   p_date = today_kst : 라이브 계산 + 베이스라인은 rollup에서
--   p_date > today_kst : 거부
-- =====================================================================
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

    -- 세션 목록도 함께 (스펙 §3.1 표시 순서 3번)
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

  -- ── 오늘: 라이브 계산 ──
  v_start_ts := (v_today_kst::timestamp) AT TIME ZONE 'Asia/Seoul';
  v_end_ts   := ((v_today_kst + 1)::timestamp) AT TIME ZONE 'Asia/Seoul';

  -- 베이스라인 (rollup의 -14d ~ -1d)
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

  -- 오늘 세션 목록
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

  -- 오늘 라이브 집계 (tutorial 제외 EXISTS)
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

  -- 스트릭 (오늘 포함 역방향 연속 일)
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
           -- ⚠️ ROW_NUMBER()는 bigint. date - bigint 연산자 없음(42883). ::int 캐스팅 필수.
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

-- =====================================================================
-- get_weekly_report(p_week_start)
--   100% rollup. p_week_start = 월요일.
-- =====================================================================
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

  -- 요일별 데이터 (스펙 §3.2: 7일 라인차트, 요일별 정확도·속도)
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

-- =====================================================================
-- get_monthly_report(p_year, p_month)
--   100% rollup.
-- =====================================================================
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

  -- 기본값 = 전월
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

  -- 주차별 데이터 (스펙 §3.3: 주차별 추세 4~5주)
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

-- =====================================================================
-- get_user_note_status — 음표별 상태 조회 (약점 훈련 입력으로 사용)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_user_note_status(p_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_user_id uuid := auth.uid();
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('learning','weakness','graduated','regressed') THEN
    RAISE EXCEPTION 'Invalid status filter: %', p_status;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'note_key', note_key, 'octave', octave, 'clef', clef,
    'status', status,
    'recent_20_attempts', recent_20_attempts,
    'recent_20_accuracy', recent_20_accuracy,
    'recent_20_sessions', recent_20_sessions,
    'recent_20_avg_ms', recent_20_avg_ms,
    'recent_20_median_ms', recent_20_median_ms,
    'ever_weakness', ever_weakness,
    'graduated_at', graduated_at,
    'regressed_at', regressed_at,
    'weakness_flagged_at', weakness_flagged_at,
    'last_attempt_at', last_attempt_at
  ) ORDER BY recent_20_accuracy NULLS LAST, recent_20_attempts DESC), '[]'::jsonb)
  INTO v_result
  FROM public.user_note_status
  WHERE user_id = v_user_id
    AND (p_status IS NULL OR status = p_status);

  RETURN jsonb_build_object('notes', v_result, 'filter', COALESCE(p_status, 'all'));
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_user_note_status(text) TO authenticated;
