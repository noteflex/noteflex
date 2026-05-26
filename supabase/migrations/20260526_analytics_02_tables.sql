-- Migration: 20260526_analytics_rollup_tables.sql
-- Purpose: 분석 보고서(일/주/월) 배치 롤업 + 음표별 졸업/약점 상태 테이블.
-- 권위: user_note_logs (원시 per-note). user_sessions는 세션 메타만.
-- 단위: 모든 반응속도 ms (response_time × 1000 변환).
-- 필터: session_type = 'tutorial' 제외.
-- 약점 단위: (user_id, note_key, octave, clef) — octave 구분.

-- =====================================================================
-- 1. user_analytics_rollup — 일/주/월 통합 롤업
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_analytics_rollup (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_type              text          NOT NULL CHECK (period_type IN ('day','week','month')),
  period_start             date          NOT NULL,
  period_end               date          NOT NULL,

  -- 활동량
  sessions_count           integer       NOT NULL DEFAULT 0,
  total_attempts           integer       NOT NULL DEFAULT 0,
  correct_attempts         integer       NOT NULL DEFAULT 0,
  total_duration_seconds   integer       NOT NULL DEFAULT 0,
  active_days              integer       NOT NULL DEFAULT 0,

  -- 정확도·반응속도 전체
  overall_accuracy         numeric(5,4),
  avg_reaction_ms          integer,
  median_reaction_ms       integer,

  -- 분류별 (JSONB)
  by_clef                  jsonb,
  by_accidental            jsonb,
  by_level                 jsonb,
  per_note                 jsonb,
  interval_error_rates     jsonb,
  weak_notes_top           jsonb,

  -- 스트릭
  streak_days              integer,

  -- 2주 베이스라인 (period_end 기준 -14d ~ -1d)
  baseline_accuracy        numeric(5,4),
  baseline_avg_reaction_ms integer,

  -- 졸업/퇴보 (이번 period 동안 상태 변경 수)
  graduated_count          integer       NOT NULL DEFAULT 0,
  regressed_count          integer       NOT NULL DEFAULT 0,
  graduated_notes          jsonb,
  regressed_notes          jsonb,

  computed_at              timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (user_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_rollup_user_type_start
  ON public.user_analytics_rollup (user_id, period_type, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_rollup_user_type_baseline
  ON public.user_analytics_rollup (user_id, period_type, period_end);

-- RLS
ALTER TABLE public.user_analytics_rollup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rollup_select_own  ON public.user_analytics_rollup;
DROP POLICY IF EXISTS rollup_admin_select ON public.user_analytics_rollup;

CREATE POLICY rollup_select_own
  ON public.user_analytics_rollup
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY rollup_admin_select
  ON public.user_analytics_rollup
  FOR SELECT
  USING (public.is_admin());

-- INSERT/UPDATE/DELETE 정책 없음 — SECURITY DEFINER 배치 함수만 기록.

COMMENT ON TABLE public.user_analytics_rollup IS
  '일/주/월 분석 보고서 롤업. 배치(run_daily_analytics_rollup)가 기록.';
COMMENT ON COLUMN public.user_analytics_rollup.period_type IS
  'day=하루 / week=ISO 월~일 / month=달력 월';
COMMENT ON COLUMN public.user_analytics_rollup.per_note IS
  '[{note_key,octave,clef,attempts,accuracy,avg_ms,median_ms}] (가용한 모든 음표)';
COMMENT ON COLUMN public.user_analytics_rollup.weak_notes_top IS
  '상위 10 약점 음표: [{note_key,octave,clef,weak_score,error_rate,attempts,avg_ms}]';
COMMENT ON COLUMN public.user_analytics_rollup.interval_error_rates IS
  '도약 버킷별 오답률: {"0":{attempts,error_rate},"1-2":...,"3-5":...,"6-9":...,"10+":...}';

-- =====================================================================
-- 2. user_note_status — 음표별 졸업/약점 상태
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.user_note_status (
  user_id                  uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note_key                 text          NOT NULL,
  octave                   integer       NOT NULL,
  clef                     text          NOT NULL CHECK (clef IN ('treble','bass')),

  -- 최근 20회 윈도우
  recent_20_attempts       integer       NOT NULL DEFAULT 0,
  recent_20_correct        integer       NOT NULL DEFAULT 0,
  recent_20_accuracy       numeric(5,4),
  recent_20_sessions       integer       NOT NULL DEFAULT 0,
  recent_20_avg_ms         integer,
  recent_20_median_ms      integer,

  -- 상태
  status                   text          NOT NULL DEFAULT 'learning'
                                          CHECK (status IN ('learning','weakness','graduated','regressed')),

  -- 시각 이력
  graduated_at             timestamptz,
  regressed_at             timestamptz,
  weakness_flagged_at      timestamptz,
  ever_weakness            boolean       NOT NULL DEFAULT false,

  last_attempt_at          timestamptz,
  updated_at               timestamptz   NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, note_key, octave, clef)
);

CREATE INDEX IF NOT EXISTS idx_note_status_user_status
  ON public.user_note_status (user_id, status);

ALTER TABLE public.user_note_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS note_status_select_own  ON public.user_note_status;
DROP POLICY IF EXISTS note_status_admin_select ON public.user_note_status;

CREATE POLICY note_status_select_own
  ON public.user_note_status
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY note_status_admin_select
  ON public.user_note_status
  FOR SELECT
  USING (public.is_admin());

COMMENT ON TABLE public.user_note_status IS
  '음표 단위(note_key+octave+clef) 졸업/약점 상태. 배치가 갱신, 약점 훈련 출제 입력.';
COMMENT ON COLUMN public.user_note_status.status IS
  'learning=학습중(표본부족·중립) / weakness=약점 / graduated=졸업 / regressed=졸업 후 퇴보';
COMMENT ON COLUMN public.user_note_status.ever_weakness IS
  '한 번이라도 weakness였는지 — 졸업의 전제 조건 (약점→정상 전환만 졸업으로 인정)';

-- =====================================================================
-- 3. daily_batch_runs 확장 — 분석 롤업 통계 컬럼 추가 (옵션)
-- =====================================================================
-- 기존 daily_batch_runs에 분석 롤업 통계만 별도 컬럼으로 추가하면 기존 함수 영향 없음.
ALTER TABLE public.daily_batch_runs
  ADD COLUMN IF NOT EXISTS rollup_users_processed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rollup_users_failed    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rollup_daily_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rollup_weekly_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rollup_monthly_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rollup_graduated_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rollup_regressed_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rollup_duration_ms     integer;
