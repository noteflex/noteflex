-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260514_fresh_start.sql
-- Sprint 2: "새로 시작" — 소프트-삭제 계정 프로필 영구 삭제
-- ═══════════════════════════════════════════════════════════════
--
-- 사용 흐름:
--   1. 비인증 사용자가 soft-delete 상태 이메일로 재가입 시도
--   2. AuthModal recovery panel에서 "새로 시작" 선택
--   3. 이 함수로 profiles row 삭제
--   4. signInWithOtp(shouldCreateUser: false) → 기존 auth user로 인증
--   5. AuthCallback → 프로필 없음 → 앱이 신규 프로필 생성 (온보딩)
--
-- 보안 제약:
--   - is_deleted = true 인 계정만 삭제 가능 (활성 계정 보호)
--   - auth.users 삭제는 서비스롤 배치(hard_delete_expired_accounts)에 위임

CREATE OR REPLACE FUNCTION public.hard_delete_account(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  -- soft-delete 상태인 계정의 user ID만 대상으로 함
  SELECT u.id INTO v_uid
  FROM   auth.users u
  JOIN   public.profiles p ON p.id = u.id
  WHERE  lower(trim(u.email)) = lower(trim(p_email))
    AND  p.is_deleted = true
  LIMIT  1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Account not found or not eligible for deletion';
  END IF;

  DELETE FROM public.profiles WHERE id = v_uid;
END;
$$;

-- 비인증 사용자(가입 흐름 중)가 호출하므로 anon 허용
GRANT EXECUTE ON FUNCTION public.hard_delete_account(TEXT) TO anon;
