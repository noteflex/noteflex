-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260531_weak_scores_table.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: 약점 점수 시스템 (graduated와 별개).
--       (user_id, level, sublevel, note_id) 단위 약점 점수를 매일 KST 자정 cron으로 갱신.
--       Premium·admin 사용자만 처리. Free→Premium 전환 시 backfill로 즉시 채움.
--
-- 약점 점수 공식 (refresh_weak_scores·backfill 동일):
--   윈도우: 최근 30일 user_note_logs (sublevel > 0)
--   per-user 평균 응답시간: user_avg_rt = AVG(response_time) over 같은 윈도우
--   응답시간 임계: rt_threshold = max(2.0, user_avg_rt * 1.5)
--   per-(user, level, sublevel, note_id) 집계 (sample_size >= 5만):
--     accuracy_score      = 1 - SUM(is_correct)/COUNT(*)               -- 오답률
--     response_time_score = COUNT(response_time >= rt_threshold)/COUNT(*) -- 느린 응답 비율
--     combined_score      = accuracy_score * 0.5 + response_time_score * 0.5
--
-- note_id 형식: "<clef>:<note_key><octave>" 예 "treble:F#4", "bass:Bb2"
--   - useUserMastery·useRetryQueue의 composeId 형식과 동일 (클라 일관성)
--
-- graduated 시스템과 무관:
--   - user_note_status·refresh_user_note_status·기존 노트 윈도우(recent_20) 변경 0건
--   - 본 함수는 별도 테이블 user_note_weak_scores만 UPSERT
--
-- cron 변경:
--   기존: SELECT run_daily_batch_analysis(); SELECT run_daily_analytics_rollup();
--   신규: 위 + SELECT refresh_weak_scores();
--
-- 에러 안전 설계:
--   - run_daily_analytics_rollup 패턴 그대로 (outer EXCEPTION WHEN OTHERS).
--   - 본 함수가 RAISE 하면 cron multi-statement 트랜잭션 ABORT → 선행 함수 effect 손실.
--     따라서 outer EXCEPTION으로 모든 에러 흡수, RAISE 0.
--
-- ⚠️ DB 적용은 사용자가 별도 진행 (Supabase SQL Editor).
-- ⚠️ backfill 자동 호출(Paddle webhook·is_premium UPDATE trigger)은 3단계에서 별도 마이그레이션·코드로 추가.
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. user_note_weak_scores 테이블 ──────────────────────────
CREATE TABLE IF NOT EXISTS public.user_note_weak_scores (
  user_id              UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level                INTEGER      NOT NULL CHECK (level BETWEEN 1 AND 7),
  sublevel             INTEGER      NOT NULL CHECK (sublevel BETWEEN 1 AND 3),
  note_id              TEXT         NOT NULL,    -- "<clef>:<note_key><octave>"
  accuracy_score       NUMERIC(5,4) NOT NULL CHECK (accuracy_score BETWEEN 0 AND 1),
  response_time_score  NUMERIC(5,4) NOT NULL CHECK (response_time_score BETWEEN 0 AND 1),
  combined_score       NUMERIC(5,4) NOT NULL CHECK (combined_score BETWEEN 0 AND 1),
  sample_size          INTEGER      NOT NULL CHECK (sample_size >= 5),
  computed_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level, sublevel, note_id)
);

CREATE INDEX IF NOT EXISTS idx_weak_scores_user_level_sublevel
  ON public.user_note_weak_scores (user_id, level, sublevel);

ALTER TABLE public.user_note_weak_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weak_scores_select_own  ON public.user_note_weak_scores;
DROP POLICY IF EXISTS weak_scores_admin_select ON public.user_note_weak_scores;

CREATE POLICY weak_scores_select_own
  ON public.user_note_weak_scores
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY weak_scores_admin_select
  ON public.user_note_weak_scores
  FOR SELECT
  USING (public.is_admin());

-- INSERT/UPDATE/DELETE 정책 없음 — SECURITY DEFINER 함수만 기록.

COMMENT ON TABLE public.user_note_weak_scores IS
  '약점 점수 (user_id, level, sublevel, note_id) 단위. cron+backfill이 기록. Premium·admin만 채워짐.';
COMMENT ON COLUMN public.user_note_weak_scores.accuracy_score IS
  '오답률 (0~1, 1 = 항상 오답)';
COMMENT ON COLUMN public.user_note_weak_scores.response_time_score IS
  '느린 응답 비율 (response_time >= rt_threshold = max(2.0, user_avg_rt × 1.5))';
