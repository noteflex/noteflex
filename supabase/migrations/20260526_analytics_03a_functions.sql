-- Migration: 20260526_analytics_03a_functions.sql
-- Purpose: 분석 보고서 배치 엔진 — 함수·객체 생성만 (cron 변경 X).
-- 권한: 모두 SECURITY DEFINER.
-- 격리: 기존 run_daily_batch_analysis·handle_session_complete·note_mastery 트리거 건드리지 않음.
-- 분할 사유: prod 직접 적용. 함수 객체 적용(03a, idempotent)과 cron 변경(03b)을 분리해
--           03a 적용 → 수동 SELECT 검증 → 03b 적용 순서를 가능하게 함.
--
-- 핵심 안전 설계 — run_daily_analytics_rollup():
--   같은 cron 명령 내 선행 SELECT가 premium 만료(run_daily_batch_analysis 내부 expire_premium_users)를 수행.
--   본 함수가 RAISE 하면 cron의 multi-statement 트랜잭션이 ABORT 되어 premium 만료 effect까지 롤백됨.
--   → outer EXCEPTION WHEN OTHERS를 추가하여 어떤 에러도 흡수 (절대 RAISE 안 함).
--   → daily_batch_runs stats 기록도 자체 nested BEGIN/EXCEPTION으로 보호.

