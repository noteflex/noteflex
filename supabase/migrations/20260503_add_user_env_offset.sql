-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260503_add_user_env_offset.sql
-- ═══════════════════════════════════════════════════════════════
-- §7.3.2 calibration offset 컬럼 추가
-- NULL = calibration 미수행, number = calibration 완료 (0 포함)
--
-- ⚠️  이 마이그레이션은 Supabase Dashboard > SQL Editor에서 실행.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_env_offset_ms INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.profiles.user_env_offset_ms IS
  'Audio environment calibration offset (ms). NULL = not calibrated. 0 = calibrated, no offset needed.';
