-- ════════════════════════════════════════════════════════════════
-- 결제 lifecycle 핵심 로직 캡처 (지금까지 대시보드에만 존재 → 버전관리·재현)
-- subscriptions.status → profiles.is_premium / premium_until 동기화.
-- 라이브 정의와 동일. CREATE OR REPLACE + DROP IF EXISTS 로 멱등.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_premium_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
begin
  update public.profiles
  set
    is_premium = (new.status in ('active', 'trialing')),
    premium_until = case
      when new.status in ('active', 'trialing') then new.current_period_end
      else null
    end
  where id = new.user_id;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS on_subscription_change ON public.subscriptions;
CREATE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_premium_status();

-- ════════════════════════════════════════════════════════════════
-- 일배치 스케줄: premium 만료 안전망(expire_premium_users) + 약점/숙련 분석.
-- run_daily_batch_analysis 내부에 "오늘 이미 실행" 가드 있어 중복 무해.
-- KST 03:00 (= UTC 18:00) 1회. (pg_cron 은 이 프로젝트에 이미 설치됨.)
-- ════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $cron$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'noteflex-daily-batch';
  PERFORM cron.schedule(
    'noteflex-daily-batch',
    '0 18 * * *',
    $$SELECT public.run_daily_batch_analysis();$$
  );
END
$cron$;
