/**
 * AI-backed query interpreter
 * ---------------------------
 * Sends the raw query to the existing `discover-intent-expand` edge function
 * (Lovable AI Gateway) and returns structured intent plus 4-8 prioritized
 * search variants for background ingestion.
 *
 * Falls back to a deterministic alias-based interpretation when AI is
 * unavailable so the auto-discovery loop keeps working without network.
 */
import { supabase } from "@/integrations/supabase/client";
import { parseIntent } from "./discover-intent-parser";
import { expandDiscoverQuery } from "./discover-query-expander";
import { parseDiscoverQuery } from "./discover-query-parser";

export interface InterpretedQuery {
  raw: string;
  normalized: string;
  primaryCategory?: string;
  secondaryCategories?: string[];
  materials?: string[];
  styles?: string[];
  scenario?: string;
  colors?: string[];
  brands?: string[];
  /** 4-8 prioritized variants — exact → category → synonym → style → broad. */
  searchVariants: string[];
}

const MAX_VARIANTS = 16;
const MIN_VARIANTS = 6;

const GENDER_AXIS = ["women", "men"];
const STYLE_AXIS = ["minimal", "street", "vintage", "classic"];
const COLOR_AXIS = ["black", "white", "beige"];
const FIT_AXIS = ["oversized", "slim"];
const SCENARIO_AXIS = ["work", "weekend", "evening"];

function buildAxisVariants(base: string, primaryCategory?: string): string[] {
  const out: string[] = [];
  const head = primaryCategory && !base.includes(primaryCategory) ? `${base} ${primaryCategory}` : base;
  for (const g of GENDER_AXIS) out.push(`${g} ${head}`);
  for (const s of STYLE_AXIS) out.push(`${s} ${head}`);
  for (const c of COLOR_AXIS) out.push(`${c} ${head}`);
  for (const f of FIT_AXIS) out.push(`${f} ${head}`);
  for (const sc of SCENARIO_AXIS) out.push(`${head} ${sc}`);
  return out;
}

function dedupePush(arr: string[], v: string | null | undefined): void {
  if (!v) return;
  const t = v.trim().replace(/\s+/g, " ").toLowerCase();
  if (!t) return;
  if (!arr.includes(t)) arr.push(t);
}

/** Deterministic fallback when AI is offline / errors. */
function deterministicInterpret(query: string): InterpretedQuery {
  const parsed = parseDiscoverQuery(query);
  const intent = parseIntent(query);
  const expansion = expandDiscoverQuery(parsed);
  const variants: string[] = [];
  dedupePush(variants, parsed.normalized);
  for (const a of intent.enAliases) dedupePush(variants, a);
  for (const v of expansion.variants) dedupePush(variants, v);
  // Axis fan-out — guarantees gender/style/color/fit/scenario coverage even
  // when the deterministic expander is conservative under category lock.
  for (const v of buildAxisVariants(parsed.normalized, parsed.primaryCategory ?? undefined)) {
    dedupePush(variants, v);
  }
  return {
    raw: query,
    normalized: parsed.normalized,
    primaryCategory: parsed.primaryCategory ?? intent.primaryCategory ?? undefined,
    materials: undefined,
    styles: parsed.styleModifiers.length > 0 ? parsed.styleModifiers : intent.styleTags,
    scenario: parsed.scenario ?? intent.occasion ?? undefined,
    colors: parsed.color ? [parsed.color] : undefined,
    brands: parsed.brand ? [parsed.brand] : undefined,
    searchVariants: variants.slice(0, MAX_VARIANTS),
  };
}

/**
 * Calls the AI gateway through `discover-intent-expand` and merges the result
 * with the deterministic baseline. Always returns a usable interpretation —
 * never throws.
 */
export async function interpretQueryWithAI(query: string): Promise<InterpretedQuery> {
  const baseline = deterministicInterpret(query);
  try {
    const { data, error } = await supabase.functions.invoke("discover-intent-expand", {
      body: { query, baseline },
    });
    if (error || !data) return baseline;
    const ai = data as Partial<InterpretedQuery> & { variants?: string[] };
    const variants: string[] = [];
    // Priority order: exact → category/material → AI variants → baseline.
    dedupePush(variants, baseline.normalized);
    if (ai.primaryCategory) dedupePush(variants, `${baseline.normalized} ${ai.primaryCategory}`);
    for (const m of ai.materials || []) dedupePush(variants, `${m} ${ai.primaryCategory ?? baseline.normalized}`);
    for (const v of ai.searchVariants || ai.variants || []) dedupePush(variants, v);
    for (const v of baseline.searchVariants) dedupePush(variants, v);
    const merged: InterpretedQuery = {
      raw: query,
      normalized: baseline.normalized,
      primaryCategory: ai.primaryCategory ?? baseline.primaryCategory,
      secondaryCategories: ai.secondaryCategories ?? baseline.secondaryCategories,
      materials: ai.materials ?? baseline.materials,
      styles: ai.styles ?? baseline.styles,
      scenario: ai.scenario ?? baseline.scenario,
      colors: ai.colors ?? baseline.colors,
      brands: ai.brands ?? baseline.brands,
      searchVariants: variants.slice(0, MAX_VARIANTS),
    };
    if (merged.searchVariants.length < MIN_VARIANTS) {
      // Pad from baseline if AI returned too few.
      for (const v of baseline.searchVariants) {
        if (merged.searchVariants.length >= MIN_VARIANTS) break;
        dedupePush(merged.searchVariants, v);
      }
    }
    return merged;
  } catch (err) {
    console.warn("[aiQueryInterpreter] AI call failed, using baseline", err);
    return baseline;
  }
}
