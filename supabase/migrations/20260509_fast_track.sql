-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260509_fast_track.sql
-- ═══════════════════════════════════════════════════════════════
-- 패스트트랙 (Fast Track) 기능 추가 (Group D, 2026-05-09)
--
-- 패스트트랙 조건 (AND):
--   1. tier = premium/admin (is_premium=true OR subscription_tier='pro' OR role='admin')
--   2. sublevel >= 2 (Sub1 제외)
--   3. 첫 세션 (play_count == 0 before increment)
--   4. 세션 정답률 >= 99% (p_correct / p_attempts)
--   5. avg_reaction_ratio <= 0.5
--
-- 발동 시: passed=true 강제, fast_track=true 기록, 다음 sublevel 자동 unlock
--
-- 변경 내용:
--   1. user_sublevel_progress.fast_track BOOLEAN DEFAULT false 컬럼 추가
--   2. record_sublevel_attempt RPC 패스트트랙 분기 추가 + fast_track 응답
--   3. get_mastery_score RPC 패스트트랙 score=100 강제 + tier 조회 정정
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. fast_track 컬럼 추가 ──────────────────────────────────────
ALTER TABLE public.user_sublevel_progress
  ADD COLUMN IF NOT EXISTS fast_track BOOLEAN NOT NULL DEFAULT false;

-- ─── 2. record_sublevel_attempt RPC 패스트트랙 분기 ───────────────
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
  v_user_id              UUID    := auth.uid();
  v_is_premium           BOOLEAN;
  v_subscription_tier    TEXT;
  v_role                 TEXT;
  v_progress             RECORD;
  v_new_total_attempts   INT;
  v_new_total_correct    INT;
  v_new_best_streak      INT;
  v_new_play_count       INT;
  v_accuracy             NUMERIC;
  v_new_avg_reaction_ratio NUMERIC;
  v_session_accuracy     NUMERIC;
  v_passed               BOOLEAN;
  v_fast_track           BOOLEAN := false;
  v_just_passed          BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_level NOT BETWEEN 1 AND 7 OR p_sublevel NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Invalid level/sublevel: %/%', p_level, p_sublevel;
  END IF;

  -- 사용자 tier 조회
  SELECT p.is_premium, p.subscription_tier, p.role
  INTO v_is_premium, v_subscription_tier, v_role
  FROM public.profiles p WHERE p.id = v_user_id;

  INSERT INTO user_sublevel_progress (user_id, level, sublevel)
  VALUES (v_user_id, p_level, p_sublevel)
  ON CONFLICT (user_id, level, sublevel) DO NOTHING;

  SELECT * INTO v_progress
  FROM user_sublevel_progress
  WHERE user_id = v_user_id AND level = p_level AND sublevel = p_sublevel;

  v_new_play_count       := v_progress.play_count + 1;
  v_new_total_attempts   := v_progress.total_attempts + p_attempts;
  v_new_total_correct    := v_progress.total_correct + p_correct;
  v_new_best_streak      := GREATEST(v_progress.best_streak, p_max_streak);

  v_accuracy := CASE
    WHEN v_new_total_attempts > 0 THEN v_new_total_correct::NUMERIC / v_new_total_attempts
    ELSE 0
  END;

  -- 누적 rolling average
  v_new_avg_reaction_ratio := CASE
    WHEN p_avg_reaction_ratio IS NULL THEN v_progress.avg_reaction_ratio
    WHEN v_progress.avg_reaction_ratio IS NULL THEN p_avg_reaction_ratio
    ELSE ((v_progress.avg_reaction_ratio * v_progress.play_count) + p_avg_reaction_ratio)
         / v_new_play_count
  END;

  -- 패스트트랙 조건 검증 (세션 정답률 기준, 첫 세션 한정)
  v_session_accuracy := CASE
    WHEN p_attempts > 0 THEN p_correct::NUMERIC / p_attempts
    ELSE 0
  END;

  IF (v_is_premium = true OR v_subscription_tier = 'pro' OR v_role = 'admin')
     AND p_sublevel >= 2
     AND v_progress.play_count = 0
     AND v_session_accuracy >= 0.99
     AND p_avg_reaction_ratio IS NOT NULL
     AND p_avg_reaction_ratio <= 0.5
  THEN
    v_fast_track := true;
    v_passed     := true;
  ELSE
    v_passed := (
      v_new_play_count >= 10 AND
      v_new_best_streak >= 5 AND
      v_accuracy >= 0.85 AND
      (v_new_avg_reaction_ratio IS NULL OR v_new_avg_reaction_ratio <= 0.35)
    );
  END IF;

  v_just_passed := (NOT v_progress.passed AND v_passed);

  UPDATE user_sublevel_progress
  SET
    play_count           = v_new_play_count,
    total_attempts       = v_new_total_attempts,
    total_correct        = v_new_total_correct,
    best_streak          = v_new_best_streak,
    avg_reaction_ratio   = v_new_avg_reaction_ratio,
    passed               = v_passed,
    fast_track           = v_fast_track,
    passed_at = CASE
      WHEN v_just_passed THEN NOW()
      ELSE passed_at
    END,
    updated_at = NOW()
  WHERE user_id = v_user_id AND level = p_level AND sublevel = p_sublevel;

  -- 처음 통과 시 다음 sublevel unlock
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
    'level',              p_level,
    'sublevel',           p_sublevel,
    'play_count',         v_new_play_count,
    'total_attempts',     v_new_total_attempts,
    'total_correct',      v_new_total_correct,
    'accuracy',           v_accuracy,
    'best_streak',        v_new_best_streak,
    'avg_reaction_ratio', v_new_avg_reaction_ratio,
    'passed',             v_passed,
    'just_passed',        v_just_passed,
    'fast_track',         v_fast_track
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.record_sublevel_attempt(INT, INT, INT, INT, INT, TEXT, NUMERIC) TO authenticated;

