/**
 * Discover search constants
 * -------------------------
 * SEARCH ≠ UI.
 *
 * SEARCH_POOL_LIMIT       — how many candidate rows we pull from the DB
 *                           into memory BEFORE ranking + dedupe.
 * SEARCH_RANK_LIMIT       — how many candidates we actually score/rank.
 * SEARCH_MIN_GOOD_RESULTS — threshold below which the fallback cascade
 *                           escalates to the next stage.
 * SEARCH_VISIBLE_LIMIT    — how many ranked items we render in the visible
 *                           grid. UI cap, NOT a search cap.
 *
 * SEARCH_KR_EN_MAP        — Korean & vibe → English token expansions.
 *                           Used by `searchAliases` + `krAliasMap` so cache
 *                           lookups can match an English-heavy product_cache
 *                           when the user types Korean / vibe phrases.
 *
 * SEARCH_SCORE_WEIGHTS    — additive score weights wired into the ranker.
 *                           Tuning lives here so all selectors agree.
 *
 * Never use magic numbers in discover search code — import these.
 */
export const SEARCH_POOL_LIMIT = 2000;
export const SEARCH_RANK_LIMIT = 2000;
export const SEARCH_MIN_GOOD_RESULTS = 24;
/** Spec alias for SEARCH_MIN_GOOD_RESULTS — used by fallbackCascade. */
export const SEARCH_MIN_STRONG_RESULTS = SEARCH_MIN_GOOD_RESULTS;
export const SEARCH_VISIBLE_LIMIT = 24;

export const SEARCH_KR_EN_MAP: Record<string, string[]> = {
  // Apparel categories
  "가방": ["bag", "bags", "handbag", "tote"],
  "자켓": ["jacket", "outerwear", "blazer"],
  "재킷": ["jacket", "outerwear", "blazer"],
  "신발": ["shoes", "footwear", "sneakers"],
  "스니커즈": ["sneakers", "shoes", "footwear"],
  "운동화": ["sneakers", "running shoes", "trainers"],
  "코트": ["coat", "outerwear"],
  "부츠": ["boots", "footwear"],
  "로퍼": ["loafers", "shoes", "footwear"],
  "구두": ["loafers", "dress shoes", "shoes"],
  "셔츠": ["shirt", "top"],
  "니트": ["knit", "sweater", "top"],
  "후드": ["hoodie", "top"],
  "티셔츠": ["t-shirt", "tee", "top"],
  "바지": ["pants", "trousers"],
  "청바지": ["jeans", "denim"],
  "치마": ["skirt"],
  // Jewelry & accessories (KR)
  "목걸이": ["necklace", "jewelry", "pendant", "chain"],
  "다이아": ["diamond", "diamond jewelry", "fine jewelry"],
  "다이아몬드": ["diamond", "diamond jewelry", "fine jewelry"],
  "다이아목걸이": ["diamond necklace", "diamond pendant", "jewelry necklace"],
  "다이아 목걸이": ["diamond necklace", "diamond pendant", "jewelry necklace"],
  "반지": ["ring", "jewelry", "band"],
  "귀걸이": ["earrings", "jewelry"],
  "팔찌": ["bracelet", "bangle", "jewelry"],
  "쥬얼리": ["jewelry", "fine jewelry", "accessories"],
  "주얼리": ["jewelry", "fine jewelry", "accessories"],
  "액세서리": ["accessories", "jewelry", "fashion accessories"],
  "지갑": ["wallet", "small leather goods", "accessories"],
  "벨트": ["belt", "accessories"],
  "시계": ["watch", "watches", "accessories"],
  "선글라스": ["sunglasses", "eyewear", "accessories"],
  // Jewelry & accessories (EN — strengthen self-aliases)
  "wallet": ["wallet", "small leather goods", "accessories"],
  "necklace": ["necklace", "jewelry", "pendant", "chain"],
  "diamond": ["diamond", "fine jewelry", "luxury jewelry"],
  "bracelet": ["bracelet", "bangle", "jewelry"],
  "ring": ["ring", "band", "jewelry"],
  "earrings": ["earrings", "jewelry"],
  "pendant": ["pendant", "necklace", "jewelry"],
  "jewelry": ["jewelry", "fine jewelry", "accessories"],
  "jewellery": ["jewellery", "jewelry", "fine jewelry"],
  // Vibe / scenario
  "데이트룩": ["date night", "evening outfit", "romantic look"],
  "출근룩": ["office wear", "workwear", "formal look"],
  "꾸안꾸": ["effortless", "minimal", "relaxed style"],
  "미니멀": ["minimal", "clean", "simple style"],
  "스트릿": ["streetwear", "urban", "casual street"],
  "비오는날": ["rainy day", "rain outfit", "weatherproof"],
  "오버핏": ["oversized", "loose", "relaxed"],
  "빈티지": ["vintage", "retro"],
};

