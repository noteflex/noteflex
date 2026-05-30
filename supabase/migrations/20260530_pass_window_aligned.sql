-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260530_pass_window_aligned.sql
-- ═══════════════════════════════════════════════════════════════
-- 변경: record_sublevel_attempt의 통과 판정(v_passed)을 윈도우 기반 + 4지표로 교체.
--       클라(PASS_CRITERIA: 0.85/0.35/10/5)와 get_mastery_score(윈도우 기반)와
--       완전 일관시킴.
--
-- 배경 (직전 마이그레이션 20260529 잔여 문제):
--   - get_mastery_score는 윈도우 기반(N=7 평균)으로 교체됐으나
--     record_sublevel_attempt의 v_passed는 옛 누적 기준 그대로 유지:
--       acc >= 0.80 (다른 곳은 0.85)
--       play_count >= 5 (다른 곳은 10)
--       reaction 조건 자체 누락
--   - 결과: 윈도우 acc 94% + reaction 0.147로 모두 통과 기준 충족이어도
--     누적 acc 73%면 passed=false 잔존. 사용자가 통과 불가.
--
-- 수정 — v_passed 분기만 윈도우 기반으로 교체:
--   윈도우 길이 < 3       → 통과 보류 (false)
--   윈도우 길이 ≥ 3      → 4지표 모두 충족 시 true:
--                          acc(윈도우 평균) ≥ 0.85
--                       AND reaction(윈도우 평균) ≤ 0.35
--                       AND play_count(누적) ≥ 10
--                       AND best_streak(누적) ≥ 5
--
-- 무변경:
--   - 누적 컬럼 가산 (total_attempts·total_correct·play_count·best_streak·avg_reaction_ratio)
--   - recent_plays 윈도우 push/pop 로직
--   - 다음 sublevel 자동 INSERT(v_just_passed) 분기
--   - get_mastery_score (직전 마이그레이션 그대로)
--
-- 반환 jsonb:
--   - accuracy → 윈도우 기반(v_window_accuracy)로 변경 (UI 일관성).
--     표본 < 3이면 NULL.
--   - sample_count, just_passed는 윈도우 기반 그대로.
--
-- 기존 데이터:
--   - passed=true 행은 누적 기준으로 통과한 케이스 — 다운그레이드 안 함(UX 보호).
--   - passed=false인데 윈도우 기준 충족 케이스(snape016 등)는 다음 판 칠 때
--     v_passed=true 진입 → just_passed=true (NOT v_progress.passed) →
--     다음 sublevel 자동 INSERT 정상 발동.
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
  c_min_play_count      CONSTANT INT     := 10;
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


-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리 (적용 후)
-- ═══════════════════════════════════════════════════════════════
--
-- 1. snape016 — 통과 보류 상태 확인:
--    SELECT level, sublevel, play_count, best_streak, passed,
--           jsonb_array_length(recent_plays) AS sample_count
--    FROM user_sublevel_progress
--    WHERE user_id = (SELECT id FROM profiles WHERE email = 'snape016@gmail.com')
--      AND level = 1 AND sublevel = 1;
--    → 현재 passed=false 예상, sample_count ≥ 3
--
-- 2. 한 판 친 후 — passed=true 확인:
--    (게임 1판 플레이 후 record_sublevel_attempt 자동 호출)
--    같은 쿼리 → passed=true, passed_at 갱신 예상
--
-- 3. Lv 1-2 자동 INSERT 확인:
--    SELECT level, sublevel, play_count
--    FROM user_sublevel_progress
--    WHERE user_id = (SELECT id FROM profiles WHERE email = 'snape016@gmail.com')
--      AND level = 1 AND sublevel = 2;
--    → 새 행 존재 예상 (play_count=0)
--
-- 4. 반환 응답 직접 검증 (게임 외 호출 — 테스트 어드민 권한 필요):
--    SELECT public.record_sublevel_attempt(1, 1, 5, 5, 5, 'completed', 0.20);
--    → accuracy = 윈도우 평균 (NULL or NUMERIC), sample_count 반환
