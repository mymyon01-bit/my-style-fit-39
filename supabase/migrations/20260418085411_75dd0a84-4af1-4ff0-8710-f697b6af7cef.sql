-- source_ingestion_runs: per-run telemetry for inventory growth
CREATE TABLE public.source_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                -- apify | firecrawl | discovery | multi
  source_actor TEXT,                   -- e.g. jupri~asos-scraper, search-discovery
  query_family TEXT,                   -- e.g. bags, sneakers, streetwear
  seed_query TEXT,                     -- the actual query string used
  trigger TEXT NOT NULL DEFAULT 'cron',-- cron | live | manual
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  fetched_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  deduped_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',  -- running | success | partial | failed
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sir_started_at ON public.source_ingestion_runs (started_at DESC);
CREATE INDEX idx_sir_source ON public.source_ingestion_runs (source);
CREATE INDEX idx_sir_query_family ON public.source_ingestion_runs (query_family);

ALTER TABLE public.source_ingestion_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ingestion runs"
  ON public.source_ingestion_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ingestion_errors: domain/source failure log
CREATE TABLE public.ingestion_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.source_ingestion_runs(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  source_domain TEXT,
  query_family TEXT,
  seed_query TEXT,
  error_type TEXT,                     -- timeout | http_error | parse_error | rate_limit | unknown
  error_message TEXT,
  http_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ie_created_at ON public.ingestion_errors (created_at DESC);
CREATE INDEX idx_ie_source ON public.ingestion_errors (source);
CREATE INDEX idx_ie_domain ON public.ingestion_errors (source_domain);

ALTER TABLE public.ingestion_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ingestion errors"
  ON public.ingestion_errors
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));