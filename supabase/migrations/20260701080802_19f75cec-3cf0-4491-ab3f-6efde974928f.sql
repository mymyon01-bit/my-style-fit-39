
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.showroom_invites;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='showroom_invites' AND policyname='Owners view own showroom invites') THEN
    CREATE POLICY "Owners view own showroom invites" ON public.showroom_invites FOR SELECT TO authenticated USING (auth.uid() = created_by_user_id);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.validate_showroom_invite(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE _row public.showroom_invites%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token'); END IF;
  SELECT * INTO _row FROM public.showroom_invites WHERE invite_token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF _row.expires_at IS NOT NULL AND _row.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;
  RETURN jsonb_build_object('ok', true, 'showroom_id', _row.showroom_id);
END $$;
REVOKE ALL ON FUNCTION public.validate_showroom_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.validate_showroom_invite(text) TO anon, authenticated;

DROP POLICY IF EXISTS diagnostics_insert_anyone ON public.diagnostics_events;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='diagnostics_events' AND policyname='diagnostics_insert_authenticated') THEN
    CREATE POLICY diagnostics_insert_authenticated ON public.diagnostics_events FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins can add members" ON public.wave_members;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='wave_members' AND policyname='Admins add members or self-join public waves') THEN
    CREATE POLICY "Admins add members or self-join public waves" ON public.wave_members FOR INSERT TO authenticated
      WITH CHECK (
        public.is_wave_admin(wave_id, auth.uid())
        OR (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.waves w WHERE w.id = wave_id AND w.visibility = 'public'))
      );
  END IF;
END $$;

REVOKE SELECT (phone, phone_number, phone_verified, phone_verified_at, date_of_birth, gender_preference, email_verified, suspended_at, suspended_by, suspended_reason, bonus_stars, username_changes, dismissed_info_cards) ON public.profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT * FROM public.profiles WHERE user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
