-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260603_enable_rls_feedback_premium_waitlist.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: feedback·premium_waitlist 두 테이블 RLS 보안 정상화.
--       anon 키로 전체 행 읽기 가능한 상태 해소.
--
-- 정책 설계 근거:
--   feedback:
--     - INSERT 경로: FeedbackDialog.tsx → supabase.functions.invoke("submit-feedback")
--       → Edge Function(service_role 키) → RLS 우회. 클라이언트 직접 INSERT 경로 없음.
--       → anon INSERT 정책 불필요. 생성하지 않음 (불필요한 공격 면 제거).
--     - SELECT·UPDATE 경로: FeedbackPage.tsx → authenticated admin JWT
--       → feedback_admin_all 정책으로 커버.
--     - 위험 해소: anon SELECT → 이메일 등 전체 행 노출 차단.
--
--   premium_waitlist:
--     - INSERT 경로: Pricing.tsx → supabase.from("premium_waitlist").insert(...)
--       → anon or authenticated 직접 호출 → anon INSERT 정책 필요.
--     - UPSERT 폐기: 기존 upsert(onConflict:"email") → insert(ignoreDuplicates:true)로 변경.
--       ON CONFLICT DO NOTHING이므로 anon UPDATE 정책 불필요. 생성하지 않음.
--     - 위험 해소: anon UPDATE(임의 행 갱신) 가능 상태 해소.
--
-- 적용 후 동작:
--   feedback:
--     - anon: INSERT·SELECT·UPDATE·DELETE 모두 차단 (Edge Function이 service_role로 처리)
--     - authenticated 일반: INSERT·SELECT·UPDATE 차단
--     - authenticated admin: SELECT·UPDATE·DELETE 전체 가능
--   premium_waitlist:
--     - anon: INSERT 가능, UPDATE·SELECT 차단
--     - authenticated 일반: INSERT 가능, UPDATE·SELECT 차단
--     - authenticated admin: 전체 가능
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 본 파일 전체 실행.
--   적용 직후 수동 검증:
--   - (A) Pricing 다이얼로그 waitlist 제출 정상 확인 (중복 이메일 포함)
--   - (B) 피드백 FAB 제출 정상 확인
--   - (C) /admin/feedback 조회·상태 변경 정상 확인
--   - (D) anon SELECT 차단: 아래 검증 SQL 실행 확인
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 사전 조건: is_admin() EXECUTE 권한 보장 ──────────────────
-- 이미 부여된 경우 no-op.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 1. feedback 테이블
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- anon INSERT 정책 없음:
--   INSERT는 Edge Function(service_role)이 수행 → RLS 우회.
--   클라이언트 직접 INSERT 경로 없으므로 anon INSERT 정책 불필요.
--   (기존 정책이 존재할 경우를 위한 DROP)
DROP POLICY IF EXISTS "feedback_anon_insert" ON public.feedback;

-- admin ALL — FeedbackPage.tsx의 SELECT·UPDATE(status·admin_note·resolved_at)·CSV 포함.
-- AdminGuard(UI)와 is_admin()(DB) 이중 차단.
DROP POLICY IF EXISTS "feedback_admin_all" ON public.feedback;
CREATE POLICY "feedback_admin_all" ON public.feedback
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ═══════════════════════════════════════════════════════════════
-- 2. premium_waitlist 테이블
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.premium_waitlist ENABLE ROW LEVEL SECURITY;

-- anon INSERT — Pricing.tsx 비로그인 waitlist 등록.
-- Pricing.tsx는 insert(ignoreDuplicates:true) 사용 → ON CONFLICT DO NOTHING.
-- UPDATE 정책 불필요 (anon UPDATE 공격 면 제거).
DROP POLICY IF EXISTS "premium_waitlist_insert_all" ON public.premium_waitlist;
CREATE POLICY "premium_waitlist_insert_all" ON public.premium_waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- anon UPDATE 정책 없음:
--   기존 upsert(onConflict:"email")에서 insert(ignoreDuplicates:true)로 변경.
--   ON CONFLICT DO NOTHING이므로 UPDATE 단계 없음 → anon UPDATE 정책 불필요.
--   (기존 정책이 존재할 경우를 위한 DROP)
DROP POLICY IF EXISTS "premium_waitlist_update_all" ON public.premium_waitlist;

-- admin ALL — WaitlistPage.tsx의 SELECT + 향후 UPDATE/DELETE 포함.
DROP POLICY IF EXISTS "premium_waitlist_admin_select" ON public.premium_waitlist;
DROP POLICY IF EXISTS "premium_waitlist_admin_all" ON public.premium_waitlist;
CREATE POLICY "premium_waitlist_admin_all" ON public.premium_waitlist
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PostgREST schema cache 즉시 갱신
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 SQL (수동 실행 권장 — COMMIT 이후 별도)
-- ═══════════════════════════════════════════════════════════════

-- A. RLS 활성 확인 (두 테이블 모두 relrowsecurity = t 기대)
-- SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname IN ('feedback', 'premium_waitlist')
--     AND relnamespace = 'public'::regnamespace;

-- B. 정책 확인 (feedback: feedback_admin_all 1개 / premium_waitlist: 2개 기대)
-- SELECT polname, polcmd,
--        pg_get_expr(polqual, polrelid)      AS using_expr,
--        pg_get_expr(polwithcheck, polrelid) AS check_expr,
--        ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(polroles)) AS roles
--   FROM pg_policy
--   WHERE polrelid IN (
--     'public.feedback'::regclass,
--     'public.premium_waitlist'::regclass
--   )
--   ORDER BY polrelid::text, polname;

-- C. anon SELECT 차단 확인 — 두 테이블 모두 0 rows 기대
-- BEGIN;
-- SET LOCAL ROLE anon;
-- SELECT count(*) FROM public.feedback;        -- 기대: 0
-- SELECT count(*) FROM public.premium_waitlist; -- 기대: 0
-- RESET ROLE;
-- ROLLBACK;

-- D. anon INSERT 차단 확인 — feedback (RLS block 기대: 0 rows returned or error)
-- BEGIN;
-- SET LOCAL ROLE anon;
-- INSERT INTO public.feedback (message, locale)
--   VALUES ('rls-test', 'ko')
--   RETURNING id;  -- 기대: 0 rows (RLS 차단)
-- RESET ROLE;
-- ROLLBACK;

-- E. anon INSERT 확인 — premium_waitlist (성공 기대, ROLLBACK으로 row 안 남김)
-- BEGIN;
-- SET LOCAL ROLE anon;
-- INSERT INTO public.premium_waitlist (email, locale, source)
--   VALUES ('rls-test-' || gen_random_uuid()::text || '@verify.local', 'ko', 'pricing')
--   ON CONFLICT (email) DO NOTHING
--   RETURNING id, email;  -- 기대: 1 row
-- RESET ROLE;
-- ROLLBACK;

-- F. anon UPDATE 차단 확인 — premium_waitlist (RLS block 기대)
-- BEGIN;
-- SET LOCAL ROLE anon;
-- UPDATE public.premium_waitlist SET locale = 'en' WHERE true;  -- 기대: 0 rows updated
-- RESET ROLE;
-- ROLLBACK;
