-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260531_premium_backfill_trigger.sql
-- ═══════════════════════════════════════════════════════════════
-- 목적: Free → Premium 전환 시 약점 점수 자동 backfill.
--       profiles의 Premium 시그널(is_premium·subscription_tier·role) 변화 감지
--       → backfill_weak_scores_on_premium(NEW.id) 자동 호출.
--
-- 전제:
--   - 20260531_weak_scores_table.sql 이 먼저 적용되어
--     public.backfill_weak_scores_on_premium(uuid) 함수 존재.
--
-- 연쇄 흐름 (의도된 경로):
--   [Paddle webhook] → subscriptions INSERT/UPDATE
--     → on_subscription_change (기존 20260525) → sync_premium_status()
--       → UPDATE profiles SET is_premium = TRUE
--         → 본 마이그레이션 trigger notify_premium_activation()
--           → backfill_weak_scores_on_premium(NEW.id)
--             → user_note_weak_scores UPSERT 만 (profiles 변경 없음 → 루프 차단)
--
-- 무한 루프 방지:
--   - 본 trigger는 AFTER UPDATE ON profiles 한정 (INSERT·DELETE 제외).
--   - backfill 함수는 user_note_weak_scores UPSERT + profiles SELECT only.
--   - profiles UPDATE 없음 → 재발동 없음.
--
-- WHEN 절로 사전 필터:
--   세 컬럼(is_premium·subscription_tier·role) 중 하나라도 변화한 경우만
--   본문 진입 → 무관한 UPDATE(last_practice_date·total_xp 갱신 등)는 trigger
--   진입 자체 안 함 → 성능 영향 최소화.
--
-- 발동 조건 (함수 본문 ELSIF 분기 — 한 번만 호출):
--   1. OLD.is_premium false/NULL → NEW.is_premium TRUE
--   2. OLD.subscription_tier <> 'pro' → NEW.subscription_tier = 'pro'
--   3. OLD.role <> 'admin' → NEW.role = 'admin'
--   → backfill은 idempotent라 셋 동시 변경 시에도 안전하지만 ELSIF로 명확화.
--
-- 에러 안전 설계:
--   - 함수 본문 EXCEPTION WHEN OTHERS THEN NULL.
--   - backfill 실패해도 UPDATE 자체는 성공 (Premium 전환 차단 없음).
--   - 실패한 사용자도 다음 KST 자정 cron(refresh_weak_scores)에서 자동 복구.
--
-- ⚠️ DB 적용은 사용자가 별도 진행 (Supabase SQL Editor).
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. trigger 함수 ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_premium_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- 발동 조건 1: is_premium false/NULL → TRUE 전이
  IF (COALESCE(OLD.is_premium, false) = false) AND (NEW.is_premium = true) THEN
    PERFORM public.backfill_weak_scores_on_premium(NEW.id);

  -- 발동 조건 2: subscription_tier 다른 값 → 'pro' 전이
  ELSIF (COALESCE(OLD.subscription_tier, '') <> 'pro') AND (NEW.subscription_tier = 'pro') THEN
    PERFORM public.backfill_weak_scores_on_premium(NEW.id);

  -- 발동 조건 3: role 다른 값 → 'admin' 전이
  ELSIF (COALESCE(OLD.role, '') <> 'admin') AND (NEW.role = 'admin') THEN
    PERFORM public.backfill_weak_scores_on_premium(NEW.id);
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- backfill 실패는 UPDATE 차단하지 않음. 다음 KST 자정 cron이 자동 복구.
  RAISE NOTICE 'notify_premium_activation skipped for user_id %: % / %',
               NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.notify_premium_activation() TO postgres;

COMMENT ON FUNCTION public.notify_premium_activation() IS
  'AFTER UPDATE ON profiles trigger 함수. Premium 시그널 변화 감지 시 backfill_weak_scores_on_premium 호출. 에러는 흡수.';


-- ─── 2. trigger 등록 ──────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_premium_activation ON public.profiles;

