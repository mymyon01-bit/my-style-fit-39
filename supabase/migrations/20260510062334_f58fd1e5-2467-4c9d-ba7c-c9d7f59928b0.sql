
-- OOTD Shorts table
CREATE TABLE public.ootd_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  thumb_url TEXT,
  caption TEXT,
  duration_s NUMERIC(5,2) NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ootd_videos_created_idx ON public.ootd_videos (created_at DESC);
CREATE INDEX ootd_videos_user_idx ON public.ootd_videos (user_id);

ALTER TABLE public.ootd_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view OOTD videos"
  ON public.ootd_videos FOR SELECT USING (true);

CREATE POLICY "Users can insert their own OOTD video"
  ON public.ootd_videos FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OOTD video"
  ON public.ootd_videos FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OOTD video"
  ON public.ootd_videos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_ootd_videos_updated
  BEFORE UPDATE ON public.ootd_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Likes
CREATE TABLE public.ootd_video_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.ootd_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id, user_id)
);
CREATE INDEX ootd_video_likes_video_idx ON public.ootd_video_likes (video_id);

ALTER TABLE public.ootd_video_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view video likes"
  ON public.ootd_video_likes FOR SELECT USING (true);

CREATE POLICY "Users can like videos"
  ON public.ootd_video_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own"
  ON public.ootd_video_likes FOR DELETE USING (auth.uid() = user_id);

-- Like count maintenance
CREATE OR REPLACE FUNCTION public.bump_ootd_video_like_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ootd_videos SET like_count = like_count + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.ootd_videos SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_ootd_video_likes_count
  AFTER INSERT OR DELETE ON public.ootd_video_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_ootd_video_like_count();

-- Storage bucket for videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ootd-videos', 'ootd-videos', true, 104857600, ARRAY['video/mp4','video/quicktime','video/webm']);

CREATE POLICY "Anyone can view ootd-videos"
  ON storage.objects FOR SELECT USING (bucket_id = 'ootd-videos');

CREATE POLICY "Users can upload own ootd-videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ootd-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own ootd-videos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'ootd-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own ootd-videos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ootd-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
