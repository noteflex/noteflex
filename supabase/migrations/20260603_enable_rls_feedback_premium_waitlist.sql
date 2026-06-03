-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260603_enable_rls_feedback_premium_waitlist.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: feedback·premium_waitlist 두 테이블 RLS 보안 정상화.
--       anon 키로 전체 행 읽기 가능한 상태 해소.
--
-- 1단계 확인 결과 요약:
--   feedback:
--     - 현재 RLS OFF + GRANT ALL TO anon, authenticated
--     - INSERT: submit-feedback Edge Function(service_role)이 수행 → RLS 우회
--     - Admin UI: FeedbackPage.tsx → authenticated JWT로 SELECT·UPDATE
--     - 위험: anon 키로 SELECT * 전체 조회 가능 (이메일 등 노출)
--
--   premium_waitlist:
--     - RLS OFF (20260603_premium_waitlist_rls_enable.sql 미적용 or 재비활성)
--     - INSERT: Pricing.tsx → supabase.upsert() → anon or authenticated 직접 호출
--     - UPSERT 호환성: ON CONFLICT DO UPDATE 단계에 anon UPDATE 정책 필요
--
-- 적용 후 동작:
--   feedback:
--     - anon: INSERT 가능(Edge Function용 safety net), SELECT·UPDATE·DELETE 차단
--     - authenticated 일반: INSERT 가능, SELECT·UPDATE 차단
--     - authenticated admin: SELECT·UPDATE·DELETE 전체 가능
--   premium_waitlist:
--     - anon: INSERT + UPSERT(UPDATE) 가능, SELECT 차단
--     - authenticated 일반: INSERT + UPSERT(UPDATE) 가능, SELECT 차단
--     - authenticated admin: 전체 가능
--
-- ⚠️ anon UPDATE 정책 (premium_waitlist_update_all) 포함 이유:
--   Pricing.tsx가 ON CONFLICT DO UPDATE UPSERT를 사용. anon UPDATE 정책 없으면
--   중복 이메일 제출 시 RLS 오류 발생. 데이터(이메일·locale·source)는 민감도 낮음.
--   향후 Pricing.tsx를 INSERT ON CONFLICT DO NOTHING으로 변경 시 이 정책 삭제 가능.
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 본 파일 전체 실행.
--   적용 직후 수동 검증:
--   - (A) Pricing 다이얼로그 waitlist 제출 정상 확인
--   - (B) 피드백 FAB 제출 정상 확인
--   - (C) /admin/feedback 조회·상태 변경 정상 확인
--   - (D) anon SELECT 차단: 아래 검증 SQL 실행 확인
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 사전 조건: is_admin() EXECUTE 권한 보장 ──────────────────
-- 20260601_premium_waitlist_rls_restore.sql에서 추가됐으나 prod 적용 불확실.
-- 이미 부여된 경우 no-op.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 1. feedback 테이블
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- anon INSERT — submit-feedback Edge Function(service_role)이 실제 INSERT 수행.
-- service_role은 RLS 우회 → 이 정책은 클라이언트 직접 INSERT 시 safety net.
DROP POLICY IF EXISTS "feedback_anon_insert" ON public.feedback;
CREATE POLICY "feedback_anon_insert" ON public.feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

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

-- anon INSERT — Pricing.tsx 비로그인 waitlist 등록
DROP POLICY IF EXISTS "premium_waitlist_insert_all" ON public.premium_waitlist;
CREATE POLICY "premium_waitlist_insert_all" ON public.premium_waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- anon UPDATE — Pricing.tsx upsert(onConflict:"email")의 ON CONFLICT DO UPDATE 단계 허용.
-- 스펙 소폭 이탈 주의: anon이 임의 row UPDATE 가능 (데이터 민감도 낮음).
-- Pricing.tsx를 ON CONFLICT DO NOTHING으로 변경 후 이 정책 삭제 권장.
DROP POLICY IF EXISTS "premium_waitlist_update_all" ON public.premium_waitlist;
CREATE POLICY "premium_waitlist_update_all" ON public.premium_waitlist
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- admin ALL — 기존 admin_select(SELECT 전용) 대체.
-- WaitlistPage.tsx의 SELECT + 향후 UPDATE/DELETE 포함.
DROP POLICY IF EXISTS "premium_waitlist_admin_select" ON public.premium_waitlist;
DROP POLICY IF EXISTS "premium_waitlist_admin_all" ON public.premium_waitlist;
CREATE POLICY "premium_waitlist_admin_all" ON public.premium_waitlist
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- PostgREST schema cache 즉시 갱신 (20260603_premium_waitlist_rls_enable.sql 학습 적용)
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

-- B. 정책 확인
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

-- D. anon INSERT 확인 — feedback (성공 기대, ROLLBACK으로 row 안 남김)
-- BEGIN;
-- SET LOCAL ROLE anon;
-- INSERT INTO public.feedback (message, locale)
--   VALUES ('rls-test', 'ko')
--   RETURNING id;
-- RESET ROLE;
-- ROLLBACK;

-- E. anon INSERT 확인 — premium_waitlist UPSERT (성공 기대)
-- BEGIN;
-- SET LOCAL ROLE anon;
-- INSERT INTO public.premium_waitlist (email, locale, source)
--   VALUES ('rls-test-' || gen_random_uuid()::text || '@verify.local', 'ko', 'pricing')
--   ON CONFLICT (email) DO UPDATE SET updated_at = now()
--   RETURNING id, email;
-- RESET ROLE;
-- ROLLBACK;
