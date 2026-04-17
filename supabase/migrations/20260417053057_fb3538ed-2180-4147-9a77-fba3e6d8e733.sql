ALTER TABLE public.stories
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

UPDATE public.stories
  SET expires_at = created_at + interval '24 hours'
  WHERE expires_at IS NULL AND is_highlight = false;

CREATE INDEX IF NOT EXISTS idx_stories_user_expires
  ON public.stories (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_stories_active
  ON public.stories (expires_at DESC)
  WHERE is_highlight = false;