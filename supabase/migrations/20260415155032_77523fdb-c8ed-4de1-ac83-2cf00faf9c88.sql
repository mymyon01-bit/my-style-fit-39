
-- Create subscription plan enum
CREATE TYPE public.subscription_plan AS ENUM ('free', 'premium_trial', 'premium');
CREATE TYPE public.subscription_status AS ENUM ('active', 'expired', 'cancelled');

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  trial_start_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
ON public.subscriptions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert subscriptions"
ON public.subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create premium trial on profile creation
CREATE OR REPLACE FUNCTION public.activate_premium_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status, trial_start_date, trial_end_date)
  VALUES (NEW.user_id, 'premium_trial', 'active', now(), now() + INTERVAL '90 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: when a profile is created, activate trial
CREATE TRIGGER on_profile_created_activate_trial
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.activate_premium_trial();

-- Daily/weekly recommendation cache table
CREATE TABLE public.daily_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recommendation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recommendation_type TEXT NOT NULL DEFAULT 'daily',
  outfits JSONB NOT NULL DEFAULT '[]'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, recommendation_date, recommendation_type)
);

ALTER TABLE public.daily_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations"
ON public.daily_recommendations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations"
ON public.daily_recommendations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recommendations"
ON public.daily_recommendations FOR DELETE
USING (auth.uid() = user_id);
