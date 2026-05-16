-- ════════════════════════════════════════════════════════════════
-- Migration: 20260518_device_change_events_update_policy.sql
-- ════════════════════════════════════════════════════════════════
-- 목적: `device_change_events` 영역 UPDATE 정책 영역 누락 영역 박음.
--      `src/lib/userEnvironmentOffset.ts:135` 영역 박은 영역 silent fail 영역 박힘 영역 박음 영역.
--
-- 배경 (Phase 1 Session 2 발견):
--   - 20260503_add_device_change_events.sql 영역 박힘 영역 SELECT + INSERT 영역만 박힘
--   - 20260510_rls_audit.sql 영역 박힘 영역 동일 영역 (UPDATE 영역 정책 영역 없음)
--   - 코드 영역 박힘 영역 `userEnvironmentOffset.ts:135` 영역 영역
--     `supabase.from("device_change_events").update({ new_offset_ms })` 영역 박음 영역
--   - UPDATE 정책 영역 없음 영역 박음 영역 영역 silent 영역 0 행 영역 영역 영역 실패 영역 박음 영역
--     사용자 영역 알림 영역 박지 X 박힘 영역.
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor 영역 박음.
-- ════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS device_change_events_update_own
  ON public.device_change_events;

CREATE POLICY device_change_events_update_own
  ON public.device_change_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 검증 영역 ────────────────────────────────────────────────
-- SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename = 'device_change_events'
--   ORDER BY cmd, policyname;
-- ─── 박은 영역 박음 영역 검증 영역 ──────────────────────────────
-- 1. 인증 영역 사용자 영역 박은 영역:
--    UPDATE public.device_change_events
--      SET new_offset_ms = 100
--      WHERE id = '<event-id>' AND user_id = auth.uid();
-- 2. 결과 영역 = 1 row updated 박힘 영역 박음 영역 영역 (이전 영역 = 0 rows 영역).
-- ────────────────────────────────────────────────────────────
