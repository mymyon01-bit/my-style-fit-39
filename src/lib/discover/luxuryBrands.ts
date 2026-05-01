/**
 * Luxury & contemporary brand registry for Discover search.
 *
 * Used by:
 *  - `useDiscoverSearch` to detect luxury intent in a query and trigger the
 *    `discover-luxury` edge function in addition to the regular ladder.
 *  - `discover-luxury` edge function (mirrored copy) to normalize brand names
 *    and apply ranking boost.
 *
 * NOTE: this file MUST stay framework-free (no React, no Deno) so the same
 * source can be copy-imported by the edge function.
 */

export type CanonicalBrand = string;

/** Aliases (lowercased, accent-stripped) → canonical display name. */
const RAW_ALIASES: Array<[string[], CanonicalBrand, number]> = [
  // tier 1 — heritage maisons (boost 1.40)
  [["hermes", "에르메스", "エルメス", "爱马仕"], "Hermès", 1.4],
  [["chanel", "샤넬", "シャネル", "香奈儿"], "Chanel", 1.4],
  [["louis vuitton", "lv", "루이비통", "ルイヴィトン", "路易威登"], "Louis Vuitton", 1.4],
  [["dior", "christian dior", "디올", "ディオール", "迪奥"], "Dior", 1.4],

  // tier 2 — top luxury (boost 1.30)
  [["gucci", "구찌", "グッチ", "古驰"], "Gucci", 1.3],
  [["prada", "프라다", "プラダ", "普拉达"], "Prada", 1.3],
  [["burberry", "버버리", "バーバリー", "博柏利"], "Burberry", 1.3],
  [["balenciaga", "발렌시아가", "バレンシアガ", "巴黎世家"], "Balenciaga", 1.3],
  [["saint laurent", "ysl", "yves saint laurent", "생로랑", "サンローラン"], "Saint Laurent", 1.3],
  [["bottega veneta", "bottega", "보테가", "보테가베네타", "ボッテガヴェネタ"], "Bottega Veneta", 1.3],
  [["fendi", "펜디", "フェンディ", "芬迪"], "Fendi", 1.3],
  [["valentino", "발렌티노", "ヴァレンティノ"], "Valentino", 1.3],
  [["givenchy", "지방시", "ジバンシィ"], "Givenchy", 1.3],
  [["celine", "céline", "셀린느", "셀린", "セリーヌ"], "Celine", 1.3],
  [["loewe", "로에베", "ロエベ"], "Loewe", 1.3],
  [["miu miu", "미우미우", "ミュウミュウ"], "Miu Miu", 1.25],
  [["versace", "베르사체", "ヴェルサーチェ"], "Versace", 1.25],
  [["alexander mcqueen", "mcqueen", "맥퀸", "マックイーン"], "Alexander McQueen", 1.25],

  // tier 3 — contemporary luxury / designer (boost 1.15)
  [["acne studios", "acne", "아크네", "아크네스튜디오", "アクネ"], "Acne Studios", 1.15],
  [["maison margiela", "margiela", "mm6", "마르지엘라", "메종마르지엘라", "マルジェラ"], "Maison Margiela", 1.15],
  [["jacquemus", "자크뮈스", "ジャックムス"], "Jacquemus", 1.15],
  [["off-white", "off white", "오프화이트", "オフホワイト"], "Off-White", 1.15],
  [["jil sander", "질샌더", "ジルサンダー"], "Jil Sander", 1.15],
  [["the row", "더로우"], "The Row", 1.15],
  [["totême", "toteme", "토템", "토테메"], "Totême", 1.15],
  [["khaite", "케이트"], "Khaite", 1.15],
  [["lemaire", "르메르", "ルメール"], "Lemaire", 1.15],
  [["our legacy", "아워레가시"], "Our Legacy", 1.15],
  [["stone island", "스톤아일랜드", "ストーンアイランド"], "Stone Island", 1.15],
  [["moncler", "몽클레르", "モンクレール"], "Moncler", 1.2],
  [["canada goose", "캐나다구스"], "Canada Goose", 1.15],
  [["thom browne", "톰브라운", "トムブラウン"], "Thom Browne", 1.2],
  [["brunello cucinelli", "cucinelli", "브루넬로쿠치넬리"], "Brunello Cucinelli", 1.2],
  [["zegna", "ermenegildo zegna", "제냐", "ゼニア"], "Zegna", 1.2],
];

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_TO_CANONICAL = new Map<string, CanonicalBrand>();
const CANONICAL_TO_BOOST = new Map<CanonicalBrand, number>();
const CANONICAL_DOMAINS = new Map<CanonicalBrand, string>();

for (const [aliases, canonical, boost] of RAW_ALIASES) {
  CANONICAL_TO_BOOST.set(canonical, boost);
  ALIAS_TO_CANONICAL.set(normalizeKey(canonical), canonical);
  for (const a of aliases) ALIAS_TO_CANONICAL.set(normalizeKey(a), canonical);
}