COMMENT ON COLUMN public.user_note_weak_scores.combined_score IS
  '약점 종합 점수 = accuracy_score × 0.5 + response_time_score × 0.5';


-- ─── 2. refresh_weak_scores — Premium·admin 전체 사용자 처리 ──
-- KST 자정 cron(noteflex-daily-batch) 안에서 호출.
-- outer EXCEPTION WHEN OTHERS로 모든 에러 흡수 (cron 트랜잭션 보호).
CREATE OR REPLACE FUNCTION public.refresh_weak_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid              uuid;
  v_users_processed  int := 0;
  v_users_failed     int := 0;
BEGIN
  -- 대상: is_premium=true OR subscription_tier='pro' OR role='admin'
  -- 30일 이내 활동(user_note_logs.sublevel > 0) 있는 사용자만
  FOR v_uid IN
    SELECT DISTINCT p.id
    FROM public.profiles p
    WHERE (p.is_premium = true
           OR p.subscription_tier = 'pro'
           OR p.role = 'admin')
      AND EXISTS (
        SELECT 1 FROM public.user_note_logs l
        WHERE l.user_id = p.id
          AND l.sublevel > 0
          AND l.created_at >= now() - interval '30 days'
      )
  LOOP
    BEGIN
      PERFORM public.backfill_weak_scores_on_premium(v_uid);
      v_users_processed := v_users_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_users_failed := v_users_failed + 1;
      RAISE NOTICE 'refresh_weak_scores failed for user %: % / %', v_uid, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RETURN v_users_processed;

EXCEPTION WHEN OTHERS THEN
  -- ⚠️ TOP-LEVEL 안전망: 절대 RAISE 안 함.
  -- cron multi-statement 트랜잭션 보호 (선행 함수 effect 보존).
  RAISE NOTICE 'refresh_weak_scores TOP-LEVEL: % / %', SQLSTATE, SQLERRM;
  RETURN -1;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.refresh_weak_scores() TO postgres;

COMMENT ON FUNCTION public.refresh_weak_scores() IS
  'KST 자정 cron noteflex-daily-batch 내 호출. Premium·admin 사용자 약점 점수 일괄 갱신. outer EXCEPTION으로 모든 에러 흡수.';


