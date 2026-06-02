-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260603_feedback_status.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: public.feedback 운영 확장 — 처리 상태(status) · 종료 시각(resolved_at)
--       · 내부 메모(admin_note) 컬럼 추가. /admin/feedback 페이지에서 사용.
--
-- 사용처:
--   - src/pages/admin/FeedbackPage.tsx — 상태 토글 · 메모 편집 · 통계 카드
--   - 답장(mailto:) 흐름은 컬럼 추가 X — 클라이언트에서 row.email + locale 만으로 생성
--
-- 컬럼 설계:
--   - status: 'open'(미처리) | 'in_progress'(진행중) | 'closed'(완료)
--     기본값 'open' — 신규 row 및 기존 backfill 자동 적용
--   - resolved_at: status='closed' 전환 시 클라이언트가 now() set (트리거 X 단순화)
--   - admin_note: 운영자 내부 메모 (이용자 비노출)
--
-- INDEX: (status, created_at DESC) — 미처리 목록 + 최신순 정렬 빠른 조회.
--
-- RLS: off 유지 (feedback 테이블 정책 그대로 — 20260601_feedback_table.sql 결정).
-- GRANT 재명시 (MIGRATION_PATTERN.md §5 체크리스트).
-- NOTIFY pgrst: PostgREST schema cache 즉시 갱신 (premium_waitlist 사례 4 학습).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── 컬럼 추가 (idempotent — IF NOT EXISTS) ─────────────────────
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL;

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS admin_note TEXT NULL;

-- ─── CHECK constraint ─────────────────────────────────────────
-- 이미 존재하면 DROP 후 재생성 (값 갱신 대응).
ALTER TABLE public.feedback
  DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('open', 'in_progress', 'closed'));

-- ─── INDEX ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedback_status_created_at
  ON public.feedback (status, created_at DESC);

-- ─── COMMENTS ─────────────────────────────────────────────────
COMMENT ON COLUMN public.feedback.status IS
  '처리 상태 — open(미처리) · in_progress(진행중) · closed(완료). admin/feedback 토글.';
COMMENT ON COLUMN public.feedback.resolved_at IS
  'status=closed 전환 시각. 클라이언트가 now() set (트리거 X).';
COMMENT ON COLUMN public.feedback.admin_note IS
  '운영자 내부 메모. 이용자 비노출. /admin/feedback 상세 모달에서 편집.';

-- ─── GRANT 재명시 (feedback 테이블 표준 패턴) ──────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO anon, authenticated;

-- ─── PostgREST schema cache reload ────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- 검증 SQL (수동 실행 권장)
-- ═══════════════════════════════════════════════════════════════

-- A. 컬럼 확인
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'feedback'
--     AND column_name IN ('status', 'resolved_at', 'admin_note')
--   ORDER BY column_name;

-- B. CHECK constraint 확인
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'public.feedback'::regclass
--     AND conname = 'feedback_status_check';

-- C. INDEX 확인
-- SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public' AND tablename = 'feedback'
--     AND indexname = 'idx_feedback_status_created_at';

-- D. 기존 row 'open' backfill 확인
-- SELECT status, COUNT(*) FROM public.feedback GROUP BY status;