// Best-effort canonical domain hints used to boost SerpAPI queries.
// (Only used to add `site:` hints; never to scrape directly.)
const DOMAINS: Record<CanonicalBrand, string> = {
  "Hermès": "hermes.com",
  "Chanel": "chanel.com",
  "Louis Vuitton": "louisvuitton.com",
  "Dior": "dior.com",
  "Gucci": "gucci.com",
  "Prada": "prada.com",
  "Burberry": "burberry.com",
  "Balenciaga": "balenciaga.com",
  "Saint Laurent": "ysl.com",
  "Bottega Veneta": "bottegaveneta.com",
  "Fendi": "fendi.com",
  "Valentino": "valentino.com",
  "Givenchy": "givenchy.com",
  "Celine": "celine.com",
  "Loewe": "loewe.com",
  "Miu Miu": "miumiu.com",
  "Versace": "versace.com",
  "Alexander McQueen": "alexandermcqueen.com",
  "Acne Studios": "acnestudios.com",
  "Maison Margiela": "maisonmargiela.com",
  "Jacquemus": "jacquemus.com",
  "Off-White": "off---white.com",
  "Jil Sander": "jilsander.com",
  "The Row": "therow.com",
  "Totême": "toteme-studio.com",
  "Khaite": "khaite.com",
  "Lemaire": "lemaire.fr",
  "Our Legacy": "ourlegacy.com",
  "Stone Island": "stoneisland.com",
  "Moncler": "moncler.com",
  "Canada Goose": "canadagoose.com",
  "Thom Browne": "thombrowne.com",
  "Brunello Cucinelli": "brunellocucinelli.com",
  "Zegna": "zegna.com",
};
for (const [k, v] of Object.entries(DOMAINS)) CANONICAL_DOMAINS.set(k, v);

/** Trusted multi-brand luxury retailers — always safe to suggest as `site:` hints. */
export const LUXURY_RETAILERS = [
  "farfetch.com",
  "ssense.com",
  "mytheresa.com",
  "matchesfashion.com",
  "net-a-porter.com",
  "mrporter.com",
  "luisaviaroma.com",
] as const;

/** Try to map an arbitrary brand string to a canonical name. */
export function normalizeBrand(raw: string | null | undefined): CanonicalBrand | null {
  if (!raw) return null;
  const key = normalizeKey(String(raw));
  if (!key) return null;
  return ALIAS_TO_CANONICAL.get(key) || null;
}

export interface LuxuryDetection {
  /** Canonical brand if a known alias appears in the query. */
  brand: CanonicalBrand | null;
  /** True when the query mentions a known luxury brand. */
  isLuxury: boolean;
  /** Ranking multiplier (1.0 when not luxury). */
  weight: number;
  /** Suggested official-domain hint for `site:` query enrichment. */
  domainHint: string | null;
}

/** Detect a luxury brand mentioned anywhere in a free-form query. */
export function detectLuxuryBrand(query: string): LuxuryDetection {
  const key = normalizeKey(query || "");
  if (!key) return { brand: null, isLuxury: false, weight: 1, domainHint: null };

  // Try multi-word aliases first (longer keys are more specific).
  const aliases = Array.from(ALIAS_TO_CANONICAL.keys()).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    // Word-boundary match for ASCII; substring for CJK aliases (no spaces).
    const isCjk = /[\u3000-\u9fff\uac00-\ud7af]/.test(alias);
    const matched = isCjk
      ? key.includes(alias)
      : new RegExp(`(?:^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`).test(key);
    if (matched) {
      const canonical = ALIAS_TO_CANONICAL.get(alias)!;
      return {
        brand: canonical,
        isLuxury: true,
        weight: CANONICAL_TO_BOOST.get(canonical) ?? 1.15,
        domainHint: CANONICAL_DOMAINS.get(canonical) ?? null,
      };
    }
  }

  return { brand: null, isLuxury: false, weight: 1, domainHint: null };
}

/** Ranking multiplier for any product whose brand is recognized. */
export function brandBoost(brand: string | null | undefined): number {
  const c = normalizeBrand(brand);
  if (!c) return 1;
  return CANONICAL_TO_BOOST.get(c) ?? 1;
}

/**
 * Build an enriched SerpAPI/Google query that prefers official + trusted retailers.
 * Falls back to the raw query if no luxury brand was detected.
 */
export function enrichLuxuryQuery(query: string, detection: LuxuryDetection): string {
  if (!detection.isLuxury) return query;
  const sites: string[] = [];
  if (detection.domainHint) sites.push(detection.domainHint);
  // Add a couple of premium aggregators so we still see results when the
  // brand's own site blocks search-engine indexing of product pages.
  sites.push(LUXURY_RETAILERS[0], LUXURY_RETAILERS[1], LUXURY_RETAILERS[2]);
  const siteFilter = `(${sites.map((s) => `site:${s}`).join(" OR ")})`;
  return `${query} ${siteFilter}`;
}
