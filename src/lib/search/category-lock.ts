/**
 * Client-side category lock — single source of truth for the search engine.
 * Mirrors the deterministic regex used in the product-search and
 * search-discovery edge functions. Used to:
 *   1. detect a query's primary category (or null for scenario/style queries)
 *   2. infer a product's category from its title
 *   3. hard-filter products that don't match the locked category
 *   4. rank category matches first in append/merge cycles
 */
import type { Product } from "./types";

export type PrimaryCategory =
  | "bags"
  | "shoes"
  | "outerwear"
  | "tops"
  | "bottoms"
  | "dresses"
  | "accessories"
  | "jewelry"
  | "swimwear";

const PRIMARY_PATTERNS: Array<{ cat: PrimaryCategory; re: RegExp }> = [
  // swimwear FIRST so "swim shorts" / "board shorts" don't get caught by bottoms
  { cat: "swimwear", re: /\b(swimwear|swimsuit|swim\s*trunks?|board\s*shorts?|swim\s*shorts?|bikini|one[-\s]?piece|rashguard|rash\s*guard|beachwear|수영복|스윔웨어|비치웨어|비키니|래쉬가드|보드숏)\b/i },
  // jewelry BEFORE accessories so "necklace" / "diamond" / 목걸이 lock to jewelry, not generic accessories
  { cat: "jewelry", re: /(\b(necklace|pendant|chain|bracelet|bangle|ring|band|earrings?|stud|hoop|jewelry|jewellery|fine\s*jewelry|diamond|diamonds|gemstone|gold|silver|platinum|pearl|sapphire|ruby|emerald|carat|karat)\b|목걸이|팔찌|반지|귀걸이|쥬얼리|주얼리|다이아|다이아몬드|진주|금목걸이|은반지)/i },
  { cat: "bags", re: /\b(bags?|tote|backpack|crossbody|clutch|purse|satchel|duffle|messenger|handbag|shoulder\s*bag|hobo|bucket\s*bag|wallet|가방|백팩|토트|클러치|지갑)\b/i },
  { cat: "shoes", re: /\b(sneakers?|shoes?|boots?|loafers?|sandals?|trainers?|mules?|heels?|pumps?|flats?|oxfords?|derby|brogues?|espadrilles?|slippers?|신발|스니커즈|운동화|로퍼|부츠|샌들|힐)\b/i },
  { cat: "outerwear", re: /\b(jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker|anorak|gilet|puffer|cardigan|자켓|재킷|코트|아우터|패딩|점퍼|가디건|블레이저)\b/i },
  { cat: "tops", re: /\b(shirt|tee|t-shirts?|hoodie|sweater|polo|blouse|tank|knit|sweatshirt|pullover|henley|tunic|camisole|top|셔츠|티셔츠|후드|니트|맨투맨|블라우스|탑)\b/i },
  { cat: "bottoms", re: /\b(pants|trousers|jeans|shorts|skirt|chinos?|joggers?|leggings?|slacks|culottes|바지|청바지|슬랙스|반바지|치마|스커트|조거)\b/i },
  { cat: "dresses", re: /\b(dress|jumpsuit|romper|gown|드레스|원피스|점프수트)\b/i },
  { cat: "accessories", re: /\b(hat|cap|beanie|scarf|belt|watch|sunglasses|gloves?|tie|fedora|beret|headband|bandana|cardholder|wallet|모자|벨트|시계|선글라스|장갑)\b/i },
];

// Scenario/weather queries get NO lock (mixed-category is intentional).
const SCENARIO_RE = /\b(summer\s*vacation|date\s*night|wedding|office|gym|travel|beach|party|festival|interview|brunch|rainy(\s*day)?|snowy|winter\s*outfit|summer\s*outfit|weekend|holiday|vacation)\b/i;

/** Detect the primary category from a free-text query. Returns null for scenario/style-only queries. */
export function detectPrimaryCategory(query: string): PrimaryCategory | null {
  if (!query) return null;
  if (SCENARIO_RE.test(query)) return null;
  for (const { cat, re } of PRIMARY_PATTERNS) {
    if (re.test(query)) return cat;
  }
  return null;
}

/** Infer a product's true category from its title. */
export function inferCategoryFromTitle(title: string): PrimaryCategory | null {
  if (!title) return null;
  for (const { cat, re } of PRIMARY_PATTERNS) {
    if (re.test(title)) return cat;
  }
  return null;
}

const GENERIC_CATS = new Set(["", "clothing", "other", "general", "fashion", "miscellaneous"]);

/**
 * Returns true if a product is allowed under a locked category.
 * - Strong allow: stored category exactly matches OR title infers the same category.
 * - Generic stored category ("clothing", "other"): only allow if title confirms.
 * - Wrong stored category: reject unless title strongly says otherwise.
 */
export function productMatchesCategory(
  product: Pick<Product, "category" | "title">,
  lock: PrimaryCategory,
): boolean {
  const stored = (product.category || "").toLowerCase();
  const inferred = inferCategoryFromTitle(product.title || "");

  if (stored === lock) return true;
  if (inferred === lock) {
    // Title says it's the locked category → allow even if stored differs.
    // But guard against a strong contradiction (e.g. title has both "bag" and "dress" — rare).
    if (stored && stored !== lock && !GENERIC_CATS.has(stored)) {
      // stored disagrees AND is specific → trust title only if no contradicting word
      const otherCat = PRIMARY_PATTERNS.find((p) => p.cat === stored as PrimaryCategory);
      if (otherCat?.re.test(product.title || "")) return false;
    }
    return true;
  }
  // bags-lock + accessories-stored: accept if title literally mentions a bag word
  if (lock === "bags" && stored === "accessories") {
    return /\b(bags?|tote|backpack|crossbody|clutch|purse|satchel|messenger|handbag|wallet)\b/i.test(product.title || "");
  }
  // shoes-lock + footwear alias
  if (lock === "shoes" && stored === "footwear") return true;
  // Generic stored cat → require title confirmation
  if (GENERIC_CATS.has(stored)) return inferred === lock;
  return false;
}

/** Sort products: category-matched first, then preserve original order. */
export function categoryFirstSort<T extends Pick<Product, "category" | "title">>(
  products: T[],
  lock: PrimaryCategory | null,
): T[] {
  if (!lock) return products;
  const matched: T[] = [];
  const rest: T[] = [];
  for (const p of products) {
    if (productMatchesCategory(p, lock)) matched.push(p);
    else rest.push(p);
  }
  return [...matched, ...rest];
}
