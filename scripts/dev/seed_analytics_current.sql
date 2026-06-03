-- scripts/dev/seed_analytics_current.sql
-- Dev-only seed: 22 active days (May 11 – Jun 4, 2026) for admin user.
-- Covers THIS week + prior 3 weeks so /weekly shows a full trend line,
-- rhythm chart, and sustained weak notes immediately.
-- Real admin logs exist in this range — real+seed mix in rollups is expected for dev.
--
-- Identification markers (same as April seed — one teardown handles both):
--   user_note_logs.error_type  = 'dev_seed'        (is_correct = true)
--   user_note_logs.error_type  = 'dev_seed_wrong'   (is_correct = false)
--   user_sessions.summary      = '{"dev_seed": true}'
--
-- Accuracy arc: 78% (May 11) → 90% (Jun 4).
-- Rhythm gaps: Wed May 13, Wed May 20, Thu May 28 (simulates rest days).
-- Weak notes: F4/treble 43–49%, A#5/treble 55–61%, Bb2/bass 52–58%.
--
-- Teardown: scripts/dev/teardown_analytics_seed.sql (covers both April + current seeds)
--
-- Usage: paste into Supabase SQL editor and run Part 1, then Part 2 after it commits.

-- ============================================================
-- PART 1: Insert seed logs & sessions (22 active days)
-- ============================================================
DO $$
DECLARE
  v_admin    uuid   := '6fadc743-e1dc-45db-8681-6f1331cf6a39';

  -- 22 active days — gaps on May 13, May 20, May 28 to show rhythm breaks
  v_days     date[] := ARRAY[
    -- Week -3 (May 11–17): Mon Tue ___ Thu Fri Sat Sun
    '2026-05-11'::date, '2026-05-12', '2026-05-14', '2026-05-15', '2026-05-16', '2026-05-17',
    -- Week -2 (May 18–24): Mon Tue ___ Thu Fri Sat Sun
    '2026-05-18', '2026-05-19', '2026-05-21', '2026-05-22', '2026-05-23', '2026-05-24',
    -- Week -1 (May 25–31): Mon Tue Wed ___ Fri Sat Sun
    '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-29', '2026-05-30', '2026-05-31',
    -- Week  0 (Jun 1–7):  Mon Tue Wed Thu  (current partial week)
    '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'
  ];

  -- Note pool: 'note_key|octave|clef'
  -- Weak notes: F4/treble (idx 4), A#5/treble (idx 14), Bb2/bass (idx 15)
  v_pool     text[] := ARRAY[
    'C|4|treble',   -- 1
    'D|4|treble',   -- 2
    'E|4|treble',   -- 3
    'F|4|treble',   -- 4  ← weak: 43–49%
    'G|4|treble',   -- 5
    'A|4|treble',   -- 6
    'B|4|treble',   -- 7
    'C|5|treble',   -- 8
    'D|5|treble',   -- 9
    'E|5|treble',   -- 10
    'F|5|treble',   -- 11
    'G|5|treble',   -- 12
    'A|5|treble',   -- 13
    'A#|5|treble',  -- 14 ← weak: 55–61%
    'Bb|2|bass',    -- 15 ← weak: 52–58%
    'C|3|bass',     -- 16
    'D|3|bass',     -- 17
    'E|3|bass',     -- 18
    'F|3|bass',     -- 19
    'G|3|bass',     -- 20
    'A|3|bass',     -- 21
    'B|3|bass',     -- 22
    'C|4|bass',     -- 23
    'D|4|bass'      -- 24
  ];
  v_pool_len int    := 24;

  v_day        date;
  v_day_idx    int;
  v_sess       int;
  v_max_sess   int;
  v_i          int;
  v_note_count int;

  v_parts      text[];
  v_note_key   text;
  v_octave     int;
  v_clef       text;
  v_note_idx   int;

  v_base_acc   float8;
  v_note_acc   float8;
  v_hash       int;
  v_hash2      int;
  v_is_correct boolean;
  v_resp_sec   float8;
  v_interval   int;

  v_session_id       uuid;
  v_session_start    timestamptz;
  v_session_end      timestamptz;
  v_created_at       timestamptz;
  v_total_notes      int;
  v_correct_notes    int;
  v_total_resp_ms    float8;
