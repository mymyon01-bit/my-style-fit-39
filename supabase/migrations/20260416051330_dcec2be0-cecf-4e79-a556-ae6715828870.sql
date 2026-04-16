
-- Enable extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add trend scoring and active status to product_cache
ALTER TABLE public.product_cache
  ADD COLUMN IF NOT EXISTS trend_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_product_cache_trend ON public.product_cache(trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_product_cache_active ON public.product_cache(is_active);
