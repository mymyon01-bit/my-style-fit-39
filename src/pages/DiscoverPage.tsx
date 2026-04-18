import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles, Heart, HeartOff, Bookmark, SlidersHorizontal, ChevronDown, X, Wand2 } from "lucide-react";
import React, { useState, useEffect, useCallback, useRef, useMemo, forwardRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import StyleQuiz, { type StyleQuizAnswers } from "@/components/StyleQuiz";
import { AuthGate } from "@/components/AuthGate";
import { useCategories } from "@/hooks/useCategories";
import { generateSuggestions, TRENDING_SEARCHES } from "@/lib/searchSuggestions";
import { motion, AnimatePresence } from "framer-motion";
import SafeImage from "@/components/SafeImage";
import ShareButton from "@/components/ShareButton";
import { toast } from "sonner";
import { generateOutfits, type GeneratedOutfit } from "@/lib/outfitGenerator";
import OutfitLookCard from "@/components/OutfitLookCard";
import StyledLookSkeleton from "@/components/StyledLookSkeleton";
import ProductDetailSheet from "@/components/ProductDetailSheet";
import PreferenceBanner from "@/components/PreferenceBanner";

// ── Direct DB query for instant initial load (no edge function overhead) ──
async function directDbLoad(opts: {
  styles?: string[];
  fit?: string;
  limit?: number;
  excludeIds?: string[];
}): Promise<AIRecommendation[]> {
  try {
    let query = supabase
      .from("product_cache")
      .select("id, name, brand, price, category, style_tags, color_tags, fit, image_url, source_url, store_name, platform, reason")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .order("trend_score", { ascending: false })
      .limit(opts.limit || 12);

    if (opts.styles?.length) query = query.overlaps("style_tags", opts.styles);
    if (opts.fit) query = query.eq("fit", opts.fit);
    if (opts.excludeIds?.length) query = query.not("id", "in", `(${opts.excludeIds.join(",")})`);

    const { data, error } = await query;
    if (error || !data) return [];

    return data
      .filter((p: any) => p.image_url?.startsWith("https"))
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        brand: p.brand || "",
        price: p.price || "",
        category: p.category || "",
        reason: p.reason || "Curated for you",
        style_tags: p.style_tags || [],
        color: (p.color_tags || [])[0] || "",
        fit: p.fit || "regular",
        image_url: p.image_url,
        source_url: p.source_url,
        store_name: p.store_name,
        platform: p.platform || null,
      }));
  } catch {
    return [];
  }
}

// ── Inflight request deduplication ──
const inflightRequests = new Map<string, Promise<any>>();
function deduplicatedSearch(key: string, fn: () => Promise<any>): Promise<any> {
  const existing = inflightRequests.get(key);
  if (existing) return existing;
  const promise = fn().finally(() => inflightRequests.delete(key));
  inflightRequests.set(key, promise);
  return promise;
}

// ── Background search-discovery trigger ──
// Fires the new ingestion engine. Cooled down per-query so a quick retype
// doesn't spam Perplexity + Firecrawl.
const _discoveryFired = new Map<string, number>();
const DISCOVERY_COOLDOWN_MS = 5 * 60_000; // 5 minutes per query
async function triggerSearchDiscovery(rawQuery: string): Promise<{ inserted: number; candidatesFound: number; usedPerplexity?: boolean } | null> {
  const key = rawQuery.toLowerCase().trim();
  if (!key) return null;
  const last = _discoveryFired.get(key) || 0;
  if (Date.now() - last < DISCOVERY_COOLDOWN_MS) {
    console.info("[search] DISCOVERY_COOLDOWN_SKIP", { query: key });
    return null;
  }
  _discoveryFired.set(key, Date.now());
  try {
    const { data, error } = await supabase.functions.invoke("search-discovery", {
      body: { query: rawQuery, maxQueries: 12, maxCandidates: 40 },
    });
    if (error) throw error;
    return data as any;
  } catch (e) {
    console.warn("[search-discovery] failed", e);
    return null;
  }
}

interface AIRecommendation {
  id: string;
  name: string;
  brand: string;
  price: string;
  category: string;
  reason: string;
  style_tags: string[];
  color: string;
  fit: string;
  image_url?: string | null;
  source_url?: string | null;
  store_name?: string | null;
  platform?: string | null;
}

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  naver: { label: "Naver", color: "bg-green-600/80" },
  ssense: { label: "SSENSE", color: "bg-zinc-800/80" },
  farfetch: { label: "Farfetch", color: "bg-stone-700/80" },
  asos: { label: "ASOS", color: "bg-blue-600/80" },
  ssg: { label: "SSG", color: "bg-rose-600/80" },
  ai_search: { label: "AI", color: "bg-purple-600/80" },
};

const STYLE_FILTERS = ["minimal", "street", "classic", "edgy", "casual", "formal", "chic", "vintage", "bohemian", "sporty"];
const FIT_FILTERS = ["oversized", "regular", "slim"];
const COLOR_FILTERS = ["neutral", "dark", "earth", "bold", "pastel", "mixed"];

// ── Keyword-based fashion category classifier (module-level) ──
const CATEGORY_ORDER = ["OUTERWEAR", "TOPS", "BOTTOMS", "SHOES", "BAGS", "ACCESSORIES"] as const;
type FashionCategory = typeof CATEGORY_ORDER[number];

const CATEGORY_KEYWORDS: Record<FashionCategory, RegExp> = {
  OUTERWEAR: /\b(jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker|anorak|peacoat|raincoat|puffer|gilet|cape|poncho)\b/i,
  TOPS: /\b(shirt|t-shirt|tee|hoodie|hoody|sweater|cardigan|vest|polo|pullover|sweatshirt|blouse|tunic|camisole|tank|henley|oxford|flannel|knit|top|jumper)\b/i,
  BOTTOMS: /\b(pants|trousers|jeans|shorts|skirt|chinos?|joggers?|leggings?|overalls?|jumpsuit|romper|slacks|culottes|cargo\s*pants|sweatpants|track\s*pants|bermuda|capri)\b/i,
  SHOES: /\b(sneakers?|shoes?|boots?|loafers?|sandals?|trainers?|mules?|oxfords?|derby|brogues?|espadrilles?|slippers?|clogs?|pumps?|heels?|flats?|moccasins?)\b/i,
  BAGS: /\b(bag|tote|backpack|crossbody|clutch|purse|satchel|duffle|messenger|wallet|pouch|briefcase|weekender|fanny\s*pack|belt\s*bag|shoulder\s*bag|handbag)\b/i,
  ACCESSORIES: /\b(hat|cap|beanie|watch|belt|scarf|gloves?|socks?|tie|sunglasses|ring|necklace|bracelet|earring|jewelry|jewellery|cufflinks?|keychain|headband|bandana|beret)\b/i,
};

function classifyProduct(item: AIRecommendation): FashionCategory | null {
  const text = `${item.name} ${item.category}`.toLowerCase();
  for (const cat of CATEGORY_ORDER) {
    if (CATEGORY_KEYWORDS[cat].test(text)) return cat;
  }
  return null;
}

// ── Query type classification ──
type QueryType = "product" | "style" | "scenario";

// ── Query Intent Parser: extract structured intent from user query ──
interface QueryIntent {
  rawQuery: string;
  queryType: QueryType;
  categoryLock: FashionCategory | null;
  styleIntent: string[];
  colorIntent: string[];
  brandIntent: string[];
  keywords: string[]; // remaining meaningful terms
  scenarioLabel: string | null; // human-readable scenario name
  seasonalContext: string | null; // summer, winter, etc.
  excludeKeywords: string[]; // items that contradict the scenario
}

const STYLE_KEYWORD_MAP: Record<string, string[]> = {
  minimal: ["minimal", "clean", "simple", "structured"],
  street: ["street", "urban", "streetwear", "hip-hop"],
  classic: ["classic", "traditional", "timeless", "old money", "oldmoney", "preppy"],
  edgy: ["edgy", "punk", "dark", "avant-garde", "gothic"],
  casual: ["casual", "everyday", "relaxed", "chill", "lazy", "comfort"],
  formal: ["formal", "dressy", "office", "business", "work", "professional"],
  chic: ["chic", "elegant", "sophisticated", "modern", "sleek"],
  vintage: ["vintage", "retro", "90s", "80s", "70s", "thrift"],
  sporty: ["sporty", "athletic", "sport", "active", "gym", "running"],
  bohemian: ["bohemian", "boho", "hippie", "free-spirited"],
};

const COLOR_KEYWORDS = [
  "black", "white", "grey", "gray", "navy", "blue", "red", "green", "brown",
  "beige", "cream", "ivory", "tan", "camel", "khaki", "olive", "burgundy",
  "wine", "pink", "purple", "yellow", "orange", "pastel", "neutral", "earth",
  "dark", "light", "bright", "muted", "neon",
];

const KNOWN_BRANDS = [
  "nike", "adidas", "zara", "uniqlo", "cos", "asos", "gucci", "prada",
  "balenciaga", "new balance", "converse", "vans", "h&m", "mango",
  "arket", "muji", "acne studios", "stussy", "supreme", "carhartt",
  "the north face", "patagonia", "levi's", "levis", "gap", "ralph lauren",
  "burberry", "saint laurent", "celine", "bottega veneta", "dior",
];

function parseQueryIntent(query: string): QueryIntent {
  const lower = query.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(w => w.length > 1);

  // 0. Detect scenario (occasion/lifestyle query)
  const SCENARIO_MAP: Record<string, { label: string; season: string | null; exclude: string[] }> = {
    "summer vacation": { label: "Summer Vacation", season: "summer", exclude: ["wool", "parka", "puffer", "thermal", "fleece", "down jacket", "heavy"] },
    "summer": { label: "Summer Style", season: "summer", exclude: ["wool", "parka", "puffer", "thermal", "fleece", "down jacket", "heavy", "fur"] },
    "vacation": { label: "Vacation Outfit", season: "summer", exclude: ["formal", "suit", "blazer", "heavy", "wool"] },
    "beach": { label: "Beach Look", season: "summer", exclude: ["boots", "coat", "blazer", "suit", "formal", "wool", "parka"] },
    "travel": { label: "Travel Outfit", season: null, exclude: ["formal", "suit", "heels"] },
    "airport": { label: "Airport Look", season: null, exclude: ["formal", "suit", "heels", "dress shoes"] },
    "winter": { label: "Winter Style", season: "winter", exclude: ["sandals", "tank", "shorts", "linen", "swim"] },
    "spring": { label: "Spring Style", season: "spring", exclude: ["parka", "heavy", "puffer", "sandals"] },
    "fall": { label: "Fall Style", season: "fall", exclude: ["sandals", "tank", "swim", "linen"] },
    "autumn": { label: "Autumn Style", season: "fall", exclude: ["sandals", "tank", "swim", "linen"] },
    "rain": { label: "Rainy Day", season: null, exclude: ["sandals", "suede", "canvas"] },
    "date night": { label: "Date Night", season: null, exclude: ["gym", "athletic", "joggers", "sweatpants", "cargo"] },
    "date": { label: "Date Outfit", season: null, exclude: ["gym", "athletic", "joggers", "sweatpants"] },
    "wedding": { label: "Wedding Guest", season: null, exclude: ["sneakers", "hoodie", "joggers", "cargo", "gym"] },
    "office": { label: "Office Look", season: null, exclude: ["gym", "athletic", "hoodie", "cargo", "ripped"] },
    "work": { label: "Work Outfit", season: null, exclude: ["gym", "athletic", "hoodie", "cargo", "ripped"] },
    "gym": { label: "Gym & Workout", season: null, exclude: ["formal", "suit", "heels", "blazer", "loafers"] },
    "workout": { label: "Workout Gear", season: null, exclude: ["formal", "suit", "heels", "blazer", "loafers"] },
    "party": { label: "Party Outfit", season: null, exclude: ["athletic", "gym", "hiking", "cargo"] },
    "festival": { label: "Festival Look", season: "summer", exclude: ["formal", "suit", "blazer", "wool", "heavy"] },
    "casual": { label: "Casual Style", season: null, exclude: ["formal", "suit"] },
    "formal": { label: "Formal Look", season: null, exclude: ["sneakers", "hoodie", "joggers", "cargo", "gym"] },
    "streetwear": { label: "Streetwear", season: null, exclude: ["formal", "suit", "dress shoes", "loafers"] },
    "hiking": { label: "Hiking Gear", season: null, exclude: ["formal", "heels", "suit", "loafers"] },
    "school": { label: "School Outfit", season: null, exclude: ["formal", "suit", "heels"] },
    "brunch": { label: "Brunch Look", season: null, exclude: ["gym", "athletic", "formal", "suit"] },
    "concert": { label: "Concert Outfit", season: null, exclude: ["formal", "suit", "office"] },
    "interview": { label: "Interview Look", season: null, exclude: ["gym", "hoodie", "joggers", "ripped", "cargo"] },
    "picnic": { label: "Picnic Style", season: "summer", exclude: ["formal", "suit", "heels", "heavy"] },
    "resort": { label: "Resort Wear", season: "summer", exclude: ["heavy", "parka", "wool", "boots"] },
  };

  // Check scenario (longest match first)
  let scenarioLabel: string | null = null;
  let seasonalContext: string | null = null;
  let excludeKeywords: string[] = [];
  const sortedScenarios = Object.keys(SCENARIO_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedScenarios) {
    if (lower.includes(key)) {
      const info = SCENARIO_MAP[key];
      scenarioLabel = info.label;
      seasonalContext = info.season;
      excludeKeywords = info.exclude;
      break;
    }
  }

  // 1. Detect category lock
  let categoryLock: FashionCategory | null = null;
  for (const cat of CATEGORY_ORDER) {
    if (CATEGORY_KEYWORDS[cat].test(lower)) {
      categoryLock = cat;
      break;
    }
  }

  // 2. Detect style intent
  const styleIntent: string[] = [];
  for (const [style, keywords] of Object.entries(STYLE_KEYWORD_MAP)) {
    if (keywords.some(k => lower.includes(k))) {
      styleIntent.push(style);
    }
  }

  // 3. Detect color intent
  const colorIntent = COLOR_KEYWORDS.filter(c => lower.includes(c));

  // 4. Detect brand intent
  const brandIntent = KNOWN_BRANDS.filter(b => lower.includes(b));

  // 5. Remaining keywords
  const consumed = new Set<string>();
  [...colorIntent, ...brandIntent].forEach(w => w.split(/\s+/).forEach(p => consumed.add(p)));
  Object.values(STYLE_KEYWORD_MAP).flat().forEach(k => { if (lower.includes(k)) k.split(/\s+/).forEach(p => consumed.add(p)); });
  const keywords = words.filter(w => !consumed.has(w) && w.length > 2);

  // 6. Determine query type
  // CRITICAL: If a specific product category is detected (e.g. "sneakers" in "casual sneakers"),
  // treat as PRODUCT query — not scenario. Scenario only applies when no product keyword exists.
  let queryType: QueryType = "product";
  if (scenarioLabel && !categoryLock) {
    queryType = "scenario";
  } else if (categoryLock) {
    // Product category present — override scenario, keep as product search
    queryType = "product";
    // Still keep seasonal excludes if they apply (e.g. "summer sneakers" should exclude wool)
    if (!scenarioLabel) {
      excludeKeywords = [];
    }
  } else if (styleIntent.length > 0) {
    queryType = "style";
  }

  return { rawQuery: query, queryType, categoryLock, styleIntent, colorIntent, brandIntent, keywords, scenarioLabel, seasonalContext, excludeKeywords };
}

