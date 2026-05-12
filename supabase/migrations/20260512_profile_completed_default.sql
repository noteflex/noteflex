-- profile_completed default = true (drift 정정)
ALTER TABLE public.profiles
  ALTER COLUMN profile_completed SET DEFAULT true;

-- 닉네임이 있는 기존 사용자 중 profile_completed = false인 행 정정
UPDATE public.profiles
SET profile_completed = true
WHERE profile_completed = false
  AND nickname IS NOT NULL;

-- trigger 정정: nickname 자동 생성 + profile_completed = true 명시 + TOS 동의 시점 저장
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    nickname,
    profile_completed,
    tos_agreed_at,
    privacy_agreed_at,
    marketing_agreed_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    'user_' || substring(NEW.id::text, 1, 8),
    true,
    (NEW.raw_user_meta_data->>'tos_agreed_at')::timestamptz,
    (NEW.raw_user_meta_data->>'privacy_agreed_at')::timestamptz,
    (NEW.raw_user_meta_data->>'marketing_agreed_at')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE SET
    tos_agreed_at       = EXCLUDED.tos_agreed_at,
    privacy_agreed_at   = EXCLUDED.privacy_agreed_at,
    marketing_agreed_at = EXCLUDED.marketing_agreed_at,
    profile_completed   = true
  WHERE public.profiles.tos_agreed_at IS NULL;

  RETURN NEW;
END;
$$;
