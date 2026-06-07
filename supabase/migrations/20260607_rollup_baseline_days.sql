-- =====================================================================
-- 20260607_rollup_baseline_days.sql
-- daily rollup 베이스라인 실제 활동일 수 저장
--
-- 문제: build_period_rollup()이 baseline_accuracy/avg_ms만 저장하고
--       baseline_days(창 내 실제 활동일 수)를 저장하지 않아
--       클라이언트가 고정값 14로 근사 → showDelta 가드 우회.
-- 해결:
--   [1] user_analytics_rollup에 baseline_days INTEGER 컬럼 추가
--   [2] 기존 행 backfill (동일 창 정의로 재계산)
--   [3] build_period_rollup() 갱신 — COUNT(*) 저장, live RPC와 동일한 창
-- =====================================================================

-- [1] 컬럼 추가
ALTER TABLE public.user_analytics_rollup
  ADD COLUMN IF NOT EXISTS baseline_days INTEGER;

-- [2] 기존 행 backfill
--     period_type = 'day' 행 대상, 동일 창 정의: period_end 기준 직전 14일 daily 행 수
UPDATE public.user_analytics_rollup r
SET baseline_days = (
  SELECT COUNT(*)
  FROM public.user_analytics_rollup b
  WHERE b.user_id      = r.user_id
    AND b.period_type  = 'day'
    AND b.period_start >= r.period_end - 14
    AND b.period_start <  r.period_end
)
WHERE r.period_type = 'day';

