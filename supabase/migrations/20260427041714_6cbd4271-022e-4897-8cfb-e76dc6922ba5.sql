-- Track per-user, per-day star grants for action-based rewards
CREATE TABLE IF NOT EXISTS public.star_action_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  grant_date date NOT NULL DEFAULT CURRENT_DATE,
  stars_awarded int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, action, grant_date)
);

ALTER TABLE public.star_action_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own action grants"
  ON public.star_action_grants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own action grants"
  ON public.star_action_grants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS star_action_grants_user_date_idx
  ON public.star_action_grants (user_id, grant_date DESC);

-- RPC to atomically claim a daily star for a given action
CREATE OR REPLACE FUNCTION public.claim_star_action(_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _me uuid := auth.uid();
  _allowed text[] := ARRAY['share_ootd', 'discover_import', 'join_circle'];
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT (_action = ANY(_allowed)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_action');
  END IF;

  -- Insert grant; do nothing if already claimed today
  INSERT INTO public.star_action_grants (user_id, action, grant_date, stars_awarded)
  VALUES (_me, _action, CURRENT_DATE, 1)
  ON CONFLICT (user_id, action, grant_date) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed_today');
  END IF;

  -- Award the star
  UPDATE public.profiles
     SET bonus_stars = bonus_stars + 1,
         updated_at = now()
   WHERE user_id = _me;

  RETURN jsonb_build_object('ok', true, 'stars_awarded', 1);
END;
$$;