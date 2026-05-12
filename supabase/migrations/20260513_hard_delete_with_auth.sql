-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260513_hard_delete_with_auth.sql
-- "새로 시작": profiles + auth.users 모두 삭제 → 진짜 신규 가입
--
-- 이전 버전 문제:
--   - profiles만 삭제 → auth.users 그대로 남음
--   - 재가입 시 옛 user_id로 인증 → INSERT INTO auth.users 없음
--   - on_auth_user_created_profile 트리거 미작동 → profiles 신규 생성 X
--
-- 이번 버전:
--   - profiles 삭제 후 auth.users도 삭제
--   - auth.identities·sessions·refresh_tokens 등 FK CASCADE로 자동 정리
--   - 재가입 시 새 user_id INSERT → 트리거 정상 작동 → 신규 profiles 생성
-- ═══════════════════════════════════════════════════════════════

-- 이전 이메일 인수 버전 교체 (search_path에 auth 추가)
DROP FUNCTION IF EXISTS public.hard_delete_account(TEXT);

CREATE OR REPLACE FUNCTION public.hard_delete_account(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 이메일로 user_id 조회
  SELECT id INTO v_user_id
  FROM   auth.users
  WHERE  email = p_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- 안전장치: 30일 이내 soft-delete 계정만 허용 (활성/만료 계정 보호)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE  id         = v_user_id
      AND  is_deleted = true
      AND  deleted_at > NOW() - INTERVAL '30 days'
  ) THEN
    RAISE EXCEPTION 'Account not eligible for hard delete';
  END IF;

  -- profiles 먼저 삭제 (public FK 정합)
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- auth.users 삭제 → auth.identities·sessions·refresh_tokens 등 CASCADE
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- 비인증(가입 흐름 중) + 인증 사용자 모두 허용
GRANT EXECUTE ON FUNCTION public.hard_delete_account(TEXT) TO anon, authenticated;
