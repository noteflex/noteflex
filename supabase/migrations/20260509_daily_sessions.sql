-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260509_daily_sessions.sql
-- ═══════════════════════════════════════════════════════════════
-- 일일 세션 한도 시스템 (영역 B-0 D1·D2·D3 결정)
--
-- Guest = 3회/일, Free = 7회/일, Premium = 무제한 (DB 호출 X).
-- session_date = UTC 기준 (글로벌 출시 일관).
-- tier_snapshot 컬럼 두지 않음 — tier는 profiles 자체 등급 영역.
--
-- RPC:
--   1. increment_daily_session() → atomic upsert 후 갱신 count 반환
--   2. get_today_session_count() → UTC 오늘 count 조회
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. daily_sessions 테이블 ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_sessions_user_date
  ON public.daily_sessions (user_id, session_date DESC);

-- ─── 2. RLS 정책 ─────────────────────────────────────────────────
ALTER TABLE public.daily_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_sessions_select_own" ON public.daily_sessions;
CREATE POLICY "daily_sessions_select_own"
  ON public.daily_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_sessions_insert_own" ON public.daily_sessions;
CREATE POLICY "daily_sessions_insert_own"
  ON public.daily_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_sessions_update_own" ON public.daily_sessions;
CREATE POLICY "daily_sessions_update_own"
  ON public.daily_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── 3. RPC: increment_daily_session ─────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_daily_session()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_new_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.daily_sessions (user_id, session_date, session_count)
  VALUES (v_user_id, v_today, 1)
  ON CONFLICT (user_id, session_date)
  DO UPDATE SET
    session_count = public.daily_sessions.session_count + 1,
    updated_at = NOW()
  RETURNING session_count INTO v_new_count;

  RETURN v_new_count;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.increment_daily_session() TO authenticated;

-- ─── 4. RPC: get_today_session_count ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_today_session_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $func$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT session_count INTO v_count
  FROM public.daily_sessions
  WHERE user_id = v_user_id AND session_date = v_today;

  RETURN COALESCE(v_count, 0);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_today_session_count() TO authenticated;
