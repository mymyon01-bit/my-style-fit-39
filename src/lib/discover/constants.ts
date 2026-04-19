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
  // Categories
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
  /** Freshness bonus (normalized 0..1 then scaled). */
  freshness: 5,
  /** Unseen bonus (item has never been rendered for this user). */
  unseen: 5,
} as const;
