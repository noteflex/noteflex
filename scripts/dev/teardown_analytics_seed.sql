-- scripts/dev/teardown_analytics_seed.sql
-- Removes ALL data from seed_analytics_admin.sql AND seed_analytics_current.sql.
-- Identified by error_type / summary markers — real admin logs are never touched.
--
-- After deleting seeded data, rebuilds all affected period rollups from real data only.
-- Real admin logs exist from 2026-04-07. Both April and May–Jun seed data is removed.
--
-- Steps:
--   1. Delete seeded note logs   (error_type IN ('dev_seed', 'dev_seed_wrong'))
--   2. Delete seeded sessions    (summary->>'dev_seed' = 'true')
--   3. Delete ALL rollup rows in Apr–Jun 2026 (they may contain real+seed mix)
--   4. Rebuild daily rollups for every real-data day (dynamic — scans actual logs)
--   5. Rebuild weekly rollups for all ISO weeks Apr 6 – Jun 7 (10 weeks)
--   6. Rebuild monthly rollups for Apr, May, Jun 2026
--   7. refresh_user_note_status (real data only)
--   8. refresh_weak_scores

DO $$
DECLARE
  v_admin        uuid := '6fadc743-e1dc-45db-8681-6f1331cf6a39';
  v_deleted_logs int;
  v_deleted_sess int;
  v_deleted_rp   int;
  v_day          date;
  v_week_start   date;
  v_rec          record;
BEGIN

  -- ── 1. Delete seeded note logs ──────────────────────────────────────────
  DELETE FROM user_note_logs
  WHERE user_id   = v_admin
    AND error_type IN ('dev_seed', 'dev_seed_wrong');
  GET DIAGNOSTICS v_deleted_logs = ROW_COUNT;

  -- ── 2. Delete seeded sessions ───────────────────────────────────────────
  DELETE FROM user_sessions
  WHERE user_id = v_admin
    AND (summary->>'dev_seed')::boolean IS TRUE;
  GET DIAGNOSTICS v_deleted_sess = ROW_COUNT;

  RAISE NOTICE 'Deleted % seeded note logs, % seeded sessions', v_deleted_logs, v_deleted_sess;

  -- ── 3. Delete all rollup rows in Apr–Jun 2026 ───────────────────────────
  -- These may contain real+seed mixed values and must be rebuilt from real data.
  DELETE FROM user_analytics_rollup
  WHERE user_id      = v_admin
    AND period_start >= '2026-04-01'
    AND period_start <= '2026-06-30';
  GET DIAGNOSTICS v_deleted_rp = ROW_COUNT;
  RAISE NOTICE 'Deleted % rollup rows (Apr–Jun 2026)', v_deleted_rp;

  -- ── 4. Rebuild daily rollups for every real-data day ────────────────────
  -- Dynamic: scans user_note_logs to find which KST dates have real logs.
  FOR v_rec IN (
    SELECT DISTINCT (created_at AT TIME ZONE 'Asia/Seoul')::date AS d
    FROM user_note_logs
    WHERE user_id = v_admin
    ORDER BY 1
  ) LOOP
    PERFORM build_period_rollup(v_admin, 'day', v_rec.d, v_rec.d);
  END LOOP;
  RAISE NOTICE 'Daily rollups rebuilt from real data';

  -- ── 5. Rebuild weekly rollups (all 10 ISO weeks Apr 6 – Jun 7) ──────────
  -- Covers April seed weeks, May–Jun current-window seed weeks, and any
  -- weeks with real data only.
  FOREACH v_week_start IN ARRAY ARRAY[
    '2026-04-06'::date,  -- Apr  6–12
    '2026-04-13',        -- Apr 13–19
    '2026-04-20',        -- Apr 20–26
    '2026-04-27',        -- Apr 27–May 3
    '2026-05-04',        -- May  4–10  (real data: May 5, 9, 10)
    '2026-05-11',        -- May 11–17  (seeded only after teardown → no data)
    '2026-05-18',        -- May 18–24  (real: May 23, 24)
    '2026-05-25',        -- May 25–31  (real: May 25, 27, 30, 31)
    '2026-06-01'         -- Jun  1–7   (real: Jun 2, 3, 4)
  ] LOOP
    PERFORM build_period_rollup(v_admin, 'week', v_week_start, v_week_start + 6);
  END LOOP;
  RAISE NOTICE 'Weekly rollups rebuilt';

  -- ── 6. Rebuild monthly rollups ──────────────────────────────────────────
  PERFORM build_period_rollup(v_admin, 'month', '2026-04-01', '2026-04-30');
  PERFORM build_period_rollup(v_admin, 'month', '2026-05-01', '2026-05-31');
  PERFORM build_period_rollup(v_admin, 'month', '2026-06-01', '2026-06-30');
  RAISE NOTICE 'Monthly rollups rebuilt (Apr, May, Jun 2026)';

  -- ── 7. Refresh note status from real data only ──────────────────────────
  PERFORM refresh_user_note_status(v_admin);
  RAISE NOTICE 'refresh_user_note_status done';

  -- ── 8. Rebuild weak scores (global) ─────────────────────────────────────
  PERFORM refresh_weak_scores();
  RAISE NOTICE 'refresh_weak_scores done';

  RAISE NOTICE 'Teardown complete. All seed data removed; rollups rebuilt from real data.';
END;
$$;
