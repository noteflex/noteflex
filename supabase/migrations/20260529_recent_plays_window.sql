-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260529_recent_plays_window.sql
-- ═══════════════════════════════════════════════════════════════
-- 변경: user_sublevel_progress에 recent_plays JSONB 윈도우 컬럼 추가.
--       record_sublevel_attempt가 매 호출 시 윈도우 prepend + trim(7).
--       get_mastery_score가 정확도·반응속도를 윈도우 기반(최근 7판)으로 계산.
--       play_count·best_streak·누적 컬럼(total_attempts·total_correct·avg_reaction_ratio)은 그대로 유지.
--
-- 배경:
--   누적 평균(total_correct/total_attempts)은 초반 부진이 영구히 남아
--   MIN_ACCURACY=0.85 도달이 사실상 불가능. 최근 N판 윈도우로 변경해
--   학습 곡선이 점수·통과 판정에 반영되도록 함.
--
-- 윈도우 항목 형식:
--   {"at": "<ISO ts>", "attempts": N, "correct": N, "reaction_ratio": num|null}
--   최대 7개, 최신이 앞(index 0). 8번째 추가 시 가장 오래된 항목 제거.
--
-- 표본 처리 (get_mastery_score):
--   N < 3   → accuracy·reaction 점수 0 (play_count·streak 점수만 부분 적용)
--   3≤N≤7   → 윈도우 합계로 평균 계산, 정상 점수
--   fast_track=true → 100점 즉시 (기존 동작 유지)
--
-- 적용 후:
--   - 기존 user_sublevel_progress 모든 행은 recent_plays = '[]' 시작
--   - 신규 record_sublevel_attempt 호출부터 윈도우 누적
--   - 마이그레이션 시점 이전 누적값(total_*)은 보존, 윈도우 기반 점수는 N≥3 도달부터 표시
--
-- ⚠️ DB 적용은 사용자가 별도 진행 (Supabase SQL Editor).
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. 컬럼 추가 ──────────────────────────────────────────────
ALTER TABLE public.user_sublevel_progress
  ADD COLUMN IF NOT EXISTS recent_plays JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.user_sublevel_progress.recent_plays IS
  '최근 N판 윈도우 (최대 7, 최신이 앞). 형식: [{at, attempts, correct, reaction_ratio}, ...].';


-- ─── 2. record_sublevel_attempt — 윈도우 push/pop 추가 ────────
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
  v_accuracy           NUMERIC;
  v_passed             BOOLEAN;
  v_just_passed        BOOLEAN := false;
  -- recent_plays 윈도우 변수
  v_new_play           JSONB;
  v_new_window         JSONB;
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

  -- 누적 정확도 (legacy 통과 판정용 — 윈도우 기반은 클라/get_mastery_score에서)
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
    'accuracy',       v_accuracy,
    'best_streak',    v_new_best_streak,
    'passed',         v_passed,
    'just_passed',    v_just_passed,
    'sample_count',   jsonb_array_length(v_new_window)
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.record_sublevel_attempt(INT, INT, INT, INT, INT, TEXT, NUMERIC) TO authenticated;


