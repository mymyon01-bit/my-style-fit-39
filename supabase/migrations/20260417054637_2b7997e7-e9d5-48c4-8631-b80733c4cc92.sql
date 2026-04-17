ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all'
CHECK (audience IN ('all','circles','friends'));

-- Replace permissive view policy with audience-aware one
DROP POLICY IF EXISTS "Anyone can view stories" ON public.stories;

CREATE POLICY "Stories visible by audience"
ON public.stories
FOR SELECT
USING (
  -- Owner always sees their own
  auth.uid() = user_id
  -- Public stories
  OR audience = 'all'
  -- Circles: viewer follows the author
  OR (
    audience = 'circles'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.circles c
      WHERE c.follower_id = auth.uid() AND c.following_id = stories.user_id
    )
  )
  -- Friends: mutual follow
  OR (
    audience = 'friends'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.circles c1
      WHERE c1.follower_id = auth.uid() AND c1.following_id = stories.user_id
    )
    AND EXISTS (
      SELECT 1 FROM public.circles c2
      WHERE c2.follower_id = stories.user_id AND c2.following_id = auth.uid()
    )
  )
);