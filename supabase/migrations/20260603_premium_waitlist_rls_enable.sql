-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260603_premium_waitlist_rls_enable.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: 2026-05-31 가오픈 직전 임시 비활성된 premium_waitlist RLS 재활성.
--       어제 시도(20260601_premium_waitlist_rls_restore.sql) 실패 원인을 정확히
--       잡아 NOTIFY pgrst로 schema cache 즉시 갱신까지 포함.
--
-- 2026-06-02 진단 결과 (사용자 SQL Editor 실행 → 결과 공유):
--   - 정책 3개 그대로 잔존 (admin_select / insert_all / update_all) — TO 절·USING·
--     WITH CHECK 모두 정상.
--   - GRANT INSERT/UPDATE/SELECT 모두 anon·authenticated 보유 정상.
--   - is_admin() EXECUTE 권한 anon·authenticated 둘 다 보유. SECURITY DEFINER 정상.
--   - 즉 prerequisite는 완벽 — RLS만 켜면 됨.
--
-- 어제(2026-06-01) 실패 원인 (확정):
--   - 정책·grants 모두 정상이었으나 RLS ENABLE 시점에 PostgREST schema cache가
--     이전 상태("정책 없는 RLS ENABLE")로 인식 → 모든 INSERT가 "new row violates
--     RLS policy"로 차단.
--   - Supabase SQL Editor에서 직접 DDL 실행 시 PostgREST 자동 reload trigger가
--     항상 들어가지 않음. 명시적 NOTIFY pgrst 필요.
--
-- 이번 마이그레이션의 차이점:
--   - ALTER TABLE ENABLE ROW LEVEL SECURITY 외에 정책 재생성은 불필요 (이미 존재).
--   - 끝에 NOTIFY pgrst, 'reload schema'로 cache 즉시 갱신 — 핵심 라인.
--
-- 적용 후 동작:
--   - anon (비로그인): INSERT/UPSERT 성공, SELECT 차단 (TO authenticated 한정 정책).
--   - authenticated 일반 사용자: INSERT/UPSERT 성공, SELECT 차단 (is_admin() = false).
--   - authenticated admin: INSERT/UPSERT 성공, SELECT 전체 (is_admin() = true).
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 본 파일 전체 실행.
-- 적용 직후 시크릿 창 Pricing 다이얼로그에서 이메일 입력 → row 추가 확인 필수.
-- 문제 발생 시 즉시 롤백:
--   ALTER TABLE public.premium_waitlist DISABLE ROW LEVEL SECURITY;
--   NOTIFY pgrst, 'reload schema';
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- RLS 재활성
ALTER TABLE public.premium_waitlist ENABLE ROW LEVEL SECURITY;

-- 기존 정책 (admin_select / insert_all / update_all) 그대로 유지.
-- 어제 마이그레이션(20260601_premium_waitlist_rls_restore.sql) 적용 후 롤백은
-- ALTER TABLE DISABLE만 수행했으므로 정책·grants 잔존 — 추가 작업 X.

-- PostgREST schema cache 즉시 갱신 (어제 실패 원인 해결)
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 SQL (수동 실행 권장 — 위 COMMIT 이후 별도)
-- ═══════════════════════════════════════════════════════════════

-- A. RLS 활성 확인 (relrowsecurity = t 기대)
-- SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname = 'premium_waitlist' AND relnamespace = 'public'::regnamespace;

-- B. 정책 3개 + TO 절 확인 (어제 진단과 동일 결과 기대)
-- SELECT polname, polcmd,
--        pg_get_expr(polqual, polrelid)      AS using_expr,
--        pg_get_expr(polwithcheck, polrelid) AS check_expr,
--        ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(polroles)) AS roles
--   FROM pg_policy
--   WHERE polrelid = 'public.premium_waitlist'::regclass
--   ORDER BY polname;

-- C. anon role INSERT 시뮬레이션 (성공해야 함 — ROLLBACK으로 row 안 남김)
-- BEGIN;
-- SET LOCAL ROLE anon;
-- INSERT INTO public.premium_waitlist (email, locale, source)
--   VALUES ('verify-' || gen_random_uuid()::text || '@test.local', 'ko', 'pricing')
--   ON CONFLICT (email) DO UPDATE SET updated_at = now()
--   RETURNING id, email;
-- RESET ROLE;
-- ROLLBACK;

-- D. anon SELECT 차단 검증 (0 rows 기대 — TO authenticated 정책)
-- BEGIN;
-- SET LOCAL ROLE anon;
-- SELECT count(*) FROM public.premium_waitlist;
-- RESET ROLE;
-- ROLLBACK;
