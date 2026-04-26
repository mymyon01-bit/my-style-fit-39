-- ============================================================
-- Orphan cleanup + future-proof account-deletion cascade
-- ============================================================
-- Goal: when a user no longer exists in auth.users (deleted account or
-- hard-removed), wipe their social footprint (posts, comments, reactions,
-- stars, follows, likes, saves, messages, showroom reactions, OOTD posts,
-- profile shell) AND recompute the parent counters so feeds/cards show
-- truthful numbers.

-- 1. Reusable helper: purge everything owned by a single user_id and
--    recompute affected counters. Safe to call for users that still exist
--    (used by delete_my_account) or for fully-orphaned IDs (used by the
--    sweep below).
CREATE OR REPLACE FUNCTION public.purge_user_content(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _affected_posts uuid[];
  _affected_comments uuid[];
  _affected_showrooms uuid[];
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  -- Capture the OOTD posts whose like/dislike/star counts we'll need to
  -- recompute after we strip this user's interactions out.
  SELECT COALESCE(array_agg(DISTINCT post_id), '{}')
    INTO _affected_posts
  FROM (
    SELECT post_id FROM public.ootd_reactions WHERE user_id = _user_id
    UNION
    SELECT post_id FROM public.ootd_stars     WHERE user_id = _user_id
  ) s;

  SELECT COALESCE(array_agg(DISTINCT comment_id), '{}')
    INTO _affected_comments
  FROM public.comment_likes WHERE user_id = _user_id;

  SELECT COALESCE(array_agg(DISTINCT showroom_id), '{}')
    INTO _affected_showrooms
  FROM public.showroom_reactions WHERE user_id = _user_id;

  -- Strip the user's own social rows.
  DELETE FROM public.ootd_reactions       WHERE user_id = _user_id;
  DELETE FROM public.ootd_stars           WHERE user_id = _user_id;
  DELETE FROM public.comment_likes        WHERE user_id = _user_id;
  DELETE FROM public.comment_reports      WHERE reporter_id = _user_id;
  DELETE FROM public.ootd_comments        WHERE user_id = _user_id;
  DELETE FROM public.saved_posts          WHERE user_id = _user_id;
  DELETE FROM public.saved_items          WHERE user_id = _user_id;
  DELETE FROM public.circles              WHERE follower_id = _user_id OR following_id = _user_id;
  DELETE FROM public.blocked_users        WHERE blocker_id = _user_id OR blocked_id = _user_id;
  DELETE FROM public.showroom_reactions   WHERE user_id = _user_id;
  DELETE FROM public.showroom_followers   WHERE user_id = _user_id;
  DELETE FROM public.notifications        WHERE recipient_id = _user_id OR actor_id = _user_id;
  DELETE FROM public.messages             WHERE sender_id = _user_id OR recipient_id = _user_id;
  DELETE FROM public.conversation_participants WHERE user_id = _user_id;
  DELETE FROM public.conversations        WHERE user_a = _user_id OR user_b = _user_id OR created_by = _user_id;

  -- Cascade: delete the user's own posts (which removes any remaining
  -- comments/stars/reactions on them via FK-less manual cleanup).
  DELETE FROM public.ootd_comments  WHERE post_id IN (SELECT id FROM public.ootd_posts WHERE user_id = _user_id);
  DELETE FROM public.ootd_reactions WHERE post_id IN (SELECT id FROM public.ootd_posts WHERE user_id = _user_id);
  DELETE FROM public.ootd_stars     WHERE post_id IN (SELECT id FROM public.ootd_posts WHERE user_id = _user_id);
  DELETE FROM public.saved_posts    WHERE post_id IN (SELECT id FROM public.ootd_posts WHERE user_id = _user_id);
  DELETE FROM public.ootd_posts     WHERE user_id = _user_id;

  -- Showrooms owned by the user.
  DELETE FROM public.showroom_reactions WHERE showroom_id IN (SELECT id FROM public.showrooms WHERE user_id = _user_id);
  DELETE FROM public.showroom_followers WHERE showroom_id IN (SELECT id FROM public.showrooms WHERE user_id = _user_id);
  DELETE FROM public.showroom_items     WHERE showroom_id IN (SELECT id FROM public.showrooms WHERE user_id = _user_id);
  DELETE FROM public.showrooms          WHERE user_id = _user_id;

  -- Other per-user data
  DELETE FROM public.daily_recommendations WHERE user_id = _user_id;
  DELETE FROM public.body_profiles         WHERE user_id = _user_id;
  DELETE FROM public.body_scan_images      WHERE user_id = _user_id;
  DELETE FROM public.fit_feedback          WHERE user_id = _user_id;
  DELETE FROM public.fit_generations_v2    WHERE user_id = _user_id;
  DELETE FROM public.fit_tryons            WHERE user_id = _user_id;
  DELETE FROM public.interactions          WHERE user_id = _user_id;
  DELETE FROM public.phone_verifications   WHERE user_id = _user_id;
  DELETE FROM public.push_device_tokens    WHERE user_id = _user_id;
  DELETE FROM public.referrals             WHERE referrer_id = _user_id OR referred_id = _user_id;
  DELETE FROM public.referral_grants       WHERE user_id = _user_id;
  DELETE FROM public.star_grant_recipients WHERE user_id = _user_id;
  DELETE FROM public.user_roles            WHERE user_id = _user_id;
  DELETE FROM public.profiles              WHERE user_id = _user_id;

  -- Recompute counters that the deletions above may have invalidated.
  UPDATE public.ootd_posts p SET
    like_count    = COALESCE((SELECT COUNT(*) FROM public.ootd_reactions r WHERE r.post_id = p.id AND r.reaction = 'like'), 0),
    dislike_count = COALESCE((SELECT COUNT(*) FROM public.ootd_reactions r WHERE r.post_id = p.id AND r.reaction = 'dislike'), 0),
    star_count    = COALESCE((SELECT COUNT(*) FROM public.ootd_stars     s WHERE s.post_id = p.id), 0)
  WHERE p.id = ANY(_affected_posts);

  UPDATE public.showrooms s SET
    star_count = COALESCE((SELECT COUNT(*) FROM public.showroom_reactions r WHERE r.showroom_id = s.id AND r.reaction_type = 'star'), 0),
    like_count = COALESCE((SELECT COUNT(*) FROM public.showroom_reactions r WHERE r.showroom_id = s.id AND r.reaction_type = 'like'), 0),
    save_count = COALESCE((SELECT COUNT(*) FROM public.showroom_reactions r WHERE r.showroom_id = s.id AND r.reaction_type = 'save'), 0),
    follower_count = COALESCE((SELECT COUNT(*) FROM public.showroom_followers f WHERE f.showroom_id = s.id), 0)
  WHERE s.id = ANY(_affected_showrooms);

  -- ootd_topics.post_count derives from posts.topics — recount those touched.
  UPDATE public.ootd_topics t SET
    post_count = COALESCE((
      SELECT COUNT(*) FROM public.ootd_posts p WHERE t.name = ANY(p.topics)
    ), 0);
