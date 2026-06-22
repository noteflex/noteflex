-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260622_lower_play_count_threshold.sql
-- ═══════════════════════════════════════════════════════════════
-- 변경: record_sublevel_attempt 의 c_min_play_count 10 → 5.
--       sublevel 통과 4기준 중 최소 플레이 횟수 한 줄만 완화.
--       나머지 3기준(정확도 0.85·반응비 0.35·best_streak 5)과
--       MIN_SAMPLE 3·윈도우 7은 불변.
--
-- 함수 본문은 20260530_pass_window_aligned.sql 의 정의를 그대로
-- 가져온 뒤 c_min_play_count 상수값만 10 → 5 로 바꾼 것 — 그 외
-- 단 한 줄도 다르지 않음.
--
-- 클라 미러: src/lib/levelSystem.ts PASS_CRITERIA.MIN_PLAY_COUNT
-- 도 동일 커밋에서 5 로 동기화.
--
-- ⚠️ DB 적용은 사용자가 별도 진행 (Supabase SQL Editor).
-- ═══════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.record_sublevel_attempt(
  p_level              INT,
  p_sublevel           INT,
  p_attempts           INT,
  p_correct            INT,
  p_max_streak         INT,
  p_game_status        TEXT,
  p_avg_reaction_ratio NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id            UUID := auth.uid();
  v_progress           RECORD;
  v_new_total_attempts INT;
  v_new_total_correct  INT;
  v_new_best_streak    INT;
  v_new_play_count     INT;
  v_passed             BOOLEAN;
  v_just_passed        BOOLEAN := false;
  -- recent_plays 윈도우 변수
  v_new_play           JSONB;
  v_new_window         JSONB;
  -- 윈도우 평균 (통과 판정 + 반환 accuracy)
  v_window_size        INT;
  v_window_attempts    INT;
  v_window_correct     INT;
  v_window_reaction    NUMERIC;
  v_window_accuracy    NUMERIC;

  -- 통과 임계 (클라 PASS_CRITERIA와 100% 일치)
  c_min_accuracy        CONSTANT NUMERIC := 0.85;
  c_min_reaction_ratio  CONSTANT NUMERIC := 0.35;
  c_min_play_count      CONSTANT INT     := 5;
  c_min_best_streak     CONSTANT INT     := 5;
  c_min_sample          CONSTANT INT     := 3;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_level NOT BETWEEN 1 AND 7 OR p_sublevel NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Invalid level/sublevel: %/%', p_level, p_sublevel;
  END IF;

  INSERT INTO user_sublevel_progress (user_id, level, sublevel)
  VALUES (v_user_id, p_level, p_sublevel)
  ON CONFLICT (user_id, level, sublevel) DO NOTHING;

  SELECT * INTO v_progress
  FROM user_sublevel_progress
  WHERE user_id = v_user_id AND level = p_level AND sublevel = p_sublevel;

  -- 누적 컬럼 갱신 (기존 로직 그대로)
  v_new_play_count     := v_progress.play_count + 1;
  v_new_total_attempts := v_progress.total_attempts + p_attempts;
  v_new_total_correct  := v_progress.total_correct + p_correct;
  v_new_best_streak    := GREATEST(v_progress.best_streak, p_max_streak);

  -- ── recent_plays 윈도우 갱신 ───────────────────────────────
  v_new_play := jsonb_build_object(
    'at',             to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'attempts',       p_attempts,
    'correct',        p_correct,
    'reaction_ratio', p_avg_reaction_ratio
  );

  -- prepend 새 항목
  v_new_window := jsonb_build_array(v_new_play) || COALESCE(v_progress.recent_plays, '[]'::jsonb);

  -- 길이 7 초과 시 앞에서 7개만 유지
  IF jsonb_array_length(v_new_window) > 7 THEN
    v_new_window := (
      SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
      FROM jsonb_array_elements(v_new_window) WITH ORDINALITY AS t(elem, ord)
      WHERE ord <= 7
    );
  END IF;

  -- ── 윈도우 평균 + 통과 판정 (윈도우 기반 + 4지표 모두) ─────
  v_window_size := jsonb_array_length(v_new_window);

  IF v_window_size >= c_min_sample THEN
    SELECT
      SUM((elem->>'attempts')::INT),
      SUM((elem->>'correct')::INT),
      AVG((elem->>'reaction_ratio')::NUMERIC)
        FILTER (WHERE elem->'reaction_ratio' IS NOT NULL
                  AND jsonb_typeof(elem->'reaction_ratio') = 'number'
                  AND (elem->>'reaction_ratio')::NUMERIC > 0)
    INTO v_window_attempts, v_window_correct, v_window_reaction
    FROM jsonb_array_elements(v_new_window) AS elem;

    v_window_accuracy := CASE
      WHEN v_window_attempts > 0
      THEN v_window_correct::NUMERIC / v_window_attempts
      ELSE 0
    END;

    -- 4지표 모두 충족해야 통과 (클라 checkPassed와 동일)
    v_passed := (
      v_window_accuracy >= c_min_accuracy
      AND v_window_reaction IS NOT NULL
      AND v_window_reaction <= c_min_reaction_ratio
      AND v_new_play_count   >= c_min_play_count
      AND v_new_best_streak  >= c_min_best_streak
    );
  ELSE
    -- 표본 < 3 : 통과 보류
    v_window_accuracy := NULL;
    v_window_reaction := NULL;
    v_passed          := false;
  END IF;

  v_just_passed := (NOT v_progress.passed AND v_passed);

  -- ── 갱신 ────────────────────────────────────────────────────
  UPDATE user_sublevel_progress
  SET
    play_count     = v_new_play_count,
    total_attempts = v_new_total_attempts,
    total_correct  = v_new_total_correct,
    best_streak    = v_new_best_streak,
    avg_reaction_ratio = CASE
      WHEN p_avg_reaction_ratio IS NULL THEN avg_reaction_ratio
      WHEN avg_reaction_ratio IS NULL  THEN p_avg_reaction_ratio
      ELSE (avg_reaction_ratio * v_progress.play_count + p_avg_reaction_ratio) / v_new_play_count
    END,
    recent_plays   = v_new_window,
    passed         = v_passed,
    passed_at      = CASE WHEN v_just_passed THEN NOW() ELSE passed_at END,
    updated_at     = NOW()
  WHERE user_id = v_user_id AND level = p_level AND sublevel = p_sublevel;

  -- 다음 sublevel 자동 INSERT (just_passed)
  IF v_just_passed THEN
    IF p_sublevel < 3 THEN
      INSERT INTO user_sublevel_progress (user_id, level, sublevel)
      VALUES (v_user_id, p_level, p_sublevel + 1)
      ON CONFLICT DO NOTHING;
    ELSIF p_level < 7 THEN
      INSERT INTO user_sublevel_progress (user_id, level, sublevel)
      VALUES (v_user_id, p_level + 1, 1)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'level',          p_level,
    'sublevel',       p_sublevel,
    'play_count',     v_new_play_count,
    'total_attempts', v_new_total_attempts,
    'total_correct',  v_new_total_correct,
    'accuracy',       v_window_accuracy,    -- 윈도우 기반 (표본<3이면 NULL)
    'reaction_ratio', v_window_reaction,    -- 윈도우 기반 (표본<3이면 NULL)
    'best_streak',    v_new_best_streak,
    'passed',         v_passed,
    'just_passed',    v_just_passed,
    'sample_count',   v_window_size
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.record_sublevel_attempt(INT, INT, INT, INT, INT, TEXT, NUMERIC) TO authenticated;
