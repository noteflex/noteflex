-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260509_mastery_score.sql
-- ═══════════════════════════════════════════════════════════════
-- Mastery Score RPC (Group C, 2026-05-09)
--
-- get_mastery_score(p_level, p_sublevel)
--   → 4-metric 25% weighted average (0~100)
--   → tier 자동 분기: premium/admin = 4 metrics 모두; free/guest = score 만
--
-- 공식 (각 항 25점 만점):
--   accuracy_score  = LEAST(accuracy / 0.85,  1) * 25
--   reaction_score  = LEAST(0.35 / reaction,  1) * 25  (낮을수록 좋음)
--   count_score     = LEAST(play_count / 10,  1) * 25
--   streak_score    = LEAST(best_streak / 5,  1) * 25
--   total           = SUM(4 scores) → 0~100 INTEGER
--
-- pass criteria 달성 시 exactly 100 보장:
--   accuracy≥0.85, reaction≤0.35, play_count≥10, best_streak≥5
--
-- Return:
--   free/guest: { score: INT }
--   premium/admin: { score: INT, accuracy: NUMERIC, reaction_ratio: NUMERIC,
--                    play_count: INT, best_streak: INT }
-- ═══════════════════════════════════════════════════════════════

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
  v_user_id       UUID := auth.uid();
  v_progress      RECORD;
  v_tier          TEXT;
  v_accuracy      NUMERIC;
  v_reaction      NUMERIC;
  v_acc_score     NUMERIC;
  v_react_score   NUMERIC;
  v_count_score   NUMERIC;
  v_streak_score  NUMERIC;
  v_total         INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ─── 1. 진행 데이터 조회 ────────────────────────────────────────
  SELECT usp.*
  INTO   v_progress
  FROM   user_sublevel_progress usp
  WHERE  usp.user_id = v_user_id
    AND  usp.level   = p_level
    AND  usp.sublevel = p_sublevel;

  -- 기록 없으면 score=0 반환
  IF NOT FOUND THEN
    RETURN jsonb_build_object('score', 0);
  END IF;

  -- ─── 2. tier 조회 (profiles 테이블 기준) ────────────────────────
  SELECT COALESCE(p.tier, 'free')
  INTO   v_tier
  FROM   profiles p
  WHERE  p.id = v_user_id;

  IF NOT FOUND THEN
    v_tier := 'free';
  END IF;

  -- ─── 3. 개별 metric 계산 ────────────────────────────────────────
  v_accuracy := CASE
    WHEN v_progress.total_attempts > 0
    THEN v_progress.total_correct::NUMERIC / v_progress.total_attempts
    ELSE 0
  END;

  -- reaction_ratio: NULL이면 아직 기록 없음 → 0점 (아직 통과 조건 미충족)
  v_reaction := COALESCE(v_progress.avg_reaction_ratio, 99);

  v_acc_score    := LEAST(v_accuracy / 0.85,  1.0) * 25;
  v_react_score  := LEAST(0.35 / NULLIF(v_reaction, 0), 1.0) * 25;
  v_count_score  := LEAST(v_progress.play_count::NUMERIC / 10, 1.0) * 25;
  v_streak_score := LEAST(v_progress.best_streak::NUMERIC / 5,  1.0) * 25;

  v_total := ROUND(v_acc_score + v_react_score + v_count_score + v_streak_score)::INT;

  -- ─── 4. tier 분기 반환 ──────────────────────────────────────────
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
