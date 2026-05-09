ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dismissed_info_cards TEXT[] NOT NULL DEFAULT '{}'::text[];