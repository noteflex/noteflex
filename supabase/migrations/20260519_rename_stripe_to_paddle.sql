-- ═══════════════════════════════════════════════════════════════
-- 컬럼명 stripe_* → paddle_* 변경
-- ═══════════════════════════════════════════════════════════════
-- Lovable 초기 세팅 시 Stripe로 설정되었으나 실제로는 Paddle 사용 중.
-- 코드 가독성 및 미래 유지보수성을 위해 정리.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- profiles 테이블
ALTER TABLE public.profiles
  RENAME COLUMN stripe_customer_id TO paddle_customer_id;

-- subscriptions 테이블
ALTER TABLE public.subscriptions
  RENAME COLUMN stripe_customer_id TO paddle_customer_id;

ALTER TABLE public.subscriptions
  RENAME COLUMN stripe_subscription_id TO paddle_subscription_id;

ALTER TABLE public.subscriptions
  RENAME COLUMN stripe_price_id TO paddle_price_id;

COMMIT;

-- 검증 쿼리 (참고):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND column_name LIKE '%stripe%';
-- → 결과 0건이어야 정상.
