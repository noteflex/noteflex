-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260513_account_recovery.sql
-- Sprint 2 C1: 30일 이내 soft-delete 계정 복구 UX
-- ═══════════════════════════════════════════════════════════════

-- ── 1. check_email_exists v3 — 4가지 계정 상태 반환 ──────────────
-- 반환 타입 변경으로 DROP 후 재생성 필요
-- v2: TABLE(user_exists BOOLEAN, is_confirmed BOOLEAN)
-- v3: TABLE(account_status TEXT, recovery_days_left INT)
--   'new'                → 미가입 또는 미인증 (가입 진행)
--   'active'             → 정상 활성 계정 (로그인 CTA)
--   'deleted_recoverable'→ 탈퇴 30일 이내 (복구 가능)
--   'deleted_expired'    → 탈퇴 30일 경과 (복구 불가)

DROP FUNCTION IF EXISTS public.check_email_exists(TEXT);

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS TABLE(account_status TEXT, recovery_days_left INT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid        UUID;
  v_confirmed  BOOLEAN;
  v_is_deleted BOOLEAN;
  v_deleted_at TIMESTAMPTZ;
  v_days_left  INT;
BEGIN
  SELECT u.id,
         (u.email_confirmed_at IS NOT NULL),
         p.is_deleted,
         p.deleted_at
  INTO   v_uid, v_confirmed, v_is_deleted, v_deleted_at
  FROM   auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE  u.email = lower(trim(p_email))
  LIMIT  1;

  -- 미가입 또는 미인증 → 신규 가입 허용
  IF v_uid IS NULL OR NOT v_confirmed THEN
    RETURN QUERY SELECT 'new'::TEXT, NULL::INT;
    RETURN;
  END IF;

  -- soft-delete 계정 확인
  IF v_is_deleted = true AND v_deleted_at IS NOT NULL THEN
    v_days_left := 30 - (EXTRACT(EPOCH FROM (NOW() - v_deleted_at)) / 86400)::INT;
    IF v_days_left > 0 THEN
      RETURN QUERY SELECT 'deleted_recoverable'::TEXT, v_days_left;
    ELSE
      RETURN QUERY SELECT 'deleted_expired'::TEXT, 0::INT;
    END IF;
    RETURN;
  END IF;

  -- 정상 활성 계정
  RETURN QUERY SELECT 'active'::TEXT, NULL::INT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon, authenticated;

-- ── 2. restore_account() — 인증된 사용자(magic link 클릭 후) 복구 ─

CREATE OR REPLACE FUNCTION public.restore_account()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.profiles SET
    is_deleted      = false,
    deleted_at      = NULL,
    deletion_reason = NULL,
    email           = v_email
  WHERE id = auth.uid()
    AND is_deleted = true
    AND deleted_at > NOW() - INTERVAL '30 days';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not recoverable: not found or recovery window expired';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_account() TO authenticated;

-- ── 3. hard_delete_expired_accounts() — 서비스 롤 배치 작업용 ─────
-- 실제 auth.users 삭제는 서비스 롤 Edge Function에서 이 함수로
-- 대상 목록을 받아 admin.deleteUser() 호출

CREATE OR REPLACE FUNCTION public.hard_delete_expired_accounts()
RETURNS TABLE(expired_user_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id
  FROM   public.profiles p
  WHERE  p.is_deleted = true
    AND  p.deleted_at <= NOW() - INTERVAL '30 days';
END;
$$;

-- service_role 전용
REVOKE EXECUTE ON FUNCTION public.hard_delete_expired_accounts() FROM anon, authenticated;
