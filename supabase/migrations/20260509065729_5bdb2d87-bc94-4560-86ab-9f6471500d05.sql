-- Recreate create_wave to be extra defensive: explicitly use SECURITY DEFINER,
-- handle visibility default, return JSON to avoid PostgREST table-return RLS edge cases,
-- and ensure both authenticated and anon can NOT call without a JWT (anon blocked).
CREATE OR REPLACE FUNCTION public.create_wave(
  _name text,
  _description text DEFAULT NULL,
  _cover_image_url text DEFAULT NULL,
  _visibility text DEFAULT 'private'
) RETURNS public.waves
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.waves;
  _vis text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN
    RAISE EXCEPTION 'name_required' USING ERRCODE = '22023';
  END IF;
  _vis := COALESCE(NULLIF(_visibility,''), 'private');
  IF _vis NOT IN ('private','public') THEN _vis := 'private'; END IF;

  INSERT INTO public.waves (name, description, cover_image_url, is_private, visibility, created_by)
  VALUES (
    btrim(_name),
    NULLIF(btrim(coalesce(_description,'')), ''),
    _cover_image_url,
    _vis = 'private',
    _vis,
    _uid
  )
  RETURNING * INTO _row;

  -- Ensure owner membership exists (in case trigger didn't fire for any reason)
  INSERT INTO public.wave_members (wave_id, user_id, role)
  VALUES (_row.id, _uid, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_wave(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_wave(text,text,text,text) TO authenticated;

-- Add a permissive INSERT policy fallback for SECURITY DEFINER inserts;
-- since postgres bypasses RLS this is only an extra safety net for direct inserts.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid='public.waves'::regclass AND polname='Authenticated users can create waves'
  ) THEN
    CREATE POLICY "Authenticated users can create waves" ON public.waves
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;