-- [3] build_period_rollup() 갱신
--     변경점:
--       DECLARE: v_baseline_days INTEGER 추가
--       §4 베이스라인 SELECT: COUNT(*) 추가
--       UPSERT INSERT/ON CONFLICT: baseline_days 추가
CREATE OR REPLACE FUNCTION public.build_period_rollup(
  p_user_id     uuid,
  p_period_type text,
  p_period_start date,
  p_period_end   date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_start_ts timestamptz := (p_period_start::timestamp) AT TIME ZONE 'Asia/Seoul';
  v_end_ts   timestamptz := ((p_period_end + 1)::timestamp) AT TIME ZONE 'Asia/Seoul';

  v_sessions_count       int := 0;
  v_total_duration       int := 0;
  v_active_days          int := 0;

  v_total_attempts       int := 0;
  v_correct_attempts     int := 0;
  v_overall_accuracy     numeric(5,4);
  v_avg_ms               int;
  v_median_ms            int;

  v_by_clef              jsonb := '{}'::jsonb;
  v_by_accidental        jsonb := '{}'::jsonb;
  v_by_level             jsonb := '{}'::jsonb;
  v_per_note             jsonb := '[]'::jsonb;
  v_interval_rates       jsonb := '{}'::jsonb;
  v_weak_top             jsonb := '[]'::jsonb;

  v_streak_days          int := 0;
  v_baseline_acc         numeric(5,4);
  v_baseline_ms          int;
  v_baseline_days        integer;
  v_graduated_count      int := 0;
  v_regressed_count      int := 0;
  v_graduated_notes      jsonb := '[]'::jsonb;
  v_regressed_notes      jsonb := '[]'::jsonb;
BEGIN
  -- ── 1. 세션 메타(tutorial 제외) ──
  SELECT
    COUNT(*),
    COALESCE(SUM(duration_seconds), 0),
    COUNT(DISTINCT (started_at AT TIME ZONE 'Asia/Seoul')::date)
  INTO v_sessions_count, v_total_duration, v_active_days
  FROM public.user_sessions
  WHERE user_id = p_user_id
    AND session_type <> 'tutorial'
    AND started_at >= v_start_ts
    AND started_at <  v_end_ts;

  -- ── 2. 전체 집계 + 분류별 JSONB ──
  WITH valid_logs AS (
    SELECT
      l.note_key, l.octave, l.clef, l.is_correct,
      (l.response_time * 1000)::numeric AS ms,
      l.level, l.interval_from_prev, l.created_at
    FROM public.user_note_logs l
    WHERE l.user_id = p_user_id
      AND l.created_at >= v_start_ts
      AND l.created_at <  v_end_ts
      AND NOT EXISTS (
        SELECT 1 FROM public.user_sessions s
        WHERE s.user_id = p_user_id
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
  clef_agg AS (
    SELECT clef,
           COUNT(*) AS n,
           (COUNT(*) FILTER (WHERE is_correct))::numeric / NULLIF(COUNT(*),0) AS acc,
           AVG(ms) FILTER (WHERE ms IS NOT NULL)::int AS avg_ms,
           (percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)
             FILTER (WHERE ms IS NOT NULL))::int AS median_ms
    FROM valid_logs GROUP BY clef
  ),
  acc_class AS (
    SELECT
      CASE WHEN note_key ~ '[#b]' THEN 'accidental' ELSE 'natural' END AS bucket,
      is_correct, ms
    FROM valid_logs
  ),
  accidental_agg AS (
    SELECT bucket,
           COUNT(*) AS n,
           (COUNT(*) FILTER (WHERE is_correct))::numeric / NULLIF(COUNT(*),0) AS acc,
           AVG(ms) FILTER (WHERE ms IS NOT NULL)::int AS avg_ms,
           (percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)
             FILTER (WHERE ms IS NOT NULL))::int AS median_ms
    FROM acc_class GROUP BY bucket
  ),
  level_agg AS (
    SELECT level,
           COUNT(*) AS n,
           (COUNT(*) FILTER (WHERE is_correct))::numeric / NULLIF(COUNT(*),0) AS acc,
           AVG(ms) FILTER (WHERE ms IS NOT NULL)::int AS avg_ms,
           (percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)
             FILTER (WHERE ms IS NOT NULL))::int AS median_ms
    FROM valid_logs GROUP BY level
  ),
  per_note_agg AS (
    SELECT note_key, octave, clef,
           COUNT(*) AS n,
           (COUNT(*) FILTER (WHERE is_correct))::numeric / NULLIF(COUNT(*),0) AS acc,
           AVG(ms) FILTER (WHERE ms IS NOT NULL)::int AS avg_ms,
           (percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)
             FILTER (WHERE ms IS NOT NULL))::int AS median_ms
    FROM valid_logs GROUP BY note_key, octave, clef
  ),
  interval_buckets AS (
    SELECT
      CASE
        WHEN interval_from_prev IS NULL THEN NULL
        WHEN ABS(interval_from_prev) = 0 THEN '0'
        WHEN ABS(interval_from_prev) BETWEEN 1 AND 2 THEN '1-2'
        WHEN ABS(interval_from_prev) BETWEEN 3 AND 5 THEN '3-5'
        WHEN ABS(interval_from_prev) BETWEEN 6 AND 9 THEN '6-9'
        ELSE '10+'
      END AS bucket,
      is_correct
    FROM valid_logs
    WHERE interval_from_prev IS NOT NULL
  ),
  interval_agg AS (
    SELECT bucket,
           COUNT(*) AS n,
           (COUNT(*) FILTER (WHERE NOT is_correct))::numeric / NULLIF(COUNT(*),0) AS error_rate
    FROM interval_buckets GROUP BY bucket
  ),
  weak_calc AS (
    SELECT note_key, octave, clef, n,
           (1 - acc)::numeric AS error_rate,
           avg_ms,
           median_ms,
           (1 - acc) * SQRT(n) + LEAST(COALESCE(avg_ms,0)::numeric / 3000.0, 1.0) * 0.3 AS weak_score
    FROM per_note_agg
    WHERE n >= 3
  )
  SELECT
    o.attempts, o.correct, o.avg_ms, o.median_ms,
    o.correct::numeric / NULLIF(o.attempts,0),
    COALESCE((SELECT jsonb_object_agg(clef, jsonb_build_object(
       'attempts', n, 'accuracy', acc, 'avg_ms', avg_ms, 'median_ms', median_ms))
       FROM clef_agg), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(bucket, jsonb_build_object(
       'attempts', n, 'accuracy', acc, 'avg_ms', avg_ms, 'median_ms', median_ms))
       FROM accidental_agg), '{}'::jsonb),
    COALESCE((SELECT jsonb_object_agg(level::text, jsonb_build_object(
       'attempts', n, 'accuracy', acc, 'avg_ms', avg_ms, 'median_ms', median_ms))
       FROM level_agg), '{}'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'note_key', note_key, 'octave', octave, 'clef', clef,
       'attempts', n, 'accuracy', acc, 'avg_ms', avg_ms, 'median_ms', median_ms))
       FROM per_note_agg), '[]'::jsonb),
    COALESCE((SELECT jsonb_object_agg(bucket, jsonb_build_object(
       'attempts', n, 'error_rate', error_rate))
       FROM interval_agg WHERE bucket IS NOT NULL), '{}'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'note_key', note_key, 'octave', octave, 'clef', clef,
       'attempts', n, 'error_rate', error_rate, 'avg_ms', avg_ms,
       'median_ms', median_ms, 'weak_score', ROUND(weak_score::numeric, 4))
       ORDER BY weak_score DESC)
       FROM (SELECT * FROM weak_calc ORDER BY weak_score DESC LIMIT 10) t),
       '[]'::jsonb)
  INTO
    v_total_attempts, v_correct_attempts, v_avg_ms, v_median_ms,
    v_overall_accuracy,
    v_by_clef, v_by_accidental, v_by_level,
    v_per_note, v_interval_rates, v_weak_top
  FROM overall o;

  -- ── 3. 스트릭 (period_end 기준 역방향 연속 활동 일수) ──
  WITH active_days AS (
    SELECT DISTINCT (created_at AT TIME ZONE 'Asia/Seoul')::date AS d
    FROM public.user_note_logs
    WHERE user_id = p_user_id
      AND created_at >= ((p_period_end - 60)::timestamp) AT TIME ZONE 'Asia/Seoul'
      AND created_at <  ((p_period_end + 1)::timestamp) AT TIME ZONE 'Asia/Seoul'
  ),
  walked AS (
    SELECT d,
           ROW_NUMBER() OVER (ORDER BY d DESC) AS rn,
           -- ⚠️ ROW_NUMBER()는 bigint. date - bigint 연산자 없음(42883). ::int 캐스팅 필수.
           (p_period_end - (ROW_NUMBER() OVER (ORDER BY d DESC) - 1)::int) AS expected
    FROM active_days
    WHERE d <= p_period_end
  )
  SELECT COUNT(*) INTO v_streak_days
  FROM walked
  WHERE d = expected;

  -- ── 4. 베이스라인 (live RPC get_daily_report()와 동일한 창·정의) ──
  SELECT
    AVG(overall_accuracy)::numeric(5,4),
    AVG(avg_reaction_ms)::int,
    COUNT(*)
  INTO v_baseline_acc, v_baseline_ms, v_baseline_days
  FROM public.user_analytics_rollup
  WHERE user_id = p_user_id
    AND period_type = 'day'
    AND period_start >= p_period_end - 14
    AND period_start <  p_period_end;

  -- ── 5. 졸업·퇴보 ──
  SELECT
    COUNT(*) FILTER (WHERE graduated_at IS NOT NULL
                       AND graduated_at >= v_start_ts AND graduated_at < v_end_ts),
    COUNT(*) FILTER (WHERE regressed_at IS NOT NULL
                       AND regressed_at >= v_start_ts AND regressed_at < v_end_ts),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'note_key', note_key, 'octave', octave, 'clef', clef, 'at', graduated_at))
       FROM public.user_note_status
       WHERE user_id = p_user_id
         AND graduated_at >= v_start_ts AND graduated_at < v_end_ts), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'note_key', note_key, 'octave', octave, 'clef', clef, 'at', regressed_at))
       FROM public.user_note_status
       WHERE user_id = p_user_id
         AND regressed_at >= v_start_ts AND regressed_at < v_end_ts), '[]'::jsonb)
  INTO v_graduated_count, v_regressed_count, v_graduated_notes, v_regressed_notes
  FROM public.user_note_status
  WHERE user_id = p_user_id;

  -- ── 6. UPSERT ──
  INSERT INTO public.user_analytics_rollup (
    user_id, period_type, period_start, period_end,
    sessions_count, total_attempts, correct_attempts,
    total_duration_seconds, active_days,
    overall_accuracy, avg_reaction_ms, median_reaction_ms,
    by_clef, by_accidental, by_level, per_note,
    interval_error_rates, weak_notes_top,
    streak_days, baseline_accuracy, baseline_avg_reaction_ms, baseline_days,
    graduated_count, regressed_count, graduated_notes, regressed_notes,
    computed_at
  ) VALUES (
    p_user_id, p_period_type, p_period_start, p_period_end,
    v_sessions_count, v_total_attempts, v_correct_attempts,
    v_total_duration, v_active_days,
    v_overall_accuracy, v_avg_ms, v_median_ms,
    v_by_clef, v_by_accidental, v_by_level, v_per_note,
    v_interval_rates, v_weak_top,
    v_streak_days, v_baseline_acc, v_baseline_ms, v_baseline_days,
    v_graduated_count, v_regressed_count, v_graduated_notes, v_regressed_notes,
    now()
  )
  ON CONFLICT (user_id, period_type, period_start) DO UPDATE SET
    period_end               = EXCLUDED.period_end,
    sessions_count           = EXCLUDED.sessions_count,
    total_attempts           = EXCLUDED.total_attempts,
    correct_attempts         = EXCLUDED.correct_attempts,
    total_duration_seconds   = EXCLUDED.total_duration_seconds,
    active_days              = EXCLUDED.active_days,
    overall_accuracy         = EXCLUDED.overall_accuracy,
    avg_reaction_ms          = EXCLUDED.avg_reaction_ms,
    median_reaction_ms       = EXCLUDED.median_reaction_ms,
    by_clef                  = EXCLUDED.by_clef,
    by_accidental            = EXCLUDED.by_accidental,
    by_level                 = EXCLUDED.by_level,
    per_note                 = EXCLUDED.per_note,
    interval_error_rates     = EXCLUDED.interval_error_rates,
    weak_notes_top           = EXCLUDED.weak_notes_top,
    streak_days              = EXCLUDED.streak_days,
    baseline_accuracy        = EXCLUDED.baseline_accuracy,
    baseline_avg_reaction_ms = EXCLUDED.baseline_avg_reaction_ms,
    baseline_days            = EXCLUDED.baseline_days,
    graduated_count          = EXCLUDED.graduated_count,
    regressed_count          = EXCLUDED.regressed_count,
    graduated_notes          = EXCLUDED.graduated_notes,
    regressed_notes          = EXCLUDED.regressed_notes,
    computed_at              = now();
END;
$func$;

GRANT EXECUTE ON FUNCTION public.build_period_rollup(uuid, text, date, date) TO postgres;