export const MEN_TERMS = [
  "men",
  "mens",
  "men's",
  "male",
  "man",
  "남자",
  "남성",
  "맨즈",
] as const;

export const WOMEN_TERMS = [
  "women",
  "womens",
  "women's",
  "female",
  "woman",
  "여자",
  "여성",
  "우먼",
  "우먼즈",
] as const;

export const UNISEX_TERMS = [
  "unisex",
  "genderless",
  "all gender",
  "all-gender",
  "공용",
  "남녀공용",
] as const;

export const SEARCH_SCORE_WEIGHTS = {
  /** Hard category match (intent.primaryCategory === row.category family). */
  categoryExact: 30,
  /** Token appears in the product name. */
  tokenInName: 20,
  /** Token appears in the category column. */
  tokenInCategory: 15,
  /** Token appears in brand. */
  tokenInBrand: 12,
  /** Token appears in stored search_query. */
  tokenInSearchQuery: 10,
  /** Style or scenario / mood match from intent. */
  styleOrScenario: 8,
  /** Image presence bonus (shopping UX — visual rows must dominate top). */
  imageBonus: 20,
  /** Image absence penalty — text-only rows sink hard. */
  imageMissingPenalty: 40,
  /** Freshness — tiered bonus applied via getFreshnessBonus(hoursOld). */
  freshness: 25,
  /** Unseen bonus (item has never been rendered for this user). */
  unseen: 5,
} as const;

/**
 * Tiered freshness bonus for shopping discovery.
 * Applied AFTER category correctness so a fresh-but-wrong item never beats
 * a correct-but-older one.
 */
export function getFreshnessBonus(createdAt: string | Date | null | undefined): number {
  if (!createdAt) return 0;
  const ts = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (!Number.isFinite(ts)) return 0;
  const hoursOld = (Date.now() - ts) / 3_600_000;
  if (hoursOld <= 24) return 25;
  if (hoursOld <= 72) return 15;
  if (hoursOld <= 168) return 8;
  return 0;
}

/**
 * True if the image_url looks like a real PRODUCT image — not a logo, sprite,
 * placeholder, social icon, or tracking pixel. Used to drop non-product rows
 * from the visible top of Discover.
 */
const NON_PRODUCT_IMAGE_HINTS = [
  "placeholder",
  "logo",
  "sprite",
  "favicon",
  "icon-",
  "/icons/",
  "social",
  "pixel",
  "blank.gif",
  "spacer",
  "1x1",
  "transparent",
  "default-image",
  "no-image",
  "noimage",
  "missing",
  "avatar-default",
];

export function looksLikeProductImage(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  const url = imageUrl.toLowerCase().trim();
  if (url.length < 10) return false;
  if (url.endsWith(".svg")) return false; // SVGs are almost always logos/icons in product feeds
  if (url.startsWith("data:") && url.length < 200) return false;
  if (!/^https?:\/\//.test(url) && !url.startsWith("/")) return false;
  for (const hint of NON_PRODUCT_IMAGE_HINTS) {
    if (url.includes(hint)) return false;
  }
  return true;
}
