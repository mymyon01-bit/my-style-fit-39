
-- 1) PROFILES: restrict anon to safe columns via column-level grants
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

CREATE POLICY "Authenticated can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can view safe profile fields"
  ON public.profiles FOR SELECT TO anon USING (true);

REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, user_id, display_name, avatar_url, username, bio, hashtags, theme,
  language, onboarded, ootd_bg_theme, ootd_bg_realistic, ootd_card_color,
  song_of_the_day, is_official, is_private, created_at, updated_at
) ON public.profiles TO anon;

-- 2) REFERRALS: only referrer or referred user can read
DROP POLICY IF EXISTS "Anyone can view referral codes" ON public.referrals;

CREATE POLICY "Users view own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- 3) PHONE_VERIFICATIONS: hide otp_code from clients
REVOKE SELECT (otp_code) ON public.phone_verifications FROM anon, authenticated;