-- ─── 3. get_mastery_score RPC 패스트트랙 100 강제 + tier 조회 정정 ──
CREATE OR REPLACE FUNCTION public.get_mastery_score(
  p_level    INT,
  p_sublevel INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id      UUID := auth.uid();
  v_progress     RECORD;
  v_tier         TEXT;
  v_accuracy     NUMERIC;
  v_reaction     NUMERIC;
  v_acc_score    NUMERIC;
  v_react_score  NUMERIC;
  v_count_score  NUMERIC;
  v_streak_score NUMERIC;
  v_total        INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT usp.*
  INTO   v_progress
  FROM   user_sublevel_progress usp
  WHERE  usp.user_id  = v_user_id
    AND  usp.level    = p_level
    AND  usp.sublevel = p_sublevel;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('score', 0);
  END IF;

  -- 패스트트랙 통과 시 100 강제
  IF v_progress.fast_track = true THEN
    RETURN jsonb_build_object('score', 100, 'fast_track', true);
  END IF;

  -- tier 조회 (정정: p.tier → is_premium + subscription_tier + role 기반)
  SELECT CASE
    WHEN p.role = 'admin'                            THEN 'admin'
    WHEN p.is_premium = true OR p.subscription_tier = 'pro' THEN 'premium'
    ELSE 'free'
  END
  INTO v_tier
  FROM profiles p
  WHERE p.id = v_user_id;

  IF NOT FOUND THEN v_tier := 'free'; END IF;

  v_accuracy := CASE
    WHEN v_progress.total_attempts > 0
    THEN v_progress.total_correct::NUMERIC / v_progress.total_attempts
    ELSE 0
  END;

  v_reaction     := COALESCE(v_progress.avg_reaction_ratio, 99);
  v_acc_score    := LEAST(v_accuracy / 0.85,                  1.0) * 25;
  v_react_score  := LEAST(0.35 / NULLIF(v_reaction, 0),       1.0) * 25;
  v_count_score  := LEAST(v_progress.play_count::NUMERIC / 10, 1.0) * 25;
  v_streak_score := LEAST(v_progress.best_streak::NUMERIC / 5,  1.0) * 25;
  v_total        := ROUND(v_acc_score + v_react_score + v_count_score + v_streak_score)::INT;

  IF v_tier IN ('premium', 'admin') THEN
    RETURN jsonb_build_object(
      'score',          v_total,
      'accuracy',       ROUND(v_accuracy * 100, 1),
      'reaction_ratio', ROUND(COALESCE(v_progress.avg_reaction_ratio, 0)::NUMERIC, 3),
      'play_count',     v_progress.play_count,
      'best_streak',    v_progress.best_streak
    );
  ELSE
    RETURN jsonb_build_object('score', v_total);
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_mastery_score(INT, INT) TO authenticated;
