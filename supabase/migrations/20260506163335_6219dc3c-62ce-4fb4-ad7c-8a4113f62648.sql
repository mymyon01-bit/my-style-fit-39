ALTER TABLE public.fit_feedback
  ADD COLUMN IF NOT EXISTS target_gender text,
  ADD COLUMN IF NOT EXISTS body_signature text,
  ADD COLUMN IF NOT EXISTS selected_size text;

CREATE INDEX IF NOT EXISTS idx_fit_feedback_body_sig ON public.fit_feedback (body_signature);
CREATE INDEX IF NOT EXISTS idx_fit_feedback_target_gender ON public.fit_feedback (target_gender);