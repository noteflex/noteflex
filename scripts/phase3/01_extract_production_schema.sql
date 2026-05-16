-- ════════════════════════════════════════════════════════════════
-- Phase 3 Step 1 — Production schema 추출 영역 SQL
-- ════════════════════════════════════════════════════════════════
-- 박는 영역: Supabase Dashboard > SQL Editor
-- 박는 시점: 2026-05-17
-- 박는 목적: Production 영역에 박혀있지만 supabase/migrations/ 영역에 없는 영역
--           테이블·함수·트리거 영역을 마이그 영역 재현 영역 박은 영역 정확 영역 schema 영역 추출 영역.
--
-- 박는 방법:
--   1. 이 파일 영역 각 섹션 영역 통째로 SQL Editor 영역 박음
--   2. 결과 영역 박음 영역 Claude 영역 짚어줌
--   3. Claude 영역 박음 영역 마이그 영역 영역 박은 영역 정확 영역 schema 영역 박음
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- A. 8개 테이블 영역 컬럼 정의 영역 박음
-- ════════════════════════════════════════════════════════════════
-- 박는 영역: 컬럼명·타입·default·nullable·PK 영역 박음
-- ════════════════════════════════════════════════════════════════

SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  c.is_nullable,
  c.column_default,
  c.ordinal_position,
  CASE
    WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'PK'
    ELSE NULL
  END AS is_pk
FROM information_schema.columns c
LEFT JOIN information_schema.key_column_usage kcu
  ON kcu.table_schema = c.table_schema
  AND kcu.table_name = c.table_name
  AND kcu.column_name = c.column_name
LEFT JOIN information_schema.table_constraints tc
  ON tc.constraint_name = kcu.constraint_name
  AND tc.constraint_type = 'PRIMARY KEY'
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'user_sessions',
    'user_stats_daily',
    'note_mastery',
    'leagues',
    'league_members',
    'admin_actions',
    'daily_batch_runs',
    'user_streaks',
    'subscriptions'
  )
ORDER BY c.table_name, c.ordinal_position;


-- ════════════════════════════════════════════════════════════════
-- B. 8개 테이블 영역 인덱스 정의 영역 박음
-- ════════════════════════════════════════════════════════════════
-- 박는 영역: 인덱스명·인덱스 정의 (CREATE INDEX 문 영역 그대로 박힘 영역)
-- ════════════════════════════════════════════════════════════════

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'user_sessions',
    'user_stats_daily',
    'note_mastery',
    'leagues',
    'league_members',
    'admin_actions',
    'daily_batch_runs',
    'user_streaks',
    'subscriptions'
  )
ORDER BY tablename, indexname;


-- ════════════════════════════════════════════════════════════════
-- C. 8개 테이블 영역 외래 키 영역 박음
-- ════════════════════════════════════════════════════════════════
-- 박는 영역: FK 컬럼 → 참조 영역 테이블·컬럼 + ON DELETE/UPDATE 영역
-- ════════════════════════════════════════════════════════════════

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  rc.update_rule,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
  AND kcu.table_schema = tc.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
  AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'user_sessions',
    'user_stats_daily',
    'note_mastery',
    'leagues',
    'league_members',
    'admin_actions',
    'daily_batch_runs',
    'user_streaks',
    'subscriptions'
  )
ORDER BY tc.table_name, kcu.column_name;


-- ════════════════════════════════════════════════════════════════
-- D. 8개 테이블 영역 CHECK 제약 영역 박음
-- ════════════════════════════════════════════════════════════════

SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON cc.constraint_name = tc.constraint_name
  AND cc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'user_sessions',
    'user_stats_daily',
    'note_mastery',
    'leagues',
    'league_members',
    'admin_actions',
    'daily_batch_runs',
    'user_streaks',
    'subscriptions'
  )
ORDER BY tc.table_name, tc.constraint_name;


-- ════════════════════════════════════════════════════════════════
-- E. 8개 테이블 영역 UNIQUE 제약 영역 박음
-- ════════════════════════════════════════════════════════════════

SELECT
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
  AND kcu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'user_sessions',
    'user_stats_daily',
    'note_mastery',
    'leagues',
    'league_members',
    'admin_actions',
    'daily_batch_runs',
    'user_streaks',
    'subscriptions'
  )
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;


