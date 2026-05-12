-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260513_hard_delete_by_email.sql
-- Production fix: hard_delete_account() (no-args, auth.uid() 방식) →
--                 hard_delete_account(p_email TEXT) (비인증 호출 허용)
--
-- "새로 시작" 시점 = 로그인 안 된 상태라 auth.uid() X, 이메일로 식별 필요.
-- 기존 no-args 버전 DROP 후 이메일 인수 버전으로 교체.
-- ═══════════════════════════════════════════════════════════════

-- 기존 인수 없는 버전 제거 (schema cache 충돌 방지)
DROP FUNCTION IF EXISTS public.hard_delete_account();

CREATE OR REPLACE FUNCTION public.hard_delete_account(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 이메일로 auth.users에서 user_id 조회
  SELECT id INTO v_user_id
  FROM   auth.users
  WHERE  email = lower(trim(p_email));

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

  -- profiles row 삭제 (이후 앱이 신규 프로필 생성 → 온보딩으로 분기)
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- auth.users 삭제는 서비스롤 배치(hard_delete_expired_accounts)에 위임
  -- TODO: 출시 후 auth.users hard delete cron 추가
END;
$$;

-- 비인증(가입 흐름 중) + 인증 사용자 모두 허용
GRANT EXECUTE ON FUNCTION public.hard_delete_account(TEXT) TO anon, authenticated;
