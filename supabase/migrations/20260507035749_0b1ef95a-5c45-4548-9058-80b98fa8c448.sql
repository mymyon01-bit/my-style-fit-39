-- V4.3 Smart Archive (Style Boards) + Fit Memory

-- STYLE BOARDS: Pinterest-style fashion mood/style boards
CREATE TABLE IF NOT EXISTS public.style_boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  board_type TEXT NOT NULL DEFAULT 'archive', -- 'archive' | 'style_mix' | 'inspiration' | 'look'
  tags TEXT[] NOT NULL DEFAULT '{}',
  item_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_style_boards_user ON public.style_boards(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_style_boards_public ON public.style_boards(is_public, updated_at DESC) WHERE is_public = true;

ALTER TABLE public.style_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own boards" ON public.style_boards
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users insert own boards" ON public.style_boards
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own boards" ON public.style_boards
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own boards" ON public.style_boards
  FOR DELETE USING (auth.uid() = user_id);

-- STYLE BOARD ITEMS
CREATE TABLE IF NOT EXISTS public.style_board_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.style_boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  product_id UUID,
  product_key TEXT,
  image_url TEXT,
  title TEXT,
  brand TEXT,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb, -- {x,y,w,h,rotate} for canvas
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_items_board ON public.style_board_items(board_id, position);
CREATE INDEX IF NOT EXISTS idx_board_items_user ON public.style_board_items(user_id);

ALTER TABLE public.style_board_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View items on accessible boards" ON public.style_board_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.style_boards b
            WHERE b.id = board_id AND (b.user_id = auth.uid() OR b.is_public = true))
  );
CREATE POLICY "Users insert own items" ON public.style_board_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own items" ON public.style_board_items
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own items" ON public.style_board_items
  FOR DELETE USING (auth.uid() = user_id);

-- Maintain item_count
CREATE OR REPLACE FUNCTION public.bump_style_board_item_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.style_boards SET item_count = item_count + 1, updated_at = now() WHERE id = NEW.board_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.style_boards SET item_count = GREATEST(item_count - 1, 0), updated_at = now() WHERE id = OLD.board_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_style_board_item_count ON public.style_board_items;
CREATE TRIGGER trg_style_board_item_count
AFTER INSERT OR DELETE ON public.style_board_items
FOR EACH ROW EXECUTE FUNCTION public.bump_style_board_item_count();

CREATE TRIGGER trg_style_boards_updated
BEFORE UPDATE ON public.style_boards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FIT MEMORY: per-user remembered fit preferences derived from feedback + saves
CREATE TABLE IF NOT EXISTS public.fit_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  preferred_fit TEXT, -- 'slim' | 'regular' | 'oversized' | 'relaxed'
  oversized_tolerance NUMERIC NOT NULL DEFAULT 0, -- 0..1
  preferred_inseam_cm NUMERIC,
  preferred_rise TEXT, -- 'low' | 'mid' | 'high'
  small_running_brands TEXT[] NOT NULL DEFAULT '{}',
  large_running_brands TEXT[] NOT NULL DEFAULT '{}',
  liked_silhouettes TEXT[] NOT NULL DEFAULT '{}',
  disliked_silhouettes TEXT[] NOT NULL DEFAULT '{}',
  reference_garments JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{product_key, brand, size, fit_label}]
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fit_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own fit memory" ON public.fit_memory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own fit memory" ON public.fit_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own fit memory" ON public.fit_memory
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own fit memory" ON public.fit_memory
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_fit_memory_updated
BEFORE UPDATE ON public.fit_memory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();