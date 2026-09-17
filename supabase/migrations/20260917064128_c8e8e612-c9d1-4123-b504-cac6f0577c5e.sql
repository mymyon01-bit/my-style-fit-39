ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_creator boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_is_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_creator IS DISTINCT FROM OLD.is_creator
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_creator := OLD.is_creator;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_is_creator ON public.profiles;
CREATE TRIGGER trg_guard_is_creator
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_is_creator();

CREATE TABLE IF NOT EXISTS public.creator_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  handle text NOT NULL,
  profile_url text,
  follower_count integer NOT NULL DEFAULT 0,
  note text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.creator_applications TO authenticated;
GRANT UPDATE ON public.creator_applications TO authenticated;
GRANT ALL ON public.creator_applications TO service_role;

ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own applications readable" ON public.creator_applications;
CREATE POLICY "own applications readable" ON public.creator_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "apply for self" ON public.creator_applications;
CREATE POLICY "apply for self" ON public.creator_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "admins review applications" ON public.creator_applications;
CREATE POLICY "admins review applications" ON public.creator_applications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_creator_applications_status ON public.creator_applications (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_creator_applications_updated ON public.creator_applications;
CREATE TRIGGER trg_creator_applications_updated
  BEFORE UPDATE ON public.creator_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify followers when someone they follow posts a new OOTD
CREATE OR REPLACE FUNCTION public.notify_followers_new_ootd()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, actor_id, type, target_id, metadata)
  SELECT c.follower_id, NEW.user_id, 'circle_post', NEW.id,
         jsonb_build_object('image_url', NEW.image_url, 'caption', NEW.caption)
  FROM public.circles c
  WHERE c.following_id = NEW.user_id
    AND c.follower_id <> NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followers_new_ootd ON public.ootd_posts;
CREATE TRIGGER trg_notify_followers_new_ootd
  AFTER INSERT ON public.ootd_posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_followers_new_ootd();