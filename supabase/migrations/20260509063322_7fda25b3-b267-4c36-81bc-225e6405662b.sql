
-- 1. waves: visibility column
ALTER TABLE public.waves
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private','public'));

-- 2. 1-wave-per-user trigger (official users exempt)
CREATE OR REPLACE FUNCTION public.enforce_one_wave_per_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_official boolean := false;
  _existing int;
BEGIN
  SELECT COALESCE(is_official, false) INTO _is_official
    FROM public.profiles WHERE user_id = NEW.created_by;
  IF _is_official THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO _existing
    FROM public.waves WHERE created_by = NEW.created_by;
  IF _existing >= 1 THEN
    RAISE EXCEPTION 'wave_limit_reached' USING HINT = 'Only one wave allowed per user';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_one_wave_per_user ON public.waves;
CREATE TRIGGER trg_enforce_one_wave_per_user
BEFORE INSERT ON public.waves
FOR EACH ROW EXECUTE FUNCTION public.enforce_one_wave_per_user();

-- 3. wave_modules
CREATE TABLE IF NOT EXISTS public.wave_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL REFERENCES public.waves(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('photos','board','wardrobe','poll','anon_board')),
  label text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wave_modules_wave ON public.wave_modules(wave_id, position);

CREATE OR REPLACE FUNCTION public.enforce_wave_module_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c int;
BEGIN
  SELECT COUNT(*) INTO _c FROM public.wave_modules WHERE wave_id = NEW.wave_id;
  IF _c >= 7 THEN
    RAISE EXCEPTION 'wave_module_limit_reached' USING HINT = 'Max 7 modules per wave';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_wave_module_limit ON public.wave_modules;
CREATE TRIGGER trg_enforce_wave_module_limit
BEFORE INSERT ON public.wave_modules
FOR EACH ROW EXECUTE FUNCTION public.enforce_wave_module_limit();

ALTER TABLE public.wave_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view modules" ON public.wave_modules
  FOR SELECT USING (public.is_wave_member(wave_id, auth.uid()));
CREATE POLICY "admins can insert modules" ON public.wave_modules
  FOR INSERT WITH CHECK (public.is_wave_admin(wave_id, auth.uid()));
CREATE POLICY "admins can update modules" ON public.wave_modules
  FOR UPDATE USING (public.is_wave_admin(wave_id, auth.uid()));
CREATE POLICY "owners can delete modules" ON public.wave_modules
  FOR DELETE USING (public.is_wave_owner(wave_id, auth.uid()));

CREATE TRIGGER trg_wave_modules_updated_at
BEFORE UPDATE ON public.wave_modules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. wave_module_posts
CREATE TABLE IF NOT EXISTS public.wave_module_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id uuid NOT NULL REFERENCES public.waves(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.wave_modules(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('photo','text','wardrobe_item','poll','anon')),
  title text,
  body text,
  image_urls text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_anonymous boolean NOT NULL DEFAULT false,
  like_count int NOT NULL DEFAULT 0,
  dislike_count int NOT NULL DEFAULT 0,
  meh_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wmp_module ON public.wave_module_posts(module_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wmp_wave ON public.wave_module_posts(wave_id, created_at DESC);

ALTER TABLE public.wave_module_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view posts" ON public.wave_module_posts
  FOR SELECT USING (public.is_wave_member(wave_id, auth.uid()));
CREATE POLICY "members can insert their posts" ON public.wave_module_posts
  FOR INSERT WITH CHECK (
    public.is_wave_member(wave_id, auth.uid()) AND author_id = auth.uid()
  );
CREATE POLICY "author can update own post" ON public.wave_module_posts
  FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "author or admin can delete post" ON public.wave_module_posts
  FOR DELETE USING (
    author_id = auth.uid() OR public.is_wave_admin(wave_id, auth.uid())
  );

CREATE TRIGGER trg_wmp_updated_at
BEFORE UPDATE ON public.wave_module_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. wave_post_reactions
CREATE TABLE IF NOT EXISTS public.wave_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.wave_module_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('like','dislike','meh')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_wpr_post ON public.wave_post_reactions(post_id);

ALTER TABLE public.wave_post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view reactions" ON public.wave_post_reactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.wave_module_posts p
            WHERE p.id = post_id AND public.is_wave_member(p.wave_id, auth.uid()))
  );
CREATE POLICY "members can insert own reaction" ON public.wave_post_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.wave_module_posts p
      WHERE p.id = post_id AND public.is_wave_member(p.wave_id, auth.uid())
    )
  );
