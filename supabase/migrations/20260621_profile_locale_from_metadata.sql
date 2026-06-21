-- 20260621_profile_locale_from_metadata
--
-- 목적: 신규 가입자 profiles.locale이 클라 감지값(navigator.language)을 반영하도록 정정.
--
-- 배경:
--   - 어드민 화면에서 첫 가입자 profiles.locale='ko'로 라벨링 → 영어권 광고 타겟 신호 오염.
--   - 클라(AuthModal) 가입 흐름은 locale을 user_metadata에 전송하지 않았고,
--     트리거 handle_new_user_profile은 locale 컬럼을 명시 INSERT 하지 않음.
--   - 결과적으로 운영 DB의 profiles.locale 컬럼 DEFAULT(추정 'ko')가 모든 신규 가입에 적용됨.
--
-- 처리:
--   1. 컬럼 DEFAULT를 'en'으로 안전 폴백 변경 (영어권 사용자 다수, 한국어는 명시 전송으로 정확 반영).
--   2. 트리거가 raw_user_meta_data->>'locale'을 읽어 INSERT 컬럼에 포함.
--      ON CONFLICT DO UPDATE 분기에서도 locale 동기화 — 최초 동의 시점에만 정정(WHERE tos_agreed_at IS NULL 가드 유지).
--
-- 클라 매핑:
--   - AuthModal Magic Link 가입: signInWithOtp.options.data.locale = detectLocale()
--   - Google OAuth: noteflex_consent localStorage + AuthCallback UPDATE에서 locale 포함
--   - Fresh Start: 동일
--
-- 가드:
--   - 한국어 사용자(navigator.language='ko-*')는 detectLocale → 'ko' 반환되어 정확 저장.
--   - metadata 누락 시 'en' 폴백 (운영 drift 안전망).
--   - 기존 행은 손대지 않음 (사용자가 ProfilePage에서 명시 변경한 값 보존).

ALTER TABLE public.profiles
  ALTER COLUMN locale SET DEFAULT 'en';

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
    marketing_agreed_at,
    locale
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
    (NEW.raw_user_meta_data->>'marketing_agreed_at')::timestamptz,
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en')
  )
  ON CONFLICT (id) DO UPDATE SET
    tos_agreed_at       = EXCLUDED.tos_agreed_at,
    privacy_agreed_at   = EXCLUDED.privacy_agreed_at,
    marketing_agreed_at = EXCLUDED.marketing_agreed_at,
    locale              = COALESCE(EXCLUDED.locale, public.profiles.locale),
    profile_completed   = true
  WHERE public.profiles.tos_agreed_at IS NULL;

  RETURN NEW;
END;
$$;
