
CREATE OR REPLACE FUNCTION public.admin_get_profile(_user_id uuid)
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles WHERE user_id = _user_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_get_profile(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_get_profile(uuid) TO authenticated;
