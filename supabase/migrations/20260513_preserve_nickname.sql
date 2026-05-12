-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260513_preserve_nickname.sql
-- Sprint 2 C2: 탈퇴 시 닉네임·아바타 보존 + 부분 유니크 인덱스
-- ═══════════════════════════════════════════════════════════════

-- ── 1. request_account_deletion 수정 ─────────────────────────
-- 이메일만 마스킹; 닉네임·display_name·avatar_url 보존
-- → restore_account() 복구 시 프로필이 온전히 되돌아옴

CREATE OR REPLACE FUNCTION public.request_account_deletion(reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE public.profiles SET
    deleted_at      = NOW(),
    is_deleted      = true,
    deletion_reason = reason,
    -- 이메일만 GDPR/PIPA 마스킹 (닉네임·아바타는 복구를 위해 보존)
    email           = 'deleted_' || id::text || '@deleted.local'
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_account_deletion(TEXT) TO authenticated;

-- ── 2. 닉네임 부분 유니크 인덱스 ────────────────────────────
-- 활성 계정(is_deleted = false)끼리만 닉네임 충돌 방지
-- 탈퇴 계정 닉네임은 인덱스 대상에서 제외 → 동일 닉네임 신규 가입 가능
-- 기존 유니크 인덱스가 있으면 먼저 제거

DROP INDEX IF EXISTS public.profiles_nickname_unique;
DROP INDEX IF EXISTS public.profiles_nickname_key;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_active_unique
  ON public.profiles (lower(nickname))
  WHERE is_deleted = false AND nickname IS NOT NULL;
