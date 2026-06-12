-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260613_record_practice_day.sql
-- ═══════════════════════════════════════════════════════════════
-- 스트릭 Step 1 — record_practice_day RPC.
--
-- 호출 시점:
--   - 일반 레벨 게임 완료 (useSessionRecorder: record_game_session 성공 직후)
--   - 데일리 챌린지 완료 (DailyChallenge.finalizeIfNeeded "ended" 전환 시점)
--
-- 입력: p_local_date date  — 클라이언트 로컬 자정 기준 YYYY-MM-DD.
-- 동작:
--   1. 비로그인(auth.uid() NULL) → no-op, {updated:false} 반환.
--   2. user_streaks 행 없음 → INSERT current=1, longest=1, last_practice_date=p_local_date.
--   3. 있음 + last_practice_date == p_local_date → 오늘 이미 인정, 변화 없음.
--   4. 있음 + last_practice_date == p_local_date - 1 → current_streak += 1.
--   5. 그 외(과거 또는 NULL) → current_streak = 1 리셋.
--   - longest_streak = GREATEST(longest, current).
--   - 동결 컬럼(streak_freezes_*)은 본 RPC에서 건드리지 않음 — 후속 단계.
--
-- 반환: jsonb {current_streak, longest_streak, updated}.
--
-- SECURITY DEFINER → user_streaks INSERT/UPDATE 정책 미정의 상태에서도 동작.
-- 사용자 본인의 행만 갱신 (auth.uid() 강제).
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 실행.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_practice_day(p_local_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id     uuid := auth.uid();
  v_existing    record;
  v_new_current int;
  v_new_longest int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('updated', false);
  END IF;

  SELECT current_streak, longest_streak, last_practice_date
    INTO v_existing
    FROM public.user_streaks
    WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_streaks (
      user_id, current_streak, longest_streak, last_practice_date, updated_at
    ) VALUES (
      v_user_id, 1, 1, p_local_date, now()
    );
    RETURN jsonb_build_object(
      'current_streak', 1,
      'longest_streak', 1,
      'updated', true
    );
  END IF;

  IF v_existing.last_practice_date = p_local_date THEN
    RETURN jsonb_build_object(
      'current_streak', v_existing.current_streak,
      'longest_streak', v_existing.longest_streak,
      'updated', false
    );
  ELSIF v_existing.last_practice_date = (p_local_date - 1) THEN
    v_new_current := v_existing.current_streak + 1;
  ELSE
    v_new_current := 1;
  END IF;

  v_new_longest := GREATEST(v_existing.longest_streak, v_new_current);

  UPDATE public.user_streaks
  SET current_streak     = v_new_current,
      longest_streak     = v_new_longest,
      last_practice_date = p_local_date,
      updated_at         = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'current_streak', v_new_current,
    'longest_streak', v_new_longest,
    'updated', true
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.record_practice_day(date) TO authenticated;

-- ─── 검증 쿼리 (apply 후 확인) ────────────────────────────────
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_name = 'record_practice_day' AND routine_schema = 'public';
--
-- 동작 확인 (admin 본인 계정에서):
--   SELECT public.record_practice_day(CURRENT_DATE);
--   SELECT current_streak, longest_streak, last_practice_date
--     FROM public.user_streaks WHERE user_id = auth.uid();
