
UPDATE public.product_cache
SET category = 'bags'
WHERE is_active = true
  AND (category IS NULL OR category IN ('footwear','shoes','other','clothing','accessories','general','fashion','miscellaneous'))
  AND name ~* '\m(tote|backpack|crossbody|clutch|purse|satchel|handbag|shoulder bag|hobo bag|bucket bag|messenger bag|duffle)\M'
  AND name !~* '\m(sneaker|boots?|loafers?|sandals?|heels?|pumps?|trainers?|oxfords?)\M';

UPDATE public.product_cache
SET category = 'shoes'
WHERE is_active = true
  AND (category IS NULL OR category IN ('other','clothing','bags','general','fashion','miscellaneous','accessories'))
  AND name ~* '\m(sneakers?|loafers?|sandals?|trainers?|mules?|heels?|pumps?|flats?|oxfords?|espadrilles?|brogues?)\M'
  AND name !~* '\m(bag|tote|backpack|crossbody|clutch|purse|satchel|handbag)\M';

UPDATE public.product_cache
SET category = 'outerwear'
WHERE is_active = true
  AND (category IS NULL OR category IN ('other','clothing','general','fashion','miscellaneous'))
  AND name ~* '\m(jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker|anorak|puffer)\M';
