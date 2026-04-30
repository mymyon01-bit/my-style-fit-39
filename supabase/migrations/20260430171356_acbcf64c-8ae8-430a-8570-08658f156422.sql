CREATE TABLE IF NOT EXISTS public.app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'android',
  version_name text NOT NULL,
  version_code integer NOT NULL,
  apk_url text NOT NULL,
  release_notes text,
  min_supported_version_code integer NOT NULL DEFAULT 1,
  is_critical boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  released_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, version_code)
);

CREATE INDEX IF NOT EXISTS idx_app_releases_lookup
  ON public.app_releases (platform, is_published, version_code DESC);

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published releases"
  ON public.app_releases FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can insert releases"
  ON public.app_releases FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can update releases"
  ON public.app_releases FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can delete releases"
  ON public.app_releases FOR DELETE
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE TRIGGER trg_app_releases_updated_at
  BEFORE UPDATE ON public.app_releases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();