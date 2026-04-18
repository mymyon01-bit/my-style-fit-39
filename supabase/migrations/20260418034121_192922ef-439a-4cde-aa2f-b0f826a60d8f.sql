CREATE TABLE public.diagnostics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  duration_ms INTEGER,
  user_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_diagnostics_events_name_created ON public.diagnostics_events (event_name, created_at DESC);
CREATE INDEX idx_diagnostics_events_status_created ON public.diagnostics_events (status, created_at DESC);

ALTER TABLE public.diagnostics_events ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can insert telemetry — no PII required, no auth check
CREATE POLICY "diagnostics_insert_anyone"
  ON public.diagnostics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read the audit log
CREATE POLICY "diagnostics_select_admin"
  ON public.diagnostics_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No update/delete policies => nobody can mutate or remove events