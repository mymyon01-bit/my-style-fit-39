-- 1. Add change-history column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username_changes timestamptz[] NOT NULL DEFAULT '{}';

-- 2. Backfill: normalize current usernames (remove spaces + invalid chars, lowercase)
DO $$
DECLARE
  r RECORD;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT user_id, username FROM public.profiles LOOP
    base := lower(coalesce(r.username, ''));
    -- replace spaces with underscore
    base := regexp_replace(base, '\s+', '_', 'g');
    -- strip invalid chars
    base := regexp_replace(base, '[^a-z0-9._]', '', 'g');
    -- collapse repeated dots
    base := regexp_replace(base, '\.{2,}', '.', 'g');
    -- trim leading/trailing dots/underscores
    base := regexp_replace(base, '^[._]+|[._]+$', '', 'g');
    IF base IS NULL OR length(base) = 0 THEN
      base := 'user_' || substr(replace(r.user_id::text,'-',''), 1, 8);
    END IF;
    IF length(base) > 30 THEN base := substr(base, 1, 30); END IF;

    candidate := base;
    n := 0;
    WHILE EXISTS (
      SELECT 1 FROM public.profiles WHERE username = candidate AND user_id <> r.user_id
    ) LOOP
      n := n + 1;
      candidate := substr(base, 1, 28) || '_' || n::text;
    END LOOP;

    IF candidate <> coalesce(r.username, '') THEN
      UPDATE public.profiles SET username = candidate WHERE user_id = r.user_id;
    END IF;
  END LOOP;
END $$;

-- 3. Validation + change-limit trigger
CREATE OR REPLACE FUNCTION public.validate_username_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_changes int;
  last_change timestamptz;
BEGIN
  -- normalize
  NEW.username := lower(coalesce(NEW.username, ''));

  -- format
  IF NEW.username IS NULL OR length(NEW.username) < 1 OR length(NEW.username) > 30 THEN
    RAISE EXCEPTION 'username_length' USING HINT = 'Username must be 1-30 characters';
  END IF;
  IF NEW.username !~ '^[a-z0-9._]+$' THEN
    RAISE EXCEPTION 'username_format' USING HINT = 'Only letters, numbers, dot and underscore allowed';
  END IF;
  IF NEW.username ~ '\s' THEN
    RAISE EXCEPTION 'username_no_spaces' USING HINT = 'Spaces are not allowed';
  END IF;
  IF NEW.username ~ '\.{2,}' THEN
    RAISE EXCEPTION 'username_consecutive_dots';
  END IF;
  IF NEW.username ~ '^[._]' OR NEW.username ~ '[._]$' THEN
    RAISE EXCEPTION 'username_edge_chars' USING HINT = 'Cannot start or end with . or _';
  END IF;

  -- Only enforce change limits on UPDATE when username actually changes
  IF TG_OP = 'UPDATE' AND NEW.username IS DISTINCT FROM OLD.username THEN
    -- count changes in trailing 365 days
    SELECT count(*) INTO recent_changes
    FROM unnest(coalesce(OLD.username_changes, '{}'::timestamptz[])) AS t
    WHERE t > now() - interval '365 days';

    IF recent_changes >= 3 THEN
      RAISE EXCEPTION 'username_yearly_limit' USING HINT = 'You can change your username up to 3 times per year';
    END IF;

    -- last change must be ≥ 30 days ago
    SELECT max(t) INTO last_change
    FROM unnest(coalesce(OLD.username_changes, '{}'::timestamptz[])) AS t;

    IF last_change IS NOT NULL AND last_change > now() - interval '30 days' THEN
      RAISE EXCEPTION 'username_monthly_lock' USING HINT = 'You must wait 30 days between username changes';
    END IF;

    -- append change timestamp
    NEW.username_changes := coalesce(OLD.username_changes, '{}'::timestamptz[]) || now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_username_change_trg ON public.profiles;
CREATE TRIGGER validate_username_change_trg
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_username_change();