// ─── TRY-ON PROMPT BUILDER ──────────────────────────────────────────────────
// Builds a structured natural-language prompt for text→image try-on
// generation. Used by the text-prompt fallback path (no body photo).
//
// Identity: a fixed "house model" persona is injected so faces/bodies stay
// consistent across generations (PATCH 1).
// Size: amplified visual differentiation (PATCH 2).
// Product anchor: visual descriptor extracted from title/category (PATCH 3).

import { pickPersona, sizeBehaviorStrong } from "./personas";

export interface TryOnUserBody {
  heightCm?: number | null;
  weightKg?: number | null;
  shoulderWidthCm?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  gender?: "female" | "male" | "neutral" | null;
}

export interface TryOnProductInfo {
  title: string;
  category?: string | null;
  fitType?: string | null;
}

export type SizeToken = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export function sizeToBehavior(size: string): string {
  // Kept for backward compat; new code should use sizeBehaviorStrong.
  return sizeBehaviorStrong(size);
}

function shoulderDescriptor(shoulderCm?: number | null): string {
  if (!shoulderCm) return "natural shoulder width";
  if (shoulderCm >= 48) return "broad shoulders";
  if (shoulderCm <= 40) return "narrow shoulders";
  return "average shoulders";
}

/** Natural-language body summary derived from raw metrics. */
function buildBodySummary(u: TryOnUserBody): string {
  const h = u.heightCm ?? null;
  const w = u.weightKg ?? null;
  const bmi = h && w ? w / Math.pow(h / 100, 2) : null;
  const parts: string[] = [];
  if (h) {
    if (h >= 180) parts.push("tall");
    else if (h <= 165) parts.push("compact");
    else parts.push("average height");
  }
  if (bmi != null) {
    if (bmi < 21) parts.push("lean build");
    else if (bmi < 25) parts.push("athletic build");
    else if (bmi < 28) parts.push("solid build");
    else parts.push("fuller build");
  }
  if (u.shoulderWidthCm && u.shoulderWidthCm >= 48) parts.push("slightly broad shoulders");
  if (u.chestCm && u.waistCm && u.chestCm - u.waistCm >= 14) parts.push("tapered upper body");
  return parts.length ? parts.join(", ") : "natural adult proportions";
}

function buildDescriptor(p: TryOnProductInfo): string {
  // Strip brand-y cruft, keep visual descriptors only.
  const t = p.title.replace(/\s*[-–|]\s*.+$/g, "").trim();
  return t.slice(0, 110);
}

/** PATCH 3 — extract visual descriptors from product title/category. */
function buildProductAnchor(p: TryOnProductInfo): string {
  const txt = `${p.title} ${p.category ?? ""}`.toLowerCase();
  const colors = ["black","white","navy","blue","red","green","beige","cream","grey","gray","brown","pink","yellow","purple","olive","khaki","ivory"]
    .filter((c) => txt.includes(c));
  const patterns = ["striped","plaid","check","floral","graphic","print","logo","plain","ribbed","knit","denim","leather","suede","linen","cotton","wool","silk"]
    .filter((p2) => txt.includes(p2));
  const garmentHints = ["t-shirt","tee","shirt","blouse","sweater","hoodie","jacket","coat","blazer","dress","skirt","pants","jeans","shorts","cardigan","trench"]
    .filter((g) => txt.includes(g));

  const parts: string[] = [];
  if (colors.length) parts.push(colors.slice(0, 2).join(" and "));
  if (patterns.length) parts.push(patterns.slice(0, 2).join(", "));
  if (garmentHints.length) parts.push(garmentHints[0]);
  return parts.join(" ");
}

export function buildTryOnPrompt(args: {
  user: TryOnUserBody;
  product: TryOnProductInfo;
  selectedSize: string;
  recommendedSize?: string;
}): string {
  const { user, product, selectedSize, recommendedSize } = args;
  const behavior = sizeBehaviorStrong(selectedSize, recommendedSize);
  const cat = (product.category || "garment").toLowerCase();
  const desc = buildDescriptor(product);
  const persona = pickPersona({
    gender: user.gender ?? null,
    heightCm: user.heightCm ?? null,
    weightKg: user.weightKg ?? null,
  });
  const productAnchor = buildProductAnchor(product);

  const bodySummary = buildBodySummary(user);

  const lines = [
    `A premium fashion e-commerce photo of a ${persona.description} wearing the garment.`,
    `Persona identity: ${persona.id} (keep face, hair, body consistent — do not randomize).`,
    ``,
    `Garment:`,
    `- type: ${cat}`,
    `- description: ${desc}`,
    productAnchor ? `- visual cues: ${productAnchor}` : null,
    product.fitType ? `- designed fit: ${product.fitType}` : null,
    `- selected size: ${selectedSize}`,
    `- size-specific fit behavior: ${behavior}`,
    productAnchor ? `Reference product image must be respected as closely as possible (color, pattern, silhouette, fabric).` : `No reference image provided — render the garment based on the description and the body metrics below.`,
    ``,
    `Body:`,
    `- ${bodySummary}`,
    user.heightCm ? `- height ~${Math.round(user.heightCm)} cm` : null,
    user.weightKg ? `- weight ~${Math.round(user.weightKg)} kg` : null,
    `- shoulders: ${shoulderDescriptor(user.shoulderWidthCm)}`,
    ``,
    `Style:`,
    `- clean neutral studio background`,
    `- soft fashion lighting, natural fabric drape and realistic folds`,
    `- front-facing or 3/4 standing pose, full upper body visible`,
    `- editorial but commercial, premium e-commerce look`,
    ``,
    `Do NOT generate: mannequin, floating clothes, headless body, duplicate limbs, warped torso, random face change, fake logos, text artifacts, watermark, deformed hands, flat product card overlay.`,
  ];
  return lines.filter(Boolean).join("\n");
}
