-- 1) Add columns to stories table for public/pinned state
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_stories_user_public ON public.stories(user_id, is_public) WHERE is_public = true;

-- 2) story_views: who viewed which story
CREATE TABLE IF NOT EXISTS public.story_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story ON public.story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_owner ON public.story_views(owner_id, viewed_at DESC);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can record own views"
  ON public.story_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Story owner can see viewers"
  ON public.story_views FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = viewer_id);

-- 3) story_highlights: instagram-style collections
CREATE TABLE IF NOT EXISTS public.story_highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  cover_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_story_highlights_user ON public.story_highlights(user_id, sort_order);

ALTER TABLE public.story_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads highlights"
  ON public.story_highlights FOR SELECT
  USING (true);

CREATE POLICY "Users manage own highlights"
  ON public.story_highlights FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_story_highlights_updated_at
  BEFORE UPDATE ON public.story_highlights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) story_highlight_items: many-to-many
CREATE TABLE IF NOT EXISTS public.story_highlight_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  highlight_id UUID NOT NULL REFERENCES public.story_highlights(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(highlight_id, story_id)
);

CREATE INDEX IF NOT EXISTS idx_story_highlight_items_h ON public.story_highlight_items(highlight_id);

ALTER TABLE public.story_highlight_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads highlight items"
  ON public.story_highlight_items FOR SELECT
  USING (true);

CREATE POLICY "Users manage own highlight items"
  ON public.story_highlight_items FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);