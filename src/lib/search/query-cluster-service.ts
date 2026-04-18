/**
 * QUERY CLUSTER SERVICE
 *
 * Cluster-first search: every search starts by looking up a precomputed
 * cluster in `query_clusters`. If found we seed the session with the cached
 * product_ids INSTANTLY (DB-first, no blank screen, no random fallback).
 * The fresh external search continues in the background and the cluster is
 * upserted at the end so it improves over time.
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeFromCache } from "./product-normalizer";
import type { Product } from "./types";

/* ─────────── Normalization ─────────── */

/** Light synonym map — keeps clusters from fragmenting across near-duplicates. */
const SYNONYMS: Record<string, string> = {
  street: "streetwear",
  streetstyle: "streetwear",
  tee: "t-shirt",
  tees: "t-shirt",
  trainers: "sneakers",
  kicks: "sneakers",
  trousers: "pants",
  pant: "pants",
  jean: "jeans",
  shoe: "shoes",
  bagz: "bags",
  bag: "bags",
  jackets: "jacket",
  coats: "coat",
  hoodies: "hoodie",
};

const STOPWORDS = new Set([
  "a", "an", "the", "for", "of", "and", "or", "with", "to", "in", "on",
  "my", "me", "i", "some", "any", "best", "top", "new",
]);

export function normalizeQuery(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) => SYNONYMS[t] ?? t);
  // De-dupe while preserving order, then sort for stable cluster_key
  const unique = Array.from(new Set(tokens));
  return unique.join(" ").trim();
}

/** Stable cluster key — sorted tokens so word order doesn't fragment clusters. */
export function buildClusterKey(normalized: string): string {
  return normalized.split(" ").filter(Boolean).sort().join("-");
}

/* ─────────── Lookup ─────────── */

interface ClusterRow {
  cluster_key: string;
  query_family: string;
  normalized_query: string | null;
  category: string | null;
  tags: string[] | null;
  product_ids: string[];
  product_count: number;
  usage_count: number;
}

/**
 * Find the closest cluster for the user's query.
 * Strategy: exact key match → token-overlap fallback (≥60% token match).
 */
export async function findCluster(
  query: string,
): Promise<{ cluster: ClusterRow; products: Product[] } | null> {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;
  const key = buildClusterKey(normalized);

  // 1) Exact key
  const { data: exact } = await supabase
    .from("query_clusters")
    .select("*")
    .eq("cluster_key", key)
    .maybeSingle();

  let row: ClusterRow | null = (exact as ClusterRow | null) ?? null;

  // 2) Token-overlap fallback: pull a small candidate set and pick best
  if (!row) {
    const tokens = normalized.split(" ").filter(Boolean);
    if (tokens.length === 0) return null;

    const { data: candidates } = await supabase
      .from("query_clusters")
      .select("*")
      .or(tokens.map((t) => `normalized_query.ilike.%${t}%`).join(","))
      .order("usage_count", { ascending: false })
      .limit(8);

    if (candidates && candidates.length) {
      let best: { row: ClusterRow; score: number } | null = null;
      for (const c of candidates as ClusterRow[]) {
        const cTokens = (c.normalized_query ?? "").split(" ").filter(Boolean);
        if (cTokens.length === 0) continue;
        const overlap = tokens.filter((t) => cTokens.includes(t)).length;
        const score = overlap / Math.max(tokens.length, cTokens.length);
        if (score >= 0.6 && (!best || score > best.score)) {
          best = { row: c, score };
        }
      }
      row = best?.row ?? null;
    }
  }

  if (!row || !row.product_ids?.length) return null;

  // Hydrate products from product_cache (preserve cluster order)
  const { data: cached } = await supabase
    .from("product_cache")
    .select("*")
    .in("id", row.product_ids)
    .eq("is_active", true);

  if (!cached?.length) return null;

  const byId = new Map(cached.map((p) => [p.id, p]));
  const ordered: Product[] = [];
  for (const id of row.product_ids) {
    const raw = byId.get(id);
    if (!raw) continue;
    const product = normalizeFromCache(raw);
    if (product) ordered.push(product);
  }

  if (ordered.length === 0) return null;
  return { cluster: row, products: ordered };
}

/* ─────────── Upsert ─────────── */

/**
 * Persist / refresh a cluster after a search completes.
 * Picks up to 60 product UUIDs from the session and bumps usage_count via
 * the SECURITY DEFINER function `upsert_query_cluster`.
 */
export async function upsertCluster(args: {
  query: string;
  category?: string | null;
  tags?: string[];
  products: Product[];
}): Promise<void> {
  try {
    const normalized = normalizeQuery(args.query);
    if (!normalized) return;
    const key = buildClusterKey(normalized);

    // Only persist real DB-backed UUIDs (skip ad-hoc external ids)
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const productIds = args.products
      .map((p) => p.id)
      .filter((id): id is string => !!id && uuidRe.test(id))
      .slice(0, 60);

    if (productIds.length < 4) return; // not worth caching

    await supabase.rpc("upsert_query_cluster", {
      _cluster_key: key,
      _query_family: args.query.trim(),
      _normalized_query: normalized,
      _category: args.category ?? null,
      _tags: (args.tags ?? []).slice(0, 12),
      _product_ids: productIds,
    });
  } catch (e) {
    // Cluster persistence is best-effort — never block the user's search.
    console.warn("[query-cluster] upsert failed", e);
  }
}
