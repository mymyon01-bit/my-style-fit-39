ALTER TABLE public.waves
  ADD COLUMN IF NOT EXISTS card_border_color text,
  ADD COLUMN IF NOT EXISTS card_bg_color text,
  ADD COLUMN IF NOT EXISTS bg_animation text NOT NULL DEFAULT 'none';