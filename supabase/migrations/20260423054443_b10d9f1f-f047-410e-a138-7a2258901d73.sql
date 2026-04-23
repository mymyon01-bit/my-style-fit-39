-- Notify post owner when someone reacts (likes) on their OOTD post
CREATE OR REPLACE FUNCTION public.notify_on_ootd_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner UUID;
BEGIN
  SELECT user_id INTO _owner FROM public.ootd_posts WHERE id = NEW.post_id;
  IF _owner IS NOT NULL AND _owner <> NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_id, metadata)
    VALUES (_owner, NEW.user_id, 'like', NEW.post_id::text, jsonb_build_object('reaction', NEW.reaction));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_on_ootd_reaction ON public.ootd_reactions;
CREATE TRIGGER trg_notify_on_ootd_reaction
AFTER INSERT ON public.ootd_reactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_ootd_reaction();