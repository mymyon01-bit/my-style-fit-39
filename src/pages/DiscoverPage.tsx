import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Sparkles, Heart, HeartOff, Bookmark, SlidersHorizontal, ChevronDown, X, Wand2 } from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import ProductDetailSheet from "@/components/ProductDetailSheet";
import PreferenceBanner from "@/components/PreferenceBanner";

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
const CATEGORY_ORDER = ["TOPS", "BOTTOMS", "SHOES", "BAGS", "ACCESSORIES"] as const;
type FashionCategory = typeof CATEGORY_ORDER[number];

const CATEGORY_KEYWORDS: Record<FashionCategory, RegExp> = {
  TOPS: /\b(shirt|t-shirt|tee|hoodie|hoody|jacket|coat|blazer|sweater|cardigan|vest|polo|pullover|sweatshirt|bomber|parka|windbreaker|blouse|tunic|camisole|tank|henley|oxford|flannel|knit|top|jumper|cape|poncho|gilet|anorak|overcoat|trench)\b/i,
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

// ── Query Intent Parser: extract structured intent from user query ──
interface QueryIntent {
  rawQuery: string;
  categoryLock: FashionCategory | null;
  styleIntent: string[];
  colorIntent: string[];
  brandIntent: string[];
  keywords: string[]; // remaining meaningful terms
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

  // 5. Remaining keywords (strip detected colors/brands/styles)
  const consumed = new Set<string>();
  [...colorIntent, ...brandIntent].forEach(w => w.split(/\s+/).forEach(p => consumed.add(p)));
  Object.values(STYLE_KEYWORD_MAP).flat().forEach(k => { if (lower.includes(k)) k.split(/\s+/).forEach(p => consumed.add(p)); });
  // Also consume category keywords already matched
  const keywords = words.filter(w => !consumed.has(w) && w.length > 2);

  return { rawQuery: query, categoryLock, styleIntent, colorIntent, brandIntent, keywords };
}

// ── Strict relevance scorer based on parsed intent ──
const RELEVANCE_THRESHOLD = 25; // Items scoring below this are discarded

function scoreRelevance(item: AIRecommendation, intent: QueryIntent): number {
  const itemName = (item.name || "").toLowerCase();
  const itemBrand = (item.brand || "").toLowerCase();
  const itemText = `${itemName} ${itemBrand} ${item.category || ""} ${(item.style_tags || []).join(" ")} ${item.color || ""} ${item.fit || ""}`.toLowerCase();
  const itemCategory = classifyProduct(item);

  let score = 0;

  // 0.40 — Category match (HARD requirement when intent has category)
  if (intent.categoryLock) {
    if (itemCategory === intent.categoryLock) {
      score += 40;
    } else {
      // Category mismatch when user specified a category = near-zero relevance
      return 5;
    }
  } else {
    score += 20; // No category lock → neutral baseline
  }

  // 0.25 — Style match
  if (intent.styleIntent.length > 0) {
    const itemStyles = item.style_tags || [];
    const matched = intent.styleIntent.filter(s => itemStyles.includes(s)).length;
    const styleKeywordMatch = intent.styleIntent.some(s =>
      STYLE_KEYWORD_MAP[s]?.some(k => itemName.includes(k))
    );
    if (matched > 0) score += Math.min(25, 12 + matched * 8);
    else if (styleKeywordMatch) score += 15;
    else score += 3;
  } else {
    score += 12; // No style intent → neutral
  }

  // 0.20 — Color match
  if (intent.colorIntent.length > 0) {
    const colorMatch = intent.colorIntent.some(c => 
      itemName.includes(c) || (item.color || "").toLowerCase().includes(c) || itemText.includes(c)
    );
    score += colorMatch ? 20 : 2;
  } else {
    score += 10; // No color intent → neutral
  }

  // 0.10 — Brand match
  if (intent.brandIntent.length > 0) {
    const brandMatch = intent.brandIntent.some(b => itemBrand.includes(b));
    score += brandMatch ? 10 : 0;
  } else {
    score += 5; // No brand intent → neutral
  }

  // 0.05 — Keyword match (remaining terms)
  if (intent.keywords.length > 0) {
    const keywordHits = intent.keywords.filter(k => itemText.includes(k)).length;
    score += Math.min(5, (keywordHits / intent.keywords.length) * 5);
  }

  return Math.round(score);
}

// ── Apply strict relevance filter + sort ──
function filterByRelevance(items: AIRecommendation[], intent: QueryIntent): AIRecommendation[] {
  const scored = items.map(item => ({
    item,
    relevance: scoreRelevance(item, intent),
  }));

  // Hard filter: discard items below threshold
  const passing = scored.filter(s => s.relevance >= RELEVANCE_THRESHOLD);

  // Sort by relevance descending
  passing.sort((a, b) => b.relevance - a.relevance);

  return passing.map(s => s.item);
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

// ─── Hybrid product search: DB-first + external expansion ───
async function hybridProductSearch(opts: {
  query?: string;
  category?: string;
  styles?: string[];
  fit?: string;
  limit?: number;
  excludeIds?: string[];
  expandExternal?: boolean;
  randomize?: boolean;
}): Promise<{ products: AIRecommendation[]; expanded: boolean; dbCount: number }> {
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

// Session-level seen products tracking
const sessionSeenIds = new Set<string>();

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
  const lastPromptRef = useRef("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  // Product detail sheet
  const [detailProduct, setDetailProduct] = useState<AIRecommendation | null>(null);
  
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


  // ── INSTANT INITIAL LOAD: DB-first small batch, then background expansion ──
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const loadInitial = async () => {
      setIsGenerating(true);
      setHasGenerated(true);

      const TARGET_COUNT = 18;

      // Use style profile for personalized initial load
      const styleQuery = userStyleProfile
        ? buildStyleSearchQueries(userStyleProfile)[0]
        : undefined;

      // Step 1: Fast DB load — large initial batch with style-aware query
      const { products: dbProducts, dbCount } = await hybridProductSearch({
        query: styleQuery,
        styles: userStyleProfile?.preferred_styles?.length ? userStyleProfile.preferred_styles.slice(0, 3) : undefined,
        fit: userStyleProfile?.preferred_fit || undefined,
        limit: TARGET_COUNT,
        randomize: !styleQuery,
      });

      if (dbProducts.length > 0) {
        // Score results if we have a style profile
        let scoredProducts = dbProducts;
        if (userStyleProfile) {
          scoredProducts = dbProducts
            .map(p => ({ ...p, _freeScore: freeScoreProduct(p, styleQuery || "", userStyleProfile, feedbackMap) }))
            .sort((a, b) => (b as any)._freeScore - (a as any)._freeScore);
        }

        const diverse = enforceClientDiversity(scoredProducts, sessionSeenIds);
        diverse.forEach(p => sessionSeenIds.add(p.id));
        setRecommendations(diverse);
        setDbOffset(diverse.length);
        setHasMoreInDB(dbCount >= TARGET_COUNT);
        setIsGenerating(false);

        // Step 2: Background expansion to grow inventory
        if (diverse.length < TARGET_COUNT) {
          requestIdleCallback(() => {
            const styleQueries = userStyleProfile
              ? buildStyleSearchQueries(userStyleProfile)
              : ["trending fashion new arrivals"];
            
            hybridProductSearch({
              query: styleQueries[0],
              expandExternal: true,
              limit: TARGET_COUNT - diverse.length,
              excludeIds: Array.from(sessionSeenIds),
            }).then(({ products: freshProducts }) => {
              if (freshProducts.length > 0) {
                const freshDiverse = enforceClientDiversity(freshProducts, sessionSeenIds);
                freshDiverse.forEach(p => sessionSeenIds.add(p.id));
                setRecommendations(prev => enforceClientDiversity([...prev, ...freshDiverse], new Set()));
              }
            });
          });
        }

        // Step 3: Background seeding — trigger category-diverse queries to grow DB
        requestIdleCallback(() => {
          const seedQueries = [
            "minimal clean outerwear jacket",
            "casual streetwear sneakers",
            "classic leather bag tote",
            "trendy accessories hat watch",
          ];
          const randomSeed = seedQueries[Math.floor(Math.random() * seedQueries.length)];
          hybridProductSearch({ query: randomSeed, expandExternal: true, limit: 8 }).catch(() => {});
        });
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
    setRecommendations([]);
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

  // ── Query expansion: convert vague/lifestyle queries into concrete product searches ──
  function expandSearchQuery(q: string): string[] {
    const lower = q.toLowerCase().trim();
    const expanded: string[] = [];

    // Occasion / lifestyle expansions — map intent to actual fashion items
    const OCCASION_EXPANSIONS: Record<string, string[]> = {
      "summer vacation": ["linen shirt", "shorts", "sandals", "sunglasses", "straw hat", "lightweight dress"],
      "summer": ["linen shirt", "shorts", "sandals", "tank top", "lightweight dress", "sunglasses"],
      "vacation": ["linen shirt", "resort wear", "sandals", "sunglasses", "lightweight shorts", "summer dress"],
      "beach": ["swim shorts", "sandals", "linen shirt", "sunglasses", "straw hat", "tank top"],
      "travel": ["comfortable sneakers", "versatile jacket", "crossbody bag", "casual pants", "lightweight shirt"],
      "winter": ["wool coat", "knit sweater", "boots", "scarf", "gloves", "parka"],
      "spring": ["light jacket", "sneakers", "cotton shirt", "chinos", "windbreaker"],
      "fall": ["leather jacket", "boots", "sweater", "scarf", "corduroy pants"],
      "autumn": ["leather jacket", "boots", "sweater", "scarf", "corduroy pants"],
      "rain": ["rain jacket", "waterproof boots", "umbrella", "trench coat"],
      "wedding": ["suit", "dress shoes", "tie", "formal dress", "clutch bag"],
      "date": ["blazer", "slim pants", "clean sneakers", "dress shirt", "elegant dress"],
      "date night": ["blazer", "slim pants", "dress shoes", "elegant dress", "clutch bag"],
      "office": ["blazer", "dress shirt", "trousers", "loafers", "leather bag"],
      "work": ["blazer", "dress shirt", "trousers", "loafers", "leather bag"],
      "gym": ["athletic shorts", "running shoes", "sports tee", "hoodie", "joggers"],
      "workout": ["athletic shorts", "running shoes", "sports tee", "tank top", "leggings"],
      "party": ["statement jacket", "boots", "edgy top", "slim jeans", "accessories"],
      "festival": ["graphic tee", "shorts", "sneakers", "sunglasses", "bucket hat"],
      "casual": ["t-shirt", "jeans", "sneakers", "hoodie", "casual jacket"],
      "formal": ["suit", "dress shirt", "dress shoes", "tie", "formal dress"],
      "streetwear": ["oversized hoodie", "cargo pants", "sneakers", "cap", "crossbody bag"],
      "hiking": ["hiking boots", "outdoor jacket", "cargo pants", "backpack"],
      "camping": ["fleece jacket", "hiking boots", "cargo shorts", "backpack"],
      "school": ["backpack", "sneakers", "hoodie", "jeans", "casual tee"],
      "airport": ["comfortable sneakers", "joggers", "oversized hoodie", "crossbody bag", "sunglasses"],
    };

    // Emotion / vague word expansion
    const VAGUE_EXPANSIONS: Record<string, string[]> = {
      modern: ["modern slim jacket", "modern minimalist sneakers", "modern structured trousers"],
      clean: ["clean minimal shirt", "clean white sneakers", "clean structured blazer"],
      cozy: ["cozy oversized sweater", "cozy knit cardigan", "cozy fleece hoodie"],
      bold: ["bold statement jacket", "bold graphic tee", "bold colored sneakers"],
      moody: ["dark tonal jacket", "moody leather boots", "dark layered outfit"],
      fresh: ["fresh casual sneakers", "fresh linen shirt", "fresh summer shorts"],
      confident: ["tailored blazer", "sharp dress shoes", "structured coat"],
      elegant: ["elegant silk blouse", "classic leather bag", "tailored wool trousers"],
      chill: ["relaxed fit jeans", "casual hoodie", "comfort sneakers"],
      soft: ["pastel knit sweater", "soft cotton tee", "light linen pants"],
      dark: ["black leather jacket", "dark denim jeans", "dark minimal boots"],
      lazy: ["oversized hoodie", "relaxed joggers", "slip-on sneakers"],
      sharp: ["tailored suit jacket", "slim fit shirt", "oxford shoes"],
      lowkey: ["minimal tee", "neutral toned pants", "clean low-top sneakers"],
      romantic: ["flowy blouse", "delicate jewelry", "vintage inspired dress"],
    };

    // First check multi-word occasion phrases (longest match first)
    const sortedOccasions = Object.keys(OCCASION_EXPANSIONS).sort((a, b) => b.length - a.length);
    let matched = false;
    for (const key of sortedOccasions) {
      if (lower.includes(key)) {
        expanded.push(...OCCASION_EXPANSIONS[key]);
        matched = true;
        break;
      }
    }

    // Then check vague emotion words
    if (!matched) {
      for (const [key, expansions] of Object.entries(VAGUE_EXPANSIONS)) {
        if (lower.includes(key)) {
          expanded.push(...expansions);
          matched = true;
          break;
        }
      }
    }

    // If query has a product category keyword, just return it directly
    const hasCategory = /\b(jacket|coat|shirt|hoodie|sweater|pants|jeans|shorts|sneakers?|boots?|shoes?|bag|hat|watch|dress|blazer|cardigan|vest|skirt|top|tee|sandals?|sunglasses)\b/i.test(lower);
    if (hasCategory && !matched) {
      // Query already contains a product term — use as-is
      return [q];
    }

    // If still nothing matched and no product category, add generic category variants
    if (!matched && !hasCategory) {
      expanded.push(`${q} outfit`, `${q} clothing`, `${q} shoes`);
    }

    return [...new Set(expanded)].slice(0, 6);
  }

  // Debounced search submit — strict relevance filtering pipeline
  const handleTextSubmit = (query?: string) => {
    const q = (query || textInput).trim();
    if (!q) return;
    setTextInput(q);
    setActiveTab("for-you");
    setActiveSubcategory(null);
    setShowSuggestions(false);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      setIsGenerating(true);
      setHasGenerated(true);
      setRecommendations([]);
      lastPromptRef.current = q;

      // Step 1: Parse query into structured intent
      const intent = parseQueryIntent(q);
      const isVagueQuery = !intent.categoryLock && intent.styleIntent.length === 0 && intent.colorIntent.length === 0 && intent.brandIntent.length === 0;

      // Step 2: Expand query — for vague/lifestyle queries, expansions ARE the search
      const expandedQueries = expandSearchQuery(q);
      const isLifestyleQuery = isVagueQuery && expandedQueries.length > 1 && expandedQueries[0] !== q;

      console.log("Search:", { query: q, intent, isVagueQuery, isLifestyleQuery, expandedQueries });

      // Step 3: Choose search strategy
      const categoryMap: Record<string, string> = {
        TOPS: "clothing", BOTTOMS: "clothing", SHOES: "shoes", BAGS: "bags", ACCESSORIES: "accessories",
      };
      const dbCategory = intent.categoryLock ? categoryMap[intent.categoryLock] : undefined;

      if (isLifestyleQuery) {
        // LIFESTYLE QUERY: search for each expanded item type separately
        const results = await Promise.all(
          expandedQueries.slice(0, 5).map(eq =>
            hybridProductSearch({
              query: eq,
              limit: 8,
              expandExternal: true,
              excludeIds: Array.from(sessionSeenIds),
              randomize: false,
            })
          )
        );

        const allProducts = results.flatMap(r => r.products);
        // For lifestyle queries, re-parse each product against the expanded terms
        const diverse = enforceClientDiversity(allProducts, new Set());
        if (diverse.length > 0) {
          diverse.forEach(p => sessionSeenIds.add(p.id));
          setRecommendations(diverse.slice(0, 24));
        } else {
          // Fallback to AI
          generateRecommendations(q);
        }
        setIsGenerating(false);
      } else {
        // SPECIFIC QUERY: DB-first with strict relevance filtering
        const { products: dbProducts, dbCount } = await hybridProductSearch({
          query: q,
          category: dbCategory,
          styles: intent.styleIntent.length > 0 ? intent.styleIntent : undefined,
          fit: selectedFit || undefined,
          limit: 30,
          expandExternal: false,
          randomize: false,
        });

        const relevantDb = filterByRelevance(dbProducts, intent);
        const diverseDb = enforceClientDiversity(relevantDb, new Set());

        if (diverseDb.length > 0) {
          diverseDb.forEach(p => sessionSeenIds.add(p.id));
          setRecommendations(diverseDb);
          setDbOffset(diverseDb.length);
          setHasMoreInDB(dbCount >= 30);
          setIsGenerating(false);
        }

        // ALWAYS run external search for fresh results
        const searchQueries = [...new Set([q, ...expandedQueries])].slice(0, 3);
        Promise.all(
          searchQueries.map(sq =>
            hybridProductSearch({
              query: sq,
              category: dbCategory,
              styles: intent.styleIntent.length > 0 ? intent.styleIntent : undefined,
              fit: selectedFit || undefined,
              limit: 12,
              excludeIds: Array.from(sessionSeenIds),
              expandExternal: true,
              randomize: false,
            })
          )
        ).then(results => {
          const allFresh = results.flatMap(r => r.products);
          const relevantFresh = filterByRelevance(allFresh, intent);
          const freshDiverse = enforceClientDiversity(relevantFresh, sessionSeenIds);

          if (freshDiverse.length > 0) {
            freshDiverse.forEach(p => sessionSeenIds.add(p.id));
            setRecommendations(prev => {
              const merged = enforceClientDiversity([...prev, ...freshDiverse], new Set()).slice(0, 30);
              return merged;
            });
          }

          if (diverseDb.length === 0 && freshDiverse.length === 0) {
            generateRecommendations(q);
          }
          setIsGenerating(false);
        }).catch(() => {
          setIsGenerating(false);
        });
      }
    }, 200);
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
      TOPS: [], BOTTOMS: [], SHOES: [], BAGS: [], ACCESSORIES: [],
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
      TOPS: [], BOTTOMS: [], SHOES: [], BAGS: [], ACCESSORIES: [],
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
                  <button onClick={() => { setTextInput(""); setShowSuggestions(false); }} className="text-foreground/70 hover:text-foreground/75">
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
            {isGenerating ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 lg:gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="aspect-[3/4] rounded-xl bg-foreground/[0.04]" />
                      <div className="mt-2.5 space-y-1.5 px-0.5">
                        <div className="h-2.5 w-16 rounded bg-foreground/[0.04]" />
                        <div className="h-3 w-24 rounded bg-foreground/[0.04]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : hasGenerated && recommendations.length > 0 ? (
              <div className="space-y-12">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.25em] text-accent/60">
                      {activeTab === "for-you" ? t("curatedForYou").toUpperCase() : activeTab.toUpperCase()}
                    </p>
                    {interactionCount > 2 && (
                      <p className="text-[10px] text-foreground/75 mt-1">{t("adaptingTaste")}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-foreground/70">{recommendations.length} {t("items")}</span>
                </div>

                {/* ── Styled Outfits ── */}
                {outfitCombinations.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-semibold tracking-[0.2em] text-accent/60 uppercase">
                      Styled Looks
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {outfitCombinations.map((outfit, i) => (
                        <OutfitLookCard key={outfit.id} outfit={outfit} index={i} />
                      ))}
                    </div>
                  </div>
                )}

                {categorizedRecs.length > 0 ? (
                  categorizedRecs.map(({ category, items }) => (
                    <div key={category} className="space-y-4">
                      <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/65 uppercase">
                        {category}
                      </p>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 lg:gap-4">
                        {items.map((item, i) => (
                          <RecommendationCard
                            key={item.id}
                            item={item}
                            index={i}
                            feedbackMap={feedbackMap}
                            savedIds={savedIds}
                            onFeedback={handleFeedback}
                            onSave={handleSave}
                            onOpenDetail={setDetailProduct}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 lg:gap-4">
                    {recommendations.map((item, i) => (
                      <RecommendationCard
                        key={item.id}
                        item={item}
                        index={i}
                        feedbackMap={feedbackMap}
                        savedIds={savedIds}
                        onFeedback={handleFeedback}
                        onSave={handleSave}
                        onOpenDetail={setDetailProduct}
                      />
                    ))}
                  </div>
                )}

                {/* Load More */}
                <div className="flex justify-center pt-4 pb-8">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="hover-burgundy flex items-center gap-2 rounded-lg border border-border/30 px-6 py-3 text-[11px] font-semibold tracking-[0.15em] text-foreground/65 transition-all hover:border-accent/30 hover:bg-accent/[0.04] disabled:opacity-40"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {isLoadingMore ? t("loading").toUpperCase() : t("loadMore").toUpperCase()}
                  </button>
                </div>

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
                       <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 lg:gap-4">
                        {newStyleRecs.map((item, i) => (
                          <RecommendationCard
                            key={item.id}
                            item={item}
                            index={i}
                            feedbackMap={feedbackMap}
                            savedIds={savedIds}
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
                <p className="text-[12px] font-medium text-foreground/75">No verified products found</p>
                <p className="text-[10px] text-foreground/50 mt-1 max-w-[240px]">
                  We only show real, verified items. Try a different search or check back soon as our inventory grows.
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

interface RecommendationCardProps {
  item: AIRecommendation;
  index: number;
  feedbackMap: Record<string, "like" | "dislike">;
  savedIds: Set<string>;
  onFeedback: (id: string, type: "like" | "dislike") => void;
  onSave: (id: string) => void;
  onOpenDetail: (item: AIRecommendation) => void;
}

const RecommendationCard = ({ item, index, feedbackMap, savedIds, onFeedback, onSave, onOpenDetail }: RecommendationCardProps) => {
  const feedback = feedbackMap[item.id];
  const isSaved = savedIds.has(item.id);
  const [imgFailed, setImgFailed] = useState(false);

  // If image is missing or failed to load, don't render the card at all
  if (!item.image_url || !item.image_url.startsWith("http") || imgFailed) return null;

  return (
    <div className="group cursor-pointer" onClick={() => onOpenDetail(item)}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-foreground/[0.03]">
        <img
          src={item.image_url}
          alt={item.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading={index < 6 ? "eager" : "lazy"}
          decoding="async"
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
};

export default DiscoverPage;
