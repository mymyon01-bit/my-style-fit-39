// ─── FASHION GUARD ──────────────────────────────────────────────────────────
// Single source of truth used at INGEST time (edge functions) and at READ time
// (UI hooks) to ensure only real wearable products survive.
//
// Quality > quantity. Better to show 5 perfect items than 50 broken ones.
//
// This file is plain TS (no DOM/Deno-only APIs) so it can be imported from:
//   • Vite client bundle (src/hooks, src/lib/search)
//   • Deno edge functions (via raw text re-export, see deno copy below)
// Keep it dependency-free.

/** Things that are clearly NOT clothing/wearable. Hard reject. */
export const NON_FASHION_RE =
  /\b(?:golf\s*(?:club|set|ball|tee|cart|bag\s*set)|cart\s*bag|driver|putter|wedge\s*set|iron\s*set|hybrid\s*set|tee\s*marker|yard\s*game|yard\s*links|cornhole|frisbee|disc\s*golf|hockey|baseball\s*bat|tennis\s*racket|skateboard|surfboard|paddle|kayak|barbell|dumbbell|treadmill|charger|cable|adapter|laptop|tablet|phone\s*case|earbuds|headphone|speaker|router|monitor|keyboard|mouse|webcam|grocery|snack|vitamin|supplement|protein\s*powder|coffee\s*bean|tea\s*bag|recipe|cookbook|template|mockup|printable|digital\s*download|svg\s*file|png\s*file|cricut|vector\s*pack|font\s*bundle|poster|wall\s*art|canvas\s*print|sticker\s*pack|decal|wallpaper|toy|plushie|doll|action\s*figure|board\s*game|puzzle|book|movie|music\s*album|gift\s*card|상품\s*권|교환권|두부|바나나)\b/i;

/** Words that confirm a product IS clothing or a worn accessory. */
export const FASHION_RE =
  /\b(?:jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker|anorak|gilet|puffer|cardigan|shirt|tee|t-shirts?|hoodie|sweater|sweatshirt|polo|blouse|tank|knit|jersey|crewneck|pullover|henley|tunic|camisole|top|pants|trousers|jeans|shorts|skirt|chinos?|joggers?|leggings?|slacks|culottes|skort|dress|jumpsuit|romper|gown|sundress|sneakers?|boots?|loafers?|sandals?|trainers?|mules?|heels?|pumps?|flats?|oxfords?|espadrilles?|bag|tote|backpack|crossbody|clutch|purse|satchel|duffle|messenger|handbag|wallet|hat|cap|beanie|fedora|beret|scarf|belt|gloves?|tie|sunglasses|necklace|bracelet|earrings?|ring(?!\s*set)|watch|jewelry|jewellery|outfit|outerwear|footwear|denim|leather|suede)\b/i;

/** Korean fashion vocabulary (Naver titles are Hangul). */
export const FASHION_KR_RE =
  /(자켓|재킷|코트|블레이저|셔츠|후디|후드|스웨터|니트|가디건|티셔츠|티|폴로|바지|팬츠|청바지|진|반바지|스커트|치마|드레스|원피스|운동화|스니커즈|신발|슈즈|부츠|로퍼|샌들|가방|백|토트|백팩|크로스백|클러치|모자|캡|비니|벨트|스카프|봄버|파카|풀오버|맨투맨|블라우스|점퍼|패딩|아우터|악세서리|악세사리|선글라스|시계|목걸이|팔찌|귀걸이|반지)/;

/**
 * Strict title check. Rejects non-fashion AND requires fashion vocabulary.
 * Use this BEFORE inserting into product_cache and BEFORE rendering.
 */
export function isFashionTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = String(title).trim();
  if (t.length < 3) return false;
  if (NON_FASHION_RE.test(t)) return false;
  return FASHION_RE.test(t) || FASHION_KR_RE.test(t);
}

/** Map a title to a strict garment category. Returns null if uncertain. */
export function classifyGarment(title: string | null | undefined): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  if (NON_FASHION_RE.test(t)) return null;
  // Order matters: most specific first.
  if (/\b(dress|jumpsuit|romper|gown|sundress)\b/.test(t)) return "dresses";
  if (/\b(jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker|anorak|gilet|puffer|cardigan)\b/.test(t)) return "outerwear";
  if (/\b(pants|trousers|jeans|shorts|skirt|chinos?|joggers?|leggings?|slacks|culottes|skort)\b/.test(t)) return "bottoms";
  if (/\b(shirt|tee|t-?shirts?|hoodie|sweater|sweatshirt|polo|blouse|tank|knit|jersey|crewneck|pullover|henley|tunic|camisole|top)\b/.test(t)) return "tops";
  if (/\b(sneakers?|boots?|loafers?|sandals?|trainers?|mules?|heels?|pumps?|flats?|oxfords?|espadrilles?)\b/.test(t)) return "shoes";
  if (/\b(bag|tote|backpack|crossbody|clutch|purse|satchel|duffle|messenger|handbag|wallet)\b/.test(t)) return "bags";
  if (/\b(hat|cap|beanie|fedora|beret|scarf|belt|gloves?|tie|sunglasses|necklace|bracelet|earrings?|watch|jewelry|jewellery)\b/.test(t)) return "accessories";
  return null;
}

/**
 * URL-level image safety check (no network). Catches obvious non-photos:
 * sprites, favicons, logos, placeholders.
 */
const HARD_REJECT_URL_RE =
  /(^|[/_-.])(logo|logos|brand[-_]?logo|favicon|sprite|sprites|icon[-_]?set|navbar|header[-_]?(logo|banner)|site[-_]?logo|app[-_]?icon|apple[-_]?touch[-_]?icon|placeholder|placehold|noimage|no[-_]?image|default[-_]?image|coming[-_]?soon)([/_-.]|$)/i;

export function isPlausibleImageUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  const s = String(u).trim();
  if (!s) return false;
  if (!/^https?:\/\//i.test(s)) return false;
  if (HARD_REJECT_URL_RE.test(s)) return false;
  if (/\/favicon\.ico(\?|$)/i.test(s)) return false;
  return true;
}

/**
 * Hosts known to hotlink-block / expire / serve transient thumbnails.
 * Items hosted here MUST be image-proxied through our storage before being
 * shown in the UI or used by FIT.
 */
export function isFragileImageHost(u: string | null | undefined): boolean {
  if (!u) return false;
  try {
    const host = new URL(String(u)).hostname.toLowerCase();
    return (
      host.endsWith(".gstatic.com") ||
      host === "gstatic.com" ||
      host.endsWith(".googleusercontent.com") ||
      host.endsWith(".bing.net") ||
      /encrypted-tbn\d?\./.test(host) ||
      /lookaside\./.test(host) // facebook lookaside
    );
  } catch {
    return false;
  }
}

/**
 * Final UI-side gate. Returns true only when a row is safe to RENDER:
 *   - title looks like fashion
 *   - image URL is plausibly a photo
 *   - we have a destination (source_url) so the user can act
 */
export function isRenderableProduct(p: {
  name?: string | null;
  title?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  source_url?: string | null;
  externalUrl?: string | null;
}): boolean {
  const title = p.name || p.title || "";
  const img = p.image_url || p.imageUrl || "";
  const link = p.source_url || p.externalUrl || "";
  if (!isFashionTitle(title)) return false;
  if (!isPlausibleImageUrl(img)) return false;
  if (!link || !/^https?:\/\//i.test(link)) return false;
  return true;
}
