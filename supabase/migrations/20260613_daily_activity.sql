-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260613_daily_activity.sql
-- ═══════════════════════════════════════════════════════════════
-- 스트릭 Step 2 — daily_activity 테이블 + record_practice_day RPC 확장.
--
-- 배경:
--   Step 1의 user_streaks 는 마지막 활동일(last_practice_date) 1개만 보유.
--   대시보드/헤더의 주간 7도트 위젯은 요일별 활동 여부가 필요.
--   user_sessions·user_stats_daily 는 일반 게임만 기록(데일리 격리 정책).
--   → 활동 표시 전용 daily_activity 테이블을 신설하고, record_practice_day RPC가
--     user_streaks 갱신과 같은 트랜잭션에서 INSERT(멱등) 한다.
--
-- 분석 격리 정책 유지:
--   daily_activity 는 "활동 표시" 전용 — user_stats_daily / rollup / 분석 보고서와
--   완전 분리. 분석 쪽은 여전히 일반 게임만 user_sessions → user_stats_daily.
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 실행.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. daily_activity 테이블 ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_activity (
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  local_date date        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date
  ON public.daily_activity (user_id, local_date DESC);

ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_activity_select_own ON public.daily_activity;
DROP POLICY IF EXISTS daily_activity_admin_select ON public.daily_activity;

CREATE POLICY daily_activity_select_own ON public.daily_activity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY daily_activity_admin_select ON public.daily_activity
  FOR SELECT USING (public.is_admin());

-- INSERT/UPDATE 정책 없음 — 본 RPC(SECURITY DEFINER)만 쓰기 권한 보유.

-- ─── 2. record_practice_day RPC v2 — daily_activity INSERT 추가 ─
-- 기존 RPC(20260613_record_practice_day.sql)를 REPLACE 하여 한 호출로
-- user_streaks 갱신 + daily_activity 멱등 INSERT 를 같은 트랜잭션 안에서 처리.
-- 시그니처·반환 형식 무변경 → 클라이언트 코드 영향 없음.

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

  -- 활동 도트(daily_activity) 멱등 INSERT — 같은 날 재호출 무영향.
  INSERT INTO public.daily_activity (user_id, local_date)
  VALUES (v_user_id, p_local_date)
  ON CONFLICT (user_id, local_date) DO NOTHING;

  -- user_streaks 갱신 로직 (v1 그대로)
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
-- 1) 테이블·RLS 생성 확인
--   SELECT * FROM pg_policies WHERE tablename = 'daily_activity';
--
-- 2) RPC 동작 확인 (admin 본인 계정에서)
--   SELECT public.record_practice_day(CURRENT_DATE);
--   SELECT user_id, local_date FROM public.daily_activity
--     WHERE user_id = auth.uid() ORDER BY local_date DESC LIMIT 7;
--   SELECT current_streak, longest_streak, last_practice_date
--     FROM public.user_streaks WHERE user_id = auth.uid();
