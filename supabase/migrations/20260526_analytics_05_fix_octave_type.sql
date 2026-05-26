-- Migration: 20260526_analytics_05_fix_octave_type.sql
-- Purpose: user_note_logs.octave 컬럼 타입을 TEXT(라이브 드리프트) → INTEGER(소스 마이그레이션 원본)로 정렬.
--
-- 드리프트 증거:
--   - 소스 마이그레이션 20260405142021_28ee1d25-c89c-4a05-bb92-f7fd721e4eee.sql L5:
--       octave INTEGER NOT NULL
--   - 이후 user_note_logs.octave를 건드린 ALTER 마이그레이션: 없음
--     (20260525_note_interval_from_prev.sql는 interval_from_prev 컬럼만 추가)
--   - 라이브 DB는 user_note_logs.octave = TEXT 상태로 확인됨 → 마이그레이션 외 경로(수동 ALTER·
--     초기 환경 차이 등)로 변형된 드리프트.
--
-- 진단:
--   refresh_user_note_status (03a L92)의 USING (note_key, octave, clef) 조인에서
--   user_note_logs.octave(text) ↔ user_note_status.octave(integer) 비교가 42883 "text = integer"로 실패.
--   data_batch_runs.rollup_users_failed=3 + rollup_users_processed=0이 직접 증거.
--   note_status는 이미 integer(02_tables L97)이므로 logs를 integer로 정렬하는 것이 올바른 방향.
--
-- 호환성 (클라이언트):
--   - src/lib/userNoteLogs.ts L6: `octave: number` (TS number)
--   - src/components/NoteGame.tsx L1039·1104·1168: `octave: parseInt(currentTarget.octave)` → number 전송
--   - supabase-js는 number를 JSON number로 직렬화 → integer 컬럼 INSERT 정상.
--   - 만약 향후 text "4" 같은 값이 들어오더라도 PG가 암묵 캐스팅으로 처리.
--
-- 인덱스 처리:
--   01_indexes.sql의 `idx_note_logs_user_note_octave_clef`가 octave 포함.
--   PostgreSQL ALTER COLUMN TYPE은 컬럼이 포함된 인덱스를 자동 재구축 (동일 트랜잭션 내).
--   별도 DROP/CREATE INDEX 불필요. 단 ALTER 동안 AccessExclusiveLock — 읽기·쓰기 전부 블록.
--
-- 적용 타이밍:
--   user_note_logs는 게임 INSERT 핫테이블이지만 ~3144 rows 소량 → ALTER는 sub-second.
--   그래도 안전을 위해 트래픽 적은 시간대(예: KST 새벽) 적용 권장.
--
-- 멱등성:
--   본 마이그레이션은 information_schema.columns로 현재 타입을 확인하여
--   이미 integer면 NOTICE만 출력하고 ALTER 안 함 → 반복 적용 안전.

DO $migrate$
DECLARE
  v_current_type text;
  v_total_rows   int;
  v_bad_count    int;
  v_sample       text;
BEGIN
  -- ── 1. 현재 타입 확인 ──
  SELECT data_type INTO v_current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'user_note_logs'
    AND column_name  = 'octave';

  IF v_current_type IS NULL THEN
    RAISE EXCEPTION 'user_note_logs.octave column not found (table missing or column dropped)';
  END IF;

  RAISE NOTICE '[05_fix_octave_type] current user_note_logs.octave type: %', v_current_type;

  -- ── 2. 이미 integer면 스킵 (멱등) ──
  IF v_current_type = 'integer' THEN
    RAISE NOTICE '[05_fix_octave_type] already integer — no ALTER needed';
    RETURN;
  END IF;

  -- ── 3. 사전 가드: 모든 octave 값이 정수로 캐스팅 가능한지 검증 ──
  --     octave::text로 정규화 (이미 integer라면 digit string, text라면 그대로)
  --     비정수 값(예: "5.5", "abc", "")이 있으면 ALTER가 도중 실패하므로 미리 차단
  SELECT count(*) INTO v_total_rows FROM public.user_note_logs;

  SELECT count(*) INTO v_bad_count
  FROM public.user_note_logs
  WHERE octave::text !~ '^-?[0-9]+$';

  IF v_bad_count > 0 THEN
    SELECT octave::text INTO v_sample
    FROM public.user_note_logs
    WHERE octave::text !~ '^-?[0-9]+$'
    LIMIT 1;

    RAISE EXCEPTION
      '[05_fix_octave_type] non-integer octave values found: % of % rows (sample: %). '
      'Manual cleanup required before ALTER (e.g., UPDATE ... SET octave = ... WHERE octave = %L).',
      v_bad_count, v_total_rows, v_sample, v_sample;
  END IF;

  RAISE NOTICE '[05_fix_octave_type] all % rows have integer-parseable octave — proceeding with ALTER',
    v_total_rows;

  -- ── 4. ALTER TYPE ──
  --     PG가 동일 트랜잭션에서 idx_note_logs_user_note_octave_clef를 자동 재구축.
  --     AccessExclusiveLock 동안 user_note_logs 읽기·쓰기 블록 (sub-second 예상).
  EXECUTE 'ALTER TABLE public.user_note_logs '
       || 'ALTER COLUMN octave TYPE integer USING octave::integer';

  RAISE NOTICE '[05_fix_octave_type] ALTER complete: user_note_logs.octave is now integer. '
               'Index idx_note_logs_user_note_octave_clef auto-rebuilt.';
END;
$migrate$;

-- =====================================================================
-- 적용 후 검증 (수동 — 본 파일 적용 직후 실행 권장)
-- =====================================================================
-- 1) 컬럼 타입 양쪽 동일 확인
--    SELECT t.table_name, c.column_name, c.data_type
--      FROM information_schema.columns c
--      JOIN information_schema.tables  t USING (table_schema, table_name)
--     WHERE c.table_schema='public'
--       AND t.table_name IN ('user_note_logs','user_note_status')
--       AND c.column_name = 'octave'
--     ORDER BY t.table_name;
--    기대: 둘 다 integer
--
-- 2) 인덱스 재구축 확인 (size > 0, valid)
--    SELECT indexname, indexdef
--      FROM pg_indexes
--     WHERE tablename = 'user_note_logs'
--       AND indexname = 'idx_note_logs_user_note_octave_clef';
--
-- 3) refresh_user_note_status 직접 호출로 USING 조인 정상 동작 확인
--    SELECT public.refresh_user_note_status(auth.uid());  -- 본인 user_id로
--    -- 에러 없이 row count 반환되어야 함
--
-- 4) 전체 배치 호출 → users_failed = 0 확인
--    SELECT public.run_daily_analytics_rollup();
--    SELECT run_date, status,
--           rollup_users_processed, rollup_users_failed,
--           rollup_daily_count, rollup_weekly_count, rollup_monthly_count
--      FROM public.daily_batch_runs
--     ORDER BY run_date DESC LIMIT 3;
--    기대: rollup_users_failed = 0, rollup_users_processed > 0, rollup_daily_count > 0
