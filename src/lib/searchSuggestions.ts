/**
 * WARDROBE Search Suggestion Engine
 * Maps user input to structured tags and generates relevant suggestions.
 */

interface SuggestionResult {
  suggestions: string[];
  matchedTags: {
    category?: string;
    subcategory?: string;
    style?: string;
    fit?: string;
    color?: string;
  };
}

const STYLE_KEYWORDS: Record<string, string[]> = {
  minimal: ["minimal", "minimalist", "clean", "simple", "basic"],
  street: ["street", "streetwear", "urban", "hype", "skate"],
  classic: ["classic", "timeless", "traditional", "preppy", "ivy"],
  formal: ["formal", "office", "business", "professional", "suit", "dress code"],
  casual: ["casual", "relaxed", "everyday", "chill", "laid-back", "comfy"],
  sporty: ["sporty", "athletic", "sport", "gym", "active", "workout"],
  edgy: ["edgy", "punk", "grunge", "dark", "gothic", "alternative"],
  chic: ["chic", "elegant", "sophisticated", "luxury", "premium", "high-end"],
  bohemian: ["boho", "bohemian", "hippie", "free-spirited", "flowy"],
  vintage: ["vintage", "retro", "90s", "80s", "y2k", "old school"],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  clothing: ["clothing", "clothes", "wear", "outfit", "apparel", "garment"],
  tops: ["top", "shirt", "tee", "t-shirt", "blouse", "sweater", "hoodie", "pullover", "knit", "polo", "tank"],
  bottoms: ["pants", "trousers", "jeans", "shorts", "skirt", "chinos", "joggers", "slacks"],
  outerwear: ["jacket", "coat", "blazer", "parka", "bomber", "windbreaker", "cardigan", "vest", "puffer", "trench", "overcoat"],
  bags: ["bag", "handbag", "tote", "crossbody", "clutch", "backpack", "purse", "satchel", "duffel"],
  shoes: ["shoes", "sneakers", "boots", "sandals", "loafers", "heels", "flats", "trainers", "oxfords", "derby", "mules"],
  accessories: ["accessory", "accessories", "belt", "watch", "sunglasses", "hat", "jewelry", "ring", "necklace", "bracelet", "scarf", "gloves", "tie", "cap"],
};

const FIT_KEYWORDS: Record<string, string[]> = {
  oversized: ["oversized", "baggy", "loose", "relaxed fit", "wide", "boxy", "oversize"],
  regular: ["regular", "standard", "normal", "medium"],
  slim: ["slim", "fitted", "skinny", "tight", "tailored", "narrow"],
};

const COLOR_KEYWORDS: Record<string, string[]> = {
  neutral: ["neutral", "beige", "cream", "tan", "khaki", "off-white", "ivory", "nude", "camel"],
  dark: ["dark", "black", "charcoal", "navy", "midnight", "onyx", "deep"],
  bold: ["bold", "red", "yellow", "orange", "bright", "vibrant", "colorful", "neon", "pink", "purple"],
  earth: ["earth", "brown", "olive", "green", "forest", "rust", "burgundy", "terracotta", "sage"],
  pastel: ["pastel", "light blue", "lavender", "mint", "peach", "blush", "baby"],
  mixed: ["mixed", "pattern", "print", "plaid", "stripe", "check", "floral"],
};

/**
 * V4.2 — Fashion-aesthetic vocabulary. When a user types a mood/aesthetic
 * concept (quiet luxury, gorpcore, old money…), we expand it into the
 * concrete categories shoppers actually want to see.
 */
const AESTHETIC_EXPANSIONS: Record<string, { label: string; expand: string[] }> = {
  "quiet luxury": {
    label: "Quiet Luxury",
    expand: ["cashmere knitwear", "tailored trousers", "minimal leather bag", "neutral overcoat", "fine merino sweater"],
  },
  "old money": {
    label: "Old Money",
    expand: ["polo shirts", "pleated trousers", "loafers", "navy blazer", "cable knit sweater"],
  },
  gorpcore: {
    label: "Gorpcore",
    expand: ["technical shell jacket", "cargo pants", "trail runners", "fleece pullover", "utility vest"],
  },
  "clean fit": {
    label: "Clean Fit",
    expand: ["white sneakers", "straight jeans", "crew neck tee", "minimal bomber", "neutral cap"],
  },
  "archive fashion": {
    label: "Archive Fashion",
    expand: ["asymmetric tops", "draped trousers", "deconstructed jacket", "avant-garde knit"],
  },
  "smart casual": {
    label: "Smart Casual",
    expand: ["unstructured blazer", "chinos", "loafers", "oxford shirt", "merino polo"],
  },
  "airport look": {
    label: "Airport Look",
    expand: ["oversized hoodie", "wide leg sweatpants", "chunky sneakers", "long puffer", "crossbody bag"],
  },
  workout: {
    label: "Workout",
    expand: ["compression shirts", "running shorts", "training shoes", "sweat-resistant jacket", "gym bag"],
  },
  athleisure: {
    label: "Athleisure",
    expand: ["track pants", "performance tee", "trainers", "zip-up hoodie", "sports bra"],
  },
  minimal: {
    label: "Minimal",
    expand: ["monochrome outerwear", "clean sneakers", "neutral knitwear", "relaxed trousers"],
  },
  y2k: {
    label: "Y2K",
    expand: ["low-rise jeans", "baby tee", "cargo skirt", "shoulder bag", "tinted sunglasses"],
  },
  techwear: {
    label: "Techwear",
    expand: ["shell jacket", "tactical pants", "modular vest", "ninja sneakers"],
  },
};

