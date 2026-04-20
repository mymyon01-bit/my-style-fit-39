// ─── GARMENT CUTOUT CACHE ──────────────────────────────────────────────────
// Wraps the existing `cutout-product` edge function with:
//  • per-(productImageUrl) localStorage cache (keyed by hash of URL)
//  • in-memory promise dedup so concurrent callers share one network call
//  • silent fallback to the original product image if cutout fails
//
// Returns a URL the canvas compositor can draw with crossOrigin="anonymous".

import { supabase } from "@/integrations/supabase/client";

const MEM_CACHE = new Map<string, string>();
const INFLIGHT = new Map<string, Promise<string>>();
const STORAGE_PREFIX = "fit-cutout::v1::";

function shortHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function readStorage(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_PREFIX + key) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    // Data URLs can be huge — cap stored value to ~2MB to avoid quota errors.
    if (value.length > 2_000_000) return;
    window.localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch {
    // ignore quota
  }
}

export async function getGarmentCutout(
  imageUrl: string,
  productName?: string
): Promise<string> {
  if (!imageUrl) return imageUrl;
  const key = shortHash(imageUrl);

  const mem = MEM_CACHE.get(key);
  if (mem) return mem;

  const stored = readStorage(key);
  if (stored) {
    MEM_CACHE.set(key, stored);
    return stored;
  }

  const inflight = INFLIGHT.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("cutout-product", {
        body: { imageUrl, productName },
      });
      if (error) throw error;
      const url = data?.cutoutUrl;
      if (typeof url === "string" && url.length > 0) {
        MEM_CACHE.set(key, url);
        writeStorage(key, url);
        return url;
      }
      throw new Error("no_cutout_url");
    } catch (err) {
      console.warn("[garmentCutoutCache] fallback to original image", err);
      // Fallback: original image — compositor will draw it with multiply blend.
      MEM_CACHE.set(key, imageUrl);
      return imageUrl;
    } finally {
      INFLIGHT.delete(key);
    }
  })();

  INFLIGHT.set(key, promise);
  return promise;
}
