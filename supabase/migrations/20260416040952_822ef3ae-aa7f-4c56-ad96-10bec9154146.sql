
-- 1. User roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Product categories (hierarchical)
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories" ON public.product_categories
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert categories" ON public.product_categories
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update categories" ON public.product_categories
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete categories" ON public.product_categories
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  price numeric,
  currency text DEFAULT 'USD',
  description text,
  images text[] DEFAULT '{}',
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  style_tags text[] DEFAULT '{}',
  color_tags text[] DEFAULT '{}',
  fit_type text,
  source_url text,
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can insert products" ON public.products
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_style_tags ON public.products USING GIN(style_tags);
CREATE INDEX idx_products_featured ON public.products(is_featured) WHERE is_featured = true;

-- 4. Saved folders
CREATE TABLE public.saved_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

ALTER TABLE public.saved_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders" ON public.saved_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own folders" ON public.saved_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own folders" ON public.saved_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own folders" ON public.saved_folders
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_saved_folders_updated_at
  BEFORE UPDATE ON public.saved_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Add folder_id to saved_items
ALTER TABLE public.saved_items ADD COLUMN folder_id uuid REFERENCES public.saved_folders(id) ON DELETE SET NULL;

-- 6. Seed top-level categories
INSERT INTO public.product_categories (id, name, slug, sort_order, icon) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Clothes', 'clothes', 1, 'shirt'),
  ('a0000000-0000-0000-0000-000000000002', 'Accessories', 'accessories', 2, 'gem'),
  ('a0000000-0000-0000-0000-000000000003', 'Bags', 'bags', 3, 'shopping-bag'),
  ('a0000000-0000-0000-0000-000000000004', 'Wallets', 'wallets', 4, 'wallet'),
  ('a0000000-0000-0000-0000-000000000005', 'Shoes', 'shoes', 5, 'footprints'),
  ('a0000000-0000-0000-0000-000000000006', 'Jewelry', 'jewelry', 6, 'diamond'),
  ('a0000000-0000-0000-0000-000000000007', 'Hats', 'hats', 7, 'hard-hat'),
  ('a0000000-0000-0000-0000-000000000008', 'Eyewear', 'eyewear', 8, 'glasses');

-- Clothes subcategories
INSERT INTO public.product_categories (name, slug, parent_id, sort_order) VALUES
  ('Outerwear', 'outerwear', 'a0000000-0000-0000-0000-000000000001', 1),
  ('Tops', 'tops', 'a0000000-0000-0000-0000-000000000001', 2),
  ('Bottoms', 'bottoms', 'a0000000-0000-0000-0000-000000000001', 3),
  ('Dresses', 'dresses', 'a0000000-0000-0000-0000-000000000001', 4),
  ('Knitwear', 'knitwear', 'a0000000-0000-0000-0000-000000000001', 5),
  ('Shirts', 'shirts', 'a0000000-0000-0000-0000-000000000001', 6),
  ('Denim', 'denim', 'a0000000-0000-0000-0000-000000000001', 7),
  ('Tailoring', 'tailoring', 'a0000000-0000-0000-0000-000000000001', 8),
  ('Activewear', 'activewear', 'a0000000-0000-0000-0000-000000000001', 9);

-- Accessories subcategories
INSERT INTO public.product_categories (name, slug, parent_id, sort_order) VALUES
  ('Belts', 'belts', 'a0000000-0000-0000-0000-000000000002', 1),
  ('Scarves', 'scarves', 'a0000000-0000-0000-0000-000000000002', 2),
  ('Watches', 'watches', 'a0000000-0000-0000-0000-000000000002', 3),
  ('Hair Accessories', 'hair-accessories', 'a0000000-0000-0000-0000-000000000002', 4),
  ('Small Accessories', 'small-accessories', 'a0000000-0000-0000-0000-000000000002', 5);

-- Bags subcategories
INSERT INTO public.product_categories (name, slug, parent_id, sort_order) VALUES
  ('Shoulder Bags', 'shoulder-bags', 'a0000000-0000-0000-0000-000000000003', 1),
  ('Tote Bags', 'tote-bags', 'a0000000-0000-0000-0000-000000000003', 2),
  ('Crossbody Bags', 'crossbody-bags', 'a0000000-0000-0000-0000-000000000003', 3),
  ('Backpacks', 'backpacks', 'a0000000-0000-0000-0000-000000000003', 4),
  ('Mini Bags', 'mini-bags', 'a0000000-0000-0000-0000-000000000003', 5);

-- Wallets subcategories
INSERT INTO public.product_categories (name, slug, parent_id, sort_order) VALUES
  ('Card Holders', 'card-holders', 'a0000000-0000-0000-0000-000000000004', 1),
  ('Zip Wallets', 'zip-wallets', 'a0000000-0000-0000-0000-000000000004', 2),
  ('Fold Wallets', 'fold-wallets', 'a0000000-0000-0000-0000-000000000004', 3);
