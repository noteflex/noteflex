-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260510_rls_audit.sql
-- ═══════════════════════════════════════════════════════════════
-- §X-1 D2: 전 테이블 RLS 정책 검증 + 정정
--
-- 점검 테이블:
--   profiles · user_note_logs · user_sublevel_progress
--   daily_sessions · user_custom_scores · payment_events
--   device_change_events · user_scores · practice_logs
--
-- 각 테이블: SELECT/INSERT/UPDATE/DELETE auth.uid()=user_id 강제
--           admin SELECT 추가 (is_admin() 함수 공통 사용)
--
-- ⚠️ production apply 전 Supabase Dashboard > SQL Editor에서 실행.
--    Docker 로컬 미사용 → 직접 apply 필요.
-- ═══════════════════════════════════════════════════════════════

-- ─── 0. is_admin() 헬퍼 함수 ─────────────────────────────────────
-- profiles.role = 'admin' 여부 확인. SECURITY DEFINER = RLS 우회 없이
-- profiles 직접 조회 가능 (호출자 RLS 적용 X).
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

-- ─── 1. profiles ────────────────────────────────────────────────
-- 기존: SELECT, INSERT, UPDATE (auth.uid() = id) ✓
-- 추가: admin SELECT (다른 사용자 프로필 조회용)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- ─── 2. user_note_logs ──────────────────────────────────────────
-- 기존: SELECT, INSERT (TO authenticated) ✓
-- 추가: admin SELECT

ALTER TABLE public.user_note_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all note logs" ON public.user_note_logs;
CREATE POLICY "Admins can view all note logs"
  ON public.user_note_logs FOR SELECT
  USING (public.is_admin());

-- ─── 3. user_sublevel_progress ──────────────────────────────────
-- 기존: SELECT, INSERT, UPDATE, admin SELECT ✓
-- 추가: DELETE (계정 탈퇴 수동 정리 또는 GDPR 요청 대비)

ALTER TABLE public.user_sublevel_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own progress" ON public.user_sublevel_progress;
CREATE POLICY "Users can delete own progress"
  ON public.user_sublevel_progress FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 4. daily_sessions ──────────────────────────────────────────
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

-- ─── 5. user_custom_scores ──────────────────────────────────────
-- 기존: SELECT, INSERT, UPDATE, DELETE (auth.uid() = user_id) ✓
-- 추가: admin SELECT

ALTER TABLE public.user_custom_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all custom scores" ON public.user_custom_scores;
CREATE POLICY "Admins can view all custom scores"
  ON public.user_custom_scores FOR SELECT
  USING (public.is_admin());

-- ─── 6. payment_events ──────────────────────────────────────────
-- 기존: SELECT (auth.uid() = user_id) ✓
-- INSERT는 SECURITY DEFINER RPC (apply_payment_topup) 전용 → 사용자 직접 INSERT 금지 유지
-- 추가: admin SELECT (결제 이상 분석용)

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all payments" ON public.payment_events;
CREATE POLICY "Admins can view all payments"
  ON public.payment_events FOR SELECT
  USING (public.is_admin());

-- ─── 7. device_change_events ────────────────────────────────────
-- 기존: SELECT, INSERT (auth.uid() = user_id), admin SELECT ✓
-- 모두 충족 — 확인 및 재생성 (idempotent)

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

-- ─── 8. user_scores (add_user_scores_and_practice_logs) ─────────
-- 기존: SELECT, INSERT, UPDATE, DELETE ✓
-- 추가: admin SELECT

DROP POLICY IF EXISTS "Admins can view all user scores" ON public.user_scores;
CREATE POLICY "Admins can view all user scores"
  ON public.user_scores FOR SELECT
  USING (public.is_admin());

-- ─── 9. practice_logs ───────────────────────────────────────────
-- 기존: SELECT, INSERT ✓
-- 추가: UPDATE, DELETE, admin SELECT

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

-- ─── 검증 쿼리 (apply 후 Supabase Dashboard에서 확인) ──────────────
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
