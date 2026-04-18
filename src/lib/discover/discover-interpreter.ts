/**
 * Discover query interpreter — deterministic-first, AI-assisted.
 * --------------------------------------------------------------
 * Single entry point: `interpretQuery(raw)`.
 *
 *   1. Normalize input (lowercase, trim, drop punctuation; keep KR jamo).
 *   2. Run a strict deterministic parser on a KR/EN alias map.
 *   3. ONLY when category === "unknown" OR the query is clearly vague
 *      (slang, mood-only, no signal at all), fall back to the
 *      `discover-intent-expand` edge function (Lovable AI).
 *   4. Return a strict ParsedDiscoverQuery shape that downstream code
 *      (search runner, category guard) consumes.
 *
 * Hard rules baked in:
 *   - We NEVER return a category we can't justify.
 *   - We NEVER mix categories (no swimwear ↔ jacket bleeding).
 *   - AI is fallback only — every successful deterministic parse skips AI.
 */
import { supabase } from "@/integrations/supabase/client";

export type InterpretedCategory =
  | "swimwear"
  | "outerwear"
  | "tops"
  | "pants"
  | "shoes"
  | "bags"
  | "dresses"
  | "accessories"
  | "unknown";

export type InterpretedLanguage = "kr" | "en" | "mixed";

export interface ParsedDiscoverQuery {
  raw: string;
  normalized: string;
  language: InterpretedLanguage;
  category: InterpretedCategory;
  productTypes: string[];
  style: string[];
  color?: string | null;
  gender?: "male" | "female" | "unisex" | null;
  /** True when the AI fallback produced this result. */
  aiAssisted: boolean;
}

// ---------------------------------------------------------------------------
// Alias maps (KR + EN). Keep small, surgical, and additive.
// ---------------------------------------------------------------------------

const CATEGORY_MAP: Record<Exclude<InterpretedCategory, "unknown">, string[]> = {
  swimwear: ["swimwear", "swimsuit", "swim trunks", "board shorts", "bikini",
             "수영복", "스윔웨어", "비치웨어", "비키니", "래쉬가드"],
  outerwear: ["jacket", "coat", "blazer", "parka", "puffer", "trench", "bomber",
              "자켓", "재킷", "코트", "아우터", "패딩", "점퍼"],
  tops: ["shirt", "tshirt", "t-shirt", "tee", "hoodie", "sweater", "knit", "blouse", "polo",
         "셔츠", "티셔츠", "후디", "후드", "니트", "스웨터", "맨투맨", "블라우스"],
  pants: ["pants", "jeans", "trousers", "slacks", "shorts", "joggers", "chinos",
          "바지", "슬랙스", "청바지", "데님", "조거", "쇼츠", "반바지"],
  shoes: ["shoes", "sneakers", "boots", "loafers", "heels", "sandals", "trainers",
          "신발", "스니커즈", "운동화", "부츠", "로퍼", "샌들", "힐"],
  bags: ["bag", "tote", "backpack", "crossbody", "clutch", "wallet",
         "가방", "백", "토트", "백팩", "크로스백", "지갑"],
  dresses: ["dress", "gown", "jumpsuit", "romper",
            "원피스", "드레스", "점프수트"],
  accessories: ["hat", "cap", "scarf", "belt", "watch", "sunglasses", "jewelry",
                "necklace", "earring", "bracelet", "ring",
                "모자", "스카프", "벨트", "시계", "선글라스", "주얼리",
                "목걸이", "귀걸이", "팔찌", "반지"],
};

const PRODUCT_MAP: Partial<Record<InterpretedCategory, string[]>> = {
  swimwear: ["swim trunks", "board shorts", "bikini", "one-piece", "rashguard"],
  outerwear: ["jacket", "coat", "blazer", "parka"],
  tops: ["t-shirt", "shirt", "hoodie", "sweater"],
  pants: ["jeans", "trousers", "shorts"],
  shoes: ["sneakers", "boots", "loafers"],
  bags: ["tote", "backpack", "crossbody"],
  dresses: ["dress", "jumpsuit"],
  accessories: ["hat", "scarf", "sunglasses"],
};

