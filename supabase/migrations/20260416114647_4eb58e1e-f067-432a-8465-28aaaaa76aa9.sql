-- Add source trust tracking to product_cache
ALTER TABLE public.product_cache 
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'scraper',
  ADD COLUMN IF NOT EXISTS source_trust_level text NOT NULL DEFAULT 'medium';

-- Add index for fast trust-level filtering
CREATE INDEX IF NOT EXISTS idx_product_cache_trust ON public.product_cache (source_trust_level);

-- Add index for deduplication by source_url
CREATE INDEX IF NOT EXISTS idx_product_cache_source_url ON public.product_cache (source_url) WHERE source_url IS NOT NULL;

-- Mark existing ai_search products as low trust (AI-fabricated)
UPDATE public.product_cache SET source_trust_level = 'low', source_type = 'ai' WHERE platform = 'ai_search';

-- Mark scraped products as medium trust
UPDATE public.product_cache SET source_trust_level = 'medium', source_type = 'scraper' WHERE platform != 'ai_search' AND source_type = 'scraper';