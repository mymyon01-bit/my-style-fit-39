CREATE OR REPLACE FUNCTION public.create_wave(
  _name text,
  _description text DEFAULT NULL,
  _cover_image_url text DEFAULT NULL,
  _visibility text DEFAULT 'private'
) RETURNS public.waves
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.waves;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN
    RAISE EXCEPTION 'name_required' USING ERRCODE = '22023';
  END IF;
  IF _visibility NOT IN ('private','public') THEN
    _visibility := 'private';
  END IF;

  INSERT INTO public.waves (name, description, cover_image_url, is_private, visibility, created_by)
  VALUES (
    btrim(_name),
    NULLIF(btrim(coalesce(_description,'')), ''),
    _cover_image_url,
    _visibility = 'private',
    _visibility,
    _uid
  )
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_wave(text, text, text, text) TO authenticated;