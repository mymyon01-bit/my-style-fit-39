
-- Daily winners for CROWNED
CREATE TABLE public.daily_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  award_date date NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  post_id uuid REFERENCES public.ootd_posts(id) ON DELETE SET NULL,
  score numeric NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT 'Style King',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_winners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view daily winners" ON public.daily_winners FOR SELECT USING (true);

-- Circle system (social graph)
CREATE TABLE public.circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view circles" ON public.circles FOR SELECT USING (true);
CREATE POLICY "Users can add to circles" ON public.circles FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can remove from circles" ON public.circles FOR DELETE USING (auth.uid() = follower_id);

-- Stories
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  expires_at timestamptz,
  is_highlight boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stories" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Users can create own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON public.stories FOR DELETE USING (auth.uid() = user_id);

-- Saved/Scrap posts
CREATE TABLE public.saved_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.ootd_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own saved posts" ON public.saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save posts" ON public.saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave posts" ON public.saved_posts FOR DELETE USING (auth.uid() = user_id);

-- Add hashtags column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT '{}'::text[];

-- Storage bucket for stories
INSERT INTO storage.buckets (id, name, public) VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view stories media" ON storage.objects FOR SELECT USING (bucket_id = 'stories');
CREATE POLICY "Users can upload own stories" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own stories" ON storage.objects FOR DELETE USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);
