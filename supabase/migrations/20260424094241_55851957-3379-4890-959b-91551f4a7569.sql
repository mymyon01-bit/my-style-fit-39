-- ============================================================
-- SHOWROOM feature: tables, RLS, triggers
-- Integrates with OOTD shared daily-3-star economy.
-- ============================================================

-- 1) Main showroom table
CREATE TABLE IF NOT EXISTS public.showrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  intro text,
  theme text NOT NULL DEFAULT 'minimal_gallery',
  background_url text,
  banner_url text,
  theme_color text,
  hashtags text[] NOT NULL DEFAULT '{}',
  playlist_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private','invite_only')),
  is_pinned boolean NOT NULL DEFAULT false,
  star_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  save_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_showrooms_user ON public.showrooms(user_id);
CREATE INDEX IF NOT EXISTS idx_showrooms_visibility ON public.showrooms(visibility);
CREATE INDEX IF NOT EXISTS idx_showrooms_updated ON public.showrooms(updated_at DESC);

ALTER TABLE public.showrooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view public showrooms"
  ON public.showrooms FOR SELECT
  USING (visibility = 'public' OR auth.uid() = user_id);

CREATE POLICY "Users insert own showrooms"
  ON public.showrooms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own showrooms"
  ON public.showrooms FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own showrooms"
  ON public.showrooms FOR DELETE
  USING (auth.uid() = user_id);

-- 2) Showroom items
CREATE TABLE IF NOT EXISTS public.showroom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id uuid NOT NULL REFERENCES public.showrooms(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('discover','ootd','saved','image')),
  product_id text,
  image_url text,
  title text,
  brand text,
  note text,
  hashtags text[] NOT NULL DEFAULT '{}',
  position_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_showroom_items_showroom ON public.showroom_items(showroom_id, position_order);

ALTER TABLE public.showroom_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view items of viewable showrooms"
  ON public.showroom_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.showrooms s
    WHERE s.id = showroom_items.showroom_id
      AND (s.visibility IN ('public','invite_only') OR s.user_id = auth.uid())
  ));

CREATE POLICY "Owners insert items"
  ON public.showroom_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.showrooms s
    WHERE s.id = showroom_items.showroom_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Owners update items"
  ON public.showroom_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.showrooms s
    WHERE s.id = showroom_items.showroom_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Owners delete items"
  ON public.showroom_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.showrooms s
    WHERE s.id = showroom_items.showroom_id AND s.user_id = auth.uid()
  ));

-- 3) Reactions (like / star / save)
CREATE TABLE IF NOT EXISTS public.showroom_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id uuid NOT NULL REFERENCES public.showrooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reaction_type text NOT NULL CHECK (reaction_type IN ('like','star','save')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (showroom_id, user_id, reaction_type)
);
CREATE INDEX IF NOT EXISTS idx_showroom_reactions_room ON public.showroom_reactions(showroom_id);
CREATE INDEX IF NOT EXISTS idx_showroom_reactions_user ON public.showroom_reactions(user_id, reaction_type);

ALTER TABLE public.showroom_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions"
  ON public.showroom_reactions FOR SELECT USING (true);

CREATE POLICY "Users insert own reactions"
  ON public.showroom_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own reactions"
  ON public.showroom_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- 4) Invite tokens (no payments)
CREATE TABLE IF NOT EXISTS public.showroom_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id uuid NOT NULL REFERENCES public.showrooms(id) ON DELETE CASCADE,
  invite_token text NOT NULL UNIQUE,
  created_by_user_id uuid NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_showroom_invites_room ON public.showroom_invites(showroom_id);

ALTER TABLE public.showroom_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view invite by token"
  ON public.showroom_invites FOR SELECT USING (true);

