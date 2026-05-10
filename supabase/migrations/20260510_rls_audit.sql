-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260510_rls_audit.sql  (v2 — 2026-05-10 정정)
-- ═══════════════════════════════════════════════════════════════
-- §X-1 D2: 전 테이블 RLS 정책 검증 + 정정
--
-- 안전 설계: production에 없는 테이블은 EXCEPTION WHEN undefined_table
-- 블록으로 스킵 → 어떤 production 상태에서도 에러 없이 실행 가능.
--
-- Core 4 테이블 (반드시 존재): profiles · user_note_logs
--                              user_sublevel_progress · daily_sessions
-- Optional 5 테이블 (존재 시 적용): user_custom_scores · payment_events
--                                    device_change_events · user_scores
--                                    practice_logs
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 실행.
-- ═══════════════════════════════════════════════════════════════

-- ─── 0. is_admin() 헬퍼 함수 ─────────────────────────────────────
-- profiles.role = 'admin' 여부 확인.
-- SECURITY DEFINER = 호출자 RLS를 우회해 profiles 직접 조회 가능.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $func$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ─── 1. profiles (core) ──────────────────────────────────────────
-- 기존: SELECT, INSERT, UPDATE (auth.uid() = id) ✓
-- 추가: admin SELECT

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- ─── 2. user_note_logs (core) ────────────────────────────────────
-- 기존: SELECT, INSERT (TO authenticated) ✓
-- 추가: admin SELECT

ALTER TABLE public.user_note_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all note logs" ON public.user_note_logs;
CREATE POLICY "Admins can view all note logs"
  ON public.user_note_logs FOR SELECT
  USING (public.is_admin());

-- ─── 3. user_sublevel_progress (core) ────────────────────────────
-- 기존: SELECT, INSERT, UPDATE, admin SELECT ✓
-- 추가: DELETE (GDPR 탈퇴 데이터 정리)

ALTER TABLE public.user_sublevel_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own progress" ON public.user_sublevel_progress;
CREATE POLICY "Users can delete own progress"
  ON public.user_sublevel_progress FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 4. daily_sessions (core) ────────────────────────────────────
-- 기존: SELECT, INSERT, UPDATE (auth.uid() = user_id) ✓
-- 추가: DELETE, admin SELECT

ALTER TABLE public.daily_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_sessions_delete_own" ON public.daily_sessions;
CREATE POLICY "daily_sessions_delete_own"
  ON public.daily_sessions FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_sessions_admin_select" ON public.daily_sessions;
CREATE POLICY "daily_sessions_admin_select"
  ON public.daily_sessions FOR SELECT
  USING (public.is_admin());

-- ─── 5. user_custom_scores (optional) ────────────────────────────
-- 기존: SELECT, INSERT, UPDATE, DELETE ✓ | 추가: admin SELECT
DO $block$
BEGIN
  ALTER TABLE public.user_custom_scores ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Admins can view all custom scores" ON public.user_custom_scores;
  CREATE POLICY "Admins can view all custom scores"
    ON public.user_custom_scores FOR SELECT
    USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'user_custom_scores not found, skipping';
END $block$;

-- ─── 6. payment_events (optional) ────────────────────────────────
-- 기존: SELECT (auth.uid() = user_id) ✓
-- INSERT는 SECURITY DEFINER RPC 전용 — 직접 INSERT 금지 유지
-- 추가: admin SELECT
DO $block$
BEGIN
  ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Admins can view all payments" ON public.payment_events;
  CREATE POLICY "Admins can view all payments"
    ON public.payment_events FOR SELECT
    USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'payment_events not found, skipping';
END $block$;

-- ─── 7. device_change_events (optional) ──────────────────────────
-- 기존: SELECT, INSERT, admin SELECT ✓ — 재생성 (idempotent)
DO $block$
BEGIN
  ALTER TABLE public.device_change_events ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users can view own device change events" ON public.device_change_events;
  CREATE POLICY "Users can view own device change events"
    ON public.device_change_events FOR SELECT
    USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can insert own device change events" ON public.device_change_events;
  CREATE POLICY "Users can insert own device change events"
    ON public.device_change_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Admins can view all device change events" ON public.device_change_events;
  CREATE POLICY "Admins can view all device change events"
    ON public.device_change_events FOR SELECT
    USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'device_change_events not found, skipping';
END $block$;

-- ─── 8. user_scores (optional) ───────────────────────────────────
-- 기존: SELECT, INSERT, UPDATE, DELETE ✓ | 추가: admin SELECT
DO $block$
BEGIN
  DROP POLICY IF EXISTS "Admins can view all user scores" ON public.user_scores;
  CREATE POLICY "Admins can view all user scores"
    ON public.user_scores FOR SELECT
    USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'user_scores not found, skipping';
END $block$;

-- ─── 9. practice_logs (optional) ─────────────────────────────────
-- 기존: SELECT, INSERT ✓ | 추가: UPDATE, DELETE, admin SELECT
DO $block$
BEGIN
  DROP POLICY IF EXISTS "Users can update own practice logs" ON public.practice_logs;
  CREATE POLICY "Users can update own practice logs"
    ON public.practice_logs FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can delete own practice logs" ON public.practice_logs;
  CREATE POLICY "Users can delete own practice logs"
    ON public.practice_logs FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Admins can view all practice logs" ON public.practice_logs;
  CREATE POLICY "Admins can view all practice logs"
    ON public.practice_logs FOR SELECT
    USING (public.is_admin());
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'practice_logs not found, skipping';
END $block$;

-- ─── 검증 쿼리 (apply 후 Supabase Dashboard에서 확인) ──────────────
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
