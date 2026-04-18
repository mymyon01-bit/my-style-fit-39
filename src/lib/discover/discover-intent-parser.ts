/**
 * Discover intent parser
 * ----------------------
 * Wraps the existing keyword parser + KR alias map and produces a richer,
 * stable `ParsedIntent` shape for the search ladder. Pure & deterministic.
 *
 * The intent parser does NOT call AI. AI expansion only happens later in
 * the ladder (semantic stage) when no deterministic signal is found.
 */
import { parseDiscoverQuery } from "./discover-query-parser";
import { resolveKrAliases, isKoreanQuery } from "./krAliasMap";
import { detectPrimaryCategory, type PrimaryCategory } from "@/lib/search/category-lock";

export type IntentLanguage = "ko" | "en" | "mixed";

export interface ParsedIntent {
  rawQuery: string;
  normalized: string;
  language: IntentLanguage;
  primaryCategory: PrimaryCategory | null;
  styleTags: string[];     // e.g. ["minimal", "oversized"]
  moodTags: string[];      // vibe / emotional ("effortless", "edgy", "romantic", "clean")
  occasion: string | null; // "date night", "office", ...
  weather: string | null;  // "rainy", "snowy", "summer", ...
  color: string | null;
  brand: string | null;
  fitIntent: string | null;
  gender: "men" | "women" | "unisex" | null;
  /** EN tokens injected from the KR alias map (and later, AI expansion). */
  enAliases: string[];
  /** Family hint when the query is KR (e.g. "bag" → derives bags lock). */
  family: string | null;
  /** Initial ladder mode — caller can override. */
  fallbackMode: "exact" | "tokenized" | "semantic" | "broad";
}

const MOOD_RE =
  /\b(effortless|edgy|clean|minimal\s*relaxed|romantic|feminine|soft|elegant|chic|cool|sporty|cozy|playful|bold|moody|sleek)\b/i;

const GENDER_RE = /\b(men'?s?|male|guy|guys|women'?s?|female|girl|girls|ladies|unisex)\b/i;

const WEATHER_RE = /\b(rainy|snowy|hot|cold|warm|chilly|humid|wet)\b/i;

const OCCASION_RE =
  /\b(wedding|office|gym|travel|beach|party|festival|interview|brunch|date\s*night|weekend|holiday|vacation|formal|casual\s*friday)\b/i;

// Mood aliases — map deterministic mood words to normalized tags.
const MOOD_NORMALIZE: Record<string, string> = {
  "minimal relaxed": "effortless",
  "soft": "romantic",
  "feminine": "romantic",
};

function normalizeMood(raw: string): string {
  const k = raw.toLowerCase().replace(/\s+/g, " ").trim();
  return MOOD_NORMALIZE[k] || k;
}

function detectLanguage(q: string, kr: boolean): IntentLanguage {
  const hasLatin = /[A-Za-z]/.test(q);
  if (kr && hasLatin) return "mixed";
  if (kr) return "ko";
  return "en";
}

function detectGender(q: string): ParsedIntent["gender"] {
  const m = GENDER_RE.exec(q);
  if (!m) return null;
  const w = m[0].toLowerCase();
  if (/(men|male|guy)/.test(w)) return "men";
  if (/(women|female|girl|ladies)/.test(w)) return "women";
  return "unisex";
}

export function parseIntent(rawQuery: string): ParsedIntent {
  const raw = (rawQuery || "").trim();
  const base = parseDiscoverQuery(raw);
  const kr = resolveKrAliases(raw);
  const language = detectLanguage(raw, kr.isKorean);

  // Derive category lock — prefer explicit detection on the raw query, then
  // fall back to the EN family hint from the KR alias map.
  let primaryCategory = base.primaryCategory;
  if (!primaryCategory && kr.family) {
    primaryCategory = detectPrimaryCategory(kr.family);
  }
  // Also try the EN aliases themselves (e.g. "bag" → bags) when family is null.
  if (!primaryCategory && kr.aliases.length > 0) {
    for (const a of kr.aliases) {
      const c = detectPrimaryCategory(a);
      if (c) { primaryCategory = c; break; }
    }
  }

  // Mood tags — collected from raw query AND from KR alias EN expansions.
  const moodSet = new Set<string>();
  let m: RegExpExecArray | null;
  const moodFlagged = new RegExp(MOOD_RE.source, "gi");
  while ((m = moodFlagged.exec(raw)) !== null) moodSet.add(normalizeMood(m[0]));
  for (const a of kr.aliases) {
    if (MOOD_RE.test(a)) moodSet.add(normalizeMood(a));
  }
  // KR vibe tokens map to EN mood tags
  if (/꾸안꾸|깔끔/.test(raw)) moodSet.add("effortless");
  if (/힙한|스트릿/.test(raw)) moodSet.add("edgy");
  if (/러블리/.test(raw)) moodSet.add("romantic");
  if (/오버핏/.test(raw)) moodSet.add("oversized");

  const occasion = OCCASION_RE.exec(raw)?.[0]?.toLowerCase() || base.scenario;
  const weather = WEATHER_RE.exec(raw)?.[0]?.toLowerCase()
    || (kr.aliases.find((a) => /rain|snow/.test(a))
        ? (kr.aliases.find((a) => /rain/.test(a)) ? "rainy" : "snowy")
        : null);

  const fallbackMode: ParsedIntent["fallbackMode"] = (() => {
    if (raw.split(/\s+/).length <= 1) return "exact";
    if (base.brand || primaryCategory || base.color) return "tokenized";
    if (moodSet.size > 0 || base.styleModifiers.length > 0) return "semantic";
    return "broad";
  })();

  return {
    rawQuery: raw,
    normalized: base.normalized,
    language,
    primaryCategory,
    styleTags: base.styleModifiers,
    moodTags: Array.from(moodSet),
    occasion,
    weather,
    color: base.color,
    brand: base.brand,
    fitIntent: base.fit,
    gender: detectGender(raw),
    enAliases: kr.aliases,
    family: kr.family,
    fallbackMode,
  };
}

/** Build a UI-friendly chip list from a ParsedIntent for the interpretation banner. */
export function summarizeIntent(intent: ParsedIntent): string[] {
  const chips: string[] = [];
  if (intent.brand) chips.push(cap(intent.brand));
  if (intent.color) chips.push(cap(intent.color) + " tones");
  if (intent.weather) chips.push(weatherLabel(intent.weather));
  if (intent.occasion) chips.push(cap(intent.occasion));
  for (const s of intent.styleTags) chips.push(cap(s));
  for (const m of intent.moodTags) {
    const c = cap(m);
    if (!chips.includes(c)) chips.push(c);
  }
  if (intent.fitIntent) chips.push(cap(intent.fitIntent));
  if (intent.primaryCategory) chips.push(cap(intent.primaryCategory));
  return chips.slice(0, 6);
}

function cap(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function weatherLabel(w: string): string {
  if (w === "rainy") return "Rain-friendly";
  if (w === "snowy") return "Snow-ready";
  return cap(w);
}

export { isKoreanQuery };
