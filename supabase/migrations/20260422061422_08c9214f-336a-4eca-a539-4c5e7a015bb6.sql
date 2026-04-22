-- ─── PRODUCT-IMAGES BUCKET (persistent storage for proxied product images) ──
-- Needed because most ingested images are hotlinked Google CDN URLs that block
-- cross-origin requests and expire. We copy them into our own bucket on first
-- successful access and rewrite product_cache.image_url to the permanent URL.

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (so <img src> works without auth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'product_images_public_read'
  ) THEN
    CREATE POLICY product_images_public_read
      ON storage.objects FOR SELECT
      USING (bucket_id = 'product-images');
  END IF;
END $$;

-- Service-role / edge functions write (no client-side writes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'product_images_service_write'
  ) THEN
    CREATE POLICY product_images_service_write
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'service_role');
  END IF;
END $$;

-- ─── DB CLEANUP: deactivate obvious non-fashion ─────────────────────────────
-- Golf clubs, yard games, groceries, electronics, etc. that slipped through
-- the loose validators. Conservative — only matches obvious non-clothing terms.
UPDATE public.product_cache
   SET is_active = false,
       updated_at = now()
 WHERE is_active = true
   AND (
        name ~* '\m(golf\s*club|golf\s*set|golf\s*ball|cart\s*bag|driver|putter|wedge\s*set|iron\s*set|hybrid\s*set|tee\s*marker|yard\s*game|yard\s*links|cornhole|frisbee\s*set|practice\s*golf|disc\s*golf|hockey|baseball\s*bat|tennis\s*racket|skateboard|surfboard|paddle|kayak)\M'
     OR name ~* '\m(charger|cable|adapter|laptop|tablet|phone\s*case|earbuds|headphone|speaker|router|monitor|keyboard|mouse|webcam)\M'
     OR name ~* '\m(grocery|snack|vitamin|supplement|protein\s*powder|coffee\s*bean|tea\s*bag|recipe|cookbook)\M'
     OR name ~* '\m(template|mockup|printable|digital\s*download|svg\s*file|png\s*file|cricut|vector\s*pack|font\s*bundle)\M'
     OR name ~* '\m(poster|wall\s*art|canvas\s*print|sticker\s*pack|decal|wallpaper)\M'
   );

-- Re-classify obviously misclassified "accessories" rows where the title
-- clearly indicates clothing.
UPDATE public.product_cache
   SET category = 'tops', updated_at = now()
 WHERE is_active = true
   AND category IN ('accessories', 'other', 'clothing', 'general', 'fashion', 'miscellaneous')
   AND name ~* '\m(t-?shirt|shirt|tee|hoodie|sweater|sweatshirt|cardigan|polo|blouse|tank|knit|jersey|crewneck|pullover|henley|tunic|camisole|top)\M'
   AND name !~* '\m(skirt|dress|pants|jacket|coat|shoes?|bag)\M';

UPDATE public.product_cache
   SET category = 'outerwear', updated_at = now()
 WHERE is_active = true
   AND category IN ('accessories', 'other', 'clothing', 'general', 'fashion', 'miscellaneous')
   AND name ~* '\m(jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker|anorak|gilet|puffer)\M';

UPDATE public.product_cache
   SET category = 'bottoms', updated_at = now()
 WHERE is_active = true
   AND category IN ('accessories', 'other', 'clothing', 'general', 'fashion', 'miscellaneous')
   AND name ~* '\m(pants|trousers|jeans|shorts|skirt|chinos?|joggers?|leggings?|slacks|culottes|skort)\M';

UPDATE public.product_cache
   SET category = 'dresses', updated_at = now()
 WHERE is_active = true
   AND category IN ('accessories', 'other', 'clothing', 'general', 'fashion', 'miscellaneous')
   AND name ~* '\m(dress|jumpsuit|romper|gown|sundress|maxi\s*dress|mini\s*dress|midi\s*dress)\M';

UPDATE public.product_cache
   SET category = 'shoes', updated_at = now()
 WHERE is_active = true
   AND category IN ('accessories', 'other', 'clothing', 'general', 'fashion', 'miscellaneous')
   AND name ~* '\m(sneakers?|boots?|loafers?|sandals?|trainers?|mules?|heels?|pumps?|flats?|oxfords?|espadrilles?)\M';