// ── Strict relevance scorer based on parsed intent ──
const RELEVANCE_THRESHOLD = 15; // Base threshold — progressive fallback will lower further if needed
const MIN_RESULT_TARGET = 12; // Minimum products to show before considering search "successful"

// User taste signals blended into ranking (Step 3, factor #4 in the formula)
interface UserSignals {
  styleProfile?: any | null;
  feedbackMap?: Record<string, "like" | "dislike">;
  savedIds?: Set<string>;
}

function scoreRelevance(item: AIRecommendation, intent: QueryIntent, signals?: UserSignals): number {
  const itemName = (item.name || "").toLowerCase();
  const itemBrand = (item.brand || "").toLowerCase();
  const itemText = `${itemName} ${itemBrand} ${item.category || ""} ${(item.style_tags || []).join(" ")} ${item.color || ""} ${item.fit || ""}`.toLowerCase();
  const itemCategory = classifyProduct(item);

  // HARD BLOCK: If product contains excluded keywords for this scenario, reject it
  if (intent.excludeKeywords.length > 0) {
    if (intent.excludeKeywords.some(ex => itemName.includes(ex) || itemText.includes(ex))) {
      return 0; // Completely irrelevant — e.g. wool coat for summer vacation
    }
  }

  // HARD BLOCK: Disliked feedback rules item out completely
  if (signals?.feedbackMap?.[item.id] === "dislike") return 0;

  // ── SEARCH-FIRST RANKING ──
  // The user's actual query (brand + category + color + keywords) dominates the
  // score. Personal preferences are a small tiebreaker only — they must NOT
  // outrank a true match for what the user typed.

  let score = 0;

  // 0.35 — BRAND match (highest weight when user types a brand like "Gucci")
  if (intent.brandIntent.length > 0) {
    const brandMatch = intent.brandIntent.some(b => itemBrand.includes(b) || itemName.includes(b));
    score += brandMatch ? 35 : 0; // brand search → non-brand items get nothing here
  } else {
    score += 12; // neutral baseline when no brand specified
  }

  // 0.25 — CATEGORY / scenario relevance (e.g. "jacket", "sneakers")
  if (intent.categoryLock) {
    if (itemCategory === intent.categoryLock) score += 25;
    else score += 4;
  } else {
    score += 12;
  }

  // 0.15 — KEYWORD / name match (literal terms from the query)
  if (intent.keywords.length > 0) {
    let kwHits = 0;
    let nameHits = 0;
    for (const k of intent.keywords) {
      if (itemNameContains(itemName, k)) { kwHits++; nameHits++; }
      else if (itemText.includes(k)) kwHits++;
    }
    const ratio = kwHits / intent.keywords.length;
    // Name match is worth more than tag match
    score += Math.min(15, ratio * 12 + Math.min(3, nameHits));
  } else {
    score += 7;
  }

  // 0.12 — COLOR match (when user explicitly asked for a color)
  if (intent.colorIntent.length > 0) {
    const colorMatch = intent.colorIntent.some(c =>
      itemName.includes(c) || (item.color || "").toLowerCase().includes(c) || itemText.includes(c)
    );
    score += colorMatch ? 12 : 0;
  } else {
    score += 6;
  }

  // 0.08 — STYLE intent (e.g. "minimal", "street")
  if (intent.styleIntent.length > 0) {
    const itemStyles = item.style_tags || [];
    const matched = intent.styleIntent.filter(s => itemStyles.includes(s)).length;
    const styleKeywordMatch = intent.styleIntent.some(s =>
      STYLE_KEYWORD_MAP[s]?.some(k => itemName.includes(k))
    );
    if (matched > 0) score += Math.min(8, 4 + matched * 2);
    else if (styleKeywordMatch) score += 5;
    else score += 1;
  } else {
    score += 4;
  }

  // 0.05 — USER PREFERENCE tiebreaker (small — must not overpower the query)
  let prefScore = 0;
  if (signals) {
    const styles = signals.styleProfile?.preferred_styles || [];
    const disliked = signals.styleProfile?.disliked_styles || [];
    const favBrands: string[] = (signals.styleProfile?.favorite_brands || []).map((b: string) => b.toLowerCase());
    const itemStyleTags: string[] = item.style_tags || [];
    const preferredFit = signals.styleProfile?.preferred_fit;

    if (styles.length && itemStyleTags.some((t: string) => styles.includes(t))) prefScore += 2;
    if (disliked.length && itemStyleTags.some((t: string) => disliked.includes(t))) prefScore -= 4;
    // Only bonus favorite brand if the user did NOT explicitly search a brand
    if (intent.brandIntent.length === 0 && favBrands.length && favBrands.some(b => itemBrand.includes(b))) prefScore += 2;
    if (preferredFit && item.fit && item.fit.toLowerCase() === String(preferredFit).toLowerCase()) prefScore += 1;
    if (signals.savedIds?.has(item.id)) prefScore += 1;
    if (signals.feedbackMap?.[item.id] === "like") prefScore += 2;
  }
  score += Math.max(-4, Math.min(5, prefScore));

  return Math.round(score);
}

// Helper: stricter "name contains" (word-ish boundary so "tee" doesn't match "teen")
function itemNameContains(name: string, term: string): boolean {
  if (!term) return false;
  if (term.length <= 3) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return re.test(name);
  }
  return name.includes(term);
}

// ── Scenario-specific filter: ensures category balance for lifestyle queries ──
function filterForScenario(items: AIRecommendation[], intent: QueryIntent): AIRecommendation[] {
  // First, apply exclude keywords filter
  let filtered = items.filter(item => {
    const itemName = (item.name || "").toLowerCase();
    const itemText = `${itemName} ${item.category || ""} ${(item.style_tags || []).join(" ")}`.toLowerCase();
    return !intent.excludeKeywords.some(ex => itemName.includes(ex) || itemText.includes(ex));
  });

  // Classify into categories
  const byCategory: Record<string, AIRecommendation[]> = {};
  for (const item of filtered) {
    const cat = classifyProduct(item) || "OTHER";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  // Ensure category balance: pick items round-robin across categories
  const categories = Object.keys(byCategory).filter(c => c !== "OTHER");
  if (categories.length <= 1) return filtered; // Not enough variety to interleave

  const balanced: AIRecommendation[] = [];
  const maxPerCategory = Math.ceil(24 / categories.length);
  let idx = 0;
  const indices: Record<string, number> = {};
  categories.forEach(c => indices[c] = 0);

  // Round-robin pick: ensures mix of tops, bottoms, shoes, accessories
  while (balanced.length < 24) {
    const cat = categories[idx % categories.length];
    const catItems = byCategory[cat];
    if (catItems && indices[cat] < catItems.length && indices[cat] < maxPerCategory) {
      balanced.push(catItems[indices[cat]]);
      indices[cat]++;
    }
    idx++;
    // Break if we've gone through all items
    if (idx > categories.length * maxPerCategory) break;
  }

  // Add any remaining "OTHER" items at the end
  if (byCategory["OTHER"]) {
    balanced.push(...byCategory["OTHER"].slice(0, 4));
  }

  return balanced;
}

// ── STRICT relevance filter (no progressive fallback) — used for LATE merges
// so weak items can't replace good initial DB results.
function filterByRelevanceStrict(items: AIRecommendation[], intent: QueryIntent, signals?: UserSignals): AIRecommendation[] {
  const scored = items
    .map(item => ({ item, relevance: scoreRelevance(item, intent, signals) }))
    .sort((a, b) => b.relevance - a.relevance);

  const thresholds = [RELEVANCE_THRESHOLD, 10, 5];
  for (const threshold of thresholds) {
    const passing = scored.filter(s => s.relevance >= threshold);
    if (passing.length >= Math.min(6, items.length)) {
      return passing.map(s => s.item);
    }
  }

  const usable = scored.filter(s => s.relevance > 0).slice(0, Math.min(12, scored.length));
  if (usable.length > 0) {
    return usable.map(s => s.item);
  }

  return scored.slice(0, Math.min(8, scored.length)).map(s => s.item);
}

function normalizeProductMergeKey(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.split("?")[0].toLowerCase();
}

// ── Stable append-only merge: keeps existing order, appends new items only.
// Never reorders or removes already-rendered items → no flicker.
function appendUnique(prev: AIRecommendation[], incoming: AIRecommendation[], cap = 80): AIRecommendation[] {
  const seenIds = new Set(prev.map(p => p.id).filter(Boolean));
  const seenUrls = new Set(prev.map(p => normalizeProductMergeKey(p.source_url)).filter(Boolean) as string[]);
  const seenImages = new Set(prev.map(p => normalizeProductMergeKey(p.image_url)).filter(Boolean) as string[]);
  const seenTitles = new Set(prev.map(p => normalizeTitle(p.name)).filter(Boolean));
  const additions: AIRecommendation[] = [];

  for (const p of incoming) {
    if (!p?.id) continue;
    const urlKey = normalizeProductMergeKey(p.source_url);
    const imageKey = normalizeProductMergeKey(p.image_url);
    const titleKey = normalizeTitle(p.name || "");

    if (seenIds.has(p.id)) continue;
    if (urlKey && seenUrls.has(urlKey)) continue;
    if (imageKey && seenImages.has(imageKey)) continue;
    if (titleKey && seenTitles.has(titleKey)) continue;

    seenIds.add(p.id);
    if (urlKey) seenUrls.add(urlKey);
    if (imageKey) seenImages.add(imageKey);
    if (titleKey) seenTitles.add(titleKey);
    additions.push(p);
  }

  if (additions.length === 0) return prev;
  return [...prev, ...additions].slice(0, cap);
}

// ── Apply relevance filter with progressive fallback ──
function filterByRelevance(items: AIRecommendation[], intent: QueryIntent, minTarget = MIN_RESULT_TARGET, signals?: UserSignals): AIRecommendation[] {
  const scored = items.map(item => ({
    item,
    relevance: scoreRelevance(item, intent, signals),
  }));

  // Sort by relevance descending
  scored.sort((a, b) => b.relevance - a.relevance);

  // Progressive threshold: try strict first, then soften
  const thresholds = [RELEVANCE_THRESHOLD, 10, 5];
  for (const threshold of thresholds) {
    const passing = scored.filter(s => s.relevance >= threshold);
    if (passing.length >= minTarget || threshold === 5) {
      console.log(`Relevance filter: ${passing.length} items passed at threshold ${threshold} (from ${items.length})`);
      return passing.map(s => s.item);
    }
  }

  // If nothing passes even threshold 5, return top items by score (never fully empty)
  return scored.filter(s => s.relevance > 0).map(s => s.item);
}

// ── Human-readable search-intent label (Step 3, item #6) ──
function buildSearchExplanation(intent: QueryIntent, signals?: UserSignals): string | null {
  const parts: string[] = [];

  if (intent.queryType === "scenario" && intent.scenarioLabel) {
    parts.push(`Outfit ideas for ${intent.scenarioLabel.toLowerCase()}`);
  } else if (intent.styleIntent.length > 0 && !intent.categoryLock) {
    const styleWord = intent.styleIntent[0];
    const expansion: Record<string, string> = {
      minimal: "clean, structured pieces",
      modern: "sleek, contemporary essentials",
      classic: "timeless, tailored staples",
      street: "oversized, urban looks",
      edgy: "bold, dark-leaning pieces",
      casual: "easy, everyday basics",
      formal: "polished, refined wear",
      chic: "elegant, modern pieces",
      vintage: "retro-inspired finds",
      sporty: "athletic, active styles",
      bohemian: "relaxed, free-spirited looks",
    };
    parts.push(`Expanded "${styleWord}" into ${expansion[styleWord] || "matching styles"}`);
  } else if (intent.categoryLock) {
    const colorBit = intent.colorIntent[0] ? `${intent.colorIntent[0]} ` : "";
    parts.push(`Showing ${colorBit}${intent.categoryLock.toLowerCase()}`);
  } else {
    return null;
  }

  if (signals?.styleProfile?.preferred_styles?.length) {
    parts.push(`tuned to your taste`);
  }

  return parts.join(" · ");
}

// Emotion / Intent mapping for feed scoring (non-search contexts)
const EMOTION_STYLE_MAP: Record<string, string[]> = {
  clean: ["minimal", "cleanFit"], sharp: ["classic", "chic", "formal"],
  lazy: ["casual", "minimal"], confident: ["chic", "classic", "edgy"],
  lowkey: ["minimal", "casual"], soft: ["casual", "minimal", "bohemian"],
  bold: ["edgy", "streetwear"], cozy: ["casual", "vintage"],
  elegant: ["classic", "chic", "formal"], chill: ["casual", "minimal", "sporty"],
  dark: ["edgy", "minimal"], moody: ["edgy", "vintage"],
  fresh: ["sporty", "casual", "minimal"], romantic: ["chic", "bohemian", "vintage"],
};

const EMOTION_COLOR_MAP: Record<string, string[]> = {
  clean: ["white", "neutral", "light"], dark: ["black", "charcoal", "navy"],
  soft: ["pastel", "beige", "cream"], bold: ["red", "orange", "bright"],
  moody: ["burgundy", "dark", "forest"], fresh: ["white", "mint", "sky"],
  elegant: ["black", "navy", "gold"], cozy: ["earth", "brown", "warm"],
};

// ── Feed scoring (for non-search contexts like "For You" tab) ──
function freeScoreProduct(
  item: AIRecommendation,
  query: string,
  userStyle?: any,
  feedbackMap?: Record<string, "like" | "dislike">,
): number {
  const queryLower = query.toLowerCase();
  const terms = queryLower.split(/\s+/).filter(t => t.length > 2);
  const itemText = `${item.name} ${item.brand} ${item.category} ${(item.style_tags || []).join(" ")} ${item.color} ${item.fit}`.toLowerCase();
  const itemNameLower = item.name.toLowerCase();

  let styleScore = 0;
  const matchedEmotions = Object.keys(EMOTION_STYLE_MAP).filter(e => queryLower.includes(e));
  if (matchedEmotions.length > 0) {
    const targetStyles = [...new Set(matchedEmotions.flatMap(e => EMOTION_STYLE_MAP[e]))];
    const overlap = (item.style_tags || []).filter(t => targetStyles.includes(t)).length;
    styleScore = Math.min(100, 40 + overlap * 25);
  } else {
    let matchWeight = 0;
    let totalWeight = 0;
    for (const t of terms) {
      totalWeight += 3;
      if (itemNameLower.includes(t)) matchWeight += 3;
      else if (item.brand.toLowerCase().includes(t)) matchWeight += 2;
      else if (itemText.includes(t)) matchWeight += 1;
    }
    styleScore = totalWeight > 0 ? Math.min(100, (matchWeight / totalWeight) * 100) : 50;
  }

  let prefScore = 50;
  if (userStyle) {
    const userStyles = userStyle.preferred_styles || [];
    const disliked = userStyle.disliked_styles || [];
    const matchedStyles = (item.style_tags || []).filter((t: string) => userStyles.includes(t));
    prefScore += matchedStyles.length * 15;
    if ((item.style_tags || []).some((t: string) => disliked.includes(t))) prefScore -= 30;
    const favBrands = userStyle.favorite_brands || [];
    if (favBrands.includes(item.brand)) prefScore += 20;
    if (userStyle.preferred_fit && item.fit === userStyle.preferred_fit) prefScore += 10;
  }
  prefScore = Math.max(0, Math.min(100, prefScore));

  let behaviorScore = 50;
  if (feedbackMap) {
    if (feedbackMap[item.id] === "like") behaviorScore = 95;
    if (feedbackMap[item.id] === "dislike") behaviorScore = 5;
  }

  const diversityScore = 40 + Math.random() * 20;

  return Math.round(0.40 * styleScore + 0.25 * prefScore + 0.20 * behaviorScore + 0.15 * diversityScore);
}

// Client-side result cache
const resultCache = new Map<string, { data: AIRecommendation[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

type SearchPathStatus = "DB_ONLY" | "DB_PLUS_PERPLEXITY" | "DB_PLUS_FALLBACK" | "PERPLEXITY_CACHED" | "FALLBACK_ONLY";

type SearchIntentDebug = {
  request_id?: string;
  prompt?: string;
  tier?: string;
  provider_requested?: boolean;
  provider_selected?: string;
  api_key_present?: boolean;
  request_started?: boolean;
  request_started_at?: string;
  response_received?: boolean;
  response_status?: number | null;
  raw_response_preview?: string | null;
  api_response_parse_success?: boolean;
  api_response_parse_error?: string | null;
  content_parse_success?: boolean;
  content_parse_error?: string | null;
  validation_success?: boolean;
  validation_error?: string | null;
  soft_timeout_triggered?: boolean;
  hard_timeout_triggered?: boolean;
  fallback_triggered?: boolean;
  late_response_received?: boolean;
  successful_queries_cached?: boolean;
  endpoint?: string | null;
  model?: string | null;
  elapsed_ms?: number | null;
  test_mode?: boolean;
};

type SearchIntentResult = {
  queries: string[];
  category?: string | null;
  style_tags?: string[];
  type?: QueryType;
  source: "perplexity" | "cache" | "fallback" | "lovable";
  cacheable: boolean;
  searchPathStatus: SearchPathStatus;
  debug?: SearchIntentDebug;
};

// AI intent cache — avoid re-calling Perplexity for same/similar queries
const intentCache = new Map<string, { queries: string[]; category?: string; style_tags?: string[]; type?: QueryType; ts: number; isFallback?: boolean }>();
const INTENT_CACHE_TTL = 10 * 60 * 1000; // 10 min for Perplexity-quality queries
const FALLBACK_INTENT_CACHE_TTL = 2 * 60 * 1000; // 2 min for fallback queries (so retypes don't re-race)
// Raised from 1500 → 2500ms. Perplexity averages 1.7–2.4s server-side; 1.5s was losing
// almost every race → fallback always won → cacheable never set → repeats also fell back.
// 2.5s gives Perplexity a real chance to win while still feeling instant (DB results
// already render in <300ms before this race even matters).
// Reduced from 2500ms — DB cycle now fires in parallel, so AI expansion
// only needs to beat the user's perception (~800ms). Late results still append.
const SEARCH_INTENT_SOFT_TIMEOUT_MS = 800;

function logSearchPathStatus(query: string, status: SearchPathStatus, extra: Record<string, unknown> = {}) {
  console.info(`[search] SEARCH_PATH_STATUS=${status}`, { query, ...extra });
}

function getCacheKey(action: string, params: Record<string, any>): string {
  return `${action}:${JSON.stringify(params)}`;
}

function getCachedResult(key: string): AIRecommendation[] | null {
  const entry = resultCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  if (entry) resultCache.delete(key);
  return null;
}

// ─── Style-to-search: convert user style profile into search queries ───
function buildStyleSearchQueries(profile: any, searchText?: string): string[] {
  const queries: string[] = [];
  if (searchText) queries.push(searchText);

  const styles = profile?.preferred_styles || [];
  const fit = profile?.preferred_fit || "";
  const brands = profile?.favorite_brands || [];
  const occasions = profile?.occasions || [];

  // Generate style-aware queries
  if (styles.includes("minimal")) queries.push("minimal clean structured fashion");
  if (styles.includes("street") || styles.includes("streetwear")) queries.push("oversized street style urban");
  if (styles.includes("classic") || styles.includes("oldMoney")) queries.push("classic tailored elegant menswear");
  if (styles.includes("casual")) queries.push("casual everyday comfortable wear");
  if (styles.includes("edgy")) queries.push("edgy avant-garde dark fashion");
  if (styles.includes("chic")) queries.push("chic modern sophisticated look");
  if (styles.includes("vintage")) queries.push("vintage retro fashion pieces");

  if (fit === "oversized") queries.push("oversized relaxed fit clothing");
  if (fit === "slim") queries.push("slim fitted modern clothing");

  if (occasions.includes("work")) queries.push("office workwear professional");
  if (occasions.includes("date")) queries.push("date night outfit elegant");

  // Add brand-specific queries
  brands.slice(0, 2).forEach((b: string) => {
    if (b !== "None") queries.push(`${b} new collection`);
  });

  // Always have a fallback
  if (queries.length === 0) queries.push("trending fashion new arrivals");

  return [...new Set(queries)].slice(0, 3);
}

// ─── Hybrid product search: DB-first + external expansion (with request dedup) ───
async function hybridProductSearch(opts: {
  query?: string;
  category?: string;
  styles?: string[];
  fit?: string;
  limit?: number;
  excludeIds?: string[];
  expandExternal?: boolean;
  randomize?: boolean;
  freshSearch?: boolean;
}): Promise<{ products: AIRecommendation[]; expanded: boolean; dbCount: number }> {
  const excludeKey = (opts.excludeIds || []).slice(0, 20).sort().join("|");
  const dedupKey = [
    "product-search",
    opts.query || "",
    opts.category || "",
    (opts.styles || []).join(","),
    opts.fit || "",
    String(opts.limit || 16),
    String(opts.expandExternal ?? false),
    String(opts.randomize ?? true),
    String(opts.freshSearch ?? false),
    excludeKey,
  ].join(":");

  const runSearch = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("product-search", {
        body: {
          query: opts.query || "",
          category: opts.category,
          styles: opts.styles,
          fit: opts.fit,
          limit: opts.limit || 16,
          excludeIds: opts.excludeIds || [],
          expandExternal: opts.expandExternal ?? false,
          randomize: opts.randomize ?? true,
          freshSearch: opts.freshSearch ?? false,
        },
      });
      if (error) throw error;

      const products = (data?.products || [])
        .filter((p: any) => p.image_url?.startsWith("https"))
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          brand: p.brand || "",
          price: p.price || "",
          category: p.category || "",
          reason: p.reason || "Curated for you",
          style_tags: p.style_tags || [],
          color: p.color || "",
          fit: p.fit || "regular",
          image_url: p.image_url,
          source_url: p.source_url,
          store_name: p.store_name,
          platform: p.platform || null,
        }));

      return {
        products,
        expanded: data?.expanded || false,
        dbCount: data?.dbCount || 0,
      };
    } catch (e) {
      console.error("Hybrid search error:", e);
      return { products: [], expanded: false, dbCount: 0 };
    }
  };

  if (opts.freshSearch) {
    return runSearch();
  }

  return deduplicatedSearch(dedupKey, runSearch);
}

