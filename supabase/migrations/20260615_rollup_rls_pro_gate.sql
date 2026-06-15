-- ═══════════════════════════════════════════════════════════════
-- Migration: 20260615_rollup_rls_pro_gate.sql
-- Purpose: user_analytics_rollup SELECT RLS 좁히기.
--
-- 배경:
--   기존 SELECT 정책 = 본인 row 전부 허용(`auth.uid() = user_id`).
--   비Pro 사용자가 RPC 우회로 직접 SQL을 던지면 자기 주간/월간 rollup row를
--   그대로 가져갈 수 있음 → Pro 콘텐츠 우회 노출.
--
-- 새 정책 (단일):
--   USING (
--     (auth.uid() = user_id AND (period_type = 'day' OR public.is_pro()))
--     OR public.is_admin()
--   )
--   - 일간(day): 본인이면 항상 허용 (Free 정책 그대로).
--   - 주간/월간(week/month): 본인 + is_pro() 통과해야 허용.
--   - admin: 전체 row 허용 (기존 admin 정책 흡수).
--
-- 헬퍼:
--   public.is_pro()   = role='admin' OR subscription_tier='pro' OR is_premium=TRUE
--                       (20260613_report_history_rpc.sql)
--   public.is_admin() = role='admin'
--                       (20260510_rls_audit.sql)
--
-- RPC 정상 경로 영향:
--   get_weekly_report·get_monthly_report 는 SECURITY INVOKER 이지만, RPC 본문이
--   먼저 is_pro() 가드를 통과해야 SELECT까지 도달 → 도달 시 호출자는 Pro 또는
--   admin → 새 USING의 두 조건 중 하나를 만족 → RLS 통과. 동작 무변경.
--   (DEFINER 였다면 RLS 자체 우회였을 것이나, 이 프로젝트는 INVOKER 라
--   RLS 가 실효 게이트 — 본 변경이 의미를 가진다.)
--
-- 보조 SELECT 영향:
--   useWeeklyReport: 일간 row 보조 SELECT(period_type='day') → USING 통과.
--   useMonthlyReport: 일간 row 통과. 주간 row(period_type='week') 보조 SELECT는
--     Pro 사용자만 도달 가능(월간 RPC 가드 통과 후) → is_pro() true → 통과.
--   비Pro 가 직접 SQL 로 .from('user_analytics_rollup').eq('period_type','week') 시도
--     → USING 차단 → 0 row.
--
-- INSERT/UPDATE/DELETE 정책 무변경 — 배치 함수(SECURITY DEFINER)만 기록하는
-- 정책 유지.
-- ═══════════════════════════════════════════════════════════════

-- 멱등 재생성 — 기존 두 SELECT 정책 모두 새 단일 정책으로 통합.
DROP POLICY IF EXISTS rollup_select_own   ON public.user_analytics_rollup;
DROP POLICY IF EXISTS rollup_admin_select ON public.user_analytics_rollup;

CREATE POLICY rollup_select_own
  ON public.user_analytics_rollup
  FOR SELECT
  USING (
    (auth.uid() = user_id AND (period_type = 'day' OR public.is_pro()))
    OR public.is_admin()
  );

-- ═══════════════════════════════════════════════════════════════
-- 검증 (apply 후 Dashboard SQL Editor 또는 psql 에서 수동 실행):
--
-- -- 1) 비Pro 계정으로 로그인된 세션에서 (Supabase Studio Auth → impersonate):
-- SELECT count(*) FROM public.user_analytics_rollup WHERE period_type = 'week';   -- 기대: 0
--
-- -- 2) Pro 계정 세션:
-- SELECT count(*) FROM public.user_analytics_rollup WHERE period_type = 'week';   -- 기대: > 0
--
-- -- 3) admin 계정 세션:
-- SELECT count(*) FROM public.user_analytics_rollup WHERE period_type = 'month';  -- 기대: 전체 row 수
-- ═══════════════════════════════════════════════════════════════
