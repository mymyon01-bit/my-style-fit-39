
ALTER TABLE public.product_cache DROP CONSTRAINT IF EXISTS product_cache_external_id_key;
ALTER TABLE public.product_cache ADD CONSTRAINT product_cache_platform_external_id_key UNIQUE (platform, external_id);
