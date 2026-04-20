-- 1. Add bonus_stars to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bonus_stars integer NOT NULL DEFAULT 0;

-- 2. Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'completed'
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_idx ON public.referrals(referred_id);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_one_pending_per_user
  ON public.referrals(referrer_id) WHERE status = 'pending';

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) can look up a code to claim it
CREATE POLICY "Anyone can view referral codes"
  ON public.referrals FOR SELECT
  USING (true);

CREATE POLICY "Users can create own referral code"
  ON public.referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

-- 3. Referral grants audit log
CREATE TABLE IF NOT EXISTS public.referral_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL, -- 'referrer' | 'referred'
  stars_awarded integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own grants"
  ON public.referral_grants FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Claim function — awards stars atomically
CREATE OR REPLACE FUNCTION public.claim_referral(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref public.referrals%ROWTYPE;
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _ref FROM public.referrals WHERE code = _code LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  IF _ref.referrer_id = _caller THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  IF _ref.status = 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  -- Prevent a user from being referred more than once
  IF EXISTS (
    SELECT 1 FROM public.referrals
    WHERE referred_id = _caller AND status = 'completed'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  -- Mark referral completed
  UPDATE public.referrals
  SET referred_id = _caller, status = 'completed', completed_at = now()
  WHERE id = _ref.id;

  -- Award stars
  UPDATE public.profiles SET bonus_stars = bonus_stars + 5 WHERE user_id = _ref.referrer_id;
  UPDATE public.profiles SET bonus_stars = bonus_stars + 3 WHERE user_id = _caller;

  -- Audit
  INSERT INTO public.referral_grants(referral_id, user_id, role, stars_awarded)
  VALUES (_ref.id, _ref.referrer_id, 'referrer', 5),
         (_ref.id, _caller, 'referred', 3);

  RETURN jsonb_build_object('ok', true, 'stars_awarded', 3);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;