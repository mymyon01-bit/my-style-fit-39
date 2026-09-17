CREATE INDEX IF NOT EXISTS idx_circles_following_follower ON public.circles (following_id, follower_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_user ON public.saved_posts (post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_stories_feed_active_created ON public.stories (created_at DESC) WHERE is_highlight = false;