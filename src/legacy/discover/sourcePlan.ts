/**
 * Source plan — chooses which Korean commerce domains to hit for a given parsed query.
 * Apify-first; no Google/Naver dependency.
 */
export interface ParsedQueryLike {
  rawQuery: string;
  primaryCategory?: string | null;
  styleTags?: string[];
  brand?: string | null;
}

export interface SourcePlan {
  domains: string[];
  category: string | null;
  styleTags: string[];
  rawQuery: string;
  brand: string | null;
}

const KR_PRIMARY = ["musinsa.com", "29cm.co.kr", "wconcept.co.kr", "ssg.com"];
const GLOBAL_SECONDARY = ["yoox.com", "asos.com", "oakandfort.com"];

export function getSourcePlan(parsedQuery: ParsedQueryLike): SourcePlan {
  // KR primary always; global secondary appended for breadth.
  const domains = [...KR_PRIMARY, ...GLOBAL_SECONDARY];
  return {
    domains,
    category: parsedQuery.primaryCategory ?? null,
    styleTags: parsedQuery.styleTags ?? [],
    rawQuery: parsedQuery.rawQuery,
    brand: parsedQuery.brand ?? null,
  };
}