-- =====================================================================
-- helper: refresh_user_note_status
--   user_note_logs 최근 20회 윈도우 기반으로 user_note_status UPSERT.
--   상태 전이: learning → weakness → (학습) → graduated → regressed → ...
--   졸업 v1: 정확도만 (속도 ratio는 sublevel 컬럼 추가 후 v2).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.refresh_user_note_status(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_changed integer := 0;
BEGIN
  WITH ranked AS (
    SELECT
      l.note_key, l.octave, l.clef,
      l.is_correct,
      (l.response_time * 1000)::numeric AS ms,
      l.created_at,
      (
        SELECT s.id FROM public.user_sessions s
        WHERE s.user_id = p_user_id
          AND s.session_type <> 'tutorial'
          AND l.created_at >= s.started_at
          AND l.created_at <= s.ended_at
        LIMIT 1
      ) AS sess_id,
      ROW_NUMBER() OVER (
        PARTITION BY l.note_key, l.octave, l.clef
        ORDER BY l.created_at DESC
      ) AS rn
    FROM public.user_note_logs l
    WHERE l.user_id = p_user_id
  ),
  recent20 AS (
    SELECT
      note_key, octave, clef,
      COUNT(*)                                                  AS attempts,
      COUNT(*) FILTER (WHERE is_correct)                        AS correct,
      COUNT(DISTINCT sess_id) FILTER (WHERE sess_id IS NOT NULL) AS sessions,
      AVG(ms) FILTER (WHERE ms IS NOT NULL)::int                AS avg_ms,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)
        FILTER (WHERE ms IS NOT NULL)::int                       AS median_ms,
      MAX(created_at)                                            AS last_attempt_at
    FROM ranked
    WHERE rn <= 20
    GROUP BY note_key, octave, clef
  ),
  prev AS (
    SELECT note_key, octave, clef, status, ever_weakness, graduated_at, regressed_at, weakness_flagged_at
    FROM public.user_note_status
    WHERE user_id = p_user_id
  ),
  computed AS (
    SELECT
      r.note_key, r.octave, r.clef,
      r.attempts, r.correct, r.sessions, r.avg_ms, r.median_ms, r.last_attempt_at,
      r.correct::numeric / NULLIF(r.attempts, 0) AS accuracy,
      COALESCE(p.status, 'learning')             AS prev_status,
      COALESCE(p.ever_weakness, false)           AS prev_ever_weakness,
      p.graduated_at                             AS prev_graduated_at,
      p.regressed_at                             AS prev_regressed_at,
      p.weakness_flagged_at                      AS prev_weakness_flagged_at,
      CASE
        WHEN r.attempts < 20 THEN COALESCE(p.status, 'learning')
        WHEN COALESCE(p.ever_weakness, false)
             AND r.correct >= 19
             AND r.sessions >= 2
          THEN 'graduated'
        WHEN (r.attempts - r.correct)::numeric / r.attempts >= 0.40
          THEN 'weakness'
        WHEN p.status = 'graduated' AND r.correct < 19
          THEN 'regressed'
        ELSE 'learning'
      END AS new_status
    FROM recent20 r
    LEFT JOIN prev p USING (note_key, octave, clef)
  )
  INSERT INTO public.user_note_status (
    user_id, note_key, octave, clef,
    recent_20_attempts, recent_20_correct, recent_20_accuracy,
    recent_20_sessions, recent_20_avg_ms, recent_20_median_ms,
    status, ever_weakness,
    graduated_at, regressed_at, weakness_flagged_at,
    last_attempt_at, updated_at
  )
  SELECT
    p_user_id, note_key, octave, clef,
    attempts, correct, accuracy,
    sessions, avg_ms, median_ms,
    new_status,
    prev_ever_weakness OR (new_status = 'weakness'),
    CASE WHEN new_status = 'graduated' AND prev_status <> 'graduated' THEN now()
         ELSE prev_graduated_at END,
    CASE WHEN new_status = 'regressed' AND prev_status <> 'regressed' THEN now()
         ELSE prev_regressed_at END,
    CASE WHEN new_status = 'weakness' AND COALESCE(prev_status,'') <> 'weakness' THEN now()
         ELSE prev_weakness_flagged_at END,
    last_attempt_at,
    now()
  FROM computed
  ON CONFLICT (user_id, note_key, octave, clef) DO UPDATE SET
    recent_20_attempts      = EXCLUDED.recent_20_attempts,
    recent_20_correct       = EXCLUDED.recent_20_correct,
    recent_20_accuracy      = EXCLUDED.recent_20_accuracy,
    recent_20_sessions      = EXCLUDED.recent_20_sessions,
    recent_20_avg_ms        = EXCLUDED.recent_20_avg_ms,
    recent_20_median_ms     = EXCLUDED.recent_20_median_ms,
    status                  = EXCLUDED.status,
    ever_weakness           = EXCLUDED.ever_weakness,
    graduated_at            = EXCLUDED.graduated_at,
    regressed_at            = EXCLUDED.regressed_at,
    weakness_flagged_at     = EXCLUDED.weakness_flagged_at,
    last_attempt_at         = EXCLUDED.last_attempt_at,
    updated_at              = now();

  GET DIAGNOSTICS v_changed = ROW_COUNT;
  RETURN v_changed;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.refresh_user_note_status(uuid) TO postgres;

-- =====================================================================
-- helper: build_period_rollup
--   기간(day/week/month)에 대해 user_analytics_rollup UPSERT.
--   tutorial 제외. 단위 ms 통일.
-- =====================================================================
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

