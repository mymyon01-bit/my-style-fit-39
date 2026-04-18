
-- 1. Add new columns
ALTER TABLE public.query_clusters
  ADD COLUMN IF NOT EXISTS normalized_query text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS usage_count integer NOT NULL DEFAULT 0;

-- 2. Backfill normalized_query from existing query_family
UPDATE public.query_clusters
SET normalized_query = lower(trim(query_family))
WHERE normalized_query IS NULL;

-- 3. Uniqueness on cluster_key (one row per family)
CREATE UNIQUE INDEX IF NOT EXISTS query_clusters_cluster_key_uq
  ON public.query_clusters (cluster_key);

-- 4. Lookup index
CREATE INDEX IF NOT EXISTS query_clusters_normalized_query_idx
  ON public.query_clusters (normalized_query);

-- 5. SECURITY DEFINER helper: upsert + bump usage_count.
--    Public can call it (RLS still locks direct writes to admins).
--    Limits product_ids to 60 to avoid runaway row growth.
CREATE OR REPLACE FUNCTION public.upsert_query_cluster(
  _cluster_key text,
  _query_family text,
  _normalized_query text,
  _category text,
  _tags text[],
  _product_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.query_clusters AS qc (
    cluster_key, query_family, normalized_query, category,
    tags, product_ids, product_count, last_refreshed_at, usage_count
  )
  VALUES (
    _cluster_key, _query_family, _normalized_query, _category,
    COALESCE(_tags, '{}'::text[]),
    COALESCE(_product_ids[1:60], '{}'::uuid[]),
    COALESCE(array_length(_product_ids[1:60], 1), 0),
    now(),
    1
  )
  ON CONFLICT (cluster_key) DO UPDATE
  SET
    query_family    = EXCLUDED.query_family,
    normalized_query= EXCLUDED.normalized_query,
    category        = COALESCE(EXCLUDED.category, qc.category),
    tags            = (
      SELECT array_agg(DISTINCT t)
      FROM unnest(qc.tags || EXCLUDED.tags) AS t
    ),
    product_ids     = COALESCE(EXCLUDED.product_ids, qc.product_ids),
    product_count   = COALESCE(array_length(EXCLUDED.product_ids, 1), qc.product_count),
    last_refreshed_at = now(),
    usage_count     = qc.usage_count + 1,
    updated_at      = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_query_cluster(text, text, text, text, text[], uuid[]) TO anon, authenticated;
