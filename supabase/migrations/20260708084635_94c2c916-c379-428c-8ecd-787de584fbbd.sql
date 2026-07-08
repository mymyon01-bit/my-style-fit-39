-- Restrict profiles SELECT to only non-sensitive columns for anon/authenticated.
-- Sensitive columns (phone, phone_number, phone_verified, phone_verified_at,
-- date_of_birth, gender_preference, location, suspended_at, suspended_reason,
-- suspended_by, bonus_stars, dismissed_info_cards, email_verified, language,
-- theme, onboarded, username_changes) remain readable only to the owner via
-- the get_my_profile() SECURITY DEFINER RPC (and to admins via admin_get_profile()).

REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id,
  user_id,
  display_name,
  avatar_url,
  username,
  bio,
  hashtags,
  is_private,
  is_official,
  ootd_bg_theme,
  ootd_bg_realistic,
  ootd_card_color,
  song_of_the_day,
  created_at,
  updated_at
) ON public.profiles TO anon, authenticated;

-- service_role keeps full access for edge functions / admin tasks.
GRANT ALL ON public.profiles TO service_role;