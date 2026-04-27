CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _dob date;
BEGIN
  -- Best-effort parse of dob from metadata (expected ISO yyyy-mm-dd)
  BEGIN
    _dob := NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date;
  EXCEPTION WHEN others THEN
    _dob := NULL;
  END;

  INSERT INTO public.profiles (
    user_id, display_name, avatar_url,
    date_of_birth, gender_preference, location
  )
  VALUES (
    NEW.id,
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