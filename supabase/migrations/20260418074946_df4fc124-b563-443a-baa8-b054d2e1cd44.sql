CREATE TABLE IF NOT EXISTS public.user_seen_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_key text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_key)
);

CREATE INDEX IF NOT EXISTS idx_user_seen_products_user_recent
  ON public.user_seen_products (user_id, seen_at DESC);

ALTER TABLE public.user_seen_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own seen"
  ON public.user_seen_products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own seen"
  ON public.user_seen_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own seen"
  ON public.user_seen_products FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-expire entries older than 24h on read via helper function
CREATE OR REPLACE FUNCTION public.purge_old_seen_products()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.user_seen_products WHERE seen_at < now() - INTERVAL '24 hours';
$$;