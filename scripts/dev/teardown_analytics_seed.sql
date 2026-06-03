-- scripts/dev/teardown_analytics_seed.sql
-- Removes ALL data inserted by seed_analytics_admin.sql.
-- Identified by error_type marker (NOT date range) — admin's real logs are safe.
--
-- What gets deleted:
--   - user_note_logs  where error_type IN ('dev_seed', 'dev_seed_wrong')
--   - user_sessions   where summary->>'dev_seed' = 'true'
--   - user_analytics_rollup rows for April 2026 (days/weeks/month — seeded periods only)
--     NOTE: assumes no real rollup data exists for admin in April 2026 (real data starts May 9).
--
-- After teardown, current week/month rollups are rebuilt from real data only.

-- ─── Step 1 & 2: Delete seeded logs and sessions ───────────────────────────
DO $$
DECLARE
  v_admin        uuid := '6fadc743-e1dc-45db-8681-6f1331cf6a39';
  v_deleted_logs int;
  v_deleted_sess int;
BEGIN
  DELETE FROM user_note_logs
  WHERE user_id   = v_admin
    AND error_type IN ('dev_seed', 'dev_seed_wrong');
  GET DIAGNOSTICS v_deleted_logs = ROW_COUNT;

  DELETE FROM user_sessions
  WHERE user_id = v_admin
    AND (summary->>'dev_seed')::boolean IS TRUE;
  GET DIAGNOSTICS v_deleted_sess = ROW_COUNT;

  RAISE NOTICE 'Deleted % seeded note logs and % seeded sessions', v_deleted_logs, v_deleted_sess;
END;
$$;

-- ─── Step 3: Delete April 2026 rollup rows (all types) ─────────────────────
-- Covers: daily Apr 7–30, weekly Apr 6–May 3 (period_start within Apr), April month.
-- Safety: admin's real data starts 2026-05-09 — no real rollups exist in April.
DELETE FROM user_analytics_rollup
WHERE user_id      = '6fadc743-e1dc-45db-8681-6f1331cf6a39'
  AND period_start >= '2026-04-01'
  AND period_start <  '2026-05-05';

-- ─── Step 4: Rebuild note status from real data only ───────────────────────
SELECT refresh_user_note_status('6fadc743-e1dc-45db-8681-6f1331cf6a39'::uuid);

-- ─── Step 5: Rebuild current week/month rollups from real data only ─────────
SELECT build_period_rollup(
  '6fadc743-e1dc-45db-8681-6f1331cf6a39'::uuid,
  'week', '2026-06-02'::date, '2026-06-08'::date
);
SELECT build_period_rollup(
  '6fadc743-e1dc-45db-8681-6f1331cf6a39'::uuid,
  'month', '2026-06-01'::date, '2026-06-30'::date
);

SELECT 'Teardown complete' AS status;
