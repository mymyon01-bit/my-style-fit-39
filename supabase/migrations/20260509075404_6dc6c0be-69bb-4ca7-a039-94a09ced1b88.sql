
-- Per-wave block list managed by wave admins/owners
CREATE TABLE IF NOT EXISTS public.wave_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id UUID NOT NULL REFERENCES public.waves(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  blocked_by UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wave_id, user_id)
);

ALTER TABLE public.wave_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wave admins can view blocks"
  ON public.wave_blocks FOR SELECT
  USING (public.is_wave_admin(wave_id, auth.uid()));

CREATE POLICY "wave admins can insert blocks"
  ON public.wave_blocks FOR INSERT
  WITH CHECK (public.is_wave_admin(wave_id, auth.uid()) AND blocked_by = auth.uid());

CREATE POLICY "wave admins can delete blocks"
  ON public.wave_blocks FOR DELETE
  USING (public.is_wave_admin(wave_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_wave_blocks_wave ON public.wave_blocks(wave_id);
CREATE INDEX IF NOT EXISTS idx_wave_blocks_user ON public.wave_blocks(user_id);

-- Allow wave admins/owners to remove followers
CREATE POLICY "wave admins delete any follower"
  ON public.wave_followers FOR DELETE
  USING (public.is_wave_admin(wave_id, auth.uid()));

-- Allow wave admins/owners to remove members (besides owner)
CREATE POLICY "wave admins delete members"
  ON public.wave_members FOR DELETE
  USING (public.is_wave_admin(wave_id, auth.uid()) AND role <> 'owner');

-- Prevent blocked users from joining/following the wave
CREATE OR REPLACE FUNCTION public.prevent_blocked_wave_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.wave_blocks WHERE wave_id = NEW.wave_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'blocked_from_wave' USING HINT = 'You are blocked from this wave';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_blocked_member ON public.wave_members;
CREATE TRIGGER trg_prevent_blocked_member
  BEFORE INSERT ON public.wave_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_blocked_wave_join();

DROP TRIGGER IF EXISTS trg_prevent_blocked_follower ON public.wave_followers;
CREATE TRIGGER trg_prevent_blocked_follower
  BEFORE INSERT ON public.wave_followers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_blocked_wave_join();
