-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260601_feedback_table.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: 사용자 피드백 시스템 — FAB(💭 한 마디) → Dialog → Edge Function
--       (submit-feedback) → 이 테이블 INSERT → /admin/feedback 페이지 조회.
--
-- 사용처:
--   - src/components/feedback/FeedbackDialog.tsx 제출 흐름
--   - supabase/functions/submit-feedback/index.ts (IP·country 헤더 추출 후 INSERT)
--   - src/pages/admin/FeedbackPage.tsx (목록·검색·CSV export)
--
-- RLS: 비활성 (사용자 결정 2026-06-01 — 민감 정보 적음, 운영 단순화 우선)
--      Edge Function이 service_role로 INSERT, admin 페이지가 anon 클라이언트로
--      SELECT. RLS 없어도 client → DB 직접 접근 막혀 있고 service_role은 우회.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  email text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address text,
  country text,
  user_agent text,
  page_url text,
  locale text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON public.feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id
  ON public.feedback (user_id);

-- RLS 비활성 (사용자 결정 2026-06-01)
ALTER TABLE public.feedback DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.feedback IS
  '사용자 피드백 — FAB Dialog → submit-feedback Edge Function 경유. RLS off 결정.';
COMMENT ON COLUMN public.feedback.message IS '본문 (5~500자 클라이언트 검증).';
COMMENT ON COLUMN public.feedback.email IS '답변용 이메일 (선택).';
COMMENT ON COLUMN public.feedback.ip_address IS
  'Edge Function이 cf-connecting-ip 또는 x-forwarded-for에서 추출.';
COMMENT ON COLUMN public.feedback.country IS
  'Edge Function이 cf-ipcountry 또는 x-vercel-ip-country에서 추출.';
