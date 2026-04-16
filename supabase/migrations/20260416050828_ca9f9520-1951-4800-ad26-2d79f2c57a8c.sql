
-- Product cache / inventory table
CREATE TABLE public.product_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  name text NOT NULL,
  brand text,
  price text,
  currency text DEFAULT 'USD',
  category text,
  subcategory text,
  style_tags text[] DEFAULT '{}',
  color_tags text[] DEFAULT '{}',
  fit text,
  image_url text,
  source_url text,
  store_name text,
  reason text,
  image_valid boolean DEFAULT true,
  last_validated timestamptz DEFAULT now(),
  search_query text,
  view_count integer DEFAULT 0,
  like_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached products
CREATE POLICY "Anyone can view cached products"
  ON public.product_cache FOR SELECT USING (true);

-- Only service role inserts (edge functions use service role key)
-- No insert/update policy for anon = only service role can write

CREATE INDEX idx_product_cache_category ON public.product_cache(category);
CREATE INDEX idx_product_cache_style ON public.product_cache USING GIN(style_tags);
CREATE INDEX idx_product_cache_image_valid ON public.product_cache(image_valid);
CREATE INDEX idx_product_cache_external_id ON public.product_cache(external_id);

-- Image failure tracking for admin
CREATE TABLE public.image_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text,
  brand text,
  image_url text,
  failure_reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.image_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view image failures"
  ON public.image_failures FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on product_cache
CREATE TRIGGER update_product_cache_updated_at
  BEFORE UPDATE ON public.product_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
