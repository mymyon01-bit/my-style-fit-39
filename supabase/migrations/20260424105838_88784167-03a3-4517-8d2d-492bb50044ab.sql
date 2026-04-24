-- Followers table
CREATE TABLE IF NOT EXISTS public.showroom_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id uuid NOT NULL REFERENCES public.showrooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (showroom_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_showroom_followers_showroom ON public.showroom_followers(showroom_id);
CREATE INDEX IF NOT EXISTS idx_showroom_followers_user ON public.showroom_followers(user_id);

ALTER TABLE public.showroom_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view showroom followers"
  ON public.showroom_followers FOR SELECT
  USING (true);

CREATE POLICY "Users follow showrooms"
  ON public.showroom_followers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users unfollow own"
  ON public.showroom_followers FOR DELETE
  USING (auth.uid() = user_id);

-- Counter column
ALTER TABLE public.showrooms
  ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0;

-- Counter trigger
CREATE OR REPLACE FUNCTION public.bump_showroom_follower_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.showrooms SET follower_count = follower_count + 1 WHERE id = NEW.showroom_id;
    -- notify owner
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_id)
    SELECT s.user_id, NEW.user_id, 'showroom_follow', NEW.showroom_id::text
    FROM public.showrooms s
    WHERE s.id = NEW.showroom_id AND s.user_id <> NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.showrooms SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.showroom_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_showroom_followers_count ON public.showroom_followers;
CREATE TRIGGER trg_showroom_followers_count
AFTER INSERT OR DELETE ON public.showroom_followers
FOR EACH ROW EXECUTE FUNCTION public.bump_showroom_follower_count();