ALTER TABLE public.ootd_videos
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS filter text;

CREATE INDEX IF NOT EXISTS ootd_videos_tags_idx ON public.ootd_videos USING GIN (tags);