CREATE POLICY "users can update own reaction" ON public.wave_post_reactions
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "users can delete own reaction" ON public.wave_post_reactions
  FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.bump_wave_post_reaction_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  delta int := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
  pid uuid := CASE WHEN TG_OP = 'INSERT' THEN NEW.post_id ELSE OLD.post_id END;
  rt text := CASE WHEN TG_OP = 'INSERT' THEN NEW.reaction ELSE OLD.reaction END;
BEGIN
  IF rt = 'like' THEN
    UPDATE public.wave_module_posts SET like_count = GREATEST(like_count + delta, 0) WHERE id = pid;
  ELSIF rt = 'dislike' THEN
    UPDATE public.wave_module_posts SET dislike_count = GREATEST(dislike_count + delta, 0) WHERE id = pid;
  ELSIF rt = 'meh' THEN
    UPDATE public.wave_module_posts SET meh_count = GREATEST(meh_count + delta, 0) WHERE id = pid;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_bump_wpr_ins AFTER INSERT ON public.wave_post_reactions
FOR EACH ROW EXECUTE FUNCTION public.bump_wave_post_reaction_counts();
CREATE TRIGGER trg_bump_wpr_del AFTER DELETE ON public.wave_post_reactions
FOR EACH ROW EXECUTE FUNCTION public.bump_wave_post_reaction_counts();

-- 6. wave_post_comments
CREATE TABLE IF NOT EXISTS public.wave_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.wave_module_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.wave_post_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  like_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wpc_post ON public.wave_post_comments(post_id, created_at);

ALTER TABLE public.wave_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view comments" ON public.wave_post_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.wave_module_posts p
            WHERE p.id = post_id AND public.is_wave_member(p.wave_id, auth.uid()))
  );
CREATE POLICY "members can insert comments" ON public.wave_post_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.wave_module_posts p
      WHERE p.id = post_id AND public.is_wave_member(p.wave_id, auth.uid())
    )
  );
CREATE POLICY "author or admin can delete comment" ON public.wave_post_comments
  FOR DELETE USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.wave_module_posts p
      WHERE p.id = post_id AND public.is_wave_admin(p.wave_id, auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.bump_wave_post_comment_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.wave_module_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.wave_module_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_wpc_ins AFTER INSERT ON public.wave_post_comments
FOR EACH ROW EXECUTE FUNCTION public.bump_wave_post_comment_count();
CREATE TRIGGER trg_wpc_del AFTER DELETE ON public.wave_post_comments
FOR EACH ROW EXECUTE FUNCTION public.bump_wave_post_comment_count();

-- 7. wave_comment_likes
CREATE TABLE IF NOT EXISTS public.wave_comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.wave_post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE public.wave_comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view comment likes" ON public.wave_comment_likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.wave_post_comments c
      JOIN public.wave_module_posts p ON p.id = c.post_id
      WHERE c.id = comment_id AND public.is_wave_member(p.wave_id, auth.uid())
    )
  );
CREATE POLICY "members can insert own like" ON public.wave_comment_likes
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.wave_post_comments c
      JOIN public.wave_module_posts p ON p.id = c.post_id
      WHERE c.id = comment_id AND public.is_wave_member(p.wave_id, auth.uid())
    )
  );
CREATE POLICY "users can delete own comment like" ON public.wave_comment_likes
  FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.bump_wave_comment_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.wave_post_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.wave_post_comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_wcl_ins AFTER INSERT ON public.wave_comment_likes
FOR EACH ROW EXECUTE FUNCTION public.bump_wave_comment_like_count();
CREATE TRIGGER trg_wcl_del AFTER DELETE ON public.wave_comment_likes
FOR EACH ROW EXECUTE FUNCTION public.bump_wave_comment_like_count();

-- 8. wave_polls + votes (poll metadata stored on wave_module_posts.metadata too, but separate table for vote rows)
CREATE TABLE IF NOT EXISTS public.wave_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.wave_module_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  option_index int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.wave_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view votes" ON public.wave_poll_votes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.wave_module_posts p
            WHERE p.id = post_id AND public.is_wave_member(p.wave_id, auth.uid()))
  );
CREATE POLICY "members can vote" ON public.wave_poll_votes
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.wave_module_posts p
      WHERE p.id = post_id AND public.is_wave_member(p.wave_id, auth.uid())
    )
  );
CREATE POLICY "users can change own vote" ON public.wave_poll_votes
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "users can remove own vote" ON public.wave_poll_votes
  FOR DELETE USING (user_id = auth.uid());
