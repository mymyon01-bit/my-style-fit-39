-- 1. Add suspension fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_by uuid;

-- 2. Admin moderation policies on ootd_posts
DROP POLICY IF EXISTS "Admins can delete any post" ON public.ootd_posts;
CREATE POLICY "Admins can delete any post"
  ON public.ootd_posts
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update any post" ON public.ootd_posts;
CREATE POLICY "Admins can update any post"
  ON public.ootd_posts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Admin moderation policies on profiles (suspend / soft moderate)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Admin can manage block records (for moderation: force-block bad actors)
DROP POLICY IF EXISTS "Admins can view all blocks" ON public.blocked_users;
CREATE POLICY "Admins can view all blocks"
  ON public.blocked_users
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert any block" ON public.blocked_users;
CREATE POLICY "Admins can insert any block"
  ON public.blocked_users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete any block" ON public.blocked_users;
CREATE POLICY "Admins can delete any block"
  ON public.blocked_users
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Admin can view all OOTD comments and delete them
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.ootd_comments;
CREATE POLICY "Admins can delete any comment"
  ON public.ootd_comments
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));