-- =====================================================================
-- top-level: run_daily_analytics_rollup
--   KST 00:00 cron (noteflex-daily-batch에서 run_daily_batch_analysis 이후 호출).
--
--   ⚠️ 에러 흡수 설계 (CRITICAL):
--   같은 cron 명령은 multi-statement로 SELECT run_daily_batch_analysis(); SELECT run_daily_analytics_rollup();
--   두 SELECT는 같은 트랜잭션에 있다. 본 함수가 RAISE 하면 트랜잭션이 ABORT 되어
--   직전 run_daily_batch_analysis (premium 만료 포함)의 effect도 롤백된다.
--   → outer EXCEPTION WHEN OTHERS를 두어 모든 에러를 흡수. RETURN NULL.
--   → 추가로 post-loop stats write도 nested BEGIN/EXCEPTION으로 보호하여
--     stats write 실패가 그 자체로 outer EXCEPTION을 트리거하지 않도록 함.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.run_daily_analytics_rollup()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_started_at      timestamptz := now();
  v_today_kst       date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  v_yesterday_kst   date := v_today_kst - 1;
  v_is_monday       boolean := EXTRACT(ISODOW FROM v_today_kst) = 1;
  v_is_first        boolean := EXTRACT(DAY FROM v_today_kst) = 1;

  v_week_start      date := v_today_kst - 7;
  v_week_end        date := v_today_kst - 1;
  v_month_start     date := (date_trunc('month', (v_today_kst - INTERVAL '1 day'))::date);
  v_month_end       date := (date_trunc('month', v_today_kst)::date - 1);

  v_uid             uuid;
  v_users_processed int := 0;
  v_users_failed    int := 0;
  v_daily_count     int := 0;
  v_weekly_count    int := 0;
  v_monthly_count   int := 0;
  v_grad_total      int := 0;
  v_reg_total       int := 0;
  v_duration_ms     int;

  v_grad_for_user   int;
  v_reg_for_user    int;

  v_run_id          uuid;
BEGIN
  -- 30일 내 활동 유저 순회
  FOR v_uid IN
    SELECT DISTINCT user_id
    FROM public.user_note_logs
    WHERE created_at >= ((v_today_kst - 30)::timestamp) AT TIME ZONE 'Asia/Seoul'
  LOOP
    BEGIN
      PERFORM public.refresh_user_note_status(v_uid);

      PERFORM public.build_period_rollup(v_uid, 'day', v_yesterday_kst, v_yesterday_kst);
      v_daily_count := v_daily_count + 1;

      IF v_is_monday THEN
        PERFORM public.build_period_rollup(v_uid, 'week', v_week_start, v_week_end);
        v_weekly_count := v_weekly_count + 1;
      END IF;

      IF v_is_first THEN
        PERFORM public.build_period_rollup(v_uid, 'month', v_month_start, v_month_end);
        v_monthly_count := v_monthly_count + 1;
      END IF;

      SELECT graduated_count, regressed_count
      INTO v_grad_for_user, v_reg_for_user
      FROM public.user_analytics_rollup
      WHERE user_id = v_uid AND period_type = 'day' AND period_start = v_yesterday_kst;
      v_grad_total := v_grad_total + COALESCE(v_grad_for_user, 0);
      v_reg_total  := v_reg_total  + COALESCE(v_reg_for_user,  0);

      v_users_processed := v_users_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      -- per-user 에러 흡수: savepoint 롤백 + 다음 유저 계속
      v_users_failed := v_users_failed + 1;
      RAISE NOTICE 'analytics rollup failed for user %: % / %', v_uid, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  v_duration_ms := EXTRACT(EPOCH FROM (now() - v_started_at)) * 1000;

  -- post-loop stats write — 자체 nested BEGIN/EXCEPTION으로 보호
  -- (이 블록 내 에러는 outer EXCEPTION을 트리거하지 않음; cron 트랜잭션 안전)
  BEGIN
    UPDATE public.daily_batch_runs
    SET rollup_users_processed = v_users_processed,
        rollup_users_failed    = v_users_failed,
        rollup_daily_count     = v_daily_count,
        rollup_weekly_count    = v_weekly_count,
        rollup_monthly_count   = v_monthly_count,
        rollup_graduated_total = v_grad_total,
        rollup_regressed_total = v_reg_total,
        rollup_duration_ms     = v_duration_ms
    WHERE run_date = v_today_kst
    RETURNING id INTO v_run_id;

    IF v_run_id IS NULL THEN
      INSERT INTO public.daily_batch_runs (
        run_date, users_analyzed, status,
        rollup_users_processed, rollup_users_failed,
        rollup_daily_count, rollup_weekly_count, rollup_monthly_count,
        rollup_graduated_total, rollup_regressed_total, rollup_duration_ms
      ) VALUES (
        v_today_kst, v_users_processed, 'success',
        v_users_processed, v_users_failed,
        v_daily_count, v_weekly_count, v_monthly_count,
        v_grad_total, v_reg_total, v_duration_ms
      )
      ON CONFLICT (run_date) DO UPDATE SET
        rollup_users_processed = EXCLUDED.rollup_users_processed,
        rollup_users_failed    = EXCLUDED.rollup_users_failed,
        rollup_daily_count     = EXCLUDED.rollup_daily_count,
        rollup_weekly_count    = EXCLUDED.rollup_weekly_count,
        rollup_monthly_count   = EXCLUDED.rollup_monthly_count,
        rollup_graduated_total = EXCLUDED.rollup_graduated_total,
        rollup_regressed_total = EXCLUDED.rollup_regressed_total,
        rollup_duration_ms     = EXCLUDED.rollup_duration_ms
      RETURNING id INTO v_run_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- stats write 실패: 루프 데이터는 유지(이미 commit savepoint 안에 있음).
    -- v_run_id는 NULL로 유지. outer EXCEPTION으로 escalate 안 함.
    RAISE NOTICE 'analytics rollup stats write failed (loop data preserved): % / %',
                 SQLSTATE, SQLERRM;
    v_run_id := NULL;
  END;

  RETURN v_run_id;

