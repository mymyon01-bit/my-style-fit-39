-- Add platform column to product_cache
ALTER TABLE public.product_cache
  ADD COLUMN IF NOT EXISTS platform text DEFAULT 'ai_search';

-- Index for platform filtering
CREATE INDEX IF NOT EXISTS idx_product_cache_platform ON public.product_cache (platform);

-- Composite index for DB-first discover queries
CREATE INDEX IF NOT EXISTS idx_product_cache_active_trend ON public.product_cache (is_active, trend_score DESC)
  WHERE is_active = true AND image_valid = true;

-- Index for dedup by external_id + platform
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_cache_platform_external
  ON public.product_cache (platform, external_id)
  WHERE external_id IS NOT NULL;