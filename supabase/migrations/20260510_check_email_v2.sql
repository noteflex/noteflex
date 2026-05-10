-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260510_check_email_v2.sql
-- ═══════════════════════════════════════════════════════════════
-- check_email_exists v2 — 미인증 사용자 분기 지원
--
-- v1: profiles.email 기반 boolean (미인증/인증 구분 불가)
-- v2: auth.users 기반 (user_exists, is_confirmed) 반환
--
-- 분기:
--   email_confirmed_at IS NULL     → 미인증 = 차단 X, OTP 재전송
--   email_confirmed_at IS NOT NULL → 인증 완료 = 차단 + 로그인 CTA
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- v1 삭제 (반환 타입 변경 → CREATE OR REPLACE 불가)
DROP FUNCTION IF EXISTS public.check_email_exists(TEXT);

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS TABLE(user_exists BOOLEAN, is_confirmed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXISTS(
      SELECT 1 FROM auth.users u
      WHERE u.email = lower(trim(p_email))
    ) AS user_exists,
    EXISTS(
      SELECT 1 FROM auth.users u
      WHERE u.email = lower(trim(p_email))
        AND u.email_confirmed_at IS NOT NULL
    ) AS is_confirmed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon, authenticated;
