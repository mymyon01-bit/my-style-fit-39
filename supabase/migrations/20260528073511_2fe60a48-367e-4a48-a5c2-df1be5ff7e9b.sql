
-- ============ profiles: column-level restriction for anon ============
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, user_id, display_name, username, avatar_url, bio, hashtags,
  is_private, is_official, ootd_bg_theme, ootd_bg_realistic,
  ootd_card_color, song_of_the_day, language, theme,
  created_at, updated_at
) ON public.profiles TO anon;

-- ============ removed_accounts: drop public read, add safe RPC ============
DROP POLICY IF EXISTS "Public can check removal by email" ON public.removed_accounts;

REVOKE SELECT ON public.removed_accounts FROM anon, authenticated;
GRANT ALL ON public.removed_accounts TO service_role;

CREATE OR REPLACE FUNCTION public.check_removed_account(_email text)
RETURNS TABLE(email text, reason text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email, reason
  FROM public.removed_accounts
  WHERE lower(email) = lower(_email)
  ORDER BY removed_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.check_removed_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_removed_account(text) TO anon, authenticated;

-- ============ star_action_grants: block client inserts ============
DROP POLICY IF EXISTS "Users can insert their own action grants" ON public.star_action_grants;
REVOKE INSERT, UPDATE, DELETE ON public.star_action_grants FROM anon, authenticated;
GRANT ALL ON public.star_action_grants TO service_role;

-- ============ oauth_token_exchange: lock down to service_role ============
REVOKE ALL ON public.oauth_token_exchange FROM anon, authenticated;
GRANT ALL ON public.oauth_token_exchange TO service_role;
