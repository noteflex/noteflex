-- §X-2 C3: soft delete columns + GDPR/PIPA masking RPC
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Mask PII on deletion; hard delete deferred to 30-day batch job
CREATE OR REPLACE FUNCTION public.request_account_deletion(reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE public.profiles SET
    deleted_at       = NOW(),
    is_deleted       = true,
    deletion_reason  = reason,
    email            = 'deleted_' || id::text || '@deleted.local',
    nickname         = 'deleted_' || substring(id::text, 1, 8),
    display_name     = NULL,
    avatar_url       = NULL
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_account_deletion(TEXT) TO authenticated;
