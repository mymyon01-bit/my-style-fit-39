
CREATE TABLE public.octoparse_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL UNIQUE,
  label text NOT NULL,
  category text,
  gender text,
  source_site text,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_inserted_count integer DEFAULT 0,
  last_error text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.octoparse_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view octoparse tasks"
  ON public.octoparse_tasks FOR SELECT
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()));

CREATE POLICY "Admins can manage octoparse tasks"
  ON public.octoparse_tasks FOR ALL
  TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

CREATE TRIGGER octoparse_tasks_updated_at
  BEFORE UPDATE ON public.octoparse_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