// ─── Tag-based fallback: direct DB query when network is slow ───
async function tagBasedFallback(opts: {
  styles?: string[];
  fit?: string;
  category?: string;
  limit?: number;
}): Promise<AIRecommendation[]> {
  try {
    let query = supabase
      .from("product_cache")
      .select("id, name, brand, price, category, style_tags, color_tags, fit, image_url, source_url, store_name, platform")
      .eq("is_active", true)
      .eq("image_valid", true)
      .order("trend_score", { ascending: false })
      .limit(opts.limit || 12);

    if (opts.styles?.length) query = query.overlaps("style_tags", opts.styles);
    if (opts.category) query = query.eq("category", opts.category);
    if (opts.fit) query = query.eq("fit", opts.fit);

    const { data, error } = await query;
    if (error || !data) return [];

    return data
      .filter((p: any) => p.image_url?.startsWith("https"))
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        brand: p.brand || "",
        price: p.price || "",
        category: p.category || "",
        reason: "From your style profile",
        style_tags: p.style_tags || [],
        color: (p.color_tags || [])[0] || "",
        fit: p.fit || "regular",
        image_url: p.image_url,
        source_url: p.source_url,
        store_name: p.store_name,
        platform: p.platform || null,
      }));
  } catch {
    return [];
  }
}

// ─── Hybrid search with timeout fallback ───
async function hybridSearchWithFallback(
  opts: Parameters<typeof hybridProductSearch>[0],
  fallbackOpts: { styles?: string[]; fit?: string; category?: string },
  timeoutMs = 5000,
): Promise<{ products: AIRecommendation[]; expanded: boolean; dbCount: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await hybridProductSearch(opts);
    clearTimeout(timer);
    if (result.products.length > 0) return result;

    // If empty, try tag-based fallback
    const fallback = await tagBasedFallback({ ...fallbackOpts, limit: opts.limit });
    return { products: fallback, expanded: false, dbCount: fallback.length };
  } catch {
    clearTimeout(timer);
    // Network timeout → use tag-based fallback
    console.warn("Search timeout, using tag-based fallback");
    const fallback = await tagBasedFallback({ ...fallbackOpts, limit: opts.limit });
    return { products: fallback, expanded: false, dbCount: fallback.length };
  }
}

// ─── Advanced dedup: image URL, source URL, and fuzzy title matching ───
function normalizeTitle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
}

function titlesAreSimilar(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  // Check if one contains the other (>90% overlap)
  if (na.length > 5 && nb.length > 5) {
    if (na.includes(nb) || nb.includes(na)) return true;
    // Simple character overlap ratio
    const shorter = na.length < nb.length ? na : nb;
    const longer = na.length >= nb.length ? na : nb;
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    if (matches / longer.length > 0.9) return true;
  }
  return false;
}

// Session-level brand exposure tracking (how many times each brand shown)
const sessionBrandExposure: Record<string, number> = {};
const sessionSeenImages = new Set<string>();
const sessionSeenUrls = new Set<string>();

// ─── Client-side diversity enforcement (upgraded) ───
function enforceClientDiversity(items: AIRecommendation[], seenIds: Set<string>): AIRecommendation[] {
  // 1. Remove already seen by ID
  let result = items.filter(r => !seenIds.has(r.id));

  // 2. Dedup by image URL
  const imageKeys = new Set<string>(sessionSeenImages);
  result = result.filter(r => {
    if (!r.image_url) return false;
    const imgKey = r.image_url.split("?")[0].toLowerCase(); // strip query params
    if (imageKeys.has(imgKey)) return false;
    imageKeys.add(imgKey);
    return true;
  });

  // 3. Dedup by source URL
  const urlKeys = new Set<string>(sessionSeenUrls);
  result = result.filter(r => {
    if (!r.source_url) return true;
    const urlKey = r.source_url.split("?")[0].toLowerCase();
    if (urlKeys.has(urlKey)) return false;
    urlKeys.add(urlKey);
    return true;
  });

  // 4. Dedup by fuzzy title similarity (>90% match)
  const keptTitles: string[] = [];
  result = result.filter(r => {
    if (keptTitles.some(t => titlesAreSimilar(r.name, t))) return false;
    keptTitles.push(r.name);
    return true;
  });

  // 5. Brand diversity: max 2 per brand (reduced from 3)
  // Penalize brands already over-exposed in session
  const brandCount: Record<string, number> = {};
  result = result.filter(r => {
    const b = (r.brand || "unknown").toLowerCase();
    brandCount[b] = (brandCount[b] || 0) + 1;
    const sessionCount = sessionBrandExposure[b] || 0;
    // Allow max 2 per result set, and reduce if already over-exposed in session
    const maxAllowed = sessionCount > 4 ? 1 : 2;
    return brandCount[b] <= maxAllowed;
  });

  // 6. Style diversity: max 4 items with identical style_tags combination
  const styleComboCount: Record<string, number> = {};
  result = result.filter(r => {
    const combo = (r.style_tags || []).sort().join(",") || "none";
    styleComboCount[combo] = (styleComboCount[combo] || 0) + 1;
    return styleComboCount[combo] <= 4;
  });

  // 7. Category interleaving (round-robin across categories)
  if (result.length > 6) {
    const classified = result.map(r => ({ item: r, cat: classifyProduct(r) || "other" }));
    const byCategory: Record<string, AIRecommendation[]> = {};
    classified.forEach(({ item, cat }) => {
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    });

    const categories = Object.keys(byCategory).sort((a, b) =>
      (byCategory[b]?.length || 0) - (byCategory[a]?.length || 0)
    );

    if (categories.length > 1) {
      const interleaved: AIRecommendation[] = [];
      let idx = 0;
      const maxLen = result.length;
      while (interleaved.length < maxLen) {
        const cat = categories[idx % categories.length];
        const item = byCategory[cat]?.shift();
        if (item) interleaved.push(item);
        idx++;
        if (categories.every(c => !byCategory[c]?.length)) break;
      }
      result = interleaved;
    }
  }

  // 8. Final shuffle within quality tiers (top half stays roughly on top, but shuffled)
  if (result.length > 4) {
    const midpoint = Math.ceil(result.length / 2);
    const topHalf = result.slice(0, midpoint);
    const bottomHalf = result.slice(midpoint);
    // Shuffle each half
    for (const half of [topHalf, bottomHalf]) {
      for (let i = half.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [half[i], half[j]] = [half[j], half[i]];
      }
    }
    result = [...topHalf, ...bottomHalf];
  }

  // Track what we're showing in session memory
  result.forEach(r => {
    const b = (r.brand || "unknown").toLowerCase();
    sessionBrandExposure[b] = (sessionBrandExposure[b] || 0) + 1;
    if (r.image_url) sessionSeenImages.add(r.image_url.split("?")[0].toLowerCase());
    if (r.source_url) sessionSeenUrls.add(r.source_url.split("?")[0].toLowerCase());
  });

  return result;
}