-- ════════════════════════════════════════════════════════════════
-- F. 8개 테이블 영역 RLS 활성화 영역 박음
-- ════════════════════════════════════════════════════════════════

SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = 'public'::regnamespace
  AND relname IN (
    'user_sessions',
    'user_stats_daily',
    'note_mastery',
    'leagues',
    'league_members',
    'admin_actions',
    'daily_batch_runs',
    'user_streaks',
    'subscriptions'
  )
ORDER BY relname;


-- ════════════════════════════════════════════════════════════════
-- G. 8개 테이블 영역 모든 RLS 정책 영역 박음
-- ════════════════════════════════════════════════════════════════
-- 박는 영역: CREATE POLICY 문 영역 재구성 영역 정보 영역
-- ════════════════════════════════════════════════════════════════

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,            -- SELECT / INSERT / UPDATE / DELETE / ALL
  permissive,     -- PERMISSIVE / RESTRICTIVE
  roles,          -- {public, authenticated, ...}
  qual,           -- USING 절 영역
  with_check      -- WITH CHECK 절 영역
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'user_sessions',
    'user_stats_daily',
    'note_mastery',
    'leagues',
    'league_members',
    'admin_actions',
    'daily_batch_runs',
    'user_streaks',
    'subscriptions'
  )
ORDER BY tablename, cmd, policyname;


-- ════════════════════════════════════════════════════════════════
-- H. handle_session_complete 함수 본문 영역 박음
-- ════════════════════════════════════════════════════════════════
-- 박는 영역: pg_get_functiondef 영역 박은 영역 전체 함수 정의 영역 박음
-- ════════════════════════════════════════════════════════════════

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS returns,
  l.lanname AS language,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname = 'handle_session_complete';


-- ════════════════════════════════════════════════════════════════
-- I. on_session_complete 트리거 정의 영역 박음
-- ════════════════════════════════════════════════════════════════
-- 박는 영역: CREATE TRIGGER 문 영역 재구성 영역 정보 영역
-- ════════════════════════════════════════════════════════════════

SELECT
  t.tgname AS trigger_name,
  c.relname AS table_name,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND t.tgname IN (
    'on_session_complete',
    'trg_update_profile_after_session'
  )
ORDER BY t.tgname;


-- ════════════════════════════════════════════════════════════════
-- J. check_nickname_available 함수 본문 영역 박음
-- ════════════════════════════════════════════════════════════════

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS returns,
  l.lanname AS language,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname = 'check_nickname_available';


-- ════════════════════════════════════════════════════════════════
-- K. record_sublevel_attempt 모든 버전 영역 박음 (dead 함수 확인 영역)
-- ════════════════════════════════════════════════════════════════
-- 박는 영역: 6개 인자 vs 7개 인자 버전 영역 정확한 시그니처 영역 박음
-- ════════════════════════════════════════════════════════════════

SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS returns,
  array_length(p.proargtypes, 1) AS arg_count,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'record_sublevel_attempt'
ORDER BY arg_count;


-- ════════════════════════════════════════════════════════════════
-- L. profiles 영역 실제 컬럼 영역 박음 (Session 1 Cursor 발견 영역 정정 영역)
-- ════════════════════════════════════════════════════════════════
-- 박는 영역: profiles 영역 실제 영역 박혀있는 컬럼 영역 vs 마이그 영역 정합 영역 검증 영역
-- ════════════════════════════════════════════════════════════════

SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;


-- ════════════════════════════════════════════════════════════════
-- M. note_mastery 영역 실제 컬럼 영역 박음 (Session 1 Cursor 발견 영역 정정 영역)
-- ════════════════════════════════════════════════════════════════

SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'note_mastery'
ORDER BY ordinal_position;


-- ════════════════════════════════════════════════════════════════
-- 끝 영역
-- ════════════════════════════════════════════════════════════════
-- 각 섹션 영역 결과 영역 박음 영역 → Claude 영역 짚어줌 → 마이그 영역 박힘 영역 박은 영역 정확 영역 schema 영역 박음
-- ════════════════════════════════════════════════════════════════
