ALTER TABLE public.waves ADD COLUMN IF NOT EXISTS announcement text;
ALTER TABLE public.waves ADD COLUMN IF NOT EXISTS announcement_pinned boolean NOT NULL DEFAULT false;