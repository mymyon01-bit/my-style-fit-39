-- Notifications table for follow / star / comment alerts
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL,
  actor_id UUID,
  type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_unread
  ON public.notifications (recipient_id, read_at, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = recipient_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = recipient_id);

-- Triggers create notifications automatically (security definer bypasses RLS)
CREATE OR REPLACE FUNCTION public.notify_on_circle_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.follower_id <> NEW.following_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_id)
    VALUES (NEW.following_id, NEW.follower_id, 'follow', NEW.follower_id::text);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_on_circle_follow
  AFTER INSERT ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_circle_follow();

CREATE OR REPLACE FUNCTION public.notify_on_ootd_star()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner UUID;
BEGIN
  SELECT user_id INTO _owner FROM public.ootd_posts WHERE id = NEW.post_id;
  IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_id)
    VALUES (_owner, NEW.user_id, 'star', NEW.post_id::text);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_on_ootd_star
  AFTER INSERT ON public.ootd_stars
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_ootd_star();

CREATE OR REPLACE FUNCTION public.notify_on_ootd_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner UUID;
BEGIN
  SELECT user_id INTO _owner FROM public.ootd_posts WHERE id = NEW.post_id;
  IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_id)
    VALUES (_owner, NEW.user_id, 'comment', NEW.post_id::text);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notify_on_ootd_comment
  AFTER INSERT ON public.ootd_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_ootd_comment();

-- Allow users to delete their own auth account via RPC (for self-delete in Settings)
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me UUID := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.ootd_posts WHERE user_id = _me;
  DELETE FROM public.profiles WHERE user_id = _me;
  DELETE FROM public.user_roles WHERE user_id = _me;
  DELETE FROM auth.users WHERE id = _me;
END $$;