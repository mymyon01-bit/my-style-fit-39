-- Extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Extraction domain cache
-- Tracks which extraction strategy succeeded per host so we can avoid burning
-- Firecrawl credits on domains we already know how to scrape via og: tags.
CREATE TABLE IF NOT EXISTS public.extraction_domain_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL UNIQUE,
  last_strategy text NOT NULL CHECK (last_strategy IN ('firecrawl', 'fetch')),
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extraction_domain_cache_host
  ON public.extraction_domain_cache(host);

ALTER TABLE public.extraction_domain_cache ENABLE ROW LEVEL SECURITY;

-- No public policies -> only service role (which bypasses RLS) can read/write.
-- Internal infrastructure table; not user-facing.

CREATE TRIGGER trg_extraction_domain_cache_updated_at
BEFORE UPDATE ON public.extraction_domain_cache
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Inventory seed cursor
-- Single-row pointer for the background inventory builder's round-robin.
CREATE TABLE IF NOT EXISTS public.inventory_seed_cursor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cursor_index integer NOT NULL DEFAULT 0,
  last_seed text,
  last_run_at timestamptz,
  last_inserted integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_seed_cursor ENABLE ROW LEVEL SECURITY;
-- Service-role-only (no public policies).

CREATE TRIGGER trg_inventory_seed_cursor_updated_at
BEFORE UPDATE ON public.inventory_seed_cursor
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the single cursor row if missing.
INSERT INTO public.inventory_seed_cursor (cursor_index)
SELECT 0
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_seed_cursor);