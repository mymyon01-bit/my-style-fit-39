CREATE UNIQUE INDEX IF NOT EXISTS idx_product_cache_platform_external_id
ON public.product_cache (platform, external_id)
WHERE platform IS NOT NULL AND external_id IS NOT NULL;