END;
$$;

-- 2. Sweep: find every user_id referenced anywhere that no longer exists
--    in auth.users and purge them.
DO $$
DECLARE
  _orphan uuid;
BEGIN
  FOR _orphan IN
    SELECT DISTINCT uid FROM (
      SELECT user_id AS uid FROM public.profiles
      UNION SELECT user_id FROM public.ootd_posts
      UNION SELECT user_id FROM public.ootd_comments
      UNION SELECT user_id FROM public.ootd_reactions
      UNION SELECT user_id FROM public.ootd_stars
      UNION SELECT user_id FROM public.comment_likes
      UNION SELECT reporter_id FROM public.comment_reports
      UNION SELECT follower_id FROM public.circles
      UNION SELECT following_id FROM public.circles
      UNION SELECT blocker_id FROM public.blocked_users
      UNION SELECT blocked_id FROM public.blocked_users
      UNION SELECT user_id FROM public.saved_posts
      UNION SELECT user_id FROM public.saved_items
      UNION SELECT user_id FROM public.showroom_reactions
      UNION SELECT user_id FROM public.showroom_followers
      UNION SELECT user_id FROM public.showrooms
      UNION SELECT recipient_id FROM public.notifications
      UNION SELECT actor_id FROM public.notifications
      UNION SELECT sender_id FROM public.messages
      UNION SELECT recipient_id FROM public.messages
      UNION SELECT user_id FROM public.conversation_participants
    ) s
    WHERE uid IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = uid)
  LOOP
    PERFORM public.purge_user_content(_orphan);
  END LOOP;
END $$;

-- 3. Make delete_my_account use the helper so future self-deletions
--    fully cascade.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM public.purge_user_content(_me);
  DELETE FROM auth.users WHERE id = _me;
END $$;

-- 4. Trigger: when a row in auth.users is deleted (admin-removed user,
--    or any future hard delete), purge their content automatically so
--    we never accumulate orphans again.
CREATE OR REPLACE FUNCTION public.on_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.purge_user_content(OLD.id);
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_on_auth_user_deleted ON auth.users;
CREATE TRIGGER trg_on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_deleted();