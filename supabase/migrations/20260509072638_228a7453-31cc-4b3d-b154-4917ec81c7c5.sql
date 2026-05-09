ALTER TABLE public.waves
  ADD COLUMN IF NOT EXISTS theme_animated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS theme_color_2 text;