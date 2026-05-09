
-- 1) wave_followers table
CREATE TABLE IF NOT EXISTS public.wave_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL REFERENCES public.waves(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wave_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_wave_followers_user ON public.wave_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_wave_followers_wave ON public.wave_followers(wave_id);

ALTER TABLE public.wave_followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read wave_followers" ON public.wave_followers;
CREATE POLICY "anyone can read wave_followers" ON public.wave_followers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "users insert own follow" ON public.wave_followers;
CREATE POLICY "users insert own follow" ON public.wave_followers
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.waves w WHERE w.id = wave_id AND w.visibility = 'public')
  );

DROP POLICY IF EXISTS "users delete own follow" ON public.wave_followers;
CREATE POLICY "users delete own follow" ON public.wave_followers
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2) helper: is_wave_follower
CREATE OR REPLACE FUNCTION public.is_wave_follower(_wave_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wave_followers
    WHERE wave_id = _wave_id AND user_id = _user_id
  );
$$;

-- 3) extra columns on waves
ALTER TABLE public.waves ADD COLUMN IF NOT EXISTS follower_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.waves ADD COLUMN IF NOT EXISTS theme_color text;

-- 4) trigger keeping follower_count in sync
CREATE OR REPLACE FUNCTION public.bump_wave_follower_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.waves SET follower_count = follower_count + 1 WHERE id = NEW.wave_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.waves SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.wave_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_wave_follower_count ON public.wave_followers;
CREATE TRIGGER trg_wave_follower_count
AFTER INSERT OR DELETE ON public.wave_followers
FOR EACH ROW EXECUTE FUNCTION public.bump_wave_follower_count();

-- 5) public visibility for waves / posts / comments
DROP POLICY IF EXISTS "Members can view their waves" ON public.waves;
CREATE POLICY "Members or public can view waves" ON public.waves
  FOR SELECT USING (visibility = 'public' OR is_wave_member(id, auth.uid()));

DROP POLICY IF EXISTS "members can view posts" ON public.wave_module_posts;
CREATE POLICY "members or public can view posts" ON public.wave_module_posts
  FOR SELECT USING (
    is_wave_member(wave_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.waves w WHERE w.id = wave_id AND w.visibility = 'public')
  );

DROP POLICY IF EXISTS "members can view comments" ON public.wave_post_comments;
CREATE POLICY "members or public can view comments" ON public.wave_post_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.wave_module_posts p
      JOIN public.waves w ON w.id = p.wave_id
      WHERE p.id = wave_post_comments.post_id
        AND (w.visibility = 'public' OR is_wave_member(p.wave_id, auth.uid()))
    )
  );

-- 6) follower-only comments on public waves
DROP POLICY IF EXISTS "members can insert comments" ON public.wave_post_comments;
CREATE POLICY "members or followers can insert comments" ON public.wave_post_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.wave_module_posts p
      JOIN public.waves w ON w.id = p.wave_id
      WHERE p.id = wave_post_comments.post_id
        AND (
          is_wave_member(p.wave_id, auth.uid())
          OR (w.visibility = 'public' AND is_wave_follower(p.wave_id, auth.uid()))
        )
    )
  );

-- 7) modules viewable for public waves (so non-members can browse)
DROP POLICY IF EXISTS "members can view modules" ON public.wave_modules;
CREATE POLICY "members or public can view modules" ON public.wave_modules
  FOR SELECT USING (
    is_wave_member(wave_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.waves w WHERE w.id = wave_id AND w.visibility = 'public')
  );

-- 8) wave_members viewable for public so member counts/lists work
DROP POLICY IF EXISTS "members can view membership" ON public.wave_members;
CREATE POLICY "members or public can view membership" ON public.wave_members
  FOR SELECT USING (
    is_wave_member(wave_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.waves w WHERE w.id = wave_id AND w.visibility = 'public')
  );