BEGIN
  v_day_idx := 0;

  FOREACH v_day IN ARRAY v_days LOOP
    v_day_idx := v_day_idx + 1;

    -- Overall accuracy: 78% on day 1 → 90% on day 22
    v_base_acc := 0.78 + (v_day_idx - 1) * 0.12 / 21.0;

    -- 1 or 2 sessions per day; ~1-in-4 days get only 1
    v_hash     := (hashtext(v_day::text || 'cur:nsess') & 2147483647);
    v_max_sess := CASE WHEN (v_hash % 4 = 0) THEN 1 ELSE 2 END;

    FOR v_sess IN 1..v_max_sess LOOP
      v_session_id    := gen_random_uuid();
      v_total_notes   := 0;
      v_correct_notes := 0;
      v_total_resp_ms := 0;

      -- Session start (UTC): sess 1 ≈ 10:XX UTC (19:XX KST), sess 2 ≈ 12:XX UTC (21:XX KST)
      v_hash          := (hashtext(v_day::text || v_sess::text || 'cur:sm') & 2147483647);
      v_session_start := (
        v_day::timestamp
        + make_interval(hours => 10 + (v_sess - 1) * 2, mins => v_hash % 60)
      ) AT TIME ZONE 'UTC';

      -- Notes per session: 25–35
      v_hash       := (hashtext(v_day::text || v_sess::text || 'cur:nc') & 2147483647);
      v_note_count := 25 + (v_hash % 11);

      FOR v_i IN 1..v_note_count LOOP

        -- Pick note from pool
        v_hash     := (hashtext(v_day::text || v_sess::text || v_i::text || 'cur:note') & 2147483647);
        v_note_idx := (v_hash % v_pool_len) + 1;
        v_parts    := string_to_array(v_pool[v_note_idx], '|');
        v_note_key := v_parts[1];
        v_octave   := v_parts[2]::int;
        v_clef     := v_parts[3];

        -- Per-note accuracy for weak notes
        v_note_acc := v_base_acc;
        IF v_note_key = 'F'  AND v_octave = 4 AND v_clef = 'treble' THEN
          v_note_acc := 0.43 + (v_day_idx - 1) * 0.06 / 21.0;
        ELSIF v_note_key = 'A#' AND v_octave = 5 AND v_clef = 'treble' THEN
          v_note_acc := 0.55 + (v_day_idx - 1) * 0.06 / 21.0;
        ELSIF v_note_key = 'Bb' AND v_octave = 2 AND v_clef = 'bass' THEN
          v_note_acc := 0.52 + (v_day_idx - 1) * 0.06 / 21.0;
        END IF;

        -- Correctness
        v_hash       := (hashtext(v_day::text || v_sess::text || v_i::text || 'cur:cor') & 2147483647);
        v_is_correct := (v_hash % 100) < (v_note_acc * 100)::int;

        -- Response time in SECONDS (rollup multiplies × 1000 for avg_reaction_ms)
        v_hash     := (hashtext(v_day::text || v_sess::text || v_i::text || 'cur:rt') & 2147483647);
        v_resp_sec := CASE WHEN v_is_correct
          THEN 0.4  + (v_hash % 801)  / 1000.0
          ELSE 1.5  + (v_hash % 1501) / 1000.0
        END;

        -- Interval from previous note (semitone distance)
        IF v_i = 1 THEN
          v_interval := NULL;
        ELSE
          v_hash  := (hashtext(v_day::text || v_sess::text || v_i::text || 'cur:iv')  & 2147483647);
          v_hash2 := (hashtext(v_day::text || v_sess::text || v_i::text || 'cur:iv2') & 2147483647);
          -- 20% repeat, 30% step(1-2), 25% skip(3-5), 15% leap(6-9), 10% wide(10+)
          v_interval := CASE
            WHEN (v_hash % 100) < 20 THEN 0
            WHEN (v_hash % 100) < 50 THEN 1 + (v_hash2 % 2)
            WHEN (v_hash % 100) < 75 THEN 3 + (v_hash2 % 3)
            WHEN (v_hash % 100) < 90 THEN 6 + (v_hash2 % 4)
            ELSE                          10 + (v_hash2 % 5)
          END;
        END IF;

        v_created_at := v_session_start
          + make_interval(secs => (v_i - 1) * 4 + v_resp_sec);

        INSERT INTO user_note_logs (
          user_id, note_key, octave, clef,
          is_correct, response_time, error_type,
          created_at, level, interval_from_prev, sublevel
        ) VALUES (
          v_admin, v_note_key, v_octave, v_clef,
          v_is_correct,
          v_resp_sec,
          CASE WHEN v_is_correct THEN 'dev_seed' ELSE 'dev_seed_wrong' END,
          v_created_at,
          '3',
          v_interval,
          0
        );

        v_total_notes   := v_total_notes + 1;
        v_correct_notes := v_correct_notes + (CASE WHEN v_is_correct THEN 1 ELSE 0 END);
        v_total_resp_ms := v_total_resp_ms + (v_resp_sec * 1000.0);

      END LOOP; -- notes

      v_session_end := v_session_start + make_interval(secs => v_note_count * 4 + 30);

      INSERT INTO user_sessions (
        id, user_id, level,
        started_at, ended_at, duration_seconds,
        total_notes, correct_notes, accuracy, avg_reaction_ms,
        xp_earned, session_type,
        note_attempts, summary, created_at
      ) VALUES (
        v_session_id,
        v_admin,
        3,
        v_session_start,
        v_session_end,
        EXTRACT(epoch FROM (v_session_end - v_session_start))::int,
        v_total_notes,
        v_correct_notes,
        CASE WHEN v_total_notes > 0
          THEN v_correct_notes::float8 / v_total_notes ELSE 0 END,
        CASE WHEN v_total_notes > 0
          THEN (v_total_resp_ms / v_total_notes)::int    ELSE 0 END,
        v_correct_notes * 10,
        'regular',
        '[]',
        '{"dev_seed": true}',
        v_session_start
      );

    END LOOP; -- sessions
  END LOOP; -- days

  RAISE NOTICE 'Seed (current window) Part 1 done: inserted data for % days (admin %)',
    array_length(v_days, 1), v_admin;