EXCEPTION WHEN OTHERS THEN
  -- ⚠️ TOP-LEVEL 안전망: 절대 RAISE 안 함.
  -- cron multi-statement 트랜잭션 보호 (premium 만료 effect 보존).
  -- 본 블록 도달 시 outer BEGIN savepoint는 이미 롤백됨 → 루프 데이터 잃음.
  -- 그러나 cron 트랜잭션은 abort 안 되어 선행 SELECT effect는 보존됨.
  BEGIN
    INSERT INTO public.daily_batch_runs (
      run_date, users_analyzed, status, error_message,
      rollup_users_processed, rollup_users_failed,
      rollup_daily_count, rollup_weekly_count, rollup_monthly_count,
      rollup_graduated_total, rollup_regressed_total, rollup_duration_ms
    ) VALUES (
      v_today_kst, 0, 'failed',
      'rollup top-level: ' || SQLSTATE || ' ' || SQLERRM,
      v_users_processed, v_users_failed,
      v_daily_count, v_weekly_count, v_monthly_count,
      v_grad_total, v_reg_total,
      (EXTRACT(EPOCH FROM (now() - v_started_at)) * 1000)::int
    )
    ON CONFLICT (run_date) DO UPDATE SET
      status        = 'failed',
      error_message = EXCLUDED.error_message,
      rollup_users_processed = EXCLUDED.rollup_users_processed,
      rollup_users_failed    = EXCLUDED.rollup_users_failed,
      rollup_daily_count     = EXCLUDED.rollup_daily_count,
      rollup_weekly_count    = EXCLUDED.rollup_weekly_count,
      rollup_monthly_count   = EXCLUDED.rollup_monthly_count,
      rollup_graduated_total = EXCLUDED.rollup_graduated_total,
      rollup_regressed_total = EXCLUDED.rollup_regressed_total,
      rollup_duration_ms     = EXCLUDED.rollup_duration_ms;
  EXCEPTION WHEN OTHERS THEN
    -- 로깅 자체도 실패 → NOTICE만. cron 트랜잭션은 여전히 보호됨.
    RAISE NOTICE 'analytics rollup TOP-LEVEL + logging both failed: % / %',
                 SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.run_daily_analytics_rollup() TO postgres;

COMMENT ON FUNCTION public.run_daily_analytics_rollup() IS
  '일/주/월 분석 롤업 배치. cron noteflex-daily-batch에서 run_daily_batch_analysis 다음에 호출. outer EXCEPTION으로 모든 에러 흡수 (RAISE 안 함) → 같은 cron 트랜잭션의 premium 만료 effect 보호.';
