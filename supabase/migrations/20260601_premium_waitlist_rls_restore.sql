-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260601_premium_waitlist_rls_restore.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: 가오픈(5/31) 직전 임시 비활성된 public.premium_waitlist RLS 정상화.
--
-- 배경:
--   2026-05-31 가오픈 직전에 RLS를 ALTER TABLE ... DISABLE ROW LEVEL SECURITY
--   로 임시 비활성 (anon이 모든 row 조회 가능 = 이메일 유출 위험).
--
-- 원인 진단:
--   - public.is_admin() 함수 자체는 20260510_rls_audit.sql 에서 정의됨 (정상).
--     SECURITY DEFINER + STABLE + search_path 잠금. 안전한 헬퍼.
--   - 기존 GRANT EXECUTE TO authenticated만 부여 → anon은 호출 권한 없음.
--   - 기존 SELECT 정책에 TO 절 누락 → 모든 role(anon 포함)이 정책 평가 대상.
--   - anon이 SELECT 시도 시 is_admin() 호출에서 permission denied 발생 가능.
--     (INSERT/UPDATE는 정책이 WITH CHECK(true)·USING(true)뿐이라 영향 없음.)
--
-- 정상화 변경점:
--   1. is_admin()에 anon EXECUTE 권한 추가 (정책 평가 안전성).
--      함수 자체는 SECURITY DEFINER → anon이 호출해도 함수 내부는 정의자 권한.
--   2. RLS 재활성.
--   3. 정책 재생성 시 TO 절 명시:
--      - INSERT: anon + authenticated (Pricing 다이얼로그 비로그인 진입 가능)
--      - UPDATE: anon + authenticated (UPSERT의 ON CONFLICT DO UPDATE 필요)
--      - SELECT: authenticated 전용 + is_admin() (anon은 정책 평가 대상조차 X)
--
-- 적용 후 동작:
--   - anon (비로그인): INSERT/UPSERT 성공, SELECT 차단 (행 0개 반환).
--   - authenticated 일반 사용자: INSERT/UPSERT 성공, SELECT 차단 (is_admin() = false).
--   - authenticated admin: INSERT/UPSERT 성공, SELECT 전체 (is_admin() = true).
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 본 파일 전체 실행.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. is_admin() 함수 권한 보강 ────────────────────────────
-- 기존 GRANT EXECUTE TO authenticated만 → anon 호출 시 permission denied.
-- anon에게도 EXECUTE 부여. 함수 자체는 SECURITY DEFINER로 정의자 권한
-- (postgres role)으로 profiles 조회 → 안전.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ─── 2. RLS 재활성 ───────────────────────────────────────────
ALTER TABLE public.premium_waitlist ENABLE ROW LEVEL SECURITY;

-- ─── 3. 정책 재생성 (TO 절 명시) ─────────────────────────────

-- INSERT: anon + authenticated 모두 허용 (Pricing 비로그인 진입 가능)
DROP POLICY IF EXISTS premium_waitlist_insert_all ON public.premium_waitlist;
CREATE POLICY premium_waitlist_insert_all
  ON public.premium_waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- UPDATE: anon + authenticated 모두 허용 (UPSERT의 ON CONFLICT DO UPDATE 필요)
DROP POLICY IF EXISTS premium_waitlist_update_all ON public.premium_waitlist;
CREATE POLICY premium_waitlist_update_all
  ON public.premium_waitlist
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- SELECT: authenticated 전용 + is_admin()
-- TO 절을 authenticated로 한정 → anon은 정책 평가조차 시도하지 않음
-- (이전 버그의 근본 원인 회피).
DROP POLICY IF EXISTS premium_waitlist_admin_select ON public.premium_waitlist;
CREATE POLICY premium_waitlist_admin_select
  ON public.premium_waitlist
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 SQL (수동 실행 권장 — 위 BEGIN/COMMIT 블록 이후 별도 실행)
-- ═══════════════════════════════════════════════════════════════

-- A. RLS 활성 확인
-- SELECT relname, relrowsecurity, relforcerowsecurity
--   FROM pg_class
--   WHERE relname = 'premium_waitlist';
-- 기대: relrowsecurity = t

-- B. 정책 3개 + TO 절 확인
-- SELECT polname,
--        pg_get_expr(polqual, polrelid)        AS using_expr,
--        pg_get_expr(polwithcheck, polrelid)   AS check_expr,
--        polcmd,
--        ARRAY(
--          SELECT rolname FROM pg_roles WHERE oid = ANY(polroles)
--        ) AS roles
--   FROM pg_policy
--   WHERE polrelid = 'public.premium_waitlist'::regclass
--   ORDER BY polname;
-- 기대:
--   premium_waitlist_admin_select | (is_admin())  | NULL          | r | {authenticated}
--   premium_waitlist_insert_all   | NULL          | true          | a | {anon,authenticated}
--   premium_waitlist_update_all   | true          | true          | w | {anon,authenticated}

-- C. is_admin() EXECUTE 권한 확인
-- SELECT grantee, privilege_type
--   FROM information_schema.routine_privileges
--   WHERE routine_name = 'is_admin'
--     AND routine_schema = 'public';
-- 기대: anon, authenticated 둘 다 EXECUTE 보유
