-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260531_user_note_logs_sublevel.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: user_note_logs에 sublevel INT 컬럼 추가.
--       약점 점수 집계가 (user_id, level, sublevel, note_id) 단위로 변경됨에 따라
--       per-note 시도 로그에 sublevel 정보가 필요.
--
-- 변경 사항:
--   1. user_note_logs.sublevel INT NOT NULL DEFAULT 0 추가
--   2. COMMENT
--   3. 약점 점수 집계 쿼리용 복합 인덱스 추가
--
-- 호환성:
--   - 기존 행은 sublevel=0 (마이그레이션 이전 데이터, 분석 함수에서 sublevel > 0 필터로 제외)
--   - level=0(custom_score) 세션의 신규 로그도 sublevel=0 유지
--   - 신규 로그(클라이언트 5/31 이후): NoteGame이 sublevel 값(1~3)을 전달하므로 정상 채움
--
-- 클라이언트 변경 (3단계):
--   - src/lib/userNoteLogs.ts: UserNoteLogPayload에 sublevel 필드 추가
--   - src/hooks/useNoteLogger.ts: logNote 인자에 sublevel 추가
--   - src/components/NoteGame.tsx: logNote 호출 시 sublevel 전달
--
-- ⚠️ DB 적용은 사용자가 별도 진행 (Supabase SQL Editor).
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. 컬럼 추가 ──────────────────────────────────────────────
ALTER TABLE public.user_note_logs
  ADD COLUMN IF NOT EXISTS sublevel INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.user_note_logs.sublevel IS
  '게임 sublevel (1~3). level=0(custom_score) 세션 및 5/31 이전 row는 0 기본값. 약점 점수 집계 함수는 sublevel > 0 필터 적용.';


-- ─── 2. 약점 점수 집계용 복합 인덱스 ───────────────────────────
-- refresh_weak_scores() 함수가 (user_id, level, sublevel, note_key, octave, clef) 단위로
-- 30일 윈도우 집계 → 본 인덱스로 partial range scan 가능.
CREATE INDEX IF NOT EXISTS idx_note_logs_user_level_sublevel_created
  ON public.user_note_logs (user_id, level, sublevel, created_at DESC);


-- ─── 검증 쿼리 (적용 후) ──────────────────────────────────────
--
-- 1. 컬럼 존재 확인:
--    SELECT column_name, data_type, column_default, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'user_note_logs' AND column_name = 'sublevel';
--
-- 2. 기본값 적용 확인 (기존 row 모두 sublevel=0):
--    SELECT sublevel, COUNT(*)
--    FROM public.user_note_logs
--    GROUP BY sublevel;
--    → 5/31 이전 row 전부 sublevel=0
--
-- 3. 인덱스 확인:
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE tablename = 'user_note_logs' AND indexname = 'idx_note_logs_user_level_sublevel_created';
