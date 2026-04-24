
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ootd_bg_theme TEXT,
  ADD COLUMN IF NOT EXISTS ootd_bg_realistic BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS ootd_card_color JSONB,
  ADD COLUMN IF NOT EXISTS song_of_the_day JSONB;
