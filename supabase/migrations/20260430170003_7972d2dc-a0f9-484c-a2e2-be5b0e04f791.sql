CREATE TABLE IF NOT EXISTS public.oauth_token_exchange (
  nonce TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '5 minutes')
);

ALTER TABLE public.oauth_token_exchange ENABLE ROW LEVEL SECURITY;

-- No client policies — only service role (used by the edge function) can read/write.
-- This table is sensitive; the edge function uses SERVICE_ROLE_KEY.

CREATE INDEX IF NOT EXISTS idx_oauth_token_exchange_expires ON public.oauth_token_exchange (expires_at);

-- Cleanup function: delete rows older than expiry (called opportunistically by the edge function).
CREATE OR REPLACE FUNCTION public.purge_expired_oauth_exchange()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.oauth_token_exchange WHERE expires_at < now();
$$;