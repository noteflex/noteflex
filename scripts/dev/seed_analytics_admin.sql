-- scripts/dev/seed_analytics_admin.sql
-- Dev-only seed: 22 active days (Apr 7–30, 2026) of note logs + sessions for admin user.
-- Seeded data covers April 2026 only — before admin's real data (starts May 9, 2026).
-- No overlap with production data. Safe to run against staging / local.
--
-- Identification markers (for safe teardown):
--   user_note_logs.error_type  = 'dev_seed'       (is_correct = true)
--   user_note_logs.error_type  = 'dev_seed_wrong'  (is_correct = false)
--   user_sessions.summary      = '{"dev_seed": true}'
--
-- Teardown: scripts/dev/teardown_analytics_seed.sql
--
-- Usage (Supabase SQL editor or psql as postgres / service_role):
--   Run both DO blocks in order (Part 1 then Part 2).
--   Each block must commit before the next runs.

-- ============================================================
-- PART 1: Insert seed logs & sessions (22 active days)
-- ============================================================
DO $$
DECLARE
  v_admin     uuid    := '6fadc743-e1dc-45db-8681-6f1331cf6a39';

  -- 22 active days in April 2026 (skips Apr 17, Apr 26 — simulates rest days)
  v_days      date[]  := ARRAY[
    '2026-04-07'::date, '2026-04-08', '2026-04-09', '2026-04-10', '2026-04-11', '2026-04-12',
    '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-18', '2026-04-19',
    '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25',
    '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30'
  ];

  -- Note pool: 'note_key|octave|clef'
  -- Weak notes at indices 4 (F4/treble), 14 (A#5/treble), 15 (Bb2/bass)
  v_pool      text[]  := ARRAY[
    'C|4|treble',   -- 1
    'D|4|treble',   -- 2
    'E|4|treble',   -- 3
    'F|4|treble',   -- 4  ← weak: 43–49% accuracy
    'G|4|treble',   -- 5
    'A|4|treble',   -- 6
    'B|4|treble',   -- 7
    'C|5|treble',   -- 8
    'D|5|treble',   -- 9
    'E|5|treble',   -- 10
    'F|5|treble',   -- 11
    'G|5|treble',   -- 12
    'A|5|treble',   -- 13
    'A#|5|treble',  -- 14 ← weak: 55–61% accuracy
    'Bb|2|bass',    -- 15 ← weak: 52–58% accuracy
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
  v_pool_len  int     := 24;

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
  v_resp_sec   float8;   -- response_time stored in SECONDS (rollup multiplies × 1000)
  v_interval   int;

  v_session_id       uuid;
  v_session_start    timestamptz;
  v_session_end      timestamptz;
  v_created_at       timestamptz;
  v_total_notes      int;
  v_correct_notes    int;
  v_total_resp_ms    float8;  -- accumulator in ms (for session.avg_reaction_ms)
BEGIN
  v_day_idx := 0;

  FOREACH v_day IN ARRAY v_days LOOP
    v_day_idx := v_day_idx + 1;

    -- Overall accuracy: 78% on day 1 → 88% on day 22 (linear progression)
    v_base_acc := 0.78 + (v_day_idx - 1) * 0.10 / 21.0;

    -- 1 or 2 sessions per day; drop to 1 roughly 1-in-4 days
    v_hash     := (hashtext(v_day::text || ':nsess') & 2147483647);
    v_max_sess := CASE WHEN (v_hash % 4 = 0) THEN 1 ELSE 2 END;

    FOR v_sess IN 1..v_max_sess LOOP
      v_session_id    := gen_random_uuid();
      v_total_notes   := 0;
      v_correct_notes := 0;
      v_total_resp_ms := 0;

      -- Session start (UTC): session 1 ≈ 10:XX UTC (19:XX KST), session 2 ≈ 12:XX UTC (21:XX KST)
      v_hash          := (hashtext(v_day::text || v_sess::text || ':sm') & 2147483647);
      v_session_start := (
        v_day::timestamp
        + make_interval(hours => 10 + (v_sess - 1) * 2, mins => v_hash % 60)
      ) AT TIME ZONE 'UTC';

      -- Notes per session: 25–35
      v_hash       := (hashtext(v_day::text || v_sess::text || ':nc') & 2147483647);
      v_note_count := 25 + (v_hash % 11);

      FOR v_i IN 1..v_note_count LOOP

        -- Pick note from pool
        v_hash     := (hashtext(v_day::text || v_sess::text || v_i::text || ':note') & 2147483647);
        v_note_idx := (v_hash % v_pool_len) + 1;
        v_parts    := string_to_array(v_pool[v_note_idx], '|');
        v_note_key := v_parts[1];
        v_octave   := v_parts[2]::int;
        v_clef     := v_parts[3];

        -- Per-note accuracy overrides for the three weak notes
        v_note_acc := v_base_acc;
        IF v_note_key = 'F'  AND v_octave = 4 AND v_clef = 'treble' THEN
          v_note_acc := 0.43 + (v_day_idx - 1) * 0.06 / 21.0;   -- 43–49%
        ELSIF v_note_key = 'A#' AND v_octave = 5 AND v_clef = 'treble' THEN
          v_note_acc := 0.55 + (v_day_idx - 1) * 0.06 / 21.0;   -- 55–61%
        ELSIF v_note_key = 'Bb' AND v_octave = 2 AND v_clef = 'bass' THEN
          v_note_acc := 0.52 + (v_day_idx - 1) * 0.06 / 21.0;   -- 52–58%
        END IF;

        -- Correctness: deterministic via hash
        v_hash       := (hashtext(v_day::text || v_sess::text || v_i::text || ':cor') & 2147483647);
        v_is_correct := (v_hash % 100) < (v_note_acc * 100)::int;

        -- Response time in SECONDS (user_note_logs.response_time is seconds)
        v_hash     := (hashtext(v_day::text || v_sess::text || v_i::text || ':rt') & 2147483647);
        v_resp_sec := CASE WHEN v_is_correct
          THEN 0.4 + (v_hash % 801) / 1000.0    -- 0.400–1.200 s
          ELSE 1.5 + (v_hash % 1501) / 1000.0   -- 1.500–3.000 s
        END;

        -- Interval from previous note (semitone distance)
        IF v_i = 1 THEN
          v_interval := NULL;
        ELSE
          v_hash  := (hashtext(v_day::text || v_sess::text || v_i::text || ':iv') & 2147483647);
          v_hash2 := (hashtext(v_day::text || v_sess::text || v_i::text || ':iv2') & 2147483647);
          -- Distribution: 20% repeat, 30% step(1-2), 25% skip(3-5), 15% leap(6-9), 10% wide(10+)
          v_interval := CASE
            WHEN (v_hash % 100) < 20 THEN 0
            WHEN (v_hash % 100) < 50 THEN 1 + (v_hash2 % 2)
            WHEN (v_hash % 100) < 75 THEN 3 + (v_hash2 % 3)
            WHEN (v_hash % 100) < 90 THEN 6 + (v_hash2 % 4)
            ELSE                          10 + (v_hash2 % 5)
          END;
        END IF;

        -- Timestamp: spread ~4 s per note within the session
        v_created_at := v_session_start
          + make_interval(secs => (v_i - 1) * 4 + v_resp_sec);

        INSERT INTO user_note_logs (
          user_id, note_key, octave, clef,
          is_correct, response_time, error_type,
          created_at, level, interval_from_prev, sublevel
        ) VALUES (
          v_admin,
          v_note_key,
          v_octave,
          v_clef,
          v_is_correct,
          v_resp_sec,
          CASE WHEN v_is_correct THEN 'dev_seed' ELSE 'dev_seed_wrong' END,
          v_created_at,
          '3',        -- level (text in user_note_logs)
          v_interval,
          0           -- sublevel NOT NULL DEFAULT 0
        );

        v_total_notes   := v_total_notes + 1;
        v_correct_notes := v_correct_notes + (CASE WHEN v_is_correct THEN 1 ELSE 0 END);
        v_total_resp_ms := v_total_resp_ms + (v_resp_sec * 1000.0);

      END LOOP; -- notes

      v_session_end := v_session_start
        + make_interval(secs => v_note_count * 4 + 30);

      INSERT INTO user_sessions (
        id, user_id, level,
        started_at, ended_at, duration_seconds,
        total_notes, correct_notes, accuracy, avg_reaction_ms,
        xp_earned, session_type,
        note_attempts, summary, created_at
      ) VALUES (
        v_session_id,
        v_admin,
        3,           -- level (int in user_sessions)
        v_session_start,
        v_session_end,
        EXTRACT(epoch FROM (v_session_end - v_session_start))::int,
        v_total_notes,
        v_correct_notes,
        CASE WHEN v_total_notes > 0
          THEN v_correct_notes::float8 / v_total_notes ELSE 0 END,
        CASE WHEN v_total_notes > 0
          THEN (v_total_resp_ms / v_total_notes)::int  ELSE 0 END,
        v_correct_notes * 10,   -- xp
        'regular',
        '[]',
        '{"dev_seed": true}',
        v_session_start
      );

    END LOOP; -- sessions
  END LOOP; -- days

  RAISE NOTICE 'Seed Part 1 done: inserted data for % days (admin %)',
    array_length(v_days, 1), v_admin;
END;
$$;


-- ============================================================
-- PART 2: Build period rollups
-- NOTE: run AFTER Part 1 has committed.
--
-- build_period_rollup(user_id, period_type, period_start, period_end)
--   Internally: end_ts = (period_end + 1 day) AT TIME ZONE 'Asia/Seoul' (exclusive)
--   → For daily rollup:  period_end = period_start (same date)
--   → For weekly rollup: period_end = last day of week (Sunday)
--   → For monthly rollup: period_end = last day of month
-- ============================================================
DO $$
DECLARE
  v_admin uuid := '6fadc743-e1dc-45db-8681-6f1331cf6a39';
  v_day   date;
BEGIN
  -- Rebuild user_note_status from all logs (seeded + real)
  PERFORM refresh_user_note_status(v_admin);
  RAISE NOTICE 'refresh_user_note_status done';

  -- Daily rollups — one per seeded day (period_end = period_start; function adds +1 internally)
  FOREACH v_day IN ARRAY ARRAY[
    '2026-04-07'::date, '2026-04-08', '2026-04-09', '2026-04-10', '2026-04-11', '2026-04-12',
    '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-18', '2026-04-19',
    '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25',
    '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30'
  ] LOOP
    PERFORM build_period_rollup(v_admin, 'day', v_day, v_day);
  END LOOP;
  RAISE NOTICE 'Daily rollups done (22 days)';

  -- Weekly rollups for the 4 ISO weeks covering Apr 7–30
  -- Week 1: Apr  6 (Mon) – Apr 12 (Sun)
  PERFORM build_period_rollup(v_admin, 'week', '2026-04-06', '2026-04-12');
  -- Week 2: Apr 13 (Mon) – Apr 19 (Sun)
  PERFORM build_period_rollup(v_admin, 'week', '2026-04-13', '2026-04-19');
  -- Week 3: Apr 20 (Mon) – Apr 26 (Sun)
  PERFORM build_period_rollup(v_admin, 'week', '2026-04-20', '2026-04-26');
  -- Week 4: Apr 27 (Mon) – May  3 (Sun)
  PERFORM build_period_rollup(v_admin, 'week', '2026-04-27', '2026-05-03');
  RAISE NOTICE 'Weekly rollups done (4 weeks)';

  -- Monthly rollup: April 2026 (all seeded data is within April)
  PERFORM build_period_rollup(v_admin, 'month', '2026-04-01', '2026-04-30');
  RAISE NOTICE 'April 2026 month rollup done';

  -- Current week (Jun 1–7) from real admin data — makes weekly UI show something now
  -- NOTE: Jun 1 = Monday (isoWeekStart('2026-06-04') = '2026-06-01')
  PERFORM build_period_rollup(v_admin, 'week', '2026-06-01', '2026-06-07');
  RAISE NOTICE 'Current week rollup done (Jun 1–7, real data)';

  -- Current month (Jun 1–30) from real admin data
  PERFORM build_period_rollup(v_admin, 'month', '2026-06-01', '2026-06-30');
  RAISE NOTICE 'Current month rollup done (Jun 2026, real data)';

  RAISE NOTICE 'Seed Part 2 done: all rollups built';
END;
$$;
