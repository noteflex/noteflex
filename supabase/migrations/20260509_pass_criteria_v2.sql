-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260509_pass_criteria_v2.sql
-- ═══════════════════════════════════════════════════════════════
-- PASS_CRITERIA DB 정정 (2026-05-09 결정)
--
-- 문제: record_sublevel_attempt RPC 통과 기준이 TS PASS_CRITERIA 와 불일치.
--   기존: play_count >= 5, accuracy >= 0.80
--   정정: play_count >= 10, accuracy >= 0.85, avg_reaction_ratio <= 0.35, max_streak >= 5
--
-- 변경 내용:
--   1. user_sublevel_progress 에 avg_reaction_ratio NUMERIC 컬럼 추가
--   2. record_sublevel_attempt RPC 시그니처 + 통과 기준 갱신
--
-- ⚠️  적용 후 기존 통과 기록은 보존됨 (passed=true 그대로).
--     신규 시도부터 4개 조건 적용.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. avg_reaction_ratio 컬럼 추가 ─────────────────────────────
ALTER TABLE public.user_sublevel_progress
  ADD COLUMN IF NOT EXISTS avg_reaction_ratio NUMERIC;

-- ─── 2. record_sublevel_attempt RPC 갱신 ─────────────────────────
CREATE OR REPLACE FUNCTION public.record_sublevel_attempt(
  p_level INT,
  p_sublevel INT,
  p_attempts INT,
  p_correct INT,
  p_max_streak INT,
  p_game_status TEXT,
  p_avg_reaction_ratio NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id UUID := auth.uid();
  v_progress RECORD;
  v_new_total_attempts INT;
  v_new_total_correct INT;
  v_new_best_streak INT;
  v_new_play_count INT;
  v_accuracy NUMERIC;
  v_new_avg_reaction_ratio NUMERIC;
  v_passed BOOLEAN;
  v_just_passed BOOLEAN := false;
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

  v_new_play_count := v_progress.play_count + 1;
  v_new_total_attempts := v_progress.total_attempts + p_attempts;
  v_new_total_correct := v_progress.total_correct + p_correct;
  v_new_best_streak := GREATEST(v_progress.best_streak, p_max_streak);

  v_accuracy := CASE
    WHEN v_new_total_attempts > 0 THEN v_new_total_correct::NUMERIC / v_new_total_attempts
    ELSE 0
  END;

  -- 누적 rolling average (이전값 NULL이면 이번 세션값이 첫 기록)
  v_new_avg_reaction_ratio := CASE
    WHEN p_avg_reaction_ratio IS NULL THEN v_progress.avg_reaction_ratio
    WHEN v_progress.avg_reaction_ratio IS NULL THEN p_avg_reaction_ratio
    ELSE ((v_progress.avg_reaction_ratio * v_progress.play_count) + p_avg_reaction_ratio)
         / v_new_play_count
  END;

  v_passed := (
    v_new_play_count >= 10 AND
    v_new_best_streak >= 5 AND
    v_accuracy >= 0.85 AND
    (v_new_avg_reaction_ratio IS NULL OR v_new_avg_reaction_ratio <= 0.35)
  );

  v_just_passed := (NOT v_progress.passed AND v_passed);

  UPDATE user_sublevel_progress
  SET
    play_count = v_new_play_count,
    total_attempts = v_new_total_attempts,
    total_correct = v_new_total_correct,
    best_streak = v_new_best_streak,
    avg_reaction_ratio = v_new_avg_reaction_ratio,
    passed = v_passed,
    passed_at = CASE
      WHEN v_just_passed THEN NOW()
      ELSE passed_at
    END,
    updated_at = NOW()
  WHERE user_id = v_user_id AND level = p_level AND sublevel = p_sublevel;

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
    'level', p_level,
    'sublevel', p_sublevel,
    'play_count', v_new_play_count,
    'total_attempts', v_new_total_attempts,
    'total_correct', v_new_total_correct,
    'accuracy', v_accuracy,
    'best_streak', v_new_best_streak,
    'avg_reaction_ratio', v_new_avg_reaction_ratio,
    'passed', v_passed,
    'just_passed', v_just_passed
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.record_sublevel_attempt(INT, INT, INT, INT, INT, TEXT, NUMERIC) TO authenticated;
