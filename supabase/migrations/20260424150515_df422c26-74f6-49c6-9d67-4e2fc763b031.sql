ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT false;
UPDATE public.profiles SET is_official = true WHERE user_id = 'c6a48923-d906-4408-9efc-106107480b46';