-- ─── 3. backfill_weak_scores_on_premium — 단일 사용자 idempotent ──
-- refresh_weak_scores와 동일 로직, 단일 user.
-- Free → Premium 전환 시 즉시 호출(3단계에서 webhook·trigger 추가).
-- idempotent: UPSERT 패턴 — 중복 호출해도 동일 결과 (computed_at만 갱신).
CREATE OR REPLACE FUNCTION public.backfill_weak_scores_on_premium(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_avg_rt   numeric;
  v_rt_threshold  numeric;
  v_rows_upserted int := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id NULL';
  END IF;

  -- 1. 사용자 30일 평균 응답시간 (sublevel > 0, response_time IS NOT NULL)
  SELECT AVG(response_time)::numeric
  INTO v_user_avg_rt
  FROM public.user_note_logs
  WHERE user_id = p_user_id
    AND sublevel > 0
    AND response_time IS NOT NULL
    AND response_time > 0
    AND created_at >= now() - interval '30 days';

  -- 사용자 데이터 부족 → 함수 종료 (UPSERT 없음, 기존 행은 그대로 유지)
  IF v_user_avg_rt IS NULL THEN
    RETURN 0;
  END IF;

  -- 2. 응답시간 임계
  v_rt_threshold := GREATEST(2.0, v_user_avg_rt * 1.5);

  -- 3. (level, sublevel, note_id) 단위 집계 + UPSERT
  --    note_id = "<clef>:<note_key><octave>" (예: "treble:F#4")
  WITH agg AS (
    SELECT
      l.level,
      l.sublevel,
      l.clef || ':' || l.note_key || l.octave::text AS note_id,
      COUNT(*)                                              AS sample_size,
      (1.0 - SUM(CASE WHEN l.is_correct THEN 1 ELSE 0 END)::numeric
             / NULLIF(COUNT(*), 0))                          AS accuracy_score,
      (SUM(CASE WHEN l.response_time >= v_rt_threshold THEN 1 ELSE 0 END)::numeric
             / NULLIF(COUNT(*), 0))                          AS response_time_score
    FROM public.user_note_logs l
    WHERE l.user_id = p_user_id
      AND l.sublevel > 0
      AND l.response_time IS NOT NULL
      AND l.response_time > 0
      AND l.created_at >= now() - interval '30 days'
    GROUP BY l.level, l.sublevel, note_id
    HAVING COUNT(*) >= 5
  )
  INSERT INTO public.user_note_weak_scores (
    user_id, level, sublevel, note_id,
    accuracy_score, response_time_score, combined_score,
    sample_size, computed_at
  )
  SELECT
    p_user_id,
    a.level,
    a.sublevel,
    a.note_id,
    a.accuracy_score,
    a.response_time_score,
    a.accuracy_score * 0.5 + a.response_time_score * 0.5,
    a.sample_size,
    now()
  FROM agg a
  ON CONFLICT (user_id, level, sublevel, note_id) DO UPDATE SET
    accuracy_score      = EXCLUDED.accuracy_score,
    response_time_score = EXCLUDED.response_time_score,
    combined_score      = EXCLUDED.combined_score,
    sample_size         = EXCLUDED.sample_size,
    computed_at         = now();

  GET DIAGNOSTICS v_rows_upserted = ROW_COUNT;
  RETURN v_rows_upserted;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.backfill_weak_scores_on_premium(uuid) TO postgres, authenticated;
-- authenticated에 GRANT는 webhook이 SECURITY DEFINER 함수로 호출하는 패턴 대비.
-- 실제 호출은 Paddle webhook(SERVICE_ROLE) + UPDATE trigger(SECURITY DEFINER)에서.

COMMENT ON FUNCTION public.backfill_weak_scores_on_premium(uuid) IS
  '단일 사용자 약점 점수 즉시 갱신. idempotent UPSERT. Free→Premium 전환 시 Paddle webhook·is_premium UPDATE trigger에서 호출 (3단계 추가).';


-- ─── 4. cron 갱신 — noteflex-daily-batch에 refresh_weak_scores 추가 ──
DO $cron$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'noteflex-daily-batch';
  PERFORM cron.schedule(
    'noteflex-daily-batch',
    '0 15 * * *',  -- UTC 15:00 = KST 00:00
    $$SELECT public.run_daily_batch_analysis(); SELECT public.run_daily_analytics_rollup(); SELECT public.refresh_weak_scores();$$
  );
END
$cron$;


-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리 (적용 후)
-- ═══════════════════════════════════════════════════════════════
--
-- 1. 테이블 + 정책 확인:
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename = 'user_note_weak_scores';
--
-- 2. 함수 존재 확인:
--    SELECT routine_name FROM information_schema.routines
--    WHERE routine_schema = 'public'
--      AND routine_name IN ('refresh_weak_scores', 'backfill_weak_scores_on_premium');
--
-- 3. cron command 확인 (refresh_weak_scores 포함되어야 함):
--    SELECT jobname, schedule, command FROM cron.job
--    WHERE jobname = 'noteflex-daily-batch';
--    → command에 "SELECT public.refresh_weak_scores();" 포함 확인
--
-- 4. 수동 backfill 테스트 (admin 본인):
--    SELECT public.backfill_weak_scores_on_premium(auth.uid());
--    → row 수 반환 (0이면 30일 내 sublevel>0 데이터 부족)
--
-- 5. 결과 행 확인:
--    SELECT level, sublevel, note_id, accuracy_score, response_time_score,
--           combined_score, sample_size
--    FROM public.user_note_weak_scores
--    WHERE user_id = auth.uid()
--    ORDER BY level, sublevel, combined_score DESC;
--
-- 6. cron 다음 실행 후 확인 (KST 자정 후):
--    SELECT computed_at::date, COUNT(DISTINCT user_id) AS users, COUNT(*) AS rows
--    FROM public.user_note_weak_scores
--    GROUP BY computed_at::date
--    ORDER BY computed_at::date DESC;
--
-- ═══════════════════════════════════════════════════════════════
-- cron command 대조 (기존 → 새)
-- ═══════════════════════════════════════════════════════════════
-- 기존 (20260526_analytics_03b_cron.sql 적용본):
--   command: SELECT public.run_daily_batch_analysis(); SELECT public.run_daily_analytics_rollup();
--
-- 새 (본 파일):
--   command: SELECT public.run_daily_batch_analysis(); SELECT public.run_daily_analytics_rollup(); SELECT public.refresh_weak_scores();
--
-- 차이: refresh_weak_scores() 호출만 추가. 기존 호출은 그대로.
