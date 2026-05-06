/**
 * translateQueryToEn
 * ------------------
 * Calls the `discover-translate-query` edge function to convert a Korean (or
 * mixed KR/EN) fashion query into 3-5 natural English shopping queries that
 * a real shopper would type. Used to widen Discover coverage so KR queries
 * also hit English-only sources (Farfetch, SSENSE, ASOS, etc).
 *
 * Soft-fails: returns [] on any error so callers can fall back silently.
 */
import { supabase } from "@/integrations/supabase/client";
import { isKoreanQuery } from "./krAliasMap";

const cache = new Map<string, { at: number; queries: string[] }>();
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

export async function translateQueryToEn(query: string): Promise<string[]> {
  const q = (query || "").trim();
  if (!q || !isKoreanQuery(q)) return [];

  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.queries;

  try {
    const { data, error } = await supabase.functions.invoke("discover-translate-query", {
      body: { query: q },
    });
    if (error) {
      console.warn("[translateQueryToEn] invoke error", error.message);
      return [];
    }
    if (!data?.ok || !Array.isArray(data.queries)) return [];
    const queries = (data.queries as string[])
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 5);
    cache.set(key, { at: Date.now(), queries });
    return queries;
  } catch (e) {
    console.warn("[translateQueryToEn] failed", e);
    return [];
  }
}
