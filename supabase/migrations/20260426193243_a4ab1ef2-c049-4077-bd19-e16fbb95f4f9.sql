-- Recipients of the automatic daily star bonus.
-- Today this is seeded with the existing official (admin/test) accounts.
-- New verified users will NOT be added automatically — they keep the
-- standard rules.
CREATE TABLE public.star_grant_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  daily_grant_amount integer NOT NULL DEFAULT 10,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.star_grant_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage star grant recipients"
ON public.star_grant_recipients
FOR ALL TO authenticated
USING (public.is_admin_or_above(auth.uid()))
WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE TRIGGER trg_star_grant_recipients_updated_at
BEFORE UPDATE ON public.star_grant_recipients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with the three existing verified accounts (admin + tests).
INSERT INTO public.star_grant_recipients (user_id, daily_grant_amount, notes)
SELECT user_id, 10, 'seeded: existing official account'
FROM public.profiles
WHERE is_official = true
ON CONFLICT (user_id) DO NOTHING;

-- Daily grant function. Idempotent in the sense that it just adds the
-- configured amount to each recipient's bonus_stars whenever it is invoked.
-- Schedule it via pg_cron to run once per day.
CREATE OR REPLACE FUNCTION public.grant_daily_bonus_stars()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  WITH upd AS (
    UPDATE public.profiles p
       SET bonus_stars = p.bonus_stars + r.daily_grant_amount,
           updated_at  = now()
      FROM public.star_grant_recipients r
     WHERE p.user_id = r.user_id
    RETURNING p.user_id
  )
  SELECT COUNT(*) INTO affected FROM upd;
  RETURN affected;
END;
$$;