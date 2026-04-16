-- Upgrade ai_search products from "low" to "medium" trust so DB-first actually serves them
UPDATE public.product_cache 
SET source_trust_level = 'medium' 
WHERE source_trust_level = 'low' AND is_active = true AND image_valid = true;

-- Add index for faster DB-first queries
CREATE INDEX IF NOT EXISTS idx_product_cache_active_trust ON public.product_cache (is_active, image_valid, source_trust_level, trend_score DESC);

-- Add index for category browsing
CREATE INDEX IF NOT EXISTS idx_product_cache_category ON public.product_cache (category) WHERE is_active = true AND image_valid = true;