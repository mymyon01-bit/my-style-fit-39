
CREATE OR REPLACE FUNCTION public.bump_ootd_reaction_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  delta int := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
  row_id uuid := CASE WHEN TG_OP = 'INSERT' THEN NEW.post_id ELSE OLD.post_id END;
  rtype  text := CASE WHEN TG_OP = 'INSERT' THEN NEW.reaction ELSE OLD.reaction END;
BEGIN
  IF rtype = 'like' THEN
    UPDATE public.ootd_posts
       SET like_count = GREATEST(like_count + delta, 0)
     WHERE id = row_id;
  ELSIF rtype = 'dislike' THEN
    UPDATE public.ootd_posts
       SET dislike_count = GREATEST(dislike_count + delta, 0)
     WHERE id = row_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ootd_reactions_counts_ins ON public.ootd_reactions;
DROP TRIGGER IF EXISTS trg_ootd_reactions_counts_del ON public.ootd_reactions;

CREATE TRIGGER trg_ootd_reactions_counts_ins
AFTER INSERT ON public.ootd_reactions
FOR EACH ROW EXECUTE FUNCTION public.bump_ootd_reaction_counts();

CREATE TRIGGER trg_ootd_reactions_counts_del
AFTER DELETE ON public.ootd_reactions
FOR EACH ROW EXECUTE FUNCTION public.bump_ootd_reaction_counts();

UPDATE public.ootd_posts p SET
  like_count    = COALESCE((SELECT COUNT(*) FROM public.ootd_reactions r WHERE r.post_id = p.id AND r.reaction = 'like'), 0),
  dislike_count = COALESCE((SELECT COUNT(*) FROM public.ootd_reactions r WHERE r.post_id = p.id AND r.reaction = 'dislike'), 0),
  star_count    = COALESCE((SELECT COUNT(*) FROM public.ootd_stars     s WHERE s.post_id = p.id), 0);

CREATE INDEX IF NOT EXISTS idx_ootd_posts_user_created       ON public.ootd_posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ootd_posts_created            ON public.ootd_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ootd_stars_post               ON public.ootd_stars (post_id);
CREATE INDEX IF NOT EXISTS idx_ootd_stars_user_created       ON public.ootd_stars (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ootd_reactions_user_created   ON public.ootd_reactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender               ON public.messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id              ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user_created     ON public.interactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_showroom_reactions_room_type  ON public.showroom_reactions (showroom_id, reaction_type);
