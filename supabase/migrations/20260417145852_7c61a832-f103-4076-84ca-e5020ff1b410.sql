
CREATE TABLE public.story_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view story likes"
  ON public.story_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like stories"
  ON public.story_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike stories"
  ON public.story_likes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_story_likes_story ON public.story_likes(story_id);
CREATE INDEX idx_story_likes_user ON public.story_likes(user_id);
