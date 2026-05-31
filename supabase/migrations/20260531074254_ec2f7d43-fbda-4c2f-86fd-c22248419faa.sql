
-- 1) Add audience column
ALTER TABLE public.ootd_posts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all','circle','ripple'));

CREATE INDEX IF NOT EXISTS idx_ootd_posts_audience ON public.ootd_posts(audience);

-- 2) Visibility helper. SECURITY DEFINER so the policy can read circles
--    without recursing through circles' own RLS for the viewer.
--    - 'all'    : everyone
--    - 'circle' : mutual follow (viewer<->owner)
--    - 'ripple' : viewer follows owner (any follower of owner)
--    - owner always allowed
CREATE OR REPLACE FUNCTION public.can_view_ootd_post(
  _viewer uuid,
  _owner uuid,
  _audience text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _audience IS NULL OR _audience = 'all' THEN true
    WHEN _viewer IS NULL THEN false
    WHEN _viewer = _owner THEN true
    WHEN _audience = 'ripple' THEN EXISTS (
      SELECT 1 FROM public.circles
      WHERE follower_id = _viewer AND following_id = _owner
    )
    WHEN _audience = 'circle' THEN EXISTS (
      SELECT 1 FROM public.circles
      WHERE follower_id = _viewer AND following_id = _owner
    ) AND EXISTS (
      SELECT 1 FROM public.circles
      WHERE follower_id = _owner AND following_id = _viewer
    )
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.can_view_ootd_post(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_ootd_post(uuid, uuid, text) TO anon, authenticated;

-- 3) Tighten the SELECT policy on ootd_posts
DROP POLICY IF EXISTS "Anyone can view posts" ON public.ootd_posts;

CREATE POLICY "View posts by audience"
ON public.ootd_posts
FOR SELECT
USING (public.can_view_ootd_post(auth.uid(), user_id, audience));