function findAesthetic(input: string): { key: string; label: string; expand: string[] } | null {
  const lower = input.toLowerCase().trim();
  for (const [key, value] of Object.entries(AESTHETIC_EXPANSIONS)) {
    if (lower.includes(key)) return { key, ...value };
  }
  return null;
}

function findMatches(input: string, map: Record<string, string[]>): string[] {
  const lower = input.toLowerCase();
  return Object.entries(map)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([key]) => key);
}

export function generateSuggestions(input: string): SuggestionResult {
  if (!input || input.trim().length < 2) {
    return { suggestions: [], matchedTags: {} };
  }

  const styles = findMatches(input, STYLE_KEYWORDS);
  const categories = findMatches(input, CATEGORY_KEYWORDS);
  const fits = findMatches(input, FIT_KEYWORDS);
  const colors = findMatches(input, COLOR_KEYWORDS);
  const aesthetic = findAesthetic(input);

  const matchedTags = {
    style: aesthetic?.key || styles[0],
    category: categories[0],
    fit: fits[0],
    color: colors[0],
  };

  const suggestions: string[] = [];
  const lower = input.toLowerCase().trim();

  // Aesthetic-driven expansions take top priority — these are the
  // contextual "Musinsa-style" recommendations the V4.2 spec calls for.
  if (aesthetic) {
    suggestions.push(...aesthetic.expand);
  }

  // Generate contextual suggestions based on matched tags
  if (fits.length && categories.length) {
    suggestions.push(`${fits[0]} ${categories[0]}`);
  }
  if (styles.length && categories.length) {
    suggestions.push(`${styles[0]} ${categories[0]}`);
  }
  if (styles.length && !categories.length) {
    suggestions.push(`${styles[0]} outerwear`);
    suggestions.push(`${styles[0]} tops`);
    suggestions.push(`${styles[0]} accessories`);
  }
  if (categories.length && !styles.length) {
    suggestions.push(`casual ${categories[0]}`);
    suggestions.push(`minimal ${categories[0]}`);
    suggestions.push(`street ${categories[0]}`);
  }
  if (fits.length && !categories.length) {
    suggestions.push(`${fits[0]} jackets`);
    suggestions.push(`${fits[0]} tops`);
  }
  if (colors.length) {
    const cat = categories[0] || "items";
    suggestions.push(`${colors[0]} ${cat}`);
  }

  // Always add the original query as a refinement
  if (!suggestions.includes(lower)) {
    suggestions.unshift(lower);
  }

  // Deduplicate and limit
  const unique = [...new Set(suggestions)].slice(0, 8);

  return { suggestions: unique, matchedTags };
}

// Pre-defined trending suggestions for empty state — V4.2 fashion vocabulary.
export const TRENDING_SEARCHES = [
  "quiet luxury",
  "gorpcore",
  "old money",
  "clean fit",
  "smart casual",
  "minimal outerwear",
  "oversized jackets",
  "airport look",
];

/**
 * V4.3 Visual Autocomplete categories — give the search dropdown
 * structure beyond raw text. Each category renders with its own row.
 */
export interface VisualSuggestionGroup {
  type: "brand" | "aesthetic" | "category" | "showroom";
  label: string;
  items: { label: string; query: string; emoji?: string }[];
}

const BRAND_HINTS = ["nike", "adidas", "uniqlo", "cos", "lemaire", "arket", "muji", "stussy", "carhartt"];
const AESTHETIC_HINTS = Object.keys(AESTHETIC_EXPANSIONS);

export function buildVisualGroups(input: string): VisualSuggestionGroup[] {
  const lower = input.toLowerCase().trim();
  if (!lower) return [];

  const groups: VisualSuggestionGroup[] = [];

  const brandMatches = BRAND_HINTS.filter(b => b.includes(lower) || lower.includes(b));
  if (brandMatches.length) {
    groups.push({
      type: "brand",
      label: "Brands",
      items: brandMatches.slice(0, 4).map(b => ({ label: b.toUpperCase(), query: b })),
    });
  }

  const aestheticMatches = AESTHETIC_HINTS.filter(a => a.includes(lower) || lower.includes(a.split(" ")[0]));
  if (aestheticMatches.length) {
    groups.push({
      type: "aesthetic",
      label: "Aesthetics",
      items: aestheticMatches.slice(0, 4).map(a => ({
        label: AESTHETIC_EXPANSIONS[a].label,
        query: a,
      })),
    });
  }

  const categoryMatches = Object.entries(CATEGORY_KEYWORDS).filter(([, kws]) => kws.some(k => k.includes(lower) || lower.includes(k)));
  if (categoryMatches.length) {
    groups.push({
      type: "category",
      label: "Categories",
      items: categoryMatches.slice(0, 4).map(([k]) => ({ label: k, query: k })),
    });
  }

  return groups;
}