CREATE TRIGGER trg_notify_premium_activation
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.is_premium         IS DISTINCT FROM NEW.is_premium
    OR OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier
    OR OLD.role              IS DISTINCT FROM NEW.role
  )
  EXECUTE FUNCTION public.notify_premium_activation();

COMMENT ON TRIGGER trg_notify_premium_activation ON public.profiles IS
  'Free → Premium 전환(is_premium/subscription_tier/role 변화) 시 약점 점수 자동 backfill.';


-- ═══════════════════════════════════════════════════════════════
-- 검증 쿼리 (적용 후)
-- ═══════════════════════════════════════════════════════════════
--
-- 1. trigger 등록 확인:
--    SELECT tgname, tgtype, tgenabled
--    FROM pg_trigger
--    WHERE tgname = 'trg_notify_premium_activation';
--    → tgenabled = 'O' (origin, 활성)
--
-- 2. trigger 함수 등록 확인:
--    SELECT routine_name, routine_type
--    FROM information_schema.routines
--    WHERE routine_schema = 'public'
--      AND routine_name = 'notify_premium_activation';
--
-- 3. WHEN 절 정상 적용 확인 (event_object + action_condition):
--    SELECT event_object_table, action_timing, event_manipulation,
--           action_condition
--    FROM information_schema.triggers
--    WHERE trigger_name = 'trg_notify_premium_activation';
--
-- 4. dry-run 검증 (ROLLBACK 패턴 — 실제 변경 없이 trigger 발동 확인):
--    --- 4-1. 본인의 user_id로 is_premium FALSE → TRUE 전이 시뮬:
--    BEGIN;
--      -- 사전 상태 백업 (참고)
--      SELECT id, is_premium, subscription_tier, role
--      FROM profiles WHERE id = auth.uid();
--
--      -- is_premium 강제 토글 (현재 상태에 따라 반대 값)
--      UPDATE profiles SET is_premium = NOT COALESCE(is_premium, false)
--      WHERE id = auth.uid();
--      -- trigger 발동 → backfill 호출 → user_note_weak_scores UPSERT
--
--      -- 결과 확인 (트랜잭션 안)
--      SELECT COUNT(*) AS weak_score_rows
--      FROM user_note_weak_scores
--      WHERE user_id = auth.uid();
--    ROLLBACK;
--    → profiles 원상복구, 단 user_note_weak_scores UPSERT 결과는 트랜잭션 안에서만 확인
--
--    --- 4-2. RAISE NOTICE 확인 (Supabase SQL Editor 출력 패널):
--    BEGIN;
--      UPDATE profiles SET is_premium = NOT COALESCE(is_premium, false)
--      WHERE id = auth.uid();
--    ROLLBACK;
--    → trigger 발동 시 NOTICE 출력. 에러 발생해도 NOTICE만 남고 UPDATE는 성공.
--
-- 5. 연쇄 흐름 확인 (subscriptions trigger 통한 정상 경로):
--    BEGIN;
--      -- 가상의 active subscription 시뮬 (실제 row 변경 없이 검증)
--      -- Paddle webhook 대신 직접 UPDATE
--      INSERT INTO subscriptions (user_id, status, current_period_end)
--      VALUES (auth.uid(), 'active', now() + interval '1 month')
--      ON CONFLICT (user_id) DO UPDATE SET
--        status = 'active',
--        current_period_end = now() + interval '1 month';
--      -- 연쇄: on_subscription_change → sync_premium_status →
--      --       profiles.is_premium TRUE → trg_notify_premium_activation →
--      --       backfill_weak_scores_on_premium
--    ROLLBACK;
--
-- ⚠️ 실패 시 점검:
--   - notify_premium_activation 함수 SECURITY DEFINER 권한
--   - backfill_weak_scores_on_premium 함수 존재 확인
--   - profiles 테이블 RLS 정책으로 인한 UPDATE 차단 여부
