
-- Phase 2: Wave 🌊 reaction primitive for OOTD posts
CREATE TABLE public.ootd_waves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.ootd_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

GRANT SELECT ON public.ootd_waves TO anon;
GRANT SELECT, INSERT, DELETE ON public.ootd_waves TO authenticated;
GRANT ALL ON public.ootd_waves TO service_role;

ALTER TABLE public.ootd_waves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Waves are publicly readable"
  ON public.ootd_waves FOR SELECT
  USING (true);

CREATE POLICY "Users can wave their own"
  ON public.ootd_waves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unwave their own"
  ON public.ootd_waves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX ootd_waves_post_idx ON public.ootd_waves (post_id);
CREATE INDEX ootd_waves_user_idx ON public.ootd_waves (user_id);

-- Denormalized counter on ootd_posts
ALTER TABLE public.ootd_posts
  ADD COLUMN IF NOT EXISTS wave_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_ootd_wave_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ootd_posts
       SET wave_count = wave_count + 1
     WHERE id = NEW.post_id;
    -- notify owner (skip self-wave)
    INSERT INTO public.notifications (recipient_id, actor_id, type, target_id)
    SELECT p.user_id, NEW.user_id, 'wave', NEW.post_id::text
      FROM public.ootd_posts p
     WHERE p.id = NEW.post_id AND p.user_id <> NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.ootd_posts
       SET wave_count = GREATEST(wave_count - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_ootd_waves_count
AFTER INSERT OR DELETE ON public.ootd_waves
FOR EACH ROW EXECUTE FUNCTION public.bump_ootd_wave_count();
