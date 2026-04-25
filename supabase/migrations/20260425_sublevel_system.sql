-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260425_sublevel_system.sql
-- ═══════════════════════════════════════════════════════════════
-- 21단계 레벨 세분화 시스템 (Lv 1-1 ~ Lv 7-3)
--
-- ⚠️  이 마이그레이션은 이미 Supabase Dashboard에서 적용 완료됨.
-- 이 파일은 히스토리 보존용이며 다시 실행할 필요 없음.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. user_sublevel_progress 테이블 ─────────────────────────
CREATE TABLE IF NOT EXISTS public.user_sublevel_progress (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level BETWEEN 1 AND 7),
  sublevel INT NOT NULL CHECK (sublevel BETWEEN 1 AND 3),

  play_count INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  total_attempts INT NOT NULL DEFAULT 0,
  total_correct INT NOT NULL DEFAULT 0,

  passed BOOLEAN NOT NULL DEFAULT false,
  passed_at TIMESTAMPTZ,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, level, sublevel)
);

ALTER TABLE public.user_sublevel_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.user_sublevel_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.user_sublevel_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.user_sublevel_progress
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all progress"
  ON public.user_sublevel_progress
  FOR SELECT
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_progress_user
  ON public.user_sublevel_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_progress_passed
  ON public.user_sublevel_progress (user_id, passed);

-- ─── 2. profiles.subscription_tier ─────────────────────────────
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT
  CHECK (subscription_tier IN ('free', 'pro'))
  DEFAULT 'free';

UPDATE public.profiles SET subscription_tier = 'pro' WHERE is_premium = true;

CREATE INDEX IF NOT EXISTS idx_profiles_tier
  ON public.profiles (subscription_tier);

-- ─── 3. record_sublevel_attempt() RPC ──────────────────────────
CREATE OR REPLACE FUNCTION public.record_sublevel_attempt(
  p_level INT,
  p_sublevel INT,
  p_attempts INT,
  p_correct INT,
  p_max_streak INT,
  p_game_status TEXT
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

  v_passed := (
    v_new_play_count >= 5 AND
    v_new_best_streak >= 5 AND
    v_accuracy >= 0.80
  );

  v_just_passed := (NOT v_progress.passed AND v_passed);

  UPDATE user_sublevel_progress
  SET
    play_count = v_new_play_count,
    total_attempts = v_new_total_attempts,
    total_correct = v_new_total_correct,
    best_streak = v_new_best_streak,
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
    'passed', v_passed,
    'just_passed', v_just_passed
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.record_sublevel_attempt(INT, INT, INT, INT, INT, TEXT) TO authenticated;