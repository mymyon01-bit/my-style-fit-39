
-- Comments on OOTD posts
CREATE TABLE public.ootd_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.ootd_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ootd_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON public.ootd_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert own comments" ON public.ootd_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.ootd_comments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_ootd_comments_post ON public.ootd_comments(post_id, created_at);

-- OOTD likes (separate from stars — binary like/dislike)
CREATE TABLE public.ootd_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.ootd_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.ootd_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions" ON public.ootd_reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert own reactions" ON public.ootd_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reactions" ON public.ootd_reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.ootd_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_ootd_reactions_post ON public.ootd_reactions(post_id);
CREATE INDEX idx_ootd_reactions_user ON public.ootd_reactions(user_id);

-- Make profiles publicly viewable for social features
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);

-- Add like/dislike counts to ootd_posts
ALTER TABLE public.ootd_posts ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;
ALTER TABLE public.ootd_posts ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0;
