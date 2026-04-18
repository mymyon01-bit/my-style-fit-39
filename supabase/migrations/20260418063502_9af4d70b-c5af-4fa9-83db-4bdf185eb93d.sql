CREATE TABLE public.fit_tryons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  product_key text NOT NULL,
  selected_size text NOT NULL,
  provider text NOT NULL DEFAULT 'replicate',
  model_id text,
  prediction_id text,
  status text NOT NULL DEFAULT 'pending',
  user_image_url text,
  product_image_url text,
  result_image_url text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fit_tryons_user_product_size_idx
  ON public.fit_tryons (user_id, product_key, selected_size);

CREATE INDEX fit_tryons_prediction_idx ON public.fit_tryons (prediction_id);

ALTER TABLE public.fit_tryons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tryons"
  ON public.fit_tryons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own tryons"
  ON public.fit_tryons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own tryons"
  ON public.fit_tryons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_fit_tryons_updated_at
  BEFORE UPDATE ON public.fit_tryons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();