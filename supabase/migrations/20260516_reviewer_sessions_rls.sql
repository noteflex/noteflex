-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260516_reviewer_sessions_rls.sql
-- ═══════════════════════════════════════════════════════════════
-- user_sessions RLS 보정 + profiles.last_practice_date 트리거 보정.
--
-- 배경: user_sessions 테이블은 Supabase Dashboard에서 직접 생성되어
-- 마이그레이션에 없음. reviewer 계정이 7 세션을 플레이했음에도
-- Dashboard NewUserView(신규 사용자 영역)가 박히는 현상 발생.
--
-- 원인 추정:
--   1. user_sessions에 RLS 정책이 없거나 reviewer를 막음.
--   2. profiles.last_practice_date를 갱신하는 트리거가 없음.
--
-- 이 마이그레이션:
--   A. user_sessions RLS 확인 + SELECT 정책 보강.
--   B. after_session_insert 트리거 존재 보장.
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 실행.
-- ═══════════════════════════════════════════════════════════════

-- ─── A. user_sessions RLS ─────────────────────────────────────
-- 테이블이 없으면 EXCEPTION WHEN undefined_table로 스킵 (안전).
DO $block$
BEGIN
  -- RLS 활성화
  ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

  -- SELECT: 자신의 세션만 조회 (reviewer 포함 모든 authenticated)
  DROP POLICY IF EXISTS "user_sessions_select_own" ON public.user_sessions;
  CREATE POLICY "user_sessions_select_own"
    ON public.user_sessions FOR SELECT
    USING (auth.uid() = user_id);

  -- INSERT: 자신의 세션만 삽입
  DROP POLICY IF EXISTS "user_sessions_insert_own" ON public.user_sessions;
  CREATE POLICY "user_sessions_insert_own"
    ON public.user_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  -- admin SELECT (전체 조회)
  DROP POLICY IF EXISTS "user_sessions_admin_select" ON public.user_sessions;
  CREATE POLICY "user_sessions_admin_select"
    ON public.user_sessions FOR SELECT
    USING (public.is_admin());

  RAISE NOTICE 'user_sessions RLS policies applied';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'user_sessions not found — skipping RLS setup';
END $block$;

-- ─── B. after_session_insert 트리거 ─────────────────────────
-- user_sessions에 INSERT 시 profiles.last_practice_date 갱신.
-- 이미 존재하면 OR REPLACE로 덮어씀 (idempotent).
DO $block$
BEGIN
  -- 트리거 함수
  CREATE OR REPLACE FUNCTION public.update_profile_after_session()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $func$
  BEGIN
    UPDATE public.profiles
    SET
      last_practice_date = (NEW.started_at AT TIME ZONE 'UTC')::DATE,
      updated_at = NOW()
    WHERE id = NEW.user_id
      AND (
        last_practice_date IS NULL
        OR last_practice_date < (NEW.started_at AT TIME ZONE 'UTC')::DATE
      );
    RETURN NEW;
  END;
  $func$;

  -- 트리거 등록 (user_sessions 테이블에)
  DROP TRIGGER IF EXISTS trg_update_profile_after_session ON public.user_sessions;
  CREATE TRIGGER trg_update_profile_after_session
    AFTER INSERT ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_profile_after_session();

  RAISE NOTICE 'trg_update_profile_after_session applied on user_sessions';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'user_sessions not found — skipping trigger setup';
END $block$;

-- ─── 검증 쿼리 (apply 후 Supabase Dashboard에서 확인) ──────────
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'user_sessions'
-- ORDER BY cmd;
--
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE event_object_table = 'user_sessions';
