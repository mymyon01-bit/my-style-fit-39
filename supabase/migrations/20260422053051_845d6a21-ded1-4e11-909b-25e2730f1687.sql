-- De-duplicate any existing collisions before adding the unique constraint
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY product_key, upper(size_label)
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM public.garment_measurements
)
DELETE FROM public.garment_measurements gm
USING ranked r
WHERE gm.id = r.id AND r.rn > 1;

-- Normalize size_label so the unique key is case-insensitive in practice
UPDATE public.garment_measurements SET size_label = upper(size_label) WHERE size_label <> upper(size_label);

ALTER TABLE public.garment_measurements
  ADD CONSTRAINT garment_measurements_product_size_unique
  UNIQUE (product_key, size_label);

CREATE INDEX IF NOT EXISTS idx_garment_measurements_product_key
  ON public.garment_measurements(product_key);