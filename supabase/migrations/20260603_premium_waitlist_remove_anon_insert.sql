-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260603_premium_waitlist_remove_anon_insert.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: premium_waitlist의 anon INSERT 정책 제거.
--
-- 배경:
--   Pricing.tsx가 waitlist-signup Edge Function(service_role) 경유로 전환됨.
--   service_role은 RLS를 우회하므로 anon INSERT 정책이 더 이상 불필요.
--   직접 클라이언트 INSERT 경로가 없어졌으므로 anon/authenticated 직접 쓰기 차단.
--   admin_all 정책(authenticated + is_admin())만 유지.
--
-- 적용 조건:
--   1. waitlist-signup Edge Function이 prod에 배포된 상태
--   2. Pricing.tsx가 functions.invoke() 경유로 배포된 상태
--   3. prod 폼에서 신규·중복 이메일 제출 모두 성공 확인 후 적용
--
-- ⚠️ 적용 전 반드시 prod 검증 완료 후 실행.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- anon/authenticated 직접 INSERT 차단 (Edge Function이 service_role로 처리)
DROP POLICY IF EXISTS "premium_waitlist_insert_all" ON public.premium_waitlist;

-- PostgREST schema cache 갱신
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 적용 후 검증 SQL
-- ═══════════════════════════════════════════════════════════════

-- A. 잔존 정책 확인 (premium_waitlist_admin_all 1개만 기대)
-- SELECT polname, polcmd,
--        ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(polroles)) AS roles
--   FROM pg_policy
--   WHERE polrelid = 'public.premium_waitlist'::regclass
--   ORDER BY polname;

-- B. anon INSERT 차단 확인 (error 기대)
-- BEGIN;
-- SET LOCAL ROLE anon;
-- INSERT INTO public.premium_waitlist (email, locale, source)
--   VALUES ('post-cleanup-test@verify.local', 'ko', 'pricing');  -- 기대: RLS 오류
-- RESET ROLE;
-- ROLLBACK;

-- C. Pricing 폼 재확인 — Edge Function 경유 신규·중복 이메일 모두 성공 확인
