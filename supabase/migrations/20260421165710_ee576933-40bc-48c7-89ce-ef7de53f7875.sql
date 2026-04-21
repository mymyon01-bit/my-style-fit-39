-- Cached real garment measurements per product (one row per size)
CREATE TABLE public.garment_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_key TEXT NOT NULL,
  product_id UUID NULL,
  source_url TEXT NULL,
  category TEXT NOT NULL,
  size_label TEXT NOT NULL,
  shoulder_cm NUMERIC NULL,
  chest_cm NUMERIC NULL,
  waist_cm NUMERIC NULL,
  hip_cm NUMERIC NULL,
  sleeve_cm NUMERIC NULL,
  total_length_cm NUMERIC NULL,
  thigh_cm NUMERIC NULL,
  inseam_cm NUMERIC NULL,
  rise_cm NUMERIC NULL,
  stretch_factor NUMERIC NULL DEFAULT 0,
  fit_type TEXT NULL,
  source TEXT NOT NULL DEFAULT 'estimator',
  confidence TEXT NOT NULL DEFAULT 'low',
  raw_extraction JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_key, size_label)
);
CREATE INDEX idx_garment_measurements_product_key ON public.garment_measurements (product_key);
ALTER TABLE public.garment_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view garment measurements"
  ON public.garment_measurements FOR SELECT USING (true);
CREATE POLICY "Admins can manage garment measurements"
  ON public.garment_measurements FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Cache for generated fit visualization images
CREATE TABLE public.fit_generations_v2 (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  product_key TEXT NOT NULL,
  size_label TEXT NOT NULL,
  body_signature TEXT NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NULL,
  fit_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, cache_key)
);
CREATE INDEX idx_fit_generations_v2_user ON public.fit_generations_v2 (user_id);
CREATE INDEX idx_fit_generations_v2_cache_key ON public.fit_generations_v2 (cache_key);
ALTER TABLE public.fit_generations_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own generations" ON public.fit_generations_v2
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own generations" ON public.fit_generations_v2
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own generations" ON public.fit_generations_v2
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own generations" ON public.fit_generations_v2
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_garment_measurements_updated_at
BEFORE UPDATE ON public.garment_measurements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_fit_generations_v2_updated_at
BEFORE UPDATE ON public.fit_generations_v2
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();