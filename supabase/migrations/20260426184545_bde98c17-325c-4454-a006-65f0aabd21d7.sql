-- Track removed accounts so we can show an OOTD-styled "removed" message on sign-in attempts.
-- Re-signup with the same email is allowed because the underlying auth.users row is deleted.

CREATE TABLE IF NOT EXISTS public.removed_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  reason TEXT,
  removed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  removed_by UUID
);

CREATE INDEX IF NOT EXISTS idx_removed_accounts_email_lower
  ON public.removed_accounts (lower(email));

ALTER TABLE public.removed_accounts ENABLE ROW LEVEL SECURITY;

-- Anyone can check if an email was removed (used by the public "account removed" screen).
-- Only email lookups are useful; no PII beyond email + reason is stored.
CREATE POLICY "Public can check removal by email"
ON public.removed_accounts
FOR SELECT
TO public
USING (true);

-- Only admins can record removals.
CREATE POLICY "Admins record removals"
ON public.removed_accounts
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage removals"
ON public.removed_accounts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));