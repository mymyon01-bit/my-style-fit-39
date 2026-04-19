-- Add unique one-word username to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Backfill: derive from display_name or user_id
UPDATE public.profiles
SET username = lower(
  regexp_replace(
    coalesce(nullif(trim(display_name), ''), 'user_' || substr(user_id::text, 1, 8)),
    '[^a-zA-Z0-9_]', '', 'g'
  )
)
WHERE username IS NULL OR username = '';

-- Resolve duplicates by appending short id suffix
WITH dups AS (
  SELECT user_id, username,
    row_number() OVER (PARTITION BY username ORDER BY created_at) AS rn
  FROM public.profiles
  WHERE username IS NOT NULL
)
UPDATE public.profiles p
SET username = p.username || '_' || substr(p.user_id::text, 1, 6)
FROM dups d
WHERE p.user_id = d.user_id AND d.rn > 1;

-- Enforce constraints: lowercase, alphanumeric+underscore, 3-20 chars, unique, not null
ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format_check
  CHECK (username ~ '^[a-z0-9_]{3,20}$');

-- Index for fast prefix search
CREATE INDEX IF NOT EXISTS profiles_username_search_idx ON public.profiles (username text_pattern_ops);