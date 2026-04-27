CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _dob date;
  _base_username text;
  _username text;
  _suffix int := 0;
BEGIN
  BEGIN
    _dob := NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date;
  EXCEPTION WHEN others THEN
    _dob := NULL;
  END;

  -- Build a safe base username (lowercase, alnum + underscore, 3-20 chars)
  _base_username := lower(regexp_replace(
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'username',''),
      NULLIF(NEW.raw_user_meta_data->>'full_name',''),
      NULLIF(NEW.raw_user_meta_data->>'name',''),
      split_part(NEW.email, '@', 1),
      'user'
    ),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  IF _base_username IS NULL OR length(_base_username) < 3 THEN
    _base_username := 'user' || substr(replace(NEW.id::text,'-',''), 1, 8);
  END IF;
  IF length(_base_username) > 20 THEN
    _base_username := substr(_base_username, 1, 20);
  END IF;

  _username := _base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = _username) LOOP
    _suffix := _suffix + 1;
    _username := substr(_base_username, 1, 16) || _suffix::text;
  END LOOP;

  INSERT INTO public.profiles (
    user_id, username, display_name, avatar_url,
    date_of_birth, gender_preference, location
  )
  VALUES (
    NEW.id,
    _username,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    _dob,
    NULLIF(NEW.raw_user_meta_data->>'gender',''),
    NULLIF(NEW.raw_user_meta_data->>'location','')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET display_name      = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
        avatar_url        = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        date_of_birth     = COALESCE(public.profiles.date_of_birth, EXCLUDED.date_of_birth),
        gender_preference = COALESCE(public.profiles.gender_preference, EXCLUDED.gender_preference),
        location          = COALESCE(public.profiles.location, EXCLUDED.location);
  RETURN NEW;
END;
$function$;