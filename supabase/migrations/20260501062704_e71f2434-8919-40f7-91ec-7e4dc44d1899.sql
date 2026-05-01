CREATE TABLE IF NOT EXISTS public.discovery_cache (
  query_key text PRIMARY KEY,
  query text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  gender text,
  product_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  source_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours')
);

CREATE INDEX IF NOT EXISTS discovery_cache_expires_at_idx
  ON public.discovery_cache (expires_at);

ALTER TABLE public.discovery_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read discovery cache" ON public.discovery_cache;
CREATE POLICY "Anyone can read discovery cache"
  ON public.discovery_cache
  FOR SELECT
  USING (true);

-- Writes are restricted to service role (no policy = denied for anon/authenticated).

CREATE OR REPLACE FUNCTION public.purge_expired_discovery_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.discovery_cache WHERE expires_at < now();
$$;