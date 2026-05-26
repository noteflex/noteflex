-- Migration: 20260526_analytics_logs_indexes.sql
-- Purpose: 분석 엔진(일/주/월 보고서·졸업·약점) 쿼리 seq scan 방지.
-- 권한: 기존 인덱스는 그대로 유지 (단일 컬럼 idx_note_logs_user_id, idx_note_logs_created_at).
-- 본 마이그레이션은 신규 복합 인덱스 2개만 추가.

-- (user_id, created_at) 범위 쿼리 — 일/주/월 윈도우 집계, 베이스라인.
CREATE INDEX IF NOT EXISTS idx_note_logs_user_created
  ON public.user_note_logs (user_id, created_at DESC);

-- (user_id, note_key, octave, clef) — per-note 최근 20회·졸업·약점 판정.
CREATE INDEX IF NOT EXISTS idx_note_logs_user_note_octave_clef
  ON public.user_note_logs (user_id, note_key, octave, clef, created_at DESC);

-- user_sessions: 시간 범위 매칭(EXISTS)용 — started_at·ended_at 둘 다 조건에 들어감.
-- 기존 idx_sessions_user_date(user_id, started_at DESC)는 있으나 ended_at 비교에 도움 안 됨.
-- (user_id, session_type, started_at, ended_at) 복합 — 'tutorial' 제외 + 시간 범위 매칭에 사용.
CREATE INDEX IF NOT EXISTS idx_sessions_user_type_range
  ON public.user_sessions (user_id, session_type, started_at, ended_at);

COMMENT ON INDEX public.idx_note_logs_user_created IS
  '분석 엔진: per-user 시간 윈도우 집계 (일/주/월 롤업, 2주 베이스라인)';
COMMENT ON INDEX public.idx_note_logs_user_note_octave_clef IS
  '분석 엔진: per-note 최근 20회 윈도우 (졸업·약점 판정)';
COMMENT ON INDEX public.idx_sessions_user_type_range IS
  '분석 엔진: tutorial 세션 시간 범위 EXISTS 매칭 (로그→세션 매핑)';
