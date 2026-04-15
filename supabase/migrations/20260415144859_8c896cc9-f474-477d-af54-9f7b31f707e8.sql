
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  language TEXT DEFAULT 'en',
  theme TEXT DEFAULT 'dark',
  onboarded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Style profiles
CREATE TABLE public.style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_styles TEXT[] DEFAULT '{}',
  disliked_styles TEXT[] DEFAULT '{}',
  preferred_fit TEXT,
  budget TEXT,
  favorite_brands TEXT[] DEFAULT '{}',
  occasions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.style_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own style" ON public.style_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own style" ON public.style_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own style" ON public.style_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_style_profiles_updated_at BEFORE UPDATE ON public.style_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Body profiles
CREATE TABLE public.body_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  shoulder_width_cm NUMERIC,
  waist_cm NUMERIC,
  inseam_cm NUMERIC,
  shoe_size TEXT,
  silhouette_type TEXT,
  body_landmarks JSONB DEFAULT '{}',
  scan_confidence NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.body_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own body" ON public.body_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own body" ON public.body_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own body" ON public.body_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_body_profiles_updated_at BEFORE UPDATE ON public.body_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Interactions (event tracking for recommendation algorithm)
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'product',
  target_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own interactions" ON public.interactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interactions" ON public.interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_interactions_user ON public.interactions(user_id);
CREATE INDEX idx_interactions_event ON public.interactions(event_type);

-- Saved items
CREATE TABLE public.saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own saved" ON public.saved_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved" ON public.saved_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved" ON public.saved_items FOR DELETE USING (auth.uid() = user_id);

-- OOTD posts
CREATE TABLE public.ootd_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  style_tags TEXT[] DEFAULT '{}',
  occasion_tags TEXT[] DEFAULT '{}',
  weather_tag TEXT,
  linked_products TEXT[] DEFAULT '{}',
  star_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ootd_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view posts" ON public.ootd_posts FOR SELECT USING (true);
CREATE POLICY "Users can insert own posts" ON public.ootd_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.ootd_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.ootd_posts FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_ootd_posts_updated_at BEFORE UPDATE ON public.ootd_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- OOTD stars (3 per day limit enforced by trigger)
CREATE TABLE public.ootd_stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.ootd_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);
ALTER TABLE public.ootd_stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stars" ON public.ootd_stars FOR SELECT USING (true);
CREATE POLICY "Users can insert own stars" ON public.ootd_stars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stars" ON public.ootd_stars FOR DELETE USING (auth.uid() = user_id);

-- Enforce 3 stars per day
CREATE OR REPLACE FUNCTION public.enforce_daily_star_limit()
RETURNS TRIGGER AS $$
DECLARE
  today_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO today_count
  FROM public.ootd_stars
  WHERE user_id = NEW.user_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day';
  IF today_count >= 3 THEN
    RAISE EXCEPTION 'Daily star limit reached (3 per day)';
  END IF;
  -- Increment star_count on the post
  UPDATE public.ootd_posts SET star_count = star_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_daily_star_limit BEFORE INSERT ON public.ootd_stars FOR EACH ROW EXECUTE FUNCTION public.enforce_daily_star_limit();

-- Decrement star_count on delete
CREATE OR REPLACE FUNCTION public.decrement_star_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.ootd_posts SET star_count = GREATEST(star_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_star_removed AFTER DELETE ON public.ootd_stars FOR EACH ROW EXECUTE FUNCTION public.decrement_star_count();
