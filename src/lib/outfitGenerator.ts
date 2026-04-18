/**
 * WARDROBE Outfit Generator
 * 
 * Lightweight, client-side outfit combination engine.
 * Takes categorized products and generates scored outfit sets.
 */

interface CategorizedItem {
  id: string;
  name: string;
  brand: string;
  price: string;
  category: string;
  style_tags: string[];
  color: string;
  fit: string;
  image_url?: string | null;
  source_url?: string | null;
  store_name?: string | null;
  platform?: string | null;
  reason?: string;
}

export interface GeneratedOutfit {
  id: string;
  score: number;
  styleLabel: string;
  items: {
    top: CategorizedItem;
    bottom: CategorizedItem;
    shoes: CategorizedItem;
    bag?: CategorizedItem;
    accessory?: CategorizedItem;
  };
}

type FashionCategory = "TOPS" | "BOTTOMS" | "SHOES" | "BAGS" | "ACCESSORIES";

/** Tiny deterministic 32-bit string hash (FNV-1a). Used to pick stable
 *  bag/accessory side items per outfit so the card never visually regenerates. */
function stringHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ── Style groupings for matching ──
const STYLE_GROUPS: Record<string, string[]> = {
  minimal: ["minimal", "clean", "modern", "minimalist", "classic", "tailored"],
  street: ["street", "streetwear", "urban", "casual", "edgy"],
  formal: ["formal", "classic", "tailored", "elegant", "business"],
  sporty: ["sporty", "athletic", "active", "sport"],
  bohemian: ["bohemian", "boho", "vintage", "retro", "artistic"],
};

// ── Neutral colors that pair with anything ──
const NEUTRAL_COLORS = ["black", "white", "gray", "grey", "beige", "navy", "cream", "charcoal", "khaki", "ivory", "neutral", "dark"];

// ── Color clash pairs ──
const CLASH_PAIRS = [
  ["red", "orange"], ["red", "pink"], ["green", "orange"],
  ["purple", "orange"], ["blue", "orange"],
];

function getStyleGroup(tags: string[]): string {
  const joined = tags.join(" ").toLowerCase();
  for (const [group, keywords] of Object.entries(STYLE_GROUPS)) {
    if (keywords.some(k => joined.includes(k))) return group;
  }
  return "casual";
}

function styleMatchScore(a: string[], b: string[]): number {
  const gA = getStyleGroup(a);
  const gB = getStyleGroup(b);
  if (gA === gB) return 1;
  // Partial match for related styles
  const related: Record<string, string[]> = {
    minimal: ["formal"], formal: ["minimal"], street: ["sporty"], sporty: ["street"],
  };
  if (related[gA]?.includes(gB)) return 0.6;
  return 0.2;
}

function colorHarmonyScore(colors: string[]): number {
  const lower = colors.map(c => c.toLowerCase().trim()).filter(Boolean);
  if (lower.length <= 1) return 0.8;

  const neutralCount = lower.filter(c => NEUTRAL_COLORS.some(n => c.includes(n))).length;
  // Mostly neutrals = great harmony
  if (neutralCount >= lower.length - 1) return 1;

  // Check for clashes
  for (const [a, b] of CLASH_PAIRS) {
    if (lower.some(c => c.includes(a)) && lower.some(c => c.includes(b))) return 0.2;
  }

  return 0.6;
}

function fitConsistencyScore(fits: string[]): number {
  const lower = fits.map(f => (f || "regular").toLowerCase());
  const unique = new Set(lower);
  if (unique.size === 1) return 1;
  // oversized + slim is bad
  if (lower.includes("oversized") && lower.includes("slim")) return 0.2;
  return 0.6;
}

function scoreOutfit(items: CategorizedItem[]): { score: number; label: string } {
  const tags = items.flatMap(i => i.style_tags || []);
  const colors = items.map(i => i.color || "");
  const fits = items.map(i => i.fit || "regular");

  const style = styleMatchScore(
    items[0]?.style_tags || [],
    items[1]?.style_tags || []
  );
  const color = colorHarmonyScore(colors);
  const fit = fitConsistencyScore(fits);
  const completeness = items.length >= 3 ? 1 : items.length >= 2 ? 0.7 : 0.3;

  const score = Math.round(
    (style * 0.35 + color * 0.25 + fit * 0.15 + completeness * 0.25) * 100
  );

  const label = getStyleGroup(tags);

  return { score, label };
}

export function generateOutfits(
  groups: Record<FashionCategory, CategorizedItem[]>,
  maxOutfits = 4,
  likedIds: Set<string> = new Set(),
  dislikedIds: Set<string> = new Set(),
): GeneratedOutfit[] {
  const tops = groups.TOPS.filter(i => !dislikedIds.has(i.id));
  const bottoms = groups.BOTTOMS.filter(i => !dislikedIds.has(i.id));
  const shoes = groups.SHOES.filter(i => !dislikedIds.has(i.id));
  const bags = groups.BAGS?.filter(i => !dislikedIds.has(i.id)) || [];
  const accessories = groups.ACCESSORIES?.filter(i => !dislikedIds.has(i.id)) || [];

  if (tops.length === 0 || bottoms.length === 0) return [];

  const candidates: GeneratedOutfit[] = [];
  const usedCombos = new Set<string>();

  // Generate combinations — limit iterations for performance
  const maxIter = Math.min(tops.length * bottoms.length * Math.max(shoes.length, 1), 200);
  let iter = 0;

  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of (shoes.length > 0 ? shoes : [null])) {
        if (iter++ > maxIter) break;

        const comboKey = `${top.id}-${bottom.id}-${shoe?.id || "none"}`;
        if (usedCombos.has(comboKey)) continue;
        usedCombos.add(comboKey);

        const coreItems = [top, bottom, ...(shoe ? [shoe] : [])];
        const { score, label } = scoreOutfit(coreItems);

        // Minimum quality threshold
        if (score < 45) continue;

        // Boost for liked items
        const likeBoost = coreItems.filter(i => likedIds.has(i.id)).length * 8;

        // DETERMINISTIC bag/accessory pick — derived from comboKey so the same
        // outfit always shows the same side items. Prevents card "regeneration"
        // flicker when results stream in and useMemo recomputes.
        const seed = stringHash(comboKey);
        const outfit: GeneratedOutfit = {
          id: comboKey,
          score: Math.min(100, score + likeBoost),
          styleLabel: label,
          items: {
            top,
            bottom,
            shoes: shoe || bottom, // fallback shouldn't happen
            ...(bags.length > 0 ? { bag: bags[seed % bags.length] } : {}),
            ...(accessories.length > 0 ? { accessory: accessories[(seed >>> 3) % accessories.length] } : {}),
          },
        };

        candidates.push(outfit);
      }
      if (iter > maxIter) break;
    }
    if (iter > maxIter) break;
  }

  // Sort by score, then diversify (don't repeat same top/bottom)
  candidates.sort((a, b) => b.score - a.score);

  const selected: GeneratedOutfit[] = [];
  const usedTops = new Set<string>();
  const usedBottoms = new Set<string>();

  for (const outfit of candidates) {
    if (selected.length >= maxOutfits) break;
    // Allow some repetition but prefer diversity
    const topUsed = usedTops.has(outfit.items.top.id);
    const bottomUsed = usedBottoms.has(outfit.items.bottom.id);
    if (topUsed && bottomUsed) continue;

    selected.push(outfit);
    usedTops.add(outfit.items.top.id);
    usedBottoms.add(outfit.items.bottom.id);
  }

  return selected;
}