END;
$$;


-- ============================================================
-- PART 2: Build period rollups
-- NOTE: run AFTER Part 1 has committed.
--
-- build_period_rollup(user_id, period_type, period_start, period_end)
--   period_end is the LAST day of the period (inclusive).
--   Function adds +1 internally to form the exclusive upper bound.
-- ============================================================
DO $$
DECLARE
  v_admin uuid := '6fadc743-e1dc-45db-8681-6f1331cf6a39';
  v_day   date;
BEGIN
  -- Refresh note status (real + seeded logs combined)
  PERFORM refresh_user_note_status(v_admin);
  RAISE NOTICE 'refresh_user_note_status done';

  -- Daily rollups for each of the 22 seeded days
  FOREACH v_day IN ARRAY ARRAY[
    '2026-05-11'::date, '2026-05-12', '2026-05-14', '2026-05-15', '2026-05-16', '2026-05-17',
    '2026-05-18', '2026-05-19', '2026-05-21', '2026-05-22', '2026-05-23', '2026-05-24',
    '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-29', '2026-05-30', '2026-05-31',
    '2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04'
  ] LOOP
    PERFORM build_period_rollup(v_admin, 'day', v_day, v_day);
  END LOOP;
  RAISE NOTICE 'Daily rollups done (22 days)';

  -- Weekly rollups for the 4 ISO weeks in the seed range
  -- Week -3: May 11 (Mon) – May 17 (Sun)
  PERFORM build_period_rollup(v_admin, 'week', '2026-05-11', '2026-05-17');
  -- Week -2: May 18 (Mon) – May 24 (Sun)
  PERFORM build_period_rollup(v_admin, 'week', '2026-05-18', '2026-05-24');
  -- Week -1: May 25 (Mon) – May 31 (Sun)
  PERFORM build_period_rollup(v_admin, 'week', '2026-05-25', '2026-05-31');
  -- Week  0: Jun  1 (Mon) – Jun  7 (Sun) — current week
  PERFORM build_period_rollup(v_admin, 'week', '2026-06-01', '2026-06-07');
  RAISE NOTICE 'Weekly rollups done (4 weeks)';

  -- Monthly rollups covering the seed range
  PERFORM build_period_rollup(v_admin, 'month', '2026-05-01', '2026-05-31');
  RAISE NOTICE 'May 2026 month rollup done';

  PERFORM build_period_rollup(v_admin, 'month', '2026-06-01', '2026-06-30');
  RAISE NOTICE 'Jun 2026 month rollup done';

  -- Global weak-score rebuild (dev only)
  PERFORM refresh_weak_scores();
  RAISE NOTICE 'refresh_weak_scores done';

  RAISE NOTICE 'Seed (current window) Part 2 done: all rollups built';
END;
$$;


-- ============================================================
-- VERIFICATION — run after Part 2 to check JSONB columns
-- ============================================================
-- SELECT
--   period_start,
--   total_attempts,
--   active_days,
--   ROUND((overall_accuracy * 100)::numeric, 1)        AS acc_pct,
--   ROUND((avg_reaction_ms / 1000.0)::numeric, 2)      AS avg_s,
--   jsonb_array_length(weak_notes_top)                 AS weak_top_n,
--   weak_notes_top -> 0 -> 'note_key'                  AS top_weak_note,
--   ROUND(((weak_notes_top -> 0 ->> 'error_rate')::numeric * 100)::numeric, 1) AS top_err_pct,
--   (interval_error_rates IS NOT NULL
--    AND interval_error_rates <> '{}'::jsonb)           AS has_intervals,
--   (by_clef IS NOT NULL
--    AND by_clef <> '{}'::jsonb)                        AS has_clef,
--   (by_accidental IS NOT NULL
--    AND by_accidental <> '{}'::jsonb)                  AS has_accidental,
--   jsonb_array_length(per_note)                        AS per_note_n
-- FROM user_analytics_rollup
-- WHERE user_id = '6fadc743-e1dc-45db-8681-6f1331cf6a39'
--   AND period_type = 'week'
--   AND period_start = '2026-06-01';
