-- Add best_item_id to showrooms (owner's pinned best pick, replaces playlist concept)
ALTER TABLE public.showrooms
  ADD COLUMN IF NOT EXISTS best_item_id uuid REFERENCES public.showroom_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_showrooms_best_item ON public.showrooms(best_item_id);