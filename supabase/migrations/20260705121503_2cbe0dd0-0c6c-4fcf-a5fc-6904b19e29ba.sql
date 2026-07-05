
CREATE OR REPLACE FUNCTION public.guard_profile_protected_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean := false;
BEGIN
  -- Service role bypasses this guard entirely (edge functions / admin tasks).
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    _is_admin := public.is_admin_or_above(auth.uid());
  END IF;

  IF _is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admins cannot change protected fields on their own row.
  NEW.is_official       := OLD.is_official;
  NEW.bonus_stars       := OLD.bonus_stars;
  NEW.phone_verified    := OLD.phone_verified;
  NEW.phone_verified_at := OLD.phone_verified_at;
  NEW.suspended_at      := OLD.suspended_at;
  NEW.suspended_reason  := OLD.suspended_reason;
  NEW.suspended_by      := OLD.suspended_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_protected_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_protected_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_protected_fields();

REVOKE EXECUTE ON FUNCTION public.guard_profile_protected_fields() FROM PUBLIC, anon, authenticated;
