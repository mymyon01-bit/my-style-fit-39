
-- Helpers
CREATE OR REPLACE FUNCTION public.is_admin_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::public.app_role
  )
$$;

-- Permissions
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  can_manage_admins boolean NOT NULL DEFAULT false,
  can_manage_flags boolean NOT NULL DEFAULT false,
  can_edit_fit_rules boolean NOT NULL DEFAULT false,
  can_edit_brand_calibration boolean NOT NULL DEFAULT false,
  can_edit_products boolean NOT NULL DEFAULT false,
  can_edit_content boolean NOT NULL DEFAULT false,
  can_view_sensitive boolean NOT NULL DEFAULT false,
  can_edit_app_config boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view permissions" ON public.admin_permissions FOR SELECT TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "Super admin manages permissions" ON public.admin_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER update_admin_permissions_updated_at BEFORE UPDATE ON public.admin_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_role text,
  action text NOT NULL,
  target_table text,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON public.admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_table ON public.admin_audit_log(target_table);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_log(created_at DESC);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit log" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "Admins insert audit rows" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_above(auth.uid()) AND auth.uid() = actor_id);

CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text, _target_table text, _target_id text,
  _before jsonb, _after jsonb, _reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid; _role text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_above(auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  SELECT role::text INTO _role FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role::text WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END
  LIMIT 1;
  INSERT INTO public.admin_audit_log
    (actor_id, actor_role, action, target_table, target_id, before_data, after_data, reason)
  VALUES (auth.uid(), _role, _action, _target_table, _target_id, _before, _after, _reason)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Brand fit profiles
CREATE TABLE IF NOT EXISTS public.brand_fit_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL UNIQUE,
  fit_bias text NOT NULL DEFAULT 'true_to_size',
  chest_adjustment_cm numeric NOT NULL DEFAULT 0,
  waist_adjustment_cm numeric NOT NULL DEFAULT 0,
  shoulder_adjustment_cm numeric NOT NULL DEFAULT 0,
  length_adjustment_cm numeric NOT NULL DEFAULT 0,
  hip_adjustment_cm numeric NOT NULL DEFAULT 0,
  inseam_adjustment_cm numeric NOT NULL DEFAULT 0,
  category_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_fit_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads brand calibration" ON public.brand_fit_profiles FOR SELECT USING (true);
CREATE POLICY "Admins manage brand calibration" ON public.brand_fit_profiles FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));
CREATE TRIGGER update_brand_fit_profiles_updated_at BEFORE UPDATE ON public.brand_fit_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fit size rules
CREATE TABLE IF NOT EXISTS public.fit_size_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gender text NOT NULL,
  category text NOT NULL,
  subcategory text,
  fit_intent text,
  ease_chest_cm numeric,
  ease_waist_cm numeric,
  ease_hip_cm numeric,
  ease_shoulder_cm numeric,
  ease_length_cm numeric,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fit_size_rules_unique
  ON public.fit_size_rules(gender, category, COALESCE(subcategory,''), COALESCE(fit_intent,''));
ALTER TABLE public.fit_size_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads fit rules" ON public.fit_size_rules FOR SELECT USING (true);
CREATE POLICY "Admins manage fit rules" ON public.fit_size_rules FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));
CREATE TRIGGER update_fit_size_rules_updated_at BEFORE UPDATE ON public.fit_size_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fallback tables
CREATE TABLE IF NOT EXISTS public.fit_fallback_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gender text NOT NULL,
  category text NOT NULL,
  size_label text NOT NULL,
  chest_cm numeric, waist_cm numeric, hip_cm numeric, shoulder_cm numeric,
  sleeve_cm numeric, length_cm numeric, inseam_cm numeric, thigh_cm numeric, rise_cm numeric,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fit_fallback_unique
  ON public.fit_fallback_tables(gender, category, size_label);
ALTER TABLE public.fit_fallback_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads fallback tables" ON public.fit_fallback_tables FOR SELECT USING (true);
CREATE POLICY "Admins manage fallback tables" ON public.fit_fallback_tables FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));
CREATE TRIGGER update_fit_fallback_tables_updated_at BEFORE UPDATE ON public.fit_fallback_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fit feedback
CREATE TABLE IF NOT EXISTS public.fit_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_key text NOT NULL,
  brand text, category text, product_gender text, user_gender text,
  recommended_size text, chosen_size text,
  feedback_type text NOT NULL,
  feedback_areas text[] DEFAULT '{}',
  satisfaction smallint,
  notes text,
  body_cluster text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fit_feedback_brand_cat ON public.fit_feedback(brand, category);
CREATE INDEX IF NOT EXISTS idx_fit_feedback_user ON public.fit_feedback(user_id);
ALTER TABLE public.fit_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own feedback" ON public.fit_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own feedback" ON public.fit_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all feedback" ON public.fit_feedback FOR SELECT TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "Admins manage feedback" ON public.fit_feedback FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));

-- Feature flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  description text,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percent smallint NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads feature flags" ON public.feature_flags FOR SELECT USING (true);
CREATE POLICY "Admins manage feature flags" ON public.feature_flags FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- App config
CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'general',
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  is_secret boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads non-secret config" ON public.app_config FOR SELECT
  USING (is_secret = false);
CREATE POLICY "Admins read all config" ON public.app_config FOR SELECT TO authenticated
  USING (public.is_admin_or_above(auth.uid()));
CREATE POLICY "Admins manage config" ON public.app_config FOR ALL TO authenticated
  USING (public.is_admin_or_above(auth.uid()))
  WITH CHECK (public.is_admin_or_above(auth.uid()));
CREATE TRIGGER update_app_config_updated_at BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Strengthen user_roles policies for super-admin role management
DROP POLICY IF EXISTS "Super admin manages roles" ON public.user_roles;
CREATE POLICY "Super admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins view roles" ON public.user_roles;
CREATE POLICY "Admins view roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_admin_or_above(auth.uid()) OR auth.uid() = user_id);