CREATE POLICY "Owners create invites"
  ON public.showroom_invites FOR INSERT
  WITH CHECK (
    auth.uid() = created_by_user_id AND EXISTS (
      SELECT 1 FROM public.showrooms s
      WHERE s.id = showroom_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners delete invites"
  ON public.showroom_invites FOR DELETE
  USING (auth.uid() = created_by_user_id);

-- 5) updated_at trigger on showrooms
DROP TRIGGER IF EXISTS update_showrooms_updated_at ON public.showrooms;
CREATE TRIGGER update_showrooms_updated_at
BEFORE UPDATE ON public.showrooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Pinning: only one pinned per user
CREATE OR REPLACE FUNCTION public.enforce_single_pinned_showroom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_pinned = true THEN
    UPDATE public.showrooms
       SET is_pinned = false
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_pinned = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_pinned_showroom_trg ON public.showrooms;
CREATE TRIGGER enforce_single_pinned_showroom_trg
BEFORE INSERT OR UPDATE OF is_pinned ON public.showrooms
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_pinned_showroom();

-- 7) Maintain reaction counts
CREATE OR REPLACE FUNCTION public.bump_showroom_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta int := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END;
  row_id uuid := CASE WHEN TG_OP = 'INSERT' THEN NEW.showroom_id ELSE OLD.showroom_id END;
  rtype text := CASE WHEN TG_OP = 'INSERT' THEN NEW.reaction_type ELSE OLD.reaction_type END;
BEGIN
  IF rtype = 'star' THEN
    UPDATE public.showrooms SET star_count = GREATEST(star_count + delta, 0) WHERE id = row_id;
  ELSIF rtype = 'like' THEN
    UPDATE public.showrooms SET like_count = GREATEST(like_count + delta, 0) WHERE id = row_id;
  ELSIF rtype = 'save' THEN
    UPDATE public.showrooms SET save_count = GREATEST(save_count + delta, 0) WHERE id = row_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bump_showroom_counts_ins ON public.showroom_reactions;
DROP TRIGGER IF EXISTS bump_showroom_counts_del ON public.showroom_reactions;
CREATE TRIGGER bump_showroom_counts_ins
AFTER INSERT ON public.showroom_reactions
FOR EACH ROW EXECUTE FUNCTION public.bump_showroom_counts();
CREATE TRIGGER bump_showroom_counts_del
AFTER DELETE ON public.showroom_reactions
FOR EACH ROW EXECUTE FUNCTION public.bump_showroom_counts();

-- 8) UNIFIED daily-3-star economy (OOTD + Showroom combined)
-- Replace existing OOTD enforcer to also count showroom stars.
CREATE OR REPLACE FUNCTION public.enforce_daily_star_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ootd_today int;
  showroom_today int;
  total_today int;
BEGIN
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
  IF total_today >= 3 THEN
    RAISE EXCEPTION 'Daily star limit reached (3 per day across OOTD and Showroom)';
  END IF;

  UPDATE public.ootd_posts SET star_count = star_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

-- New enforcer for showroom stars (mirror logic)
CREATE OR REPLACE FUNCTION public.enforce_daily_star_limit_showroom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ootd_today int;
  showroom_today int;
BEGIN
  IF NEW.reaction_type <> 'star' THEN
    RETURN NEW;
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

  IF (ootd_today + showroom_today) >= 3 THEN
    RAISE EXCEPTION 'Daily star limit reached (3 per day across OOTD and Showroom)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_daily_star_limit_showroom_trg ON public.showroom_reactions;
CREATE TRIGGER enforce_daily_star_limit_showroom_trg
BEFORE INSERT ON public.showroom_reactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_star_limit_showroom();

-- 9) Notifications on showroom star/like
CREATE OR REPLACE FUNCTION public.notify_on_showroom_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
BEGIN
  SELECT user_id INTO _owner FROM public.showrooms WHERE id = NEW.showroom_id;
  IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_id, metadata)
    VALUES (
      _owner, NEW.user_id,
      'showroom_' || NEW.reaction_type,
      NEW.showroom_id::text,
      jsonb_build_object('reaction', NEW.reaction_type)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_showroom_reaction_trg ON public.showroom_reactions;
CREATE TRIGGER notify_on_showroom_reaction_trg
AFTER INSERT ON public.showroom_reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_showroom_reaction();