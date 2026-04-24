CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'iap',
  event_id TEXT NOT NULL UNIQUE,
  checkout_session_id TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  credits_added INTEGER NOT NULL CHECK (credits_added > 0),
  amount_cents INTEGER,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON public.payment_events;
CREATE POLICY "Users can view own payments"
ON public.payment_events
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_user_id_created_at
ON public.payment_events (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.apply_payment_topup(
  p_event_id TEXT,
  p_checkout_session_id TEXT,
  p_user_id UUID,
  p_package_id TEXT,
  p_credits_added INTEGER,
  p_amount_cents INTEGER,
  p_currency TEXT
)
RETURNS TABLE(applied BOOLEAN, remaining_quota INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted BOOLEAN := FALSE;
  inserted_count INTEGER := 0;
  updated_quota INTEGER := 0;
BEGIN
  IF p_credits_added IS NULL OR p_credits_added <= 0 THEN
    RAISE EXCEPTION 'INVALID_CREDITS';
  END IF;

  INSERT INTO public.payment_events (
    provider,
    event_id,
    checkout_session_id,
    user_id,
    package_id,
    credits_added,
    amount_cents,
    currency,
    status
  )
  VALUES (
    'iap',
    p_event_id,
    p_checkout_session_id,
    p_user_id,
    p_package_id,
    p_credits_added,
    p_amount_cents,
    p_currency,
    'completed'
  )
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  inserted := inserted_count > 0;

  IF NOT inserted THEN
    SELECT scan_quota INTO updated_quota
    FROM public.profiles
    WHERE id = p_user_id;
    RETURN QUERY SELECT FALSE, COALESCE(updated_quota, 0);
    RETURN;
  END IF;

  PERFORM public.topup_scan_quota(p_user_id, p_credits_added);
  SELECT scan_quota INTO updated_quota
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, COALESCE(updated_quota, 0);
END;
$$;