-- ─── 3. get_mastery_score — 윈도우 기반 acc·react ─────────────
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
  v_user_id          UUID := auth.uid();
  v_progress         RECORD;
  v_tier             TEXT;

  v_window           JSONB;
  v_window_size      INT;
  v_window_attempts  INT;
  v_window_correct   INT;
  v_window_reaction  NUMERIC;

  v_accuracy         NUMERIC;
  v_reaction         NUMERIC;

  v_acc_score        NUMERIC := 0;
  v_react_score      NUMERIC := 0;
  v_count_score      NUMERIC;
  v_streak_score     NUMERIC;
  v_total            INT;

  -- 표본 임계
  c_min_sample CONSTANT INT := 3;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_progress
  FROM user_sublevel_progress
  WHERE user_id = v_user_id AND level = p_level AND sublevel = p_sublevel;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('score', 0, 'sample_count', 0);
  END IF;

  -- 패스트트랙 즉시 100
  IF v_progress.fast_track = true THEN
    RETURN jsonb_build_object('score', 100, 'fast_track', true, 'sample_count', 7);
  END IF;

  -- 티어 조회
  SELECT CASE
    WHEN p.role = 'admin'                                   THEN 'admin'
    WHEN p.is_premium = true OR p.subscription_tier = 'pro' THEN 'premium'
    ELSE 'free'
  END
  INTO v_tier
  FROM profiles p
  WHERE p.id = v_user_id;

  IF NOT FOUND THEN v_tier := 'free'; END IF;

  -- ── 윈도우 집계 ─────────────────────────────────────────────
  v_window      := COALESCE(v_progress.recent_plays, '[]'::jsonb);
  v_window_size := jsonb_array_length(v_window);

  IF v_window_size >= c_min_sample THEN
    -- 표본 충분: 윈도우 합계로 평균 계산
    SELECT
      SUM((elem->>'attempts')::INT),
      SUM((elem->>'correct')::INT),
      AVG((elem->>'reaction_ratio')::NUMERIC)
        FILTER (WHERE elem->'reaction_ratio' IS NOT NULL
                  AND jsonb_typeof(elem->'reaction_ratio') = 'number'
                  AND (elem->>'reaction_ratio')::NUMERIC > 0)
    INTO v_window_attempts, v_window_correct, v_window_reaction
    FROM jsonb_array_elements(v_window) AS elem;

    v_accuracy := CASE
      WHEN v_window_attempts > 0
      THEN v_window_correct::NUMERIC / v_window_attempts
      ELSE 0
    END;

    v_reaction    := v_window_reaction;
    v_acc_score   := LEAST(v_accuracy / 0.85, 1.0) * 25;
    v_react_score := CASE
      WHEN v_reaction IS NOT NULL AND v_reaction > 0
      THEN LEAST(0.35 / v_reaction, 1.0) * 25
      ELSE 0
    END;
  ELSE
    -- 표본 부족 (N < 3): acc·react 점수 0, play·streak 점수만 부분 적용
    v_accuracy    := NULL;
    v_reaction    := NULL;
    v_acc_score   := 0;
    v_react_score := 0;
  END IF;

  -- play_count·best_streak — 누적 컬럼 그대로
  v_count_score  := LEAST(v_progress.play_count::NUMERIC / 10, 1.0) * 25;
  v_streak_score := LEAST(v_progress.best_streak::NUMERIC / 5,  1.0) * 25;

  v_total := ROUND(v_acc_score + v_react_score + v_count_score + v_streak_score)::INT;

  -- 응답 — 프리미엄/admin은 4지표 detail 포함
  IF v_tier IN ('premium', 'admin') THEN
    RETURN jsonb_build_object(
      'score',          v_total,
      'sample_count',   v_window_size,
      'accuracy',       ROUND(COALESCE(v_accuracy, 0) * 100, 1),
      'reaction_ratio', ROUND(COALESCE(v_reaction, 0)::NUMERIC, 3),
      'play_count',     v_progress.play_count,
      'best_streak',    v_progress.best_streak
    );
  ELSE
    RETURN jsonb_build_object(
      'score',        v_total,
      'sample_count', v_window_size
    );
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_mastery_score(INT, INT) TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리 (적용 후)
-- ═══════════════════════════════════════════════════════════════
-- 1. 컬럼 추가 확인:
--    SELECT column_name, data_type, column_default
--    FROM information_schema.columns
--    WHERE table_name = 'user_sublevel_progress' AND column_name = 'recent_plays';
--
-- 2. 게임 1판 후 윈도우 누적 확인:
--    SELECT level, sublevel, play_count, jsonb_array_length(recent_plays) AS sample_count,
--           recent_plays
--    FROM user_sublevel_progress
--    WHERE user_id = auth.uid() AND level = 1 AND sublevel = 1;
--
-- 3. get_mastery_score 응답에 sample_count 포함 확인:
--    SELECT get_mastery_score(1, 1);
--    → 7판 미만이면 sample_count < 7, accuracy/reaction NULL or 0
--    → 7판 이상이면 sample_count = 7, accuracy/reaction 윈도우 평균
