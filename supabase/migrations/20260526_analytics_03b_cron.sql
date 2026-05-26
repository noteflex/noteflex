-- Migration: 20260526_analytics_03b_cron.sql
-- Purpose: cron 'noteflex-daily-batch' 갱신 — 기존 호출 보존 + run_daily_analytics_rollup() 추가.
--
-- 전제:
--   - 20260526_analytics_03a_functions.sql 가 먼저 적용되어 public.run_daily_analytics_rollup() 존재.
--   - 03a 적용 후 prod에서 수동 검증 권장:
--       SELECT public.run_daily_analytics_rollup();
--     (에러 없이 NULL 또는 uuid 리턴 + daily_batch_runs에 rollup_*** 컬럼이 채워지는지 확인)
--
-- 안전성 (왜 분리 적용해도 prod 안전한가):
--   1. run_daily_analytics_rollup()은 outer EXCEPTION WHEN OTHERS로 모든 에러를 흡수하여 RAISE 하지 않음 (03a 참조).
--   2. 따라서 같은 cron 명령 안에서 본 함수가 실패해도 직전 SELECT run_daily_batch_analysis()가
--      이미 수행한 premium 만료 effect는 cron multi-statement 트랜잭션 ABORT 없이 보존됨.
--   3. cron unschedule → reschedule은 트랜잭션 안전(원자적). 명령 갱신 도중 cron 누락 시점 없음.
--
-- 새 cron command 전문(기존 vs 새): 본 파일 마지막 코멘트 블록 참조.

DO $cron$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'noteflex-daily-batch';
  PERFORM cron.schedule(
    'noteflex-daily-batch',
    '0 15 * * *',
    $$SELECT public.run_daily_batch_analysis(); SELECT public.run_daily_analytics_rollup();$$
  );
END
$cron$;

-- ─────────────────────────────────────────────────────────────────────
-- cron command 대조 (기존 → 새)
-- ─────────────────────────────────────────────────────────────────────
-- 기존 (20260525_premium_sync_trigger_and_cron.sql 마지막 적용본):
--   schedule: '0 15 * * *'  (UTC 15:00 = KST 00:00)
--   command : SELECT public.run_daily_batch_analysis();
--
-- 새 (본 파일):
--   schedule: '0 15 * * *'  (변경 없음)
--   command : SELECT public.run_daily_batch_analysis(); SELECT public.run_daily_analytics_rollup();
--
-- 차이: run_daily_analytics_rollup() 호출만 추가. 기존 호출은 그대로.
-- 적용 후 검증 쿼리:
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'noteflex-daily-batch';
