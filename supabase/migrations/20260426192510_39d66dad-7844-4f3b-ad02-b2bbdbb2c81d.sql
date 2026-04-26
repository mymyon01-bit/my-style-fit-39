-- Officially-verified accounts (blue check) get a generous 1000/day star
-- allowance instead of the standard 3/day. We do this by short-circuiting
-- the existing daily-limit triggers when the actor is `is_official = true`.

CREATE OR REPLACE FUNCTION public.enforce_daily_star_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ootd_today int;
  showroom_today int;
  total_today int;
  is_official_user boolean := false;
  daily_cap int := 3;
BEGIN
  SELECT COALESCE(is_official, false) INTO is_official_user
    FROM public.profiles WHERE user_id = NEW.user_id;

  IF is_official_user THEN
    daily_cap := 1000;
  END IF;

  SELECT COUNT(*) INTO ootd_today
    FROM public.ootd_stars
   WHERE user_id = NEW.user_id
     AND created_at >= CURRENT_DATE
     AND created_at < CURRENT_DATE + INTERVAL '1 day';

  SELECT COUNT(*) INTO showroom_today
    FROM public.showroom_reactions
   WHERE user_id = NEW.user_id
     AND reaction_type = 'star'
     AND created_at >= CURRENT_DATE
     AND created_at < CURRENT_DATE + INTERVAL '1 day';

  total_today := ootd_today + showroom_today;
  IF total_today >= daily_cap THEN
    RAISE EXCEPTION 'Daily star limit reached (% per day across OOTD and Showroom)', daily_cap;
  END IF;

  UPDATE public.ootd_posts SET star_count = star_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_daily_star_limit_showroom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ootd_today int;
  showroom_today int;
  is_official_user boolean := false;
  daily_cap int := 3;
BEGIN
  IF NEW.reaction_type <> 'star' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(is_official, false) INTO is_official_user
    FROM public.profiles WHERE user_id = NEW.user_id;

  IF is_official_user THEN
    daily_cap := 1000;
  END IF;

  SELECT COUNT(*) INTO ootd_today
    FROM public.ootd_stars
   WHERE user_id = NEW.user_id
     AND created_at >= CURRENT_DATE
     AND created_at < CURRENT_DATE + INTERVAL '1 day';

  SELECT COUNT(*) INTO showroom_today
    FROM public.showroom_reactions
   WHERE user_id = NEW.user_id
     AND reaction_type = 'star'
     AND created_at >= CURRENT_DATE
     AND created_at < CURRENT_DATE + INTERVAL '1 day';

  IF (ootd_today + showroom_today) >= daily_cap THEN
    RAISE EXCEPTION 'Daily star limit reached (% per day across OOTD and Showroom)', daily_cap;
  END IF;
  RETURN NEW;
END;
$function$;