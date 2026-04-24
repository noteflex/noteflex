CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_quota INTEGER NOT NULL DEFAULT 3 CHECK (scan_quota >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.set_updated_at_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_profiles();

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, scan_quota)
  VALUES (NEW.id, 3)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();

INSERT INTO public.profiles (id, scan_quota)
SELECT id, 3
FROM auth.users
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.consume_scan_quota()
RETURNS TABLE (remaining_quota INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  UPDATE public.profiles
  SET scan_quota = scan_quota - 1
  WHERE id = v_uid
    AND scan_quota > 0
  RETURNING scan_quota INTO remaining_quota;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.topup_scan_quota(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_TOPUP_AMOUNT';
  END IF;

  INSERT INTO public.profiles (id, scan_quota)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (id)
  DO UPDATE SET scan_quota = public.profiles.scan_quota + EXCLUDED.scan_quota
  RETURNING scan_quota INTO v_updated;

  RETURN v_updated;
END;
$$;
