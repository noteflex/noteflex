-- ═══════════════════════════════════════════════════════════════
-- handle_session_complete 트리거 함수 fix
-- note_attempts.reaction_ms를 ::INT 직접 캐스팅 시 소수 거부 문제 해결
-- ::NUMERIC::INT로 변경하여 소수도 안전하게 정수 변환
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_session_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  session_date DATE;
  note_record RECORD;
BEGIN
  session_date := (NEW.started_at AT TIME ZONE 'UTC')::DATE;

  -- 1. user_stats_daily UPSERT
  INSERT INTO user_stats_daily (
    user_id, stat_date, sessions_count, total_notes, correct_notes,
    total_duration_seconds, xp_earned, avg_accuracy, avg_reaction_ms,
    sessions_by_level, updated_at
  ) VALUES (
    NEW.user_id, session_date, 1, NEW.total_notes, NEW.correct_notes,
    NEW.duration_seconds, NEW.xp_earned, NEW.accuracy, NEW.avg_reaction_ms,
    jsonb_build_object(NEW.level::text, 1),
    now()
  )
  ON CONFLICT (user_id, stat_date) DO UPDATE SET
    sessions_count = user_stats_daily.sessions_count + 1,
    total_notes = user_stats_daily.total_notes + NEW.total_notes,
    correct_notes = user_stats_daily.correct_notes + NEW.correct_notes,
    total_duration_seconds = user_stats_daily.total_duration_seconds + NEW.duration_seconds,
    xp_earned = user_stats_daily.xp_earned + NEW.xp_earned,
    avg_accuracy = CASE
      WHEN (user_stats_daily.total_notes + NEW.total_notes) > 0
      THEN ((user_stats_daily.correct_notes + NEW.correct_notes)::numeric /
            (user_stats_daily.total_notes + NEW.total_notes))
      ELSE 0
    END,
    avg_reaction_ms = CASE
      WHEN user_stats_daily.avg_reaction_ms IS NULL THEN NEW.avg_reaction_ms
      WHEN NEW.avg_reaction_ms IS NULL THEN user_stats_daily.avg_reaction_ms
      ELSE (user_stats_daily.avg_reaction_ms + NEW.avg_reaction_ms) / 2
    END,
    sessions_by_level = user_stats_daily.sessions_by_level ||
      jsonb_build_object(
        NEW.level::text,
        COALESCE((user_stats_daily.sessions_by_level->>NEW.level::text)::int, 0) + 1
      ),
    updated_at = now();

  -- 2. profiles 업데이트
  UPDATE profiles SET
    total_xp = total_xp + NEW.xp_earned,
    last_practice_date = session_date,
    updated_at = now()
  WHERE id = NEW.user_id;

  -- 3. note_mastery 업데이트 (note_attempts JSONB 순회)
  -- ::INT 직접 캐스팅 대신 ::NUMERIC::INT 사용 (소수 안전 변환)
  IF NEW.note_attempts IS NOT NULL THEN
    FOR note_record IN
      SELECT
        (attempt->>'note')::TEXT AS note_key,
        COALESCE((attempt->>'clef')::TEXT, 'treble') AS clef,
        (attempt->>'correct')::BOOLEAN AS is_correct,
        (attempt->>'reaction_ms')::NUMERIC::INT AS reaction_ms
      FROM jsonb_array_elements(NEW.note_attempts) AS attempt
    LOOP
      INSERT INTO note_mastery (
        user_id, note_key, clef, total_attempts, correct_count,
        avg_reaction_ms, first_seen_at, last_seen_at, updated_at
      ) VALUES (
        NEW.user_id, note_record.note_key, note_record.clef, 1,
        CASE WHEN note_record.is_correct THEN 1 ELSE 0 END,
        note_record.reaction_ms, now(), now(), now()
      )
      ON CONFLICT (user_id, note_key, clef) DO UPDATE SET
        total_attempts = note_mastery.total_attempts + 1,
        correct_count = note_mastery.correct_count +
          CASE WHEN note_record.is_correct THEN 1 ELSE 0 END,
        avg_reaction_ms = CASE
          WHEN note_mastery.avg_reaction_ms IS NULL THEN note_record.reaction_ms
          WHEN note_record.reaction_ms IS NULL THEN note_mastery.avg_reaction_ms
          ELSE (note_mastery.avg_reaction_ms * note_mastery.total_attempts +
                note_record.reaction_ms) / (note_mastery.total_attempts + 1)
        END,
        mastery_level = CASE
          WHEN (note_mastery.correct_count +
                CASE WHEN note_record.is_correct THEN 1 ELSE 0 END)::numeric /
               (note_mastery.total_attempts + 1) >= 0.95 THEN 5
          WHEN (note_mastery.correct_count +
                CASE WHEN note_record.is_correct THEN 1 ELSE 0 END)::numeric /
               (note_mastery.total_attempts + 1) >= 0.90 THEN 4
          WHEN (note_mastery.correct_count +
                CASE WHEN note_record.is_correct THEN 1 ELSE 0 END)::numeric /
               (note_mastery.total_attempts + 1) >= 0.80 THEN 3
          WHEN (note_mastery.correct_count +
                CASE WHEN note_record.is_correct THEN 1 ELSE 0 END)::numeric /
               (note_mastery.total_attempts + 1) >= 0.70 THEN 2
          WHEN (note_mastery.correct_count +
                CASE WHEN note_record.is_correct THEN 1 ELSE 0 END)::numeric /
               (note_mastery.total_attempts + 1) >= 0.50 THEN 1
          ELSE 0
        END,
        last_seen_at = now(),
        updated_at = now();
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