// Session-level seen products tracking — persisted across reloads to reduce
// repeat-exposure across recent history (capped to last 500 IDs).
const SEEN_STORAGE_KEY = "wardrobe.seenProductIds";
const SEEN_CAP = 500;
const sessionSeenIds = new Set<string>(
  (() => {
    try {
      const raw = localStorage.getItem(SEEN_STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.slice(-SEEN_CAP) : [];
    } catch { return []; }
  })()
);
let _seenPersistTimer: ReturnType<typeof setTimeout> | null = null;
function persistSeenIds() {
  if (_seenPersistTimer) clearTimeout(_seenPersistTimer);
  _seenPersistTimer = setTimeout(() => {
    try {
      const arr = Array.from(sessionSeenIds).slice(-SEEN_CAP);
      localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(arr));
    } catch { /* quota — ignore */ }
  }, 800);
}
// Wrap Set.add so all existing callers persist automatically
const _origAdd = sessionSeenIds.add.bind(sessionSeenIds);
sessionSeenIds.add = (v: string) => {
  const r = _origAdd(v);
  persistSeenIds();
  return r;
};

const DiscoverPage = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const moodParam = searchParams.get("mood");
  const sourceParam = searchParams.get("source");
  const { tree: categoryTree } = useCategories();

  const [activeTab, setActiveTab] = useState("for-you");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<StyleQuizAnswers | null>(null);
  const [textInput, setTextInput] = useState(moodParam || "");
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "like" | "dislike">>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showAuthHint, setShowAuthHint] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [preferenceMode, setPreferenceMode] = useState(false);
  const [newStyleRecs, setNewStyleRecs] = useState<AIRecommendation[]>([]);
  const [loadingNewStyle, setLoadingNewStyle] = useState(false);
  const [userStyleProfile, setUserStyleProfile] = useState<any>(null);
  const [dbOffset, setDbOffset] = useState(0);
  const [hasMoreInDB, setHasMoreInDB] = useState(true);
  // ── "How about this?" — instant DB recommendations shown ABOVE the live search results ──
  const [dbRecommendations, setDbRecommendations] = useState<AIRecommendation[]>([]);
  const lastPromptRef = useRef("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  // ── Search session: a controlled lifecycle, NOT a repeating event.
  // Every new submit creates a fresh session. All async stages check
  // `session.id === searchSessionRef.current.id` before mutating UI, so
  // late callbacks from a previous session can never reset the current view.
  const searchSessionRef = useRef<{
    id: number;
    query: string;
    cycle: number;
    totalAdded: number;
    emptyCycles: number;
    stopped: boolean;
  }>({ id: 0, query: "", cycle: 0, totalAdded: 0, emptyCycles: 0, stopped: true });
  // 2x supply target — was 20, now 40 to fill the live section deeply.
  const SESSION_TARGET = 40;
  const SESSION_MAX_EMPTY_CYCLES = 2;

  // Product detail sheet
  const [detailProduct, setDetailProduct] = useState<AIRecommendation | null>(null);
  // Scenario context for display
  const [activeScenario, setActiveScenario] = useState<{ label: string; items: string[] } | null>(null);
  // Step 3: human-readable explanation of what the search interpreted
  const [searchExplanation, setSearchExplanation] = useState<string | null>(null);
  // Cycle-aware status for the live search section. Updated by appendCycle so
  // the user sees the system progress through stages instead of a vague spinner.
  const [liveStatus, setLiveStatus] = useState<string>("");
  // Same-query dedupe for explicit submits (prevents Enter-spam re-runs).
  const lastSubmitRef = useRef<{ q: string; ts: number }>({ q: "", ts: 0 });
  
  // Whether user needs to complete preferences
  const needsPreferences = !userStyleProfile && !quizAnswers;
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Filters
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedFit, setSelectedFit] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Build dynamic tabs from DB categories
  const browseTabs = useMemo(() => {
    const tabs: { slug: string; label: string; icon?: typeof Sparkles; children?: { slug: string; label: string }[] }[] = [
      { slug: "for-you", label: t("forYou") || "For You", icon: Sparkles },
    ];
    if (categoryTree.length > 0) {
      categoryTree.forEach(cat => {
        tabs.push({
          slug: cat.slug,
          label: cat.name,
          children: cat.children?.map(c => ({ slug: c.slug, label: c.name })) || [],
        });
      });
    } else {
      tabs.push(
        { slug: "clothing", label: "Clothing" },
        { slug: "bags", label: "Bags" },
        { slug: "shoes", label: "Shoes" },
        { slug: "accessories", label: "Accessories" },
      );
    }
    tabs.push({ slug: "featured", label: t("new") || "New" });
    return tabs;
  }, [categoryTree, t]);

  const activeTabData = browseTabs.find(t => t.slug === activeTab);
  const subcategories = activeTabData?.children || [];

  const searchSuggestionResults = useMemo(() => {
    if (!textInput.trim() || textInput.trim().length < 2) return [];
    return generateSuggestions(textInput).suggestions;
  }, [textInput]);


  // ── Infinite scroll: auto load-more via IntersectionObserver ──
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const isAutoLoading = useRef(false);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasGenerated && recommendations.length > 0 && !isLoadingMore && !isGenerating && !isAutoLoading.current) {
          isAutoLoading.current = true;
          loadMore().finally(() => { isAutoLoading.current = false; });
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasGenerated, recommendations.length, isLoadingMore, isGenerating]);

  // ── INSTANT INITIAL LOAD: Direct DB query (no edge function), then background expansion ──
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadInitial = async () => {
      setIsGenerating(true);
      setHasGenerated(true);

      const TARGET_COUNT = 12;

      // Step 1: INSTANT — Direct DB query, bypasses edge function for zero latency
      const userStyles = userStyleProfile?.preferred_styles?.slice(0, 3);
      const userFit = userStyleProfile?.preferred_fit;
      const dbProducts = await directDbLoad({
        styles: userStyles?.length ? userStyles : undefined,
        fit: userFit || undefined,
        limit: TARGET_COUNT,
      });

      if (dbProducts.length > 0) {
        let scoredProducts = dbProducts;
        if (userStyleProfile) {
          const styleQuery = buildStyleSearchQueries(userStyleProfile)[0] || "";
          scoredProducts = dbProducts
            .map(p => ({ ...p, _freeScore: freeScoreProduct(p, styleQuery, userStyleProfile, feedbackMap) }))
            .sort((a, b) => (b as any)._freeScore - (a as any)._freeScore);
        }

        const diverse = enforceClientDiversity(scoredProducts, sessionSeenIds);
        diverse.forEach(p => sessionSeenIds.add(p.id));
        setRecommendations(diverse);
        setDbOffset(diverse.length);
        setHasMoreInDB(true);
        setIsGenerating(false);

        // Step 2: Background expansion via edge function (non-blocking)
        setTimeout(() => {
          const styleQueries = userStyleProfile
            ? buildStyleSearchQueries(userStyleProfile)
            : ["trending fashion new arrivals"];

          hybridProductSearch({
            query: styleQueries[0],
            expandExternal: true,
            limit: TARGET_COUNT,
            excludeIds: Array.from(sessionSeenIds),
          }).then(({ products: freshProducts }) => {
            if (freshProducts.length > 0) {
              const freshDiverse = enforceClientDiversity(freshProducts, sessionSeenIds);
              freshDiverse.forEach(p => sessionSeenIds.add(p.id));
              setRecommendations(prev => enforceClientDiversity([...prev, ...freshDiverse], new Set()));
            }
          }).catch(() => {});
        }, 100);
      } else {
        // No DB products — force external expansion
        const { products: apiProducts } = await hybridProductSearch({
          query: "fashion trending new arrivals",
          expandExternal: true,
          limit: TARGET_COUNT,
        });

        if (apiProducts.length > 0) {
          apiProducts.forEach(p => sessionSeenIds.add(p.id));
          setRecommendations(apiProducts);
          setDbOffset(apiProducts.length);
          setHasMoreInDB(false);
        }
        setIsGenerating(false);
      }
    };
    if (!moodParam) loadInitial();
  }, []);

  useEffect(() => {
    if (moodParam && !hasGenerated) generateRecommendations(moodParam);
  }, [moodParam]);

  useEffect(() => {
    if (user) {
      loadSavedIds();
      loadStyleProfile();
    } else {
      setProfileLoaded(true);
    }
  }, [user]);

  const loadStyleProfile = async () => {
    if (!user) { setProfileLoaded(true); return; }
    const { data } = await supabase.from("style_profiles").select("*").eq("user_id", user.id).maybeSingle();
    setUserStyleProfile(data);
    setProfileLoaded(true);
  };

  useEffect(() => {
    if (activeTab !== "for-you" && activeTab !== "featured") {
      browseCategory(activeTab, activeSubcategory);
    }
  }, [activeTab, activeSubcategory]);

  const loadSavedIds = async () => {
    if (!user) return;
    const { data } = await supabase.from("saved_items").select("product_id").eq("user_id", user.id);
    setSavedIds(new Set((data || []).map(d => d.product_id)));
  };

  // DB-first browse with client cache
  const browseCategory = async (category: string, subcategory: string | null) => {
    const cacheKey = getCacheKey("browse", { category, subcategory, styles: selectedStyles, fit: selectedFit });
    const cached = getCachedResult(cacheKey);
    if (cached) {
      setRecommendations(cached);
      setHasGenerated(true);
      return;
    }

    if (inflightRef.current === cacheKey) return;
    inflightRef.current = cacheKey;

    setIsGenerating(true);
    setHasGenerated(true);
    // Don't clear recommendations — keep previous visible while loading
    setDbOffset(0);
    lastPromptRef.current = `Browse ${category}`;

    try {
      // Hybrid: DB-first + external expansion if too few results
      const { products, dbCount, expanded } = await hybridProductSearch({
        category,
        styles: selectedStyles.length > 0 ? selectedStyles : undefined,
        fit: selectedFit || undefined,
        limit: 18,
        excludeIds: Array.from(sessionSeenIds),
        expandExternal: false,
        randomize: true,
      });

      if (products.length >= 4) {
        const diverse = enforceClientDiversity(products, new Set());
        diverse.forEach(p => sessionSeenIds.add(p.id));
        setRecommendations(diverse);
        setDbOffset(diverse.length);
        setHasMoreInDB(dbCount >= 18);
        resultCache.set(cacheKey, { data: diverse, ts: Date.now() });
        setIsGenerating(false);
        inflightRef.current = null;
        return;
      }

      // Last resort: AI
      const sub = subcategory ? ` — ${subcategory}` : "";
      await generateRecommendations(`Show me ${category}${sub} items`, undefined, category);
    } catch {
      setIsGenerating(false);
    }
    inflightRef.current = null;
  };

  const handleQuizComplete = async (answers: StyleQuizAnswers) => {
    setQuizAnswers(answers);
    setShowQuiz(false);
    
    // Build synthetic style profile from quiz for immediate use
    const syntheticProfile = {
      preferred_styles: answers.preferredStyles,
      disliked_styles: answers.dislikedStyles,
      preferred_fit: answers.fitPreference,
      budget: answers.budgetRange,
      occasions: answers.occasionPreference,
      favorite_brands: answers.brandFamiliarity.filter(b => b !== "None"),
    };
    setUserStyleProfile(syntheticProfile);

    // Use DB-first with quiz preferences before falling back to AI
    const styleQueries = buildStyleSearchQueries(syntheticProfile);
    const { products } = await hybridSearchWithFallback(
      { query: styleQueries[0], styles: answers.preferredStyles.slice(0, 3), fit: answers.fitPreference || undefined, limit: 18, randomize: false },
      { styles: answers.preferredStyles, fit: answers.fitPreference || undefined },
    );

    if (products.length >= 4) {
      const scored = products
        .map(p => ({ ...p, _freeScore: freeScoreProduct(p, styleQueries[0], syntheticProfile, feedbackMap) }))
        .sort((a, b) => b._freeScore - a._freeScore);
      const diverse = enforceClientDiversity(scored, new Set());
      diverse.forEach(p => sessionSeenIds.add(p.id));
      setRecommendations(diverse);
      setHasGenerated(true);
    } else {
      // Fallback to AI
      const prompt = buildPromptFromQuiz(answers);
      generateRecommendations(prompt, answers);
    }

    // Persist quiz answers to style_profiles if logged in
    if (user) {
      try {
        await supabase.from("style_profiles").upsert({
          user_id: user.id,
          ...syntheticProfile,
        } as any, { onConflict: "user_id" });
      } catch (err) {
        console.error("Failed to save quiz answers:", err);
      }
    }
  };

  const buildPromptFromQuiz = (a: StyleQuizAnswers): string => {
    const parts: string[] = [];
    if (a.preferredStyles.length) parts.push(`Style: ${a.preferredStyles.join(", ")}`);
    if (a.fitPreference) parts.push(`Fit: ${a.fitPreference}`);
    if (a.colorPreference) parts.push(`Colors: ${a.colorPreference}`);
    if (a.dailyVibe) parts.push(`Vibe: ${a.dailyVibe}`);
    if (a.occasionPreference?.length) parts.push(`Occasion: ${a.occasionPreference.join(", ")}`);
    if (a.budgetRange) parts.push(`Budget: ${a.budgetRange}`);
    if (a.dislikedStyles.length) parts.push(`Avoid: ${a.dislikedStyles.join(", ")}`);
    return parts.join(". ");
  };

  // ── "How about this?" loader: instant DB recommendations based on user taste + (loosely) the query ──
  const loadDbRecommendations = useCallback(async (query: string) => {
    try {
      const stylesFromUser: string[] = userStyleProfile?.preferred_styles || quizAnswers?.preferredStyles || [];
      const dislikedStyles: string[] = userStyleProfile?.disliked_styles || [];
      const fitFromUser: string | undefined = userStyleProfile?.preferred_fit || quizAnswers?.fitPreference || undefined;

      // Pull a wide set then rank locally so it stays loosely related to the query
      // without competing with the strict bottom search-result section.
      let q = supabase
        .from("product_cache")
        .select("id, name, brand, price, category, style_tags, color_tags, fit, image_url, source_url, store_name, platform, reason")
        .eq("is_active", true)
        .not("image_url", "is", null)
        .order("trend_score", { ascending: false })
        .limit(40);
      if (stylesFromUser.length) q = q.overlaps("style_tags", stylesFromUser);
      if (fitFromUser) q = q.eq("fit", fitFromUser);

      const { data } = await q;
      let pool = (data || []).filter((p: any) => p.image_url?.startsWith("https"));

      // Soft-filter disliked styles
      if (dislikedStyles.length) {
        pool = pool.filter((p: any) => !(p.style_tags || []).some((t: string) => dislikedStyles.includes(t)));
      }

      // Light query affinity (don't drop items, just bias ordering)
      const qLower = (query || "").toLowerCase().trim();
      const tokens = qLower.split(/\s+/).filter(t => t.length > 2);
      if (tokens.length) {
        pool = pool
          .map((p: any) => {
            const hay = `${p.name || ""} ${p.brand || ""} ${(p.style_tags || []).join(" ")} ${(p.color_tags || []).join(" ")} ${p.category || ""}`.toLowerCase();
            const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
            return { p, score };
          })
          .sort((a, b) => b.score - a.score)
          .map(x => x.p);
      }

      // Exclude items already showing in the live results so the two sections stay distinct
      const liveIds = new Set(recommendations.map(r => r.id));
      const out: AIRecommendation[] = [];
      for (const p of pool) {
        if (liveIds.has(p.id)) continue;
        out.push({
          id: p.id,
          name: p.name,
          brand: p.brand || "",
          price: p.price || "",
          category: p.category || "",
          reason: p.reason || "From your taste",
          style_tags: p.style_tags || [],
          color: (p.color_tags || [])[0] || "",
          fit: p.fit || "regular",
          image_url: p.image_url,
          source_url: p.source_url,
          store_name: p.store_name,
          platform: p.platform || null,
        });
        if (out.length >= 8) break;
      }
      setDbRecommendations(out);
    } catch (e) {
      console.warn("[how-about-this] load failed", e);
      setDbRecommendations([]);
    }
  }, [userStyleProfile, quizAnswers, recommendations]);

  const generateRecommendations = async (prompt: string, quiz?: StyleQuizAnswers, categoryFilter?: string) => {
    const cacheKey = getCacheKey("recommend", { prompt, category: categoryFilter, styles: selectedStyles, fit: selectedFit, color: selectedColor });
    const cached = getCachedResult(cacheKey);
    if (cached) {
      setRecommendations(cached);
      setHasGenerated(true);
      setIsGenerating(false);
      return;
    }

    if (inflightRef.current === cacheKey) return;
    inflightRef.current = cacheKey;

    setIsGenerating(true);
    setHasGenerated(true);
    setDbOffset(0);
    setShowSuggestions(false);
    lastPromptRef.current = prompt;

    // Kick off "How about this?" DB recommendations in parallel — instant render
    loadDbRecommendations(prompt);

    try {
      const filterContext = [];
      if (categoryFilter) filterContext.push(`Category: ${categoryFilter}`);
      if (activeSubcategory) filterContext.push(`Subcategory: ${activeSubcategory}`);
      if (selectedStyles.length) filterContext.push(`Style: ${selectedStyles.join(", ")}`);
      if (selectedFit) filterContext.push(`Fit: ${selectedFit}`);
      if (selectedColor) filterContext.push(`Color palette: ${selectedColor}`);

      const fullPrompt = filterContext.length > 0
        ? `${prompt}. Filters: ${filterContext.join(". ")}`
        : prompt;

      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          action: "recommend",
          prompt: fullPrompt,
          quizAnswers: quiz || quizAnswers,
          userId: user?.id || null,
          source: sourceParam || "discover",
          count: 8,
          isSearch: true,
          category: categoryFilter || undefined,
          subcategory: activeSubcategory || undefined,
          styles: selectedStyles.length > 0 ? selectedStyles : undefined,
          fit: selectedFit || undefined,
        },
      });
      if (error) throw error;
      const recs = (data?.recommendations || []).filter((r: AIRecommendation) => {
        if (!r.image_url || !r.image_url.startsWith("http")) return false;
        return true;
      });
      setRecommendations(recs);
      setDbOffset(recs.length);
      resultCache.set(cacheKey, { data: recs, ts: Date.now() });
    } catch (e: any) {
      console.error("Recommendation error:", e);
      if (e?.message?.includes("Rate limited") || e?.status === 429) {
        toast.error("Too many requests — please wait a moment.");
      } else if (e?.message?.includes("credits") || e?.status === 402) {
        toast.error("AI credits exhausted. Please add funds.");
      }
    } finally {
      setIsGenerating(false);
      inflightRef.current = null;
    }
  };

  // ── LOAD MORE: Hybrid DB + external with relevance filtering ──
  const loadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const existingIds = new Set(recommendations.map(r => r.id));
      const category = activeTab !== "for-you" && activeTab !== "featured" ? activeTab : undefined;
      const searchQuery = lastPromptRef.current || (category ? `trending ${category}` : "fashion trending");

      // Parse intent for relevance filtering on load-more
      const intent = lastPromptRef.current ? parseQueryIntent(lastPromptRef.current) : null;

      const { products: moreProducts, dbCount } = await hybridProductSearch({
        query: searchQuery,
        category,
        styles: selectedStyles.length > 0 ? selectedStyles : undefined,
        fit: selectedFit || undefined,
        limit: 20,
        excludeIds: Array.from(new Set([...existingIds, ...sessionSeenIds])),
        expandExternal: !hasMoreInDB,
        randomize: !intent, // Only randomize for feed, not search
      });

      // Apply relevance filter if we have a search intent
      let filtered = moreProducts;
      if (intent && intent.categoryLock) {
        filtered = filterByRelevance(moreProducts, intent);
      }

      const newProducts = enforceClientDiversity(filtered, existingIds);
      
      if (newProducts.length > 0) {
        newProducts.forEach(p => sessionSeenIds.add(p.id));
        setRecommendations(prev => [...prev, ...newProducts]);
        setDbOffset(prev => prev + newProducts.length);
        setHasMoreInDB(dbCount >= 20);
      } else {
        // Try external expansion
        const { products: freshProducts } = await hybridProductSearch({
          query: searchQuery,
          expandExternal: true,
          limit: 10,
          excludeIds: Array.from(new Set([...existingIds, ...sessionSeenIds])),
        });

        let freshFiltered = freshProducts;
        if (intent && intent.categoryLock) {
          freshFiltered = filterByRelevance(freshProducts, intent);
        }

        const freshNew = enforceClientDiversity(freshFiltered, existingIds);
        if (freshNew.length > 0) {
          freshNew.forEach(p => sessionSeenIds.add(p.id));
          setRecommendations(prev => [...prev, ...freshNew]);
        } else {
          toast("No more items to show right now");
        }
      }
    } catch (e) {
      console.error("Load more error:", e);
      toast.error("Failed to load more items");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // ── FALLBACK QUERY GENERATOR: rule-based, instant, no API needed ──
  // ══════════════════════════════════════════════════════════════════════

  function expandSearchQuery(q: string): string[] {
    const lower = q.toLowerCase().trim();
    const queries: string[] = [];

    // ── 1. Detect query type using parseQueryIntent (already in scope) ──
    const intent = parseQueryIntent(q);

    // ── 2. Detect color (keep in all generated queries) ──
    const detectedColor = intent.colorIntent[0] || "";
    const colorPrefix = detectedColor ? `${detectedColor} ` : "";

    // ── 3. Detect brand ──
    const detectedBrand = intent.brandIntent[0] || "";

    // ── Style modifiers to inject for richness ──
    const STYLE_MODIFIERS = ["minimal", "oversized", "clean", "relaxed", "tailored"];

    // ═══ SCENARIO queries ═══
    const SCENARIO_EXPANSIONS: Record<string, string[]> = {
      "summer vacation": ["linen shirt summer", "casual shorts men", "sandals summer", "sunglasses fashion", "straw hat", "lightweight tee", "resort wear", "swim shorts beach"],
      "summer": ["linen shirt", "cotton shorts", "sandals", "tank top", "sunglasses", "lightweight dress", "straw bag", "espadrilles"],
      "vacation": ["resort wear shirt", "linen shorts casual", "sandals vacation", "sunglasses travel", "crossbody bag", "summer dress"],
      "beach": ["swim shorts", "sandals beach", "linen shirt", "straw hat", "tank top", "sunglasses polarized", "beach tote bag"],
      "travel": ["comfortable sneakers", "versatile jacket", "crossbody bag travel", "casual pants stretch", "lightweight shirt", "backpack carry-on"],
      "winter": ["wool coat winter", "knit sweater thick", "leather boots", "cashmere scarf", "gloves leather", "parka insulated", "thermal turtleneck"],
      "spring": ["light jacket spring", "clean sneakers white", "cotton shirt pastel", "chinos slim", "windbreaker", "light cardigan"],
      "fall": ["leather jacket brown", "suede boots", "knit sweater", "wool scarf", "corduroy pants", "flannel shirt"],
      "autumn": ["leather jacket", "chelsea boots", "cable knit sweater", "wool coat", "corduroy trousers"],
      "rain": ["rain jacket waterproof", "waterproof boots", "trench coat", "gore-tex sneakers", "packable jacket"],
      "wedding": ["suit tailored", "dress shoes leather", "silk tie", "formal dress elegant", "clutch bag evening", "cufflinks"],
      "date": ["blazer slim fit", "dress shirt clean", "slim pants", "clean sneakers", "elegant dress", "leather belt"],
      "date night": ["blazer elegant", "slim trousers dark", "dress shoes polished", "silk blouse", "clutch bag", "statement jewelry"],
      "office": ["blazer structured", "dress shirt cotton", "tailored trousers", "leather loafers", "leather briefcase", "slim belt"],
      "work": ["blazer work", "button-down shirt", "dress pants", "oxford shoes", "leather tote bag", "minimal watch"],
      "gym": ["athletic shorts dri-fit", "running shoes cushioned", "performance tee", "zip hoodie", "joggers tapered", "sports bra"],
      "workout": ["training shorts", "running shoes", "muscle tee", "compression leggings", "athletic hoodie", "gym bag"],
      "party": ["statement jacket", "leather boots", "edgy graphic top", "slim black jeans", "chain necklace", "bold sneakers"],
      "festival": ["graphic tee vintage", "denim shorts", "high-top sneakers", "bucket hat", "crossbody bag small", "bold sunglasses"],
      "casual": ["plain t-shirt quality", "slim jeans", "casual sneakers", "hoodie cotton", "casual jacket", "canvas bag"],
      "formal": ["tailored suit", "dress shirt white", "oxford shoes leather", "silk tie", "formal dress", "leather belt"],
      "streetwear": ["oversized hoodie graphic", "cargo pants wide", "chunky sneakers", "snapback cap", "crossbody bag street", "oversized tee"],
      "hiking": ["hiking boots waterproof", "outdoor jacket technical", "cargo pants stretch", "trail backpack", "moisture-wicking tee"],
      "camping": ["fleece jacket half-zip", "hiking boots", "cargo shorts durable", "technical backpack", "insulated vest"],
      "school": ["casual backpack", "clean sneakers", "cotton hoodie", "slim jeans", "basic tee", "canvas shoes"],
      "airport": ["comfortable joggers", "slip-on sneakers", "oversized hoodie soft", "crossbody bag", "sunglasses", "compression socks"],
      "brunch": ["linen shirt relaxed", "chinos casual", "loafers suede", "tote bag canvas", "light cardigan"],
      "concert": ["graphic tee band", "leather jacket", "black jeans slim", "boots", "statement accessories"],
      "interview": ["tailored blazer navy", "dress shirt white", "slim trousers charcoal", "oxford shoes", "leather portfolio bag"],
      "picnic": ["linen shirt pastel", "cotton shorts", "canvas sneakers", "straw hat", "tote bag"],
      "resort": ["resort shirt printed", "swim shorts tailored", "leather sandals", "sunglasses aviator", "linen pants"],
    };

    // ═══ STYLE / EMOTION queries ═══
    const STYLE_EXPANSIONS: Record<string, string[]> = {
      modern: ["modern slim jacket", "minimalist sneakers white", "structured trousers tapered", "clean tee premium", "modern leather bag"],
      clean: ["clean minimal shirt white", "white sneakers leather", "structured blazer neutral", "slim chinos beige", "clean watch minimal"],
      cozy: ["oversized knit sweater", "sherpa fleece hoodie", "knit cardigan chunky", "soft cotton joggers", "fuzzy slippers"],
      bold: ["statement jacket colorful", "graphic tee bold", "colored sneakers bright", "patterned shirt", "bold accessories chain"],
      moody: ["dark tonal jacket", "leather boots black", "dark denim slim", "turtleneck black", "minimal dark accessories"],
      fresh: ["light sneakers casual", "linen shirt summer", "cotton shorts fresh", "pastel tee", "canvas bag light"],
      confident: ["tailored blazer fitted", "sharp dress shoes", "structured overcoat", "slim belt leather", "quality watch"],
      elegant: ["silk blouse", "classic leather bag", "tailored wool trousers", "heeled boots", "delicate jewelry gold"],
      chill: ["relaxed jeans wide", "casual hoodie soft", "comfort sneakers slip-on", "oversized tee", "bucket hat"],
      soft: ["pastel knit sweater", "soft cotton tee cream", "light linen pants", "suede loafers", "woven bag"],
      dark: ["black leather jacket", "dark denim jeans slim", "black boots minimal", "black turtleneck", "dark accessories"],
      lazy: ["oversized hoodie blank", "relaxed joggers cotton", "slip-on sneakers", "loose tee", "beanie knit"],
      sharp: ["tailored suit jacket slim", "fitted dress shirt", "oxford shoes polished", "slim tie", "leather belt"],
      lowkey: ["neutral tee minimal", "slim chinos earth tone", "clean low-top sneakers", "simple watch", "canvas tote"],
      romantic: ["flowy blouse silk", "delicate jewelry", "vintage dress floral", "suede heels", "lace accessories"],
    };

    // ═══ PRODUCT queries: expand with style variants + nearby categories ═══
    const PRODUCT_CATEGORY_SIBLINGS: Record<string, string[]> = {
      jacket: ["outerwear", "coat", "blazer", "bomber jacket"],
      coat: ["overcoat", "trench coat", "wool coat", "parka"],
      blazer: ["sport coat", "tailored jacket", "structured blazer"],
      shirt: ["button-down shirt", "oxford shirt", "dress shirt", "casual shirt"],
      hoodie: ["zip hoodie", "pullover hoodie", "oversized hoodie", "fleece hoodie"],
      sweater: ["knit sweater", "cashmere sweater", "crewneck sweater", "cardigan"],
      pants: ["trousers", "chinos", "slim pants", "wide pants"],
      jeans: ["slim jeans", "straight jeans", "wide leg jeans", "denim"],
      shorts: ["casual shorts", "chino shorts", "athletic shorts"],
      sneakers: ["low-top sneakers", "high-top sneakers", "running shoes", "leather sneakers"],
      boots: ["chelsea boots", "leather boots", "ankle boots", "combat boots"],
      shoes: ["loafers", "sneakers", "boots", "dress shoes"],
      bag: ["tote bag", "crossbody bag", "backpack", "messenger bag"],
      dress: ["midi dress", "maxi dress", "casual dress", "elegant dress"],
    };

    // ─── Check scenario first (longest match) ───
    const sortedScenarios = Object.keys(SCENARIO_EXPANSIONS).sort((a, b) => b.length - a.length);
    let scenarioMatched = false;
    for (const key of sortedScenarios) {
      if (lower.includes(key)) {
        const items = SCENARIO_EXPANSIONS[key];
        // Add color prefix to each item if user specified a color
        queries.push(...items.map(item => colorPrefix ? `${colorPrefix}${item}` : item));
        scenarioMatched = true;
        break;
      }
    }

    // ─── Check style/emotion ───
    if (!scenarioMatched) {
      const sortedStyles = Object.keys(STYLE_EXPANSIONS).sort((a, b) => b.length - a.length);
      let styleMatched = false;
      for (const key of sortedStyles) {
        if (lower.includes(key)) {
          queries.push(...STYLE_EXPANSIONS[key].map(item => colorPrefix ? `${colorPrefix}${item}` : item));
          styleMatched = true;
          break;
        }
      }

      // ─── Product query: expand with variants ───
      if (!styleMatched) {
        const productCategoryMatch = lower.match(/\b(jacket|coat|blazer|shirt|hoodie|sweater|cardigan|vest|pants|trousers|jeans|shorts|skirt|sneakers?|boots?|shoes?|loafers?|sandals?|bag|tote|backpack|hat|watch|dress|top|tee)\b/);

        if (productCategoryMatch) {
          const productKey = productCategoryMatch[1].replace(/s$/, ""); // normalize plural
          // Original query stays first
          queries.push(q);
          // Brand variant
          if (detectedBrand) {
            queries.push(`${detectedBrand} ${productKey}`);
          }
          // Color + product
          if (detectedColor) {
            queries.push(`${detectedColor} ${productKey}`);
          }
          // Style-modified variants
          const modifiers = STYLE_MODIFIERS.slice(0, 3);
          modifiers.forEach(mod => queries.push(`${mod} ${colorPrefix}${productKey}`));
          // Sibling categories
          const siblings = PRODUCT_CATEGORY_SIBLINGS[productKey] || [];
          siblings.slice(0, 3).forEach(sib => queries.push(`${colorPrefix}${sib}`));
        } else {
          // ─── Unknown / generic query: cross-category expansion ───
          queries.push(q);
          queries.push(`${q} jacket`);
          queries.push(`${q} shirt`);
          queries.push(`${q} sneakers`);
          queries.push(`${q} pants`);
          queries.push(`${q} bag`);
          queries.push(`${q} accessories`);
          // Add style-modified
          queries.push(`minimal ${q}`);
          queries.push(`casual ${q}`);
        }
      }
    }

    // ── Ensure minimum 5 queries: pad with cross-category if needed ──
    if (queries.length < 5) {
      const padCategories = ["jacket", "sneakers", "shirt", "bag", "accessories"];
      for (const cat of padCategories) {
        if (queries.length >= 5) break;
        const padQuery = `${colorPrefix}${intent.styleIntent[0] || "casual"} ${cat}`;
        if (!queries.includes(padQuery)) queries.push(padQuery);
      }
    }

    // Deduplicate and cap at 10
    return [...new Set(queries)].slice(0, 10);
  }

  // ── Perplexity-powered query expansion via wardrobe-ai search-intent (cached, non-blocking) ──
  // Soft timeout (race) lives in handleTextSubmit; this function always awaits the full response
  // so late Perplexity wins can populate the cache and trigger background ingestion.
  async function aiExpandQuery(q: string): Promise<SearchIntentResult> {
    const cacheKey = q.toLowerCase().trim();
    const cached = intentCache.get(cacheKey);
    const cachedTtl = cached?.isFallback ? FALLBACK_INTENT_CACHE_TTL : INTENT_CACHE_TTL;
    if (cached && Date.now() - cached.ts < cachedTtl) {
      console.info("[search-intent] PERPLEXITY_CACHED", {
        query: cacheKey,
        cachedAt: new Date(cached.ts).toISOString(),
        queries: cached.queries.length,
        isFallback: !!cached.isFallback,
      });
      return {
        queries: cached.queries,
        category: cached.category,
        style_tags: cached.style_tags,
        type: cached.type,
        source: cached.isFallback ? "fallback" : "cache",
        cacheable: !cached.isFallback,
        searchPathStatus: cached.isFallback ? "FALLBACK_ONLY" : "PERPLEXITY_CACHED",
      };
    }

    console.info("[search-intent] REQUEST_START", {
      query: q,
      requestStartedAt: new Date().toISOString(),
      perplexityRequested: true,
    });

    try {
      const t0 = performance.now();
      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          action: "search-intent",
          prompt: q,
          source: sourceParam || "discover",
        },
      });
      const elapsed = Math.round(performance.now() - t0);
      if (error) throw error;
      const debug = (data?.debug || {}) as SearchIntentDebug;
      const hasValidQueries = Array.isArray(data?.queries) && data.queries.length >= 3 && data.queries.every((query: unknown) => typeof query === "string" && query.trim().length > 0);

      console.info("[search-intent] RESPONSE", {
        query: q,
        elapsedMs: elapsed,
        tier: data?.tier,
        provider: data?.provider,
        cacheable: data?.cacheable,
        responseStatus: debug.response_status ?? null,
        rawResponsePreview: debug.raw_response_preview ?? null,
        apiKeyPresent: debug.api_key_present ?? null,
        apiResponseParseSuccess: debug.api_response_parse_success ?? null,
        contentParseSuccess: debug.content_parse_success ?? null,
        validationSuccess: debug.validation_success ?? null,
        hardTimeoutTriggered: debug.hard_timeout_triggered ?? false,
        fallbackTriggered: data?.search_path_status === "FALLBACK_ONLY" || debug.fallback_triggered === true,
      });

      if (hasValidQueries) {
        const result: SearchIntentResult = {
          queries: data.queries,
          category: data.category || null,
          style_tags: data.style_tags || [],
          type: data.type,
          source: data.provider === "perplexity" ? "perplexity" : data.provider === "lovable" ? "lovable" : "fallback",
          cacheable: Boolean(data.cacheable && data.provider === "perplexity"),
          searchPathStatus: data.provider === "perplexity"
            ? "DB_PLUS_PERPLEXITY"
            : data.search_path_status === "DB_ONLY"
              ? "DB_ONLY"
              : "FALLBACK_ONLY",
          debug,
        };

        if (result.cacheable) {
          intentCache.set(cacheKey, {
            queries: result.queries,
            category: result.category ?? undefined,
            style_tags: result.style_tags,
            type: result.type,
            ts: Date.now(),
            isFallback: false,
          });
          console.info("[search-intent] CACHE_SAVE", {
            query: cacheKey,
            queries: result.queries.length,
            requestId: debug.request_id,
          });
        } else {
          console.info("[search-intent] CACHE_SKIP", {
            query: cacheKey,
            provider: result.source,
            reason: result.source === "fallback" ? "fallback-response" : "non-perplexity-provider",
          });
        }

        return result;
      }
    } catch (e) {
      console.info("[search-intent] REQUEST_FAILED", {
        query: q,
        error: e instanceof Error ? e.message : e,
      });
    }

    return {
      queries: expandSearchQuery(q),
      source: "fallback",
      cacheable: false,
      searchPathStatus: "FALLBACK_ONLY",
      debug: {
        fallback_triggered: true,
      },
    };
  }

  // Debounced search submit — SESSION-based lifecycle (append-only, controlled cycles).
  const handleTextSubmit = (query?: string) => {
    const q = (query || textInput).trim();
    if (!q) return;

    // Dedupe: same query within 1.5s is a no-op. Prevents Enter-spam.
    const now = Date.now();
    if (lastSubmitRef.current.q === q.toLowerCase() && now - lastSubmitRef.current.ts < 1500) {
      console.info("[search] DEDUPE_SUBMIT", { q });
      return;
    }
    lastSubmitRef.current = { q: q.toLowerCase(), ts: now };

    setTextInput(q);
    setActiveTab("for-you");
    setActiveSubcategory(null);
    setShowSuggestions(false);
    setLiveStatus("Searching across more stores…");

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    // 400ms debounce removed on explicit submit — kicks off immediately so
    // the user sees DB results in <500ms instead of >3s.
    debounceTimerRef.current = setTimeout(async () => {
      // ── Open a fresh search session ─────────────────────────────────────
      const sessionId = Date.now() + Math.floor(Math.random() * 1000);
      const session = { id: sessionId, query: q, cycle: 0, totalAdded: 0, emptyCycles: 0, stopped: false };
      searchSessionRef.current = session;

      // Helpers bound to THIS session only
      const isCurrent = () => searchSessionRef.current.id === sessionId && !session.stopped;
      const stopSession = (reason: string) => {
        if (session.stopped) return;
        session.stopped = true;
        if (searchSessionRef.current.id === sessionId) {
          setIsGenerating(false);
          setLiveStatus("");
        }
        console.info("[search-session] STOP", { sessionId, query: q, reason, totalAdded: session.totalAdded, cycles: session.cycle });
      };
      // Cycle-aware status messages — user sees real progress, not a vague spinner.
      const STATUS_BY_LABEL: Record<string, string> = {
        "instant-db": "Loading more products…",
        "db-quick": "Loading more products…",
        "scenario-db-quick": "Loading more products…",
        "external-fresh": "Searching across more stores…",
        "scenario-external": "Searching across more stores…",
        "late-perplexity": "Adding new verified items…",
        "discovery-ingestion": "Adding new verified items…",
        "fallback-broaden": "Searching wider for more options…",
      };
      const appendCycle = (label: string, incoming: AIRecommendation[]) => {
        if (!isCurrent()) return 0;
        session.cycle++;
        const before = session.totalAdded;
        let addedCount = 0;
        if (incoming.length > 0) {
          incoming.forEach(p => sessionSeenIds.add(p.id));
          setRecommendations(prev => {
            const merged = appendUnique(prev, incoming, 80);
            addedCount = merged.length - prev.length;
            session.totalAdded = before + addedCount;
            return merged;
          });
        }
        if (addedCount === 0) session.emptyCycles++;
        else session.emptyCycles = 0;
        // Update visible status for this cycle
        const nextStatus = STATUS_BY_LABEL[label] || "Loading more products…";
        setLiveStatus(nextStatus);
        console.info("[search-session] CYCLE", {
          sessionId, query: q, cycle: session.cycle, label,
          incoming: incoming.length, added: addedCount,
          totalAdded: session.totalAdded, emptyCycles: session.emptyCycles,
        });
        // Stop conditions
        if (session.totalAdded >= SESSION_TARGET) stopSession(`reached target ${SESSION_TARGET}`);
        else if (session.emptyCycles >= SESSION_MAX_EMPTY_CYCLES) stopSession(`${SESSION_MAX_EMPTY_CYCLES} empty cycles in a row`);
        return addedCount;
      };

      console.info("[search-session] START", { sessionId, query: q });
      setIsGenerating(true);
      setHasGenerated(true);
      // Append-only: do NOT clear previous results here. New session may reuse them
      // visually until new ones append on top — prevents the empty-flash flicker.
      setActiveScenario(null);
      setSearchExplanation(null);
      lastPromptRef.current = q;

      // Step 1: Parse query into structured intent
      const intent = parseQueryIntent(q);
      const isScenarioQuery = intent.queryType === "scenario";

      // Build user taste signals
      const userSignals: UserSignals = {
        styleProfile: userStyleProfile,
        feedbackMap,
        savedIds,
      };
      setSearchExplanation(buildSearchExplanation(intent, userSignals));

      // Reset visible list once per NEW query (not per re-submit of same query).
      // We do it by clearing only when the previous prompt differs.
      // Note: keep the list if same query — new cycles will simply append.
      // (Already handled: new session id + append-only means stale items just stay)

      // Step 2: AI query expansion with soft timeout
      const localExpanded = expandSearchQuery(q);
      const cacheKey = q.toLowerCase().trim();
      const cached = intentCache.get(cacheKey);
      let searchIntentResult: SearchIntentResult;
      let softTimeoutTriggered = false;

      // ── INSTANT CYCLE 0 ────────────────────────────────────────────────
      // Fire a literal-query DB hit IN PARALLEL with the AI expansion so
      // the user sees results in <500ms instead of waiting for Perplexity.
      // This runs only when we don't have a cached intent (cached path is
      // already fast). Errors are swallowed — it's purely additive.
      const categoryMapEarly: Record<string, string> = {
        OUTERWEAR: "outerwear", TOPS: "clothing", BOTTOMS: "clothing",
        SHOES: "shoes", BAGS: "bags", ACCESSORIES: "accessories",
      };
      const dbCategoryEarly = intent.categoryLock ? categoryMapEarly[intent.categoryLock] : undefined;
      void hybridProductSearch({
        query: q,
        category: dbCategoryEarly,
        styles: intent.styleIntent.length > 0 ? intent.styleIntent : undefined,
        fit: selectedFit || undefined,
        limit: 24,
        freshSearch: false,
        expandExternal: false,
        randomize: false,
      }).then(({ products }) => {
        if (!isCurrent() || products.length === 0) return;
        const relevant = filterByRelevance(products, intent, MIN_RESULT_TARGET, userSignals);
        const diverse = enforceClientDiversity(relevant, new Set(Array.from(sessionSeenIds)));
        appendCycle("instant-db", diverse);
      }).catch(() => {});

      if (cached && Date.now() - cached.ts < (cached.isFallback ? FALLBACK_INTENT_CACHE_TTL : INTENT_CACHE_TTL)) {
        searchIntentResult = {
          queries: cached.queries,
          category: cached.category,
          style_tags: cached.style_tags || [],
          type: cached.type,
          source: cached.isFallback ? "fallback" : "cache",
          cacheable: !cached.isFallback,
          searchPathStatus: cached.isFallback ? "FALLBACK_ONLY" : "PERPLEXITY_CACHED",
        };
      } else {
        const aiPromise = aiExpandQuery(q);
        // Late Perplexity result → background ingestion that APPENDS to current session
        void aiPromise.then((lateResult) => {
          if (!softTimeoutTriggered) return;
          if (lateResult.source !== "perplexity" || !lateResult.cacheable) return;
          if (!isCurrent()) return;
          const lateQueries = lateResult.queries.slice(0, 4);
          Promise.all(
            lateQueries.map(lq =>
              hybridProductSearch({
                query: lq, limit: 10,
                excludeIds: Array.from(sessionSeenIds),
                freshSearch: true, expandExternal: true, randomize: false,
              }).catch(() => ({ products: [] as AIRecommendation[], expanded: false, dbCount: 0 }))
            )
          ).then(results => {
            if (!isCurrent()) return;
            const lateProducts = results.flatMap(r => r.products);
            const lateRelevant = filterByRelevanceStrict(lateProducts, intent, userSignals);
            appendCycle("late-perplexity", lateRelevant);
          });
        }).catch(() => {});

        searchIntentResult = await Promise.race([
          aiPromise,
          new Promise<SearchIntentResult>((resolve) =>
            setTimeout(() => {
              softTimeoutTriggered = true;
              intentCache.set(cacheKey, { queries: localExpanded, ts: Date.now(), isFallback: true });
              resolve({
                queries: localExpanded, source: "fallback", cacheable: false,
                searchPathStatus: "FALLBACK_ONLY",
                debug: { soft_timeout_triggered: true, fallback_triggered: true },
              });
            }, SEARCH_INTENT_SOFT_TIMEOUT_MS)
          ),
        ]);
      }

      const searchQueries = [...new Set([...searchIntentResult.queries, ...localExpanded])].slice(0, 8);
      console.log("Search:", { query: q, type: intent.queryType, scenario: intent.scenarioLabel, searchQueries });

      const categoryMap: Record<string, string> = {
        OUTERWEAR: "outerwear", TOPS: "clothing", BOTTOMS: "clothing", SHOES: "shoes", BAGS: "bags", ACCESSORIES: "accessories",
      };
      const dbCategory = intent.categoryLock ? categoryMap[intent.categoryLock] : undefined;

      if (isScenarioQuery) {
        setActiveScenario({ label: intent.scenarioLabel!, items: searchQueries });

        // CYCLE 1: Quick DB results (instant)
        const quickDbResults = await Promise.all(
          searchQueries.slice(0, 2).map(eq =>
            hybridProductSearch({
              query: eq, limit: 12, expandExternal: false, freshSearch: false,
              excludeIds: Array.from(sessionSeenIds), randomize: false,
            })
          )
        );
        if (!isCurrent()) return;
        const quickProducts = quickDbResults.flatMap(r => r.products);
        const quickFiltered = filterForScenario(quickProducts, intent);
        const quickDiverse = enforceClientDiversity(quickFiltered, new Set(Array.from(sessionSeenIds)));
        appendCycle("scenario-db-quick", quickDiverse);

        // CYCLE 2: Full external search
        Promise.all(
          searchQueries.slice(0, 3).map(eq =>
            hybridProductSearch({
              query: eq, limit: 10, expandExternal: true, freshSearch: true,
              excludeIds: Array.from(sessionSeenIds), randomize: false,
            })
          )
        ).then(results => {
          if (!isCurrent()) return;
          const allProducts = results.flatMap(r => r.products);
          const scenarioFiltered = filterForScenario(allProducts, intent);
          const strict = filterByRelevanceStrict(scenarioFiltered, intent, userSignals);
          appendCycle("scenario-external", strict);
        }).catch(err => {
          console.error("Scenario external search error:", err);
        }).finally(() => {
          // External cycle finished — if no stop yet, finalize loading state
          if (isCurrent()) stopSession("scenario-external complete");
        });
      } else {
        // PRODUCT or STYLE query
        // CYCLE 1: Quick DB
        const { products: dbQuickProducts, dbCount } = await hybridProductSearch({
          query: q, category: dbCategory,
          styles: intent.styleIntent.length > 0 ? intent.styleIntent : undefined,
          fit: selectedFit || undefined,
          limit: 30, freshSearch: false, expandExternal: false, randomize: false,
        });
        if (!isCurrent()) return;
        const dbRelevant = filterByRelevance(dbQuickProducts, intent, MIN_RESULT_TARGET, userSignals);
        const dbDiverse = enforceClientDiversity(dbRelevant, new Set(Array.from(sessionSeenIds)));
        appendCycle("db-quick", dbDiverse);
        if (isCurrent()) {
          setDbOffset(dbDiverse.length);
          setHasMoreInDB(dbCount >= 30);
        }

        // CYCLE 1.5: Background search-discovery (long-term DB growth)
        triggerSearchDiscovery(q).then(async (result) => {
          if (!isCurrent() || !result || result.inserted === 0) return;
          try {
            const { data: fresh } = await supabase
              .from("product_cache")
              .select("id, name, brand, price, category, style_tags, color_tags, fit, image_url, source_url, store_name, platform, reason")
              .eq("search_query", q).eq("is_active", true)
              .order("created_at", { ascending: false }).limit(20);
            if (!fresh?.length || !isCurrent()) return;
            const mapped: AIRecommendation[] = fresh.map((p: any) => ({
              id: p.id, name: p.name, brand: p.brand || "", price: p.price || "",
              category: p.category || "", reason: p.reason || "Just discovered",
              style_tags: p.style_tags || [], color: (p.color_tags || [])[0] || "",
              fit: p.fit || "regular", image_url: p.image_url, source_url: p.source_url,
              store_name: p.store_name, platform: p.platform || "web_search",
            }));
            const newOnes = mapped.filter(p => !sessionSeenIds.has(p.id));
            const filtered = filterByRelevanceStrict(newOnes, intent, userSignals);
            appendCycle("discovery-ingestion", filtered);
          } catch (e) {
            console.warn("[search] DISCOVERY_REFETCH_FAIL", e);
          }
        }).catch(e => console.warn("[search] DISCOVERY_FAIL", e));

        // CYCLE 2: External fresh search
        const externalSearchQueries = [...new Set([q, ...searchQueries])].slice(0, 3);
        Promise.all(
          externalSearchQueries.map(sq =>
            hybridProductSearch({
              query: sq, category: dbCategory, limit: 12,
              excludeIds: Array.from(sessionSeenIds),
              freshSearch: true, expandExternal: true, randomize: false,
            })
          )
        ).then(results => {
          if (!isCurrent()) return;
          const externalProducts = results.flatMap(r => r.products);
          const externalStrict = filterByRelevanceStrict(externalProducts, intent, userSignals);
          appendCycle("external-fresh", externalStrict);
        }).catch(err => {
          console.error("External search error:", err);
        }).finally(() => {
          // CYCLE 3 fallback expansion if still under the minimum visible target
          if (!isCurrent()) return;
          if (session.totalAdded >= MIN_RESULT_TARGET) {
            stopSession(`minimum target ${MIN_RESULT_TARGET} reached`);
            return;
          }
          hybridProductSearch({
            query: q, limit: 24,
            excludeIds: Array.from(sessionSeenIds),
            freshSearch: true, expandExternal: true, randomize: true,
          }).then(({ products: wide }) => {
            if (!isCurrent()) return;
            const wideRelevant = filterByRelevance(wide, intent, MIN_RESULT_TARGET, userSignals);
            appendCycle("fallback-broaden", wideRelevant);
            stopSession("fallback-broaden complete");
          }).catch(() => stopSession("fallback-broaden failed"));
        });
      }
    }, 0);
  };



  const handleFeedback = useCallback(async (itemId: string, type: "like" | "dislike") => {
    setFeedbackMap(prev => {
      const current = prev[itemId];
      if (current === type) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: type };
    });
    if (user) {
      await supabase.from("interactions").insert({
        user_id: user.id,
        target_id: itemId,
        target_type: "product",
        event_type: type,
        metadata: { source: "discover_feed", tab: activeTab },
      });
    }
  }, [user, activeTab]);

  const handleSave = useCallback(async (itemId: string) => {
    if (!user) { setShowAuthHint(true); return; }
    if (savedIds.has(itemId)) {
      setSavedIds(prev => { const n = new Set(prev); n.delete(itemId); return n; });
      await supabase.from("saved_items").delete().eq("user_id", user.id).eq("product_id", itemId);
    } else {
      setSavedIds(prev => new Set(prev).add(itemId));
      await supabase.from("saved_items").insert({ user_id: user.id, product_id: itemId });
    }
  }, [user, savedIds]);

  const generateNewStyleRecs = async () => {
    if (loadingNewStyle) return;
    setLoadingNewStyle(true);
    try {
      const styleContext = userStyleProfile
        ? `User prefers: ${userStyleProfile.preferred_styles?.join(", ") || "various"}. Fit: ${userStyleProfile.preferred_fit || "regular"}. Budget: ${userStyleProfile.budget || "mid-range"}. Suggest something NEW and outside their comfort zone but still tasteful. Use brands they have NOT seen before.`
        : "Suggest trendy, fresh fashion items the user hasn't explored yet. Use diverse, unexpected brands.";

      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          action: "recommend",
          prompt: `${styleContext} Show unique, unexpected styles that expand their wardrobe. CRITICAL: use completely different brands from mainstream defaults.`,
          userId: user?.id || null,
          source: "discover-new-style",
          count: 4,
          isSearch: true,
        },
      });
      if (error) throw error;
      const recs = (data?.recommendations || []).filter(
        (r: AIRecommendation) => r.image_url && r.image_url.startsWith("http")
      );
      setNewStyleRecs(recs);
    } catch (e) {
      console.error("New style recs error:", e);
    } finally {
      setLoadingNewStyle(false);
    }
  };

  const toggleStyle = (s: string) => setSelectedStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const hasActiveFilters = selectedStyles.length > 0 || selectedFit !== null || selectedColor !== null;

  const clearFilters = () => {
    setSelectedStyles([]);
    setSelectedFit(null);
    setSelectedColor(null);
  };

  // Group and order recommendations by fashion category
  const categorizedRecs = useMemo(() => {
    const groups: Record<FashionCategory, AIRecommendation[]> = {
      OUTERWEAR: [], TOPS: [], BOTTOMS: [], SHOES: [], BAGS: [], ACCESSORIES: [],
    };

    for (const item of recommendations) {
      const cat = classifyProduct(item);
      if (cat) groups[cat].push(item);
    }

    // Return only non-empty categories in order
    return CATEGORY_ORDER
      .filter(cat => groups[cat].length > 0)
      .map(cat => ({ category: cat, items: groups[cat] }));
  }, [recommendations]);

  // Generate outfit combinations from categorized products
  const outfitCombinations = useMemo(() => {
    const groups: Record<FashionCategory, AIRecommendation[]> = {
      OUTERWEAR: [], TOPS: [], BOTTOMS: [], SHOES: [], BAGS: [], ACCESSORIES: [],
    };
    for (const item of recommendations) {
      const cat = classifyProduct(item);
      if (cat) groups[cat].push(item);
    }

    const liked = new Set(
      Object.entries(feedbackMap).filter(([, v]) => v === "like").map(([k]) => k)
    );
    const disliked = new Set(
      Object.entries(feedbackMap).filter(([, v]) => v === "dislike").map(([k]) => k)
    );

    return generateOutfits(groups, 4, liked, disliked);
  }, [recommendations, feedbackMap]);

  const interactionCount = Object.keys(feedbackMap).length;

  return (
    <>
      <AnimatePresence>
        {showQuiz && <StyleQuiz onComplete={handleQuizComplete} onClose={() => setShowQuiz(false)} />}
      </AnimatePresence>

      <div className="min-h-screen bg-background pb-28 md:pb-28 lg:pb-16 lg:pt-24">
        {/* Header */}
        <div className="mx-auto max-w-lg px-6 pt-10 pb-2 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[12px] font-semibold tracking-[0.35em] text-foreground/70 lg:hidden">WARDROBE</span>
            <span className="text-[10px] font-semibold tracking-[0.25em] text-foreground/70">{t("discover").toUpperCase()}</span>
          </div>
        </div>

        <div className="mx-auto max-w-lg px-6 pt-6 md:max-w-2xl md:px-10 lg:max-w-4xl lg:px-12">
          {/* Preference Banner */}
          {profileLoaded && needsPreferences && (
            <div className="mb-6">
              <PreferenceBanner onOpenQuiz={() => setShowQuiz(true)} />
            </div>
          )}
          {/* Search with suggestions */}
          <div className="relative">
            <div className="flex items-center gap-3 pb-4">
              <Search className="h-4 w-4 text-foreground/75 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={textInput}
                onChange={e => { setTextInput(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={e => e.key === "Enter" && handleTextSubmit()}
                placeholder={t("describeStyle")}
                className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-foreground/75"
              />
              {textInput.trim() && (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setTextInput(""); setShowSuggestions(false); setActiveScenario(null); }} className="text-foreground/70 hover:text-foreground/75">
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleTextSubmit()} className="hover-burgundy text-[10px] font-semibold tracking-[0.15em] text-accent/70">GO</button>
                </div>
              )}
            </div>

            {/* Search suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full z-30 rounded-xl border border-border/20 bg-card/95 backdrop-blur-xl shadow-elevated overflow-hidden"
                >
                  {searchSuggestionResults.length > 0 ? (
                    <div className="py-2">
                      <p className="px-4 py-1.5 text-[11px] font-semibold tracking-[0.2em] text-foreground/70">{t("suggestions").toUpperCase()}</p>
                      {searchSuggestionResults.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => handleTextSubmit(suggestion)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-foreground/75 transition-colors hover:bg-foreground/[0.04] hover:text-foreground/80"
                        >
                          <Search className="h-3 w-3 text-foreground/70 shrink-0" />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-2">
                      <p className="px-4 py-1.5 text-[11px] font-semibold tracking-[0.2em] text-foreground/70">{t("trending").toUpperCase()}</p>
                      {TRENDING_SEARCHES.map((term, i) => (
                        <button
                          key={i}
                          onClick={() => handleTextSubmit(term)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-foreground/70 transition-colors hover:bg-foreground/[0.04] hover:text-foreground/70"
                        >
                          <Sparkles className="h-3 w-3 text-accent/60 shrink-0" />
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Click-away for suggestions */}
          {showSuggestions && (
            <div className="fixed inset-0 z-20" onClick={() => setShowSuggestions(false)} />
          )}

          <div className="h-px bg-border/30" />

          {/* Category Tabs */}
          <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {browseTabs.map(tab => (
              <button
                key={tab.slug}
                onClick={() => { setActiveTab(tab.slug); setActiveSubcategory(null); }}
                className={`hover-burgundy shrink-0 rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.05em] transition-all ${
                  activeTab === tab.slug
                    ? "bg-accent/15 text-foreground"
                    : "text-foreground/75"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Subcategory tabs */}
          <AnimatePresence>
            {subcategories.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-2 scrollbar-hide">
                  <button
                    onClick={() => setActiveSubcategory(null)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                      !activeSubcategory ? "bg-foreground/[0.08] text-foreground/70" : "text-foreground/70 hover:text-foreground/70"
                    }`}
                  >
                    All
                  </button>
                  {subcategories.map(sub => (
                    <button
                      key={sub.slug}
                      onClick={() => setActiveSubcategory(sub.slug)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                        activeSubcategory === sub.slug ? "bg-foreground/[0.08] text-foreground/70" : "text-foreground/70 hover:text-foreground/70"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Actions */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setShowQuiz(true)}
              className="hover-burgundy flex items-center gap-2 rounded-full border border-border/30 px-4 py-2 text-[11px] font-semibold text-foreground/65"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent/70" />
              {quizAnswers ? t("refine") : t("takeStyleQuiz")}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`hover-burgundy flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold transition-all ${
                showFilters || hasActiveFilters ? "border-accent/30 text-foreground/75" : "border-border/30 text-foreground/65"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {t("filters")}
              {hasActiveFilters && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                  {selectedStyles.length + (selectedFit ? 1 : 0) + (selectedColor ? 1 : 0)}
                </span>
              )}
            </button>
            {(quizAnswers || hasActiveFilters) && (
              <button
                onClick={() => { setQuizAnswers(null); clearFilters(); setRecommendations([]); setHasGenerated(false); setTextInput(""); }}
                className="hover-burgundy text-[10px] tracking-[0.15em] text-foreground/70"
              >
                {t("reset").toUpperCase()}
              </button>
            )}
            {user && userStyleProfile && (
              <button
                onClick={() => {
                  setPreferenceMode(!preferenceMode);
                  if (!preferenceMode && userStyleProfile) {
                    const styles = userStyleProfile.preferred_styles || [];
                    setSelectedStyles(styles.filter((s: string) => STYLE_FILTERS.includes(s)));
                    if (userStyleProfile.preferred_fit) setSelectedFit(userStyleProfile.preferred_fit);
                    const prompt = `Items matching my style: ${styles.join(", ")}. Fit: ${userStyleProfile.preferred_fit || "regular"}`;
                    generateRecommendations(prompt);
                  } else {
                    clearFilters();
                  }
                }}
                className={`hover-burgundy flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-semibold transition-all ${
                  preferenceMode ? "border-accent/30 bg-accent/[0.06] text-accent/70" : "border-border/30 text-foreground/75"
                }`}
              >
                <Heart className="h-3 w-3" />
                {t("myPreferences")}
              </button>
            )}
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-4 rounded-xl border border-border/20 bg-card/30 p-4">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-foreground/75 mb-2">{t("style").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {STYLE_FILTERS.map(s => (
                        <button
                          key={s}
                          onClick={() => toggleStyle(s)}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedStyles.includes(s)
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/75 hover:text-foreground/70"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-foreground/75 mb-2">{t("preferredFit").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {FIT_FILTERS.map(f => (
                        <button
                          key={f}
                          onClick={() => setSelectedFit(selectedFit === f ? null : f)}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedFit === f
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/75 hover:text-foreground/70"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-foreground/75 mb-2">{t("color").toUpperCase()}</p>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_FILTERS.map(c => (
                        <button
                          key={c}
                          onClick={() => setSelectedColor(selectedColor === c ? null : c)}
                          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
                            selectedColor === c
                              ? "bg-accent/15 text-foreground/80"
                              : "bg-foreground/[0.03] text-foreground/75 hover:text-foreground/70"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/20 pt-3">
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-[10px] text-foreground/70 hover:text-foreground/70">
                        {t("clearAll")}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const prompt = textInput.trim() || `Recommend ${activeTab === "for-you" ? "fashion" : activeTab} items`;
                        generateRecommendations(prompt, undefined, activeTab !== "for-you" ? activeTab : undefined);
                      }}
                      className="hover-burgundy ml-auto py-2.5 text-[10px] font-semibold tracking-[0.15em] text-accent/60"
                    >
                      {t("applyFilters").toUpperCase()}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Area */}
          <div className="mt-8">
            {isGenerating && recommendations.length === 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-[3/4] rounded-xl bg-foreground/[0.04]" />
                      <div className="mt-2.5 space-y-1.5 px-0.5">
                        <div className="h-2.5 w-16 rounded bg-foreground/[0.04]" />
                        <div className="h-3 w-24 rounded bg-foreground/[0.04]" />
                        <div className="h-2.5 w-12 rounded bg-foreground/[0.04]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (hasGenerated || isGenerating) && recommendations.length > 0 ? (
              <div className="space-y-12">
                {/* Scenario context banner */}
                {activeScenario && (
                  <div className="rounded-xl border border-accent/15 bg-accent/[0.04] p-4">
                    <p className="text-[11px] font-semibold tracking-[0.15em] text-accent/70 mb-2">
                      {activeScenario.label.toUpperCase()} OUTFIT
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeScenario.items.map((item, i) => (
                        <span key={i} className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-[10px] text-foreground/60">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search interpretation label (Step 3) — shown for non-scenario searches */}
                {!activeScenario && searchExplanation && (
                  <p className="text-[11px] tracking-[0.05em] text-foreground/55 italic">
                    {searchExplanation}
                  </p>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    DISCOVER PAGE — 3 FIXED LAYERS (HARDCODED ORDER)
                    1. TOP DB PRODUCT GRID  ("For You" — instant DB picks)
                    2. STYLED LOOKS GRID    (curated editorial combinations)
                    3. LIVE SEARCH SECTION  (real, growing external results)
                    The order MUST stay 1 → 2 → 3 regardless of data state.
                    ═══════════════════════════════════════════════════════════ */}

                {/* ── LAYER 1: TOP DB PRODUCT GRID — "For You" ──
                   Hardcoded grid frame; only the products inside change.
                   Renders immediately from DB so the page is never empty. */}
                {dbRecommendations.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-baseline justify-between">
                      <p className="text-[10px] font-semibold tracking-[0.25em] text-accent/70">
                        FOR YOU
                      </p>
                      <span className="text-[9px] tracking-[0.1em] text-foreground/45">
                        Curated picks
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                      {dbRecommendations.map((item, i) => (
                        <RecommendationCard
                          key={`db-rec-${item.id}`}
                          item={item}
                          index={i}
                          feedback={feedbackMap[item.id]}
                          isSaved={savedIds.has(item.id)}
                          onFeedback={handleFeedback}
                          onSave={handleSave}
                          onOpenDetail={setDetailProduct}
                        />
                      ))}
                    </div>
                    <div className="h-px bg-border/30" />
                  </div>
                )}

                {/* ── LAYER 2: STYLED LOOKS — editorial, hardcoded frame ──
                   Always mounted while we have any data or are still
                   generating. Skeletons fill empty slots so the layout
                   never collapses or rebuilds. */}
                {(outfitCombinations.length > 0 || isGenerating) && (
                  <div className="space-y-4">
                    <div className="flex items-baseline justify-between">
                      <p className="text-[10px] font-semibold tracking-[0.2em] text-accent/60 uppercase">
                        Styled Looks
                      </p>
                      <span className="text-[9px] tracking-[0.1em] text-foreground/45">
                        Curated combinations
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {outfitCombinations.map((outfit, i) => (
                        <OutfitLookCard key={outfit.id} outfit={outfit} index={i} />
                      ))}
                      {isGenerating &&
                        Array.from({
                          length: Math.max(0, 4 - outfitCombinations.length),
                        }).map((_, i) => (
                          <StyledLookSkeleton key={`styled-skel-${i}`} />
                        ))}
                    </div>
                    <div className="h-px bg-border/30" />
                  </div>
                )}

                {/* ── LAYER 3: LIVE SEARCH / INGESTION ──
                   Header + status line make it obvious that the system is
                   still searching across more stores. Newly fetched
                   products are appended below; the frame never resets. */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.25em] text-foreground/75">
                      {activeScenario
                        ? activeScenario.label.toUpperCase()
                        : lastPromptRef.current
                          ? `RESULTS FOR "${lastPromptRef.current.toUpperCase()}"`
                          : activeTab === "for-you"
                            ? t("curatedForYou").toUpperCase()
                            : activeTab.toUpperCase()}
                    </p>
                    {interactionCount > 2 && !activeScenario && (
                      <p className="text-[10px] text-foreground/75 mt-1">{t("adaptingTaste")}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-foreground/70">{recommendations.length} {t("items")}</span>
                    {(isGenerating || isLoadingMore) && (
                      <Loader2 className="h-3 w-3 animate-spin text-accent/50" />
                    )}
                  </div>
                </div>

                {/* Live status line — always present, message swaps with state. */}
                <div
                  className="flex items-center gap-2 rounded-lg border border-accent/10 bg-accent/[0.03] px-3 py-2 text-[10px] tracking-[0.12em] text-accent/70"
                  aria-live="polite"
                >
                  {isGenerating || isLoadingMore ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>SEARCHING ACROSS MORE STORES…</span>
                    </>
                  ) : recommendations.length > 0 ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-accent/50" />
                      <span>SHOWING {recommendations.length} VERIFIED RESULTS</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>LOADING MORE PRODUCTS…</span>
                    </>
                  )}
                </div>

                {categorizedRecs.length > 0 ? (
                  categorizedRecs.map(({ category, items }) => (
                    <div key={category} className="space-y-4">
                      <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/65 uppercase">
                        {category}
                      </p>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                        {items.map((item, i) => (
                          <RecommendationCard
                            key={item.id}
                            item={item}
                            index={i}
                            feedback={feedbackMap[item.id]}
                            isSaved={savedIds.has(item.id)}
                            onFeedback={handleFeedback}
                            onSave={handleSave}
                            onOpenDetail={setDetailProduct}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                    {recommendations.map((item, i) => (
                      <RecommendationCard
                        key={item.id}
                        item={item}
                        index={i}
                        feedback={feedbackMap[item.id]}
                        isSaved={savedIds.has(item.id)}
                        onFeedback={handleFeedback}
                        onSave={handleSave}
                        onOpenDetail={setDetailProduct}
                      />
                    ))}
                  </div>
                )}

                {/* Auto load-more sentinel + manual button */}
                <div ref={loadMoreSentinelRef} className="h-1" />
                {isLoadingMore && (
                  <div className="flex justify-center pt-4 pb-8">
                    <Loader2 className="h-4 w-4 animate-spin text-accent/50" />
                  </div>
                )}

                {/* AI Recommendation: New Style */}
                {user && (
                  <div className="space-y-5 border-t border-border/15 pt-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wand2 className="h-3.5 w-3.5 text-accent/70" />
                        <p className="text-[10px] font-semibold tracking-[0.25em] text-accent/60">
                          {t("newStyleYouMightLike").toUpperCase()}
                        </p>
                      </div>
                      <button
                        onClick={generateNewStyleRecs}
                        disabled={loadingNewStyle}
                        className="hover-burgundy flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/[0.04] px-4 py-2 text-[11px] font-semibold tracking-[0.15em] text-accent/60 transition-all hover:bg-accent/[0.08] disabled:opacity-40"
                      >
                        {loadingNewStyle ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {t("tryNewStyle").toUpperCase()}
                      </button>
                    </div>

                    {newStyleRecs.length > 0 && (
                       <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
                        {newStyleRecs.map((item, i) => (
                          <RecommendationCard
                            key={item.id}
                            item={item}
                            index={i}
                            feedback={feedbackMap[item.id]}
                            isSaved={savedIds.has(item.id)}
                            onFeedback={handleFeedback}
                            onSave={handleSave}
                            onOpenDetail={setDetailProduct}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : hasGenerated ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Sparkles className="h-6 w-6 text-accent/25 mb-4" />
                <p className="text-[12px] font-medium text-foreground/75">Looking for fresh picks…</p>
                <p className="text-[10px] text-foreground/50 mt-1 max-w-[260px]">
                  Our shops are restocking. Try a broader keyword or browse trending picks while we refresh inventory.
                </p>
                <button
                  onClick={() => {
                    sessionSeenIds.clear();
                    setRecommendations([]);
                    setHasGenerated(false);
                    setTextInput("");
                  }}
                  className="mt-4 text-[10px] font-semibold tracking-wider text-accent/70 hover:text-accent transition-colors"
                >
                  RESET & BROWSE
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Sparkles className="h-8 w-8 text-accent/15 mb-4" />
                <p className="text-[12px] text-foreground/70">{t("describeStyle")}</p>
                <p className="text-[10px] text-foreground/70 mt-1">Search or browse to discover items</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAuthHint && (
        <AuthGate action="save items">
          <div />
        </AuthGate>
      )}

      <ProductDetailSheet
        product={detailProduct}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        isSaved={detailProduct ? savedIds.has(detailProduct.id) : false}
        onSave={handleSave}
      />
    </>
  );
};

// ─── Product Card Component ───
//
// IMPORTANT — perf:
//   - Wrapped in React.memo with a custom comparator that ignores Map/Set
//     identity (parent recreates these on every keystroke). We only re-render
//     when this card's own `feedback`/`isSaved`/`item` actually changes.
//   - Image slot is a fixed aspect-[3/4] container with a blurred placeholder
//     so cards never resize while images stream in (no layout shift).
//   - Above-the-fold: first 4 eager + high priority. Rest: lazy + low.

interface RecommendationCardProps {
  item: AIRecommendation;
  index: number;
  feedback: "like" | "dislike" | undefined;
  isSaved: boolean;
  onFeedback: (id: string, type: "like" | "dislike") => void;
  onSave: (id: string) => void;
  onOpenDetail: (item: AIRecommendation) => void;
}

const RecommendationCardImpl = forwardRef<HTMLDivElement, RecommendationCardProps>(
  ({ item, index, feedback, isSaved, onFeedback, onSave, onOpenDetail }, ref) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!item.image_url || !item.image_url.startsWith("http") || imgFailed) return null;

  const isAboveFold = index < 4;

  return (
    <div ref={ref} className="group cursor-pointer" onClick={() => onOpenDetail(item)}>
      {/* Fixed slot — placeholder always visible until <img> reports load. */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-foreground/[0.04]">
        {!imgLoaded && (
          <div
            className="absolute inset-0 animate-pulse bg-gradient-to-br from-foreground/[0.05] to-foreground/[0.02]"
            aria-hidden
          />
        )}
        <img
          src={item.image_url}
          alt={item.name}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading={isAboveFold ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={isAboveFold ? "high" : "low"}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 transition-all group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onFeedback(item.id, "like"); }}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              feedback === "like" ? "bg-accent/30 text-accent" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <Heart className="h-3 w-3" fill={feedback === "like" ? "currentColor" : "none"} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFeedback(item.id, "dislike"); }}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              feedback === "dislike" ? "bg-red-500/30 text-red-400" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <HeartOff className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSave(item.id); }}
            className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition-colors ${
              isSaved ? "bg-accent/30 text-accent" : "bg-black/30 text-white/70 hover:text-white"
            }`}
          >
            <Bookmark className="h-3 w-3" fill={isSaved ? "currentColor" : "none"} />
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            <ShareButton
              title={`${item.name} by ${item.brand}`}
              url={item.source_url || window.location.href}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/70 backdrop-blur-md hover:text-white"
            />
          </div>
        </div>
        {item.platform && PLATFORM_LABELS[item.platform] && (
          <div className={`absolute top-2 left-2 rounded-full ${PLATFORM_LABELS[item.platform].color} px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm tracking-wide`}>
            {PLATFORM_LABELS[item.platform].label}
          </div>
        )}
        {item.source_url && (
          <div
            onClick={(e) => { e.stopPropagation(); window.open(item.source_url!, "_blank", "noopener,noreferrer"); }}
            className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60 cursor-pointer"
          >
            SHOP →
          </div>
        )}
      </div>
      <div className="mt-2.5 space-y-0.5 px-0.5">
        <p className="text-[11px] font-medium tracking-[0.1em] text-foreground">{item.brand}</p>
        <p className="text-[12px] font-medium text-foreground/90 leading-tight line-clamp-2">{item.name}</p>
        <p className="text-[11px] font-semibold text-foreground">{item.price}</p>
        {item.store_name && (
          <p className="text-[10px] text-foreground/60">{item.store_name}</p>
        )}
      </div>
    </div>
  );
});
RecommendationCardImpl.displayName = "RecommendationCardImpl";

// Memoized wrapper — bails when only unrelated parent state changed.
// Only re-renders when this card's own props actually differ.
const RecommendationCard = React.memo(RecommendationCardImpl, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.item.image_url === next.item.image_url &&
    prev.feedback === next.feedback &&
    prev.isSaved === next.isSaved &&
    prev.onFeedback === next.onFeedback &&
    prev.onSave === next.onSave &&
    prev.onOpenDetail === next.onOpenDetail &&
    prev.index === next.index
  );
});

export default DiscoverPage;
