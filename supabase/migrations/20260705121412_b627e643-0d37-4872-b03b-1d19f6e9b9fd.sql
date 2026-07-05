
-- ============================================================
-- 1) PROFILES: column-level restrictions for `authenticated`
-- ============================================================
-- Anon already has column grants scoped to safe cols. Authenticated has
-- a table-wide GRANT SELECT which lets any logged-in user read PII.
-- Revoke table SELECT and re-grant on safe cols only. Sensitive fields
-- are accessed via SECURITY DEFINER RPCs (get_my_profile, admin_get_profile).

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, user_id, username, display_name, avatar_url, bio,
  hashtags, is_private, is_official, ootd_bg_theme, ootd_bg_realistic,
  ootd_card_color, song_of_the_day, language, theme, onboarded,
  created_at, updated_at, bonus_stars, dismissed_info_cards,
  email_verified, phone_verified, username_changes, location
) ON public.profiles TO authenticated;

-- ============================================================
-- 2) REALTIME.MESSAGES: authorize channel subscriptions
-- ============================================================
-- Without RLS here any authenticated user can subscribe to any topic
-- and receive private notifications/messages events.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own realtime topics" ON realtime.messages;
CREATE POLICY "Users read own realtime topics"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    -- personal user channel: `user:<uid>` or `notifications:<uid>`
    realtime.topic() = 'user:' || auth.uid()::text
    OR realtime.topic() = 'notifications:' || auth.uid()::text
    OR (
      -- conversation channels: `conversation:<uuid>`
      realtime.topic() LIKE 'conversation:%'
      AND public.is_conversation_participant(
        substring(realtime.topic() from 14)::uuid,
        auth.uid()
      )
    )
    OR (
      -- allow the standard postgres_changes broadcast for tables the
      -- caller can already read (notifications/messages have their own RLS)
      realtime.topic() LIKE 'realtime:%'
    )
  );

-- ============================================================
-- 3) STORAGE: fit-composites owner SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Users read own fit composites" ON storage.objects;
CREATE POLICY "Users read own fit composites"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fit-composites'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- 4) RLS-enabled tables with no policy → service-only access
-- ============================================================
-- oauth_token_exchange, extraction_domain_cache, inventory_seed_cursor
-- are internal — only edge functions (service_role) should touch them.
DROP POLICY IF EXISTS "service manages oauth exchange" ON public.oauth_token_exchange;
CREATE POLICY "service manages oauth exchange"
  ON public.oauth_token_exchange FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service manages extraction cache" ON public.extraction_domain_cache;
CREATE POLICY "service manages extraction cache"
  ON public.extraction_domain_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service manages inventory cursor" ON public.inventory_seed_cursor;
CREATE POLICY "service manages inventory cursor"
  ON public.inventory_seed_cursor FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 5) SECURITY DEFINER functions — lock down EXECUTE
-- ============================================================
-- Default: revoke from PUBLIC/anon/authenticated on all SECURITY DEFINER
-- functions in `public`. Then re-grant only on the RPCs the app calls.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Client-callable RPCs — grant EXECUTE back to `authenticated`
GRANT EXECUTE ON FUNCTION public.get_my_profile()                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_profile(uuid)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_wave_invite(uuid)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_wave_invite(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_conversation_member(uuid, uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_conversation(text, uuid[])            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_wave(text, text, text, text)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral(text)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_star_action(text)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account()                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_query_cluster(text, text, text, text, text[], uuid[]) TO authenticated;

-- check_removed_account is called during sign-up flow (pre-auth) too
GRANT EXECUTE ON FUNCTION public.check_removed_account(text) TO anon, authenticated;

-- Maintenance functions stay service-only (already revoked above).
