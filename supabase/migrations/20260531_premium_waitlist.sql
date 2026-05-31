-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260531_premium_waitlist.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: 가오픈(5/31) — Paddle 심사 통과 전 결제 잠금. 사용자가 Premium 구독 의사
--       표시 시 이메일 수집(opening notice waitlist). 심사 통과 후 일괄 이메일 발송.
--
-- 사용처: src/pages/Pricing.tsx 결제 다이얼로그 (monthly/yearly 시도 시).
--
-- RLS:
--   - INSERT: 모두 허용 (anon 가능 — 비로그인 사용자도 가입 가능)
--   - SELECT: admin role만 (is_admin())
--   - UPDATE/DELETE: 정책 없음 (admin이 supabase 콘솔로 직접 처리)
--
-- 중복:
--   - email UNIQUE 제약 → 같은 이메일 재가입 시 ON CONFLICT DO UPDATE로 locale·source 갱신.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.premium_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  locale text NOT NULL DEFAULT 'ko',
  source text NOT NULL DEFAULT 'pricing',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT premium_waitlist_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_premium_waitlist_created_at
  ON public.premium_waitlist (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_premium_waitlist_source
  ON public.premium_waitlist (source);

-- RLS 활성
ALTER TABLE public.premium_waitlist ENABLE ROW LEVEL SECURITY;

-- INSERT 정책: 모두 허용 (anon + authenticated)
DROP POLICY IF EXISTS premium_waitlist_insert_all ON public.premium_waitlist;
CREATE POLICY premium_waitlist_insert_all
  ON public.premium_waitlist
  FOR INSERT
  WITH CHECK (true);

-- UPDATE 정책: 모두 허용 (UPSERT의 ON CONFLICT DO UPDATE 동작 위해 필요)
DROP POLICY IF EXISTS premium_waitlist_update_all ON public.premium_waitlist;
CREATE POLICY premium_waitlist_update_all
  ON public.premium_waitlist
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- SELECT 정책: admin만
DROP POLICY IF EXISTS premium_waitlist_admin_select ON public.premium_waitlist;
CREATE POLICY premium_waitlist_admin_select
  ON public.premium_waitlist
  FOR SELECT
  USING (public.is_admin());

COMMENT ON TABLE public.premium_waitlist IS
  '가오픈(5/31) Premium 결제 잠금 기간 이메일 수집 waitlist. anon insert + admin select.';
COMMENT ON COLUMN public.premium_waitlist.source IS
  '가입 출처. 현재 "pricing"만 사용. 향후 다른 진입점 추가 시 구분.';
COMMENT ON COLUMN public.premium_waitlist.locale IS
  '사용자 언어 (ko/en). 향후 일괄 이메일 발송 시 언어별 템플릿 선택용.';
