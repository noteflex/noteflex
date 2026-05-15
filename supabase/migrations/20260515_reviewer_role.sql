-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260515_reviewer_role.sql
-- ═══════════════════════════════════════════════════════════════
-- Paddle 심사관 전용 reviewer 역할 + forpaddle@noteflex.app 계정.
--
-- 권한 정합:
--   - reviewer = Free tier (Lv1~5 Sub1 + 7회/일 한도)
--   - 게임 영역 박힘 (ComingSoonGate 우회)
--   - 광고 박힘 (일반 사용자 영역 정합)
--   - Premium 영역 X (admin과 분리)
--
-- 인증 흐름: 매직링크 우회, /api/reviewer-login 통해 즉시 세션 발급.
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 실행.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. profiles.role CHECK 제약 추가 ─────────────────────────
-- 기존: 제약 없음 (NULL 또는 'admin' 박힘)
-- 신규: NULL OR 'user' OR 'admin' OR 'reviewer'
-- NULL 허용 = 기존 일반 사용자 데이터 그대로 박힘.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IS NULL OR role IN ('user', 'admin', 'reviewer'));

-- ─── 2. is_reviewer() 헬퍼 함수 ──────────────────────────────
-- is_admin()과 동일 패턴. SECURITY DEFINER로 호출자 RLS 우회.

CREATE OR REPLACE FUNCTION public.is_reviewer()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $func$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'reviewer'
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.is_reviewer() TO authenticated;

-- ─── 3. forpaddle@noteflex.app 계정 생성 ──────────────────────
-- auth.users 직접 insert (email_confirmed_at 채워 인증 완료 상태).
-- 비밀번호 = 사용 안 함 (매직링크 우회 흐름이라 의미 없음).
-- handle_new_user_profile trigger가 profiles 행 자동 생성.
-- 그 후 role='reviewer', nickname='PaddleReviewer' UPDATE.

DO $$
DECLARE
  v_user_id UUID;
  v_existing_id UUID;
BEGIN
  -- 이미 존재하는지 확인 (재실행 안전)
  SELECT id INTO v_existing_id
  FROM auth.users
  WHERE email = 'forpaddle@noteflex.app';

  IF v_existing_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'forpaddle@noteflex.app',
      crypt('reviewer-no-password-magic-link-only-' || gen_random_uuid()::text, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'tos_agreed_at', now()::text,
        'privacy_agreed_at', now()::text,
        'marketing_agreed_at', NULL
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- trigger handle_new_user_profile가 profiles 행 생성.
    -- 그 후 reviewer 정보로 갱신.
    UPDATE public.profiles
    SET
      role = 'reviewer',
      nickname = 'paddle_reviewer',
      profile_completed = true,
      tos_agreed_at = COALESCE(tos_agreed_at, now()),
      privacy_agreed_at = COALESCE(privacy_agreed_at, now())
    WHERE id = v_user_id;

    RAISE NOTICE 'Created reviewer account: forpaddle@noteflex.app (id=%)', v_user_id;
  ELSE
    -- 이미 존재 → role만 정합 보장
    UPDATE public.profiles
    SET
      role = 'reviewer',
      nickname = COALESCE(nickname, 'paddle_reviewer'),
      profile_completed = true
    WHERE id = v_existing_id;

    RAISE NOTICE 'Reviewer account already exists, refreshed role: %', v_existing_id;
  END IF;
END $$;

-- ─── 4. RLS 정합 확인 ───────────────────────────────────────
-- reviewer는 일반 user와 동일 권한 (RLS 정책 추가 X).
-- "Users can view own profile" 등 기존 정책이 reviewer에도 그대로 적용.
-- admin 전용 정책 (is_admin())는 reviewer 미적용 — 격리됨.

-- ─── 5. 검증 쿼리 (수동 실행용 주석) ─────────────────────────
-- SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'forpaddle@noteflex.app';
-- SELECT id, role, nickname, profile_completed FROM public.profiles WHERE role = 'reviewer';
-- SELECT public.is_reviewer();  -- (reviewer 로그인 후 실행 시 true 박힘)
