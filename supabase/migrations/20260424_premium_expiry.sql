-- 1. daily_batch_runs에 premium_expired 컬럼 추가
ALTER TABLE daily_batch_runs 
ADD COLUMN IF NOT EXISTS premium_expired INTEGER NOT NULL DEFAULT 0;

-- 2. 프리미엄 만료 전용 함수
CREATE OR REPLACE FUNCTION public.expire_premium_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE profiles
  SET 
    is_premium = false,
    updated_at = NOW()
  WHERE is_premium = true
    AND premium_until IS NOT NULL
    AND premium_until < NOW()
    AND (role IS NULL OR role != 'admin');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$func$;

-- 3. 배치 분석 함수 개정
CREATE OR REPLACE FUNCTION public.run_daily_batch_analysis()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_run_id UUID;
  v_start_at TIMESTAMPTZ := NOW();
  v_users_analyzed INTEGER := 0;
  v_weakness_flagged INTEGER := 0;
  v_mastery_flagged INTEGER := 0;
  v_weakness_released INTEGER := 0;
  v_premium_expired INTEGER := 0;
  v_duration_ms INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  IF EXISTS (SELECT 1 FROM daily_batch_runs WHERE run_date = v_today) THEN
    RAISE NOTICE 'Batch already ran today (%), skipping.', v_today;
    RETURN NULL;
  END IF;

  SELECT COUNT(DISTINCT user_id) INTO v_users_analyzed
  FROM note_mastery
  WHERE last_seen_at >= NOW() - INTERVAL '30 days';

  WITH flagged AS (
    UPDATE note_mastery
    SET weakness_flag = true, weakness_flagged_at = NOW(), last_batch_analyzed_at = NOW()
    WHERE weakness_flag = false
      AND total_attempts >= 5
      AND (recent_accuracy < 0.60 OR avg_reaction_ms > 3000)
      AND last_seen_at >= NOW() - INTERVAL '30 days'
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_weakness_flagged FROM flagged;

  WITH released AS (
    UPDATE note_mastery
    SET weakness_flag = false, weakness_flagged_at = NULL, last_batch_analyzed_at = NOW()
    WHERE weakness_flag = true
      AND total_attempts >= 5
      AND recent_accuracy >= 0.85
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_weakness_released FROM released;

  WITH mastered AS (
    UPDATE note_mastery
    SET mastery_flag = true, mastery_flagged_at = NOW(), last_batch_analyzed_at = NOW()
    WHERE mastery_flag = false
      AND total_attempts >= 20
      AND recent_accuracy >= 0.95
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_mastery_flagged FROM mastered;

  v_premium_expired := public.expire_premium_users();

  v_duration_ms := EXTRACT(EPOCH FROM (NOW() - v_start_at)) * 1000;

  INSERT INTO daily_batch_runs (
    run_date, users_analyzed, weakness_flagged, mastery_flagged,
    weakness_released, premium_expired, duration_ms, status
  ) VALUES (
    v_today, v_users_analyzed, v_weakness_flagged, v_mastery_flagged,
    v_weakness_released, v_premium_expired, v_duration_ms, 'success'
  )
  RETURNING id INTO v_run_id;

  RETURN v_run_id;

EXCEPTION WHEN OTHERS THEN
  INSERT INTO daily_batch_runs (
    run_date, users_analyzed, duration_ms, status, error_message
  ) VALUES (
    v_today, v_users_analyzed,
    EXTRACT(EPOCH FROM (NOW() - v_start_at)) * 1000,
    'failed', SQLERRM
  )
  ON CONFLICT (run_date) DO UPDATE
  SET status = 'failed', error_message = EXCLUDED.error_message
  RETURNING id INTO v_run_id;

  RAISE;
END;
$func$;
