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

  const lines = [
    `A realistic ${persona.description} wearing ${productAnchor || desc}.`,
    `Use a consistent model identity across generations — do not randomize face, hair, or body. Persona: ${persona.id}.`,
    ``,
    `Body proportions:`,
    user.heightCm ? `- height: ${Math.round(user.heightCm)} cm` : `- height: average adult`,
    user.weightKg ? `- build: natural human proportions for ${Math.round(user.weightKg)} kg` : `- build: natural human proportions`,
    `- shoulders: ${shoulderDescriptor(user.shoulderWidthCm)}`,
    user.chestCm ? `- chest: ${Math.round(user.chestCm)} cm` : `- chest: proportional to body`,
    user.waistCm ? `- waist: ${Math.round(user.waistCm)} cm` : `- waist: proportional to body`,
    ``,
    `Garment:`,
    `- type: ${cat}`,
    `- description: ${desc}`,
    productAnchor ? `- visual: ${productAnchor}` : null,
    product.fitType ? `- fit: ${product.fitType}` : `- fit: as designed`,
    `- size: ${selectedSize}`,
    `- behavior: ${behavior}`,
    ``,
    `Visual:`,
    `- natural fabric drape with realistic wrinkles and folds`,
    `- correct garment scaling to body — size ${selectedSize} must be visibly distinct`,
    `- front-facing pose, full upper body visible`,
    `- neutral light studio background, soft fashion lighting`,
    ``,
    `Style: premium e-commerce look, photographic, no distortion.`,
    ``,
    `Negative: floating clothes, mannequin, headless body, duplicate limbs, warped body, random face change, fake logos, text artifacts, watermark, deformed hands.`,
  ];
  return lines.filter(Boolean).join("\n");
}
