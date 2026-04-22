// ─── CANONICAL PRODUCT IMAGE RESOLVER ──────────────────────────────────────
// Single source of truth for resolving a usable garment image across the
// FIT pipeline. Every component that needs a product image (FitProductCheck,
// FitPage deep-link, FitResults, FitVisual, FitTryOnTrigger, modal) MUST go
// through this helper.
//
// Priority:
//   1. Explicit primary image (`image` / `image_url`)
//   2. First entry in `images[]` / `image_urls[]`
//   3. `thumbnail` / `thumbnail_url`
//   4. `merchant_image` / `cached_image_url`
//   5. Synthesized demo placeholder (data URI SVG) for mock products
//   6. null (truly unrecoverable)

export interface ResolvableProduct {
  id?: string | null;
  name?: string | null;
  brand?: string | null;
  image?: string | null;
  image_url?: string | null;
  images?: (string | null | undefined)[] | null;
  image_urls?: (string | null | undefined)[] | null;
  thumbnail?: string | null;
  thumbnail_url?: string | null;
  merchant_image?: string | null;
  cached_image_url?: string | null;
  source?: "mock" | "db" | string | null;
}

export interface ResolvedProductImage {
  src: string | null;
  source:
    | "primary"
    | "images_array"
    | "thumbnail"
    | "merchant"
    | "synthesized"
    | "none";
  candidates: number;
}

const isUsable = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 8 && value !== "#";

/**
 * Build a deterministic SVG placeholder so a mock/demo product still gives the
 * preview pipeline something to render. Encoded as a data URI so it works
 * without any network request and survives caching.
 */
function synthesizePlaceholder(product: ResolvableProduct): string {
  const initial = (product.name?.trim()?.charAt(0) || product.brand?.trim()?.charAt(0) || "?").toUpperCase();
  const label = (product.name || "Product").slice(0, 28);
  // Soft brand-neutral palette aligned with our dark theme tokens.
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1c1a24"/>
      <stop offset="100%" stop-color="#0f0d14"/>
    </linearGradient>
  </defs>
  <rect width="600" height="800" fill="url(#g)"/>
  <g fill="#a78bfa" opacity="0.9" font-family="Georgia, serif">
    <text x="300" y="380" font-size="220" font-weight="600" text-anchor="middle">${initial}</text>
  </g>
  <g fill="#ffffff" opacity="0.55" font-family="Inter, sans-serif">
    <text x="300" y="500" font-size="22" letter-spacing="6" text-anchor="middle">${label.toUpperCase()}</text>
    <text x="300" y="540" font-size="14" letter-spacing="4" text-anchor="middle" opacity="0.6">DEMO PREVIEW</text>
  </g>
</svg>`.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function resolveBestProductImage(product: ResolvableProduct | null | undefined): ResolvedProductImage {
  if (!product) return { src: null, source: "none", candidates: 0 };

  const candidates: { src: string; source: ResolvedProductImage["source"] }[] = [];

  if (isUsable(product.image)) candidates.push({ src: product.image!, source: "primary" });
  if (isUsable(product.image_url)) candidates.push({ src: product.image_url!, source: "primary" });

  for (const arr of [product.images, product.image_urls]) {
    if (Array.isArray(arr)) {
      for (const v of arr) {
        if (isUsable(v)) candidates.push({ src: v, source: "images_array" });
      }
    }
  }

  if (isUsable(product.thumbnail)) candidates.push({ src: product.thumbnail!, source: "thumbnail" });
  if (isUsable(product.thumbnail_url)) candidates.push({ src: product.thumbnail_url!, source: "thumbnail" });
  if (isUsable(product.merchant_image)) candidates.push({ src: product.merchant_image!, source: "merchant" });
  if (isUsable(product.cached_image_url)) candidates.push({ src: product.cached_image_url!, source: "merchant" });

  if (candidates.length > 0) {
    const pick = candidates[0];
    return { src: pick.src, source: pick.source, candidates: candidates.length };
  }

  // Synthesized fallback — mock/demo products and DB rows with no image still
  // get a renderable asset so the FIT pipeline never dies.
  if (product.source === "mock" || product.name) {
    return { src: synthesizePlaceholder(product), source: "synthesized", candidates: 0 };
  }

  return { src: null, source: "none", candidates: 0 };
}

/** Convenience: just the URL, with optional structured logging. */
export function bestProductImage(
  product: ResolvableProduct | null | undefined,
  logTag?: string
): string | null {
  const r = resolveBestProductImage(product);
  if (logTag) {
    console.log("[FIT_PREVIEW]", {
      event: "resolve_product_image",
      tag: logTag,
      productId: product?.id ?? null,
      productName: product?.name ?? null,
      source: r.source,
      candidates: r.candidates,
      hasImage: !!r.src,
    });
  }
  return r.src;
}
