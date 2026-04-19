/**
 * Discover query parser
 * ---------------------
 * Pure function. Takes a raw user query and extracts structured intent so
 * the rest of the discover pipeline (guard, expander, ranker) can reason
 * about it deterministically.
 *
 * Intentionally regex-only — no AI, no async. Fast and predictable.
 */
import { detectPrimaryCategory, type PrimaryCategory } from "@/lib/search/category-lock";
import { tokenizeSearchQuery } from "./searchTokenizer";
import { expandSearchAliases } from "./searchAliases";
import { parseGenderIntent } from "./genderFilter";

export type DiscoverQueryType =
  | "category"      // "summer dresses", "leather bags"
  | "brand"         // "gucci", "nike air max"
  | "scenario"      // "wedding guest", "office summer"
  | "style"         // "minimal y2k", "old money"
  | "color"         // "all black"
  | "freeform";     // anything else

const BRAND_RE =
  /\b(nike|adidas|gucci|prada|zara|h&m|uniqlo|cos|arket|loewe|chanel|dior|hermes|balenciaga|ysl|saint\s*laurent|burberry|fendi|miu\s*miu|bottega|jacquemus|stussy|carhartt|patagonia|north\s*face|new\s*balance|asics|salomon|on\s*running|levi'?s|polo\s*ralph|ralph\s*lauren|tommy|lacoste|maison\s*margiela|acne\s*studios?|ami\s*paris|jw\s*anderson|ganni|toteme|the\s*row|khaite|alo|lululemon|reformation|aritzia|aime\s*leon\s*dore|kith)\b/i;

const SCENARIO_RE =
  /\b(wedding|office|gym|travel|beach|party|festival|interview|brunch|date\s*night|rainy|snowy|winter|summer|spring|autumn|fall|weekend|holiday|vacation|formal|casual\s*friday)\b/i;

const STYLE_RE =
  /\b(minimal|street|classic|vintage|y2k|grunge|preppy|old\s*money|cottagecore|techwear|gorpcore|dark\s*academia|coastal|boho|punk|gothic|romantic|sporty|edgy|androgynous)\b/i;

const COLOR_RE =
  /\b(black|white|beige|cream|brown|tan|navy|grey|gray|red|pink|blue|green|olive|burgundy|camel|ivory|charcoal|sage|mint|lavender|mustard)\b/i;

const FIT_RE = /\b(oversized|regular|slim|relaxed|cropped|tailored|loose|fitted|baggy)\b/i;

export interface ParsedDiscoverQuery {
  raw: string;
  normalized: string;
  /** Stopword-stripped tokens (e.g. "red shoes" → ["red","shoes"]). */
  tokens: string[];
  /** Tokens + KR/vibe alias expansions, deduped — feed straight to ranker. */
  expandedTerms: string[];
  queryType: DiscoverQueryType;
  primaryCategory: PrimaryCategory | null;
  styleModifiers: string[];
  brand: string | null;
  color: string | null;
  scenario: string | null;
  colors: string[];
  fit: string | null;
}

function pickAll(re: RegExp, q: string): string[] {
  const out = new Set<string>();
  const flagged = new RegExp(re.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = flagged.exec(q)) !== null) {
    out.add(m[0].toLowerCase().trim());
  }
  return Array.from(out);
}

function pickOne(re: RegExp, q: string): string | null {
  const m = re.exec(q);
  return m ? m[0].toLowerCase().trim() : null;
}

export function parseDiscoverQuery(raw: string): ParsedDiscoverQuery {
  const normalized = (raw || "").trim().replace(/\s+/g, " ").toLowerCase();
  const primaryCategory = detectPrimaryCategory(normalized);
  const brand = pickOne(BRAND_RE, normalized);
  const color = pickOne(COLOR_RE, normalized);
  const scenario = pickOne(SCENARIO_RE, normalized);
  const fit = pickOne(FIT_RE, normalized);
  const styleModifiers = pickAll(STYLE_RE, normalized);

  let queryType: DiscoverQueryType = "freeform";
  if (brand) queryType = "brand";
  else if (primaryCategory) queryType = "category";
  else if (scenario) queryType = "scenario";
  else if (styleModifiers.length > 0) queryType = "style";
  else if (color) queryType = "color";

  const tokens = tokenizeSearchQuery(normalized);
  const expandedTerms = expandSearchAliases(normalized);

  return {
    raw,
    normalized,
    tokens,
    expandedTerms,
    queryType,
    primaryCategory,
    styleModifiers,
    brand,
    color,
    colors: color ? [color] : [],
    scenario,
    fit,
  };
}