const STYLE_MAP: Record<string, string[]> = {
  minimal: ["minimal", "minimalist", "미니멀", "깔끔"],
  street:  ["street", "streetwear", "스트릿", "스트리트"],
  clean:   ["clean", "심플", "simple"],
  luxury:  ["luxury", "premium", "명품", "럭셔리"],
  vintage: ["vintage", "retro", "빈티지", "레트로"],
  sporty:  ["sporty", "athletic", "스포티"],
  romantic:["romantic", "feminine", "러블리", "페미닌"],
  edgy:    ["edgy", "punk", "엣지", "힙한"],
  oversized:["oversized", "loose", "오버핏", "루즈핏"],
  effortless:["effortless", "꾸안꾸", "데일리"],
};

const COLOR_MAP: Record<string, string[]> = {
  black: ["black", "블랙", "검정"],
  white: ["white", "화이트", "흰"],
  beige: ["beige", "베이지"],
  brown: ["brown", "브라운", "갈색"],
  navy:  ["navy", "네이비"],
  grey:  ["grey", "gray", "그레이", "회색"],
  red:   ["red", "레드", "빨강"],
  pink:  ["pink", "핑크", "분홍"],
  blue:  ["blue", "블루", "파랑"],
  green: ["green", "그린", "초록"],
};

const GENDER_MAP: Record<NonNullable<ParsedDiscoverQuery["gender"]>, string[]> = {
  male:    ["men", "mens", "men's", "male", "guy", "남성", "남자"],
  female:  ["women", "womens", "women's", "female", "ladies", "girl", "여성", "여자"],
  unisex:  ["unisex", "유니섹스"],
};

