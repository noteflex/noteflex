-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260527_fix_record_game_session_dedup.sql
-- ═══════════════════════════════════════════════════════════════
-- 문제: user_stats_daily 수치(sessions_count, xp_earned 등)가 정확히 2배로
--       집계되는 중복 버그.
--
-- 원인: record_game_session RPC 내부에서 user_sessions INSERT 후
--       on_session_complete 트리거(handle_session_complete)가 자동으로
--       user_stats_daily를 UPSERT하는데, RPC 본문에서도 동일한 UPSERT를
--       한 번 더 실행 → 세션 1회 완료 = daily 테이블 2회 업데이트.
--
-- 수정: record_game_session에서 user_stats_daily UPSERT 블록만 제거.
--       트리거가 단독으로 처리하도록 단순화.
--
-- 영향 없는 부분:
--   - user_sessions INSERT (그대로 유지)
--   - profiles.last_practice_date UPDATE (멱등, 그대로 유지)
--   - on_session_complete 트리거 / handle_session_complete 함수 (변경 없음)
--   - fallback INSERT 경로(RPC 실패 → 직접 INSERT)도 트리거가 daily 처리
--
-- ⚠️ production apply: Supabase Dashboard > SQL Editor에서 실행.
-- ═══════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.record_game_session(
  p_level            INT,
  p_started_at       TIMESTAMPTZ,
  p_ended_at         TIMESTAMPTZ,
  p_duration_seconds INT,
  p_total_notes      INT,
  p_correct_notes    INT,
  p_accuracy         FLOAT,
  p_avg_reaction_ms  INT,
  p_xp_earned        INT,
  p_session_type     TEXT    DEFAULT NULL,
  p_note_attempts    JSONB   DEFAULT NULL,
  p_summary          JSONB   DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id    UUID := auth.uid();
  v_session_id UUID;
  v_today      DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ─── 1. user_sessions INSERT ─────────────────────────────────
  -- INSERT 완료 시 on_session_complete 트리거가 자동으로:
  --   • user_stats_daily UPSERT
  --   • profiles.total_xp + last_practice_date UPDATE
  --   • note_mastery UPSERT
  -- 를 처리하므로 아래에서 중복 처리하지 않음.
  BEGIN
    INSERT INTO public.user_sessions (
      user_id, level, started_at, ended_at, duration_seconds,
      total_notes, correct_notes, accuracy, avg_reaction_ms, xp_earned,
      session_type, note_attempts, summary
    ) VALUES (
      v_user_id, p_level, p_started_at, p_ended_at, p_duration_seconds,
      p_total_notes, p_correct_notes, p_accuracy, p_avg_reaction_ms, p_xp_earned,
      p_session_type, p_note_attempts, p_summary
    )
    RETURNING id INTO v_session_id;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'user_sessions not found — skipping INSERT';
    v_session_id := gen_random_uuid();
  END;

  -- ─── 2. user_stats_daily UPSERT 제거 ─────────────────────────
  -- (구 20260517 버전에 있던 블록 — on_session_complete 트리거와 중복이므로 삭제)

  -- ─── 3. profiles.last_practice_date UPDATE ───────────────────
  -- handle_session_complete도 동일하게 처리하지만,
  -- 트리거가 미적용된 fallback 환경(staging, 신규 dev)을 위해 유지.
  -- 멱등(오늘 이후 날짜만 덮어씀)이라 중복 실행 무해.
  UPDATE public.profiles
  SET last_practice_date = v_today
  WHERE id = v_user_id
    AND (last_practice_date IS NULL OR last_practice_date < v_today);

  RETURN COALESCE(v_session_id, gen_random_uuid());
END;
$func$;

GRANT EXECUTE ON FUNCTION public.record_game_session(
  INT, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT, INT, FLOAT, INT, INT, TEXT, JSONB, JSONB
) TO authenticated;


-- ═══════════════════════════════════════════════════════════════
-- 적용 후 검증 쿼리
-- ═══════════════════════════════════════════════════════════════
-- 게임 1판 플레이 후 실행. sessions_count, xp_earned 비율이 1.0이면 수정 완료.
--
-- SELECT
--   usd.stat_date,
--   usd.sessions_count             AS daily_sessions,
--   COUNT(us.id)                   AS actual_sessions,
--   ROUND(usd.sessions_count::numeric / NULLIF(COUNT(us.id), 0), 2) AS ratio,
--   usd.xp_earned                  AS daily_xp,
--   SUM(us.xp_earned)              AS actual_xp
-- FROM user_stats_daily usd
-- JOIN user_sessions us
--   ON us.user_id = usd.user_id
--   AND (us.started_at AT TIME ZONE 'UTC')::DATE = usd.stat_date
-- WHERE usd.user_id = auth.uid()
--   AND usd.stat_date >= CURRENT_DATE - INTERVAL '3 days'
-- GROUP BY usd.stat_date, usd.sessions_count, usd.xp_earned
-- ORDER BY usd.stat_date DESC;


-- ═══════════════════════════════════════════════════════════════
-- 과거 데이터 복구 (stat_date >= 2026-05-17)
-- ═══════════════════════════════════════════════════════════════
-- ⚠️  적용 순서:
--   (a) 샘플 확인 쿼리(아래)로 ratio = 2.0 재확인
--   (b) 이 파일의 record_game_session 교체 먼저 적용
--   (c) 게임 1판 → 오늘 행 ratio = 1.0 확인
--   (d) 아래 백업 후 과거 복구 UPDATE 실행
--
-- ── 백업 (적용 전 반드시 실행) ──────────────────────────────────
-- CREATE TABLE IF NOT EXISTS user_stats_daily_backup_20260527
--   AS SELECT * FROM user_stats_daily;
--
-- ── 샘플 확인 ────────────────────────────────────────────────────
-- SELECT
--   usd.user_id,
--   usd.stat_date,
--   usd.sessions_count                         AS daily_cnt,
--   COUNT(us.id)                               AS actual_cnt,
--   ROUND(usd.sessions_count::numeric
--         / NULLIF(COUNT(us.id), 0), 2)        AS ratio,
--   usd.xp_earned                              AS daily_xp,
--   SUM(us.xp_earned)                          AS actual_xp
-- FROM user_stats_daily usd
-- JOIN user_sessions us
--   ON  us.user_id = usd.user_id
--   AND (us.started_at AT TIME ZONE 'UTC')::DATE = usd.stat_date
-- WHERE usd.stat_date >= '2026-05-17'
-- GROUP BY usd.user_id, usd.stat_date, usd.sessions_count, usd.xp_earned
-- ORDER BY usd.stat_date DESC
-- LIMIT 50;
--
-- ── 과거 복구 UPDATE ─────────────────────────────────────────────
-- 컬럼 매핑:
--   sessions_count         = COUNT(user_sessions rows)            ← 정확
--   total_notes            = SUM(us.total_notes)                  ← 정확
--   correct_notes          = SUM(us.correct_notes)                ← 정확
--   total_duration_seconds = SUM(us.duration_seconds)             ← 정확
--   xp_earned              = SUM(us.xp_earned)                    ← 정확
--   avg_accuracy           = SUM(correct_notes)/SUM(total_notes)  ← note-weighted, 정확
--   avg_reaction_ms        = note-count-weighted 근사:
--                            SUM(us.avg_reaction_ms * us.total_notes)
--                            / NULLIF(SUM(us.total_notes), 0)
--                            ※ us.avg_reaction_ms는 세션 내 평균이므로
--                              note 개별 반응시간이 아님. 그러나
--                              total_notes 가중 평균이 단순평균보다
--                              실제값에 더 가까움.
--   sessions_by_level      = jsonb aggregation by us.level        ← 정확
--
-- 재구성 불가 항목:
--   weak_notes  — analytics 배치가 note_mastery를 분석해 쓰는 컬럼.
--                 user_sessions 재집계로는 복원 불가.
--                 (배치 재실행 시 자동 채워짐 — 복구 UPDATE에서 건드리지 않음)
--
-- UPDATE user_stats_daily usd
-- SET
--   sessions_count         = actual.cnt,
--   total_notes            = actual.tnotes,
--   correct_notes          = actual.cnotes,
--   total_duration_seconds = actual.dur,
--   xp_earned              = actual.xp,
--   avg_accuracy           = CASE
--                              WHEN actual.tnotes > 0
--                              THEN actual.cnotes::numeric / actual.tnotes
--                              ELSE 0
--                            END,
--   avg_reaction_ms        = actual.react_ms,
--   sessions_by_level      = actual.by_level,
--   updated_at             = now()
-- FROM (
--   SELECT
--     user_id,
--     (started_at AT TIME ZONE 'UTC')::DATE                         AS stat_date,
--     COUNT(*)                                                       AS cnt,
--     SUM(total_notes)                                               AS tnotes,
--     SUM(correct_notes)                                             AS cnotes,
--     SUM(duration_seconds)                                          AS dur,
--     SUM(xp_earned)                                                 AS xp,
--     -- note-count-weighted avg_reaction_ms (단순평균보다 실제에 가까운 근사)
--     (
--       SUM(avg_reaction_ms::bigint * total_notes)
--       / NULLIF(SUM(total_notes), 0)
--     )::int                                                         AS react_ms,
--     -- sessions_by_level: {"0":n, "1":n, ...}
--     jsonb_object_agg(
--       level::text,
--       level_cnt
--     )                                                              AS by_level
--   FROM (
--     -- 레벨별 세션 수 사전 집계 (jsonb_object_agg 중복 키 방지)
--     SELECT
--       user_id,
--       (started_at AT TIME ZONE 'UTC')::DATE AS stat_date,
--       level,
--       COUNT(*)                              AS level_cnt,
--       SUM(total_notes)                      AS total_notes,
--       SUM(correct_notes)                    AS correct_notes,
--       SUM(duration_seconds)                 AS duration_seconds,
--       SUM(xp_earned)                        AS xp_earned,
--       -- avg_reaction_ms는 세션 단위 평균이므로 level 내에서도 note-weighted
--       (SUM(avg_reaction_ms::bigint * total_notes)
--        / NULLIF(SUM(total_notes), 0))::int  AS avg_reaction_ms
--     FROM user_sessions
--     WHERE (started_at AT TIME ZONE 'UTC')::DATE >= '2026-05-17'
--     GROUP BY user_id, (started_at AT TIME ZONE 'UTC')::DATE, level
--   ) by_level_day
--   GROUP BY user_id, stat_date
-- ) actual
-- WHERE usd.user_id   = actual.user_id
--   AND usd.stat_date = actual.stat_date
--   AND usd.stat_date >= '2026-05-17';
