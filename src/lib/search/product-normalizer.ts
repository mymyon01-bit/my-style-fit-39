import type { Product } from "./types";

export function inferCategory(title: string): string {
  const t = (title || "").toLowerCase();
  if (/\b(jacket|coat|blazer|parka|bomber|trench|overcoat|windbreaker)\b/.test(t)) return "outerwear";
  if (/\b(shirt|tee|t-shirt|hoodie|sweater|cardigan|polo|blouse|tank|knit)\b/.test(t)) return "tops";
  if (/\b(pants|trousers|jeans|shorts|skirt|chinos|joggers|leggings)\b/.test(t)) return "bottoms";
  if (/\b(sneakers?|shoes?|boots?|loafers?|sandals?|trainers?|mules?)\b/.test(t)) return "shoes";
  if (/\b(bag|tote|backpack|crossbody|clutch|purse|satchel|duffel)\b/.test(t)) return "bags";
  return "accessories";
}

/** Normalize a product_cache row (or product-search edge response) to Product. */
export function normalizeFromCache(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = (r.name || r.title || "") as string;
  const imageUrl = (r.image_url || r.imageUrl || null) as string | null;
  const externalUrl = (r.source_url || r.externalUrl || null) as string | null;
  if (!title) return null;
  const category = (r.category as string) || inferCategory(title);
  return {
    id: String(r.id || externalUrl || `${title}-${Date.now()}`),
    title,
    brand: (r.brand as string) || "",
    price: (r.price as string) || "",
    category,
    imageUrl,
    externalUrl,
    storeName: (r.store_name as string) || (r.storeName as string) || null,
    platform: (r.platform as string) || null,
    styleTags: (r.style_tags as string[]) || (r.styleTags as string[]) || [],
    color: (r.color as string) || ((r.color_tags as string[]) || [])[0] || "",
    fit: (r.fit as string) || "regular",
    reason: (r.reason as string) || "",
  };
}
