// ─── PRODUCT IMAGE RESOLVER ────────────────────────────────────────────────
// Used by FIT to recover a usable product image when `product.image` is
// missing, empty, or returns 404. Tries cheap local sources first, then
// falls back to og:image scraping via the existing commerce-scraper edge
// function. Returns null if nothing usable can be found — caller MUST block
// the try-on in that case.

import { supabase } from "@/integrations/supabase/client";

export interface ResolvableProduct {
  id?: string;
  image?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  images?: (string | null | undefined)[] | null;
  url?: string | null;
  source_url?: string | null;
  category?: string | null;
}

const PLACEHOLDER_BY_CATEGORY: Record<string, string> = {
  top: "/placeholder.svg",
  shirt: "/placeholder.svg",
  tee: "/placeholder.svg",
  jacket: "/placeholder.svg",
  bottom: "/placeholder.svg",
  pants: "/placeholder.svg",
  jeans: "/placeholder.svg",
  dress: "/placeholder.svg",
  default: "/placeholder.svg",
};

function isUsableUrl(u: string | null | undefined): u is string {
  if (!u) return false;
  const s = String(u).trim();
  if (!s) return false;
  if (s === "null" || s === "undefined") return false;
  if (s.startsWith("data:image/")) return true;
  return /^https?:\/\//i.test(s);
}

async function headOk(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    // Many CDNs reject HEAD; try GET with no-cors as best-effort.
    const r = await fetch(url, { method: "GET", mode: "no-cors", signal: ctl.signal });
    clearTimeout(t);
    // no-cors → opaque response; status is 0 but the request succeeded.
    return r.type === "opaque" || r.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve a usable image URL for a product. Returns:
 *   { url, source }  — usable image found
 *   null             — no recoverable image, FIT must be blocked
 */
export async function resolveProductImage(
  product: ResolvableProduct
): Promise<{ url: string; source: "direct" | "images_array" | "og_scrape" | "placeholder" } | null> {
  // 1. Direct fields
  const direct =
    product.image_url || product.imageUrl || product.image || null;
  if (isUsableUrl(direct) && (await headOk(direct))) {
    return { url: direct, source: "direct" };
  }

  // 2. images[] array
  if (Array.isArray(product.images)) {
    for (const candidate of product.images) {
      if (isUsableUrl(candidate) && (await headOk(candidate))) {
        return { url: candidate, source: "images_array" };
      }
    }
  }

  // 3. og:image scrape via commerce-scraper edge function
  const productUrl = product.url || product.source_url;
  if (productUrl && /^https?:\/\//i.test(productUrl)) {
    try {
      const { data } = await supabase.functions.invoke("commerce-scraper", {
        body: { url: productUrl, mode: "image-only" },
      });
      const scraped = (data?.image_url || data?.imageUrl || data?.image) as string | undefined;
      if (isUsableUrl(scraped) && (await headOk(scraped))) {
        return { url: scraped, source: "og_scrape" };
      }
    } catch (e) {
      console.warn("[resolveProductImage] scrape failed", e);
    }
  }

  // 4. No recovery possible — caller MUST block FIT
  console.warn("[resolveProductImage] no usable image", { id: product.id, url: productUrl });
  return null;
}

export function placeholderFor(category?: string | null): string {
  const key = (category || "default").toLowerCase();
  return PLACEHOLDER_BY_CATEGORY[key] || PLACEHOLDER_BY_CATEGORY.default;
}
