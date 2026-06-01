-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260602_feedback_rls_grants.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: feedback 테이블 RLS 비활성 + 정상 role grants 부여.
--
-- 배경 (2026-06-01):
--   초기 마이그레이션 20260601_feedback_table.sql가 ALTER TABLE ... DISABLE ROW
--   LEVEL SECURITY는 명시했으나 GRANT 명시 X. Supabase 신규 테이블 기본값은:
--     - RLS ENABLE (자동 활성, IF NOT EXISTS로 만들어도 동일)
--     - GRANT 없음 (anon·authenticated 모두 SELECT/INSERT 권한 X)
--   결과: /admin/feedback 페이지에서 authenticated JWT로 SELECT 호출 시 0 rows
--   응답 (RLS off + grant 없으면 PostgREST가 빈 결과 반환). 즉 RLS 정책뿐 아니라
--   role grants를 함께 명시해야 신규 테이블이 제대로 조회됨.
--
--   2026-06-01 hot fix로 prod에 다음 SQL을 SQL Editor에서 수동 실행:
--     ALTER TABLE public.feedback DISABLE ROW LEVEL SECURITY;
--     GRANT ALL ON public.feedback TO anon, authenticated;
--
--   이 파일은 prod 적용 사실을 마이그레이션 history에 기록 + dev/staging
--   환경에 동일 상태를 재현하기 위한 idempotent 마이그레이션. IF EXISTS·
--   DROP IF·CREATE OR REPLACE 패턴이라 prod에 다시 실행해도 안전.
--
-- 후속 정책: docs/db/MIGRATION_PATTERN.md — Supabase 신규 테이블 마이그레이션
-- 표준 템플릿에 RLS·GRANT 명시 필수 항목 등재.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- RLS 비활성 (이미 비활성이라면 no-op)
ALTER TABLE public.feedback DISABLE ROW LEVEL SECURITY;

-- 권한 부여 (이미 부여돼 있어도 no-op)
-- INSERT는 Edge Function이 service_role로 수행하므로 anon·authenticated에는
-- 필요 X지만, 추후 RLS 활성 + 정책 도입 시 발판으로 ALL 부여. RLS off 상태에서는
-- GRANT가 직접 권한 통제.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO anon, authenticated;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 SQL (수동 실행 권장 — 위 BEGIN/COMMIT 이후 별도)
-- ═══════════════════════════════════════════════════════════════

-- A. RLS 상태 확인 (relrowsecurity = f 기대)
-- SELECT relname, relrowsecurity
--   FROM pg_class
--   WHERE relname = 'feedback' AND relnamespace = 'public'::regnamespace;

-- B. role별 권한 확인 (anon·authenticated 둘 다 SELECT 보유 기대)
-- SELECT grantee, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public' AND table_name = 'feedback'
--   ORDER BY grantee, privilege_type;
