/**
 * Discover intent AI fallback (client side).
 * ------------------------------------------
 * Calls the discover-intent-expand edge function ONLY when the deterministic
 * parser found nothing useful. Merges AI tokens back into ParsedIntent.
 *
 * Designed to be non-blocking: caller awaits with a short timeout and falls
 * back to the original intent if AI is slow / errors / rate-limited.
 */
import { supabase } from "@/integrations/supabase/client";
import { detectPrimaryCategory } from "@/lib/search/category-lock";
import type { ParsedIntent } from "./discover-intent-parser";

export interface AiIntentResult {
  categories?: string[];
  styleTags?: string[];
  moodTags?: string[];
  enTokens?: string[];
  color?: string | null;
  brand?: string | null;
  weather?: string | null;
  occasion?: string | null;
}

/** Heuristic — only call AI when the deterministic parser produced no useful signal. */
export function shouldUseAiFallback(intent: ParsedIntent): boolean {
  const hasSignal =
    !!intent.primaryCategory ||
    !!intent.brand ||
    !!intent.color ||
    intent.styleTags.length > 0 ||
    intent.moodTags.length > 0 ||
    !!intent.occasion ||
    !!intent.weather ||
    intent.enAliases.length > 0;
  return !hasSignal;
}

export async function expandIntentWithAi(query: string): Promise<AiIntentResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("discover-intent-expand", {
      body: { query },
    });
    if (error) {
      console.warn("[discover-intent-ai] invoke error", error.message);
      return null;
    }
    if (!data?.ok || !data.intent) return null;
    return data.intent as AiIntentResult;
  } catch (e) {
    console.warn("[discover-intent-ai] failed", e);
    return null;
  }
}

/** Merge AI expansion into a ParsedIntent (immutably). */
export function mergeAiIntoIntent(intent: ParsedIntent, ai: AiIntentResult): ParsedIntent {
  const next: ParsedIntent = { ...intent };
  if (!next.primaryCategory && ai.categories && ai.categories.length > 0) {
    next.primaryCategory = detectPrimaryCategory(ai.categories[0]) || next.primaryCategory;
  }
  if (!next.color && ai.color) next.color = ai.color;
  if (!next.brand && ai.brand) next.brand = ai.brand;
  if (!next.weather && ai.weather) next.weather = ai.weather;
  if (!next.occasion && ai.occasion) next.occasion = ai.occasion;
  if (ai.styleTags?.length) {
    next.styleTags = Array.from(new Set([...next.styleTags, ...ai.styleTags.map((s) => s.toLowerCase())]));
  }
  if (ai.moodTags?.length) {
    next.moodTags = Array.from(new Set([...next.moodTags, ...ai.moodTags.map((s) => s.toLowerCase())]));
  }
  if (ai.enTokens?.length) {
    next.enAliases = Array.from(new Set([...next.enAliases, ...ai.enTokens.map((s) => s.toLowerCase())]));
  }
  return next;
}