// Mood/slang words that, on their own, mean we should defer to AI.
const VAGUE_RE = /(꾸안꾸|뉴욕|파리지앵|프렌치|에스닉|레트로한|힙한|느낌|vibe|aesthetic|mood|inspo|inspiration|스타일링|코디 추천)/i;

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalize(q: string): string {
  return (q || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectLanguage(q: string): InterpretedLanguage {
  const hasKr = /[가-힣]/.test(q);
  const hasEn = /[a-z]/i.test(q);
  if (hasKr && hasEn) return "mixed";
  if (hasKr) return "kr";
  return "en";
}

function matchAny(haystack: string, needles: string[]): boolean {
  for (const n of needles) {
    if (!n) continue;
    if (haystack.includes(n.toLowerCase())) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Deterministic parser
// ---------------------------------------------------------------------------

export function parseDeterministic(raw: string): ParsedDiscoverQuery {
  const normalized = normalize(raw);
  const language = detectLanguage(raw);

  let category: InterpretedCategory = "unknown";
  for (const [cat, words] of Object.entries(CATEGORY_MAP) as [Exclude<InterpretedCategory, "unknown">, string[]][]) {
    if (matchAny(normalized, words)) { category = cat; break; }
  }

  const style: string[] = [];
  for (const [tag, words] of Object.entries(STYLE_MAP)) {
    if (matchAny(normalized, words)) style.push(tag);
  }

  let color: string | null = null;
  for (const [c, words] of Object.entries(COLOR_MAP)) {
    if (matchAny(normalized, words)) { color = c; break; }
  }

  let gender: ParsedDiscoverQuery["gender"] = null;
  for (const [g, words] of Object.entries(GENDER_MAP) as [NonNullable<ParsedDiscoverQuery["gender"]>, string[]][]) {
    if (matchAny(normalized, words)) { gender = g; break; }
  }

  const productTypes = category !== "unknown" ? (PRODUCT_MAP[category] ?? []) : [];

  return {
    raw,
    normalized,
    language,
    category,
    productTypes,
    style,
    color,
    gender,
    aiAssisted: false,
  };
}

// ---------------------------------------------------------------------------
// AI fallback (Lovable AI via discover-intent-expand)
// ---------------------------------------------------------------------------

const AI_CATEGORY_TO_INTERPRETED: Record<string, InterpretedCategory> = {
  bags: "bags",
  shoes: "shoes",
  outerwear: "outerwear",
  tops: "tops",
  bottoms: "pants",
  dresses: "dresses",
  accessories: "accessories",
};

interface AiIntent {
  categories?: string[];
  styleTags?: string[];
  moodTags?: string[];
  enTokens?: string[];
  color?: string | null;
  brand?: string | null;
  weather?: string | null;
  occasion?: string | null;
}

async function callAiInterpreter(query: string): Promise<AiIntent | null> {
  try {
    const { data, error } = await supabase.functions.invoke("discover-intent-expand", {
      body: { query },
    });
    if (error) {
      console.warn("[interpretQuery] AI fallback error", error.message);
      return null;
    }
    if (!data?.intent) return null;
    return data.intent as AiIntent;
  } catch (e) {
    console.warn("[interpretQuery] AI fallback threw", e);
    return null;
  }
}

function aiToParsed(raw: string, base: ParsedDiscoverQuery, ai: AiIntent): ParsedDiscoverQuery {
  let category: InterpretedCategory = base.category;
  const aiCat = ai.categories?.[0];
  if (aiCat && AI_CATEGORY_TO_INTERPRETED[aiCat]) {
    category = AI_CATEGORY_TO_INTERPRETED[aiCat];
  }
  const productTypes = category !== "unknown"
    ? Array.from(new Set([...(PRODUCT_MAP[category] ?? []), ...(ai.enTokens ?? [])])).slice(0, 8)
    : (ai.enTokens ?? []).slice(0, 8);
  const style = Array.from(new Set([...base.style, ...(ai.styleTags ?? []), ...(ai.moodTags ?? [])])).slice(0, 6);
  return {
    ...base,
    category,
    productTypes,
    style,
    color: base.color ?? (ai.color ?? null),
    aiAssisted: true,
  };
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

function isVague(parsed: ParsedDiscoverQuery): boolean {
  if (parsed.category !== "unknown") return false;
  // Mood-only or slang → defer to AI even if some style tag matched.
  if (VAGUE_RE.test(parsed.raw)) return true;
  // Nothing useful at all (no category, no style, no color) → AI.
  return parsed.style.length === 0 && !parsed.color;
}

export async function interpretQuery(raw: string): Promise<ParsedDiscoverQuery> {
  const parsed = parseDeterministic(raw);
  if (parsed.category !== "unknown" && !VAGUE_RE.test(parsed.raw)) {
    return parsed;
  }
  if (!isVague(parsed)) return parsed;

  const ai = await callAiInterpreter(raw);
  if (!ai) return parsed; // graceful: keep deterministic result, even if "unknown"
  return aiToParsed(raw, parsed, ai);
}

// ---------------------------------------------------------------------------
// Safe expansion + category lock helpers
// ---------------------------------------------------------------------------

export function expandInterpreted(parsed: ParsedDiscoverQuery): string[] {
  if (parsed.category === "unknown") {
    return [parsed.normalized || parsed.raw].filter(Boolean);
  }
  const colorPrefix = parsed.color ? `${parsed.color} ` : "";
  const stylePrefix = parsed.style[0] ? `${parsed.style[0]} ` : "";
  const types = parsed.productTypes.length > 0 ? parsed.productTypes : [parsed.category];
  const out = new Set<string>();
  for (const t of types) {
    out.add(t);
    if (colorPrefix) out.add(`${colorPrefix}${t}`.trim());
    if (stylePrefix) out.add(`${stylePrefix}${t}`.trim());
  }
  return Array.from(out).slice(0, 8);
}

/** Hard category lock — drop products not matching the locked category. */
export function enforceInterpretedLock<T extends { category?: string | null; name?: string | null }>(
  products: T[],
  parsed: ParsedDiscoverQuery,
): T[] {
  if (parsed.category === "unknown") return products;
  const aliases = CATEGORY_MAP[parsed.category as Exclude<InterpretedCategory, "unknown">] ?? [];
  return products.filter((p) => {
    const cat = (p.category || "").toLowerCase();
    const name = (p.name || "").toLowerCase();
    if (cat === parsed.category) return true;
    return aliases.some((a) => cat.includes(a) || name.includes(a));
  });
}
