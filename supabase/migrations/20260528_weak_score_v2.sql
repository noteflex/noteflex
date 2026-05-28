-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260528_weak_score_v2.sql
-- ═══════════════════════════════════════════════════════════════
-- 변경: build_period_rollup 함수 내부의 weak_score 공식만 v2로 교체.
--       다른 로직(세션 집계·overall·by_clef·streak·졸업 등)은 그대로.
--
-- 배경 (v1 문제):
--   v1: weak_score = (1 - acc) * SQRT(n) + LEAST(avg_ms/3000, 1) * 0.3
--   sqrt(n) 표본 가중치가 너무 강해, 큰 표본(n=33)의 73% 정확도가
--   작은 표본(n=5)의 0% 정확도보다 약점 상위로 오는 사례 발생.
--   정확도가 주 신호여야 한다는 직관과 어긋남.
--
-- v2 공식:
--   weak_score = (1 - acc)
--              + LEAST(n::numeric / 100, 0.15)
--              + LEAST(COALESCE(avg_ms, 0)::numeric / 3000.0, 1.0) * 0.05
--   - (1-acc)이 주항(0~1), 표본 보너스 ≤0.15 캡, 속도 ≤0.05 캡.
--   - 같은 정확도면 큰 표본이 우선, 표본 영향은 미미하게.
--
-- 검증 시뮬레이션 (avg_ms 무시 시):
--   Eb4  23%/n13 → 0.77 + 0.130 = 0.900   ← 2위
--   Gb3   0%/n5  → 1.00 + 0.050 = 1.050   ← 1위
--   B1   29%/n7  → 0.71 + 0.070 = 0.780   ← 3위
--   B4   73%/n33 → 0.27 + 0.150 = 0.420   ← 5위
--   G1   60%/n10 → 0.40 + 0.100 = 0.500   ← 4위
--   → 기대 정렬(0%·23%·29%·60%·73%) 정확 일치.
--
-- 클라이언트 측 동일 공식: src/components/dashboard/WeakSlowNotesCards.tsx
--
-- ⚠️ DB 적용은 사용자가 별도 진행 (이 파일 작성만, 자동 apply 없음).
-- ═══════════════════════════════════════════════════════════════


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
  -- ⬇⬇⬇  v2 weak_score 공식 (이 블록만 변경, 나머지는 v1과 동일) ⬇⬇⬇
  weak_calc AS (
    SELECT note_key, octave, clef, n,
           (1 - acc)::numeric AS error_rate,
           avg_ms,
           median_ms,
           -- v2: (1-acc) 주항, 표본 보너스 ≤0.15, 속도 보너스 ≤0.05
           (1 - acc)
             + LEAST(n::numeric / 100.0, 0.15)
             + LEAST(COALESCE(avg_ms, 0)::numeric / 3000.0, 1.0) * 0.05
             AS weak_score
    FROM per_note_agg
    WHERE n >= 3
  )
  -- ⬆⬆⬆  v2 weak_score 공식 끝 ⬆⬆⬆
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
           (p_period_end - (ROW_NUMBER() OVER (ORDER BY d DESC) - 1)::int) AS expected
    FROM active_days
    WHERE d <= p_period_end
  )
  SELECT COUNT(*) INTO v_streak_days
  FROM walked
  WHERE d = expected;

  -- ── 4. 베이스라인 ──
  SELECT
    AVG(overall_accuracy)::numeric(5,4),
    AVG(avg_reaction_ms)::int
  INTO v_baseline_acc, v_baseline_ms
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
    streak_days, baseline_accuracy, baseline_avg_reaction_ms,
    graduated_count, regressed_count, graduated_notes, regressed_notes,
    computed_at
  ) VALUES (
    p_user_id, p_period_type, p_period_start, p_period_end,
    v_sessions_count, v_total_attempts, v_correct_attempts,
    v_total_duration, v_active_days,
    v_overall_accuracy, v_avg_ms, v_median_ms,
    v_by_clef, v_by_accidental, v_by_level, v_per_note,
    v_interval_rates, v_weak_top,
    v_streak_days, v_baseline_acc, v_baseline_ms,
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
    graduated_count          = EXCLUDED.graduated_count,
    regressed_count          = EXCLUDED.regressed_count,
    graduated_notes          = EXCLUDED.graduated_notes,
    regressed_notes          = EXCLUDED.regressed_notes,
    computed_at              = now();
END;
$func$;

GRANT EXECUTE ON FUNCTION public.build_period_rollup(uuid, text, date, date) TO postgres;
