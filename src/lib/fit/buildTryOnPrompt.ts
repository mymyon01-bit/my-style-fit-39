// ─── TRY-ON PROMPT BUILDER ──────────────────────────────────────────────────
// Builds a structured natural-language prompt for text→image try-on
// generation. Used by the text-prompt fallback path (no body photo).

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
  const s = (size || "M").toUpperCase();
  if (s === "XS") return "very tight fit, snug across chest and shoulders, short cropped length";
  if (s === "S") return "tight fit, snug chest, shorter length, no excess fabric";
  if (s === "M") return "regular fit, balanced proportions, natural drape";
  if (s === "L") return "slightly loose fit, relaxed chest, mild shoulder drop, soft folds at waist";
  if (s === "XL") return "oversized fit, loose body, dropped shoulders, longer length, generous drape";
  if (s === "XXL") return "very oversized fit, baggy chest and hem, fully dropped shoulders, extra length";
  return "regular fit, balanced proportions, natural drape";
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

export function buildTryOnPrompt(args: {
  user: TryOnUserBody;
  product: TryOnProductInfo;
  selectedSize: string;
}): string {
  const { user, product, selectedSize } = args;
  const behavior = sizeToBehavior(selectedSize);
  const cat = (product.category || "garment").toLowerCase();
  const desc = buildDescriptor(product);

  const lines = [
    `A realistic fashion model wearing ${desc}.`,
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
    product.fitType ? `- fit: ${product.fitType}` : `- fit: as designed`,
    `- size: ${selectedSize}`,
    `- behavior: ${behavior}`,
    ``,
    `Visual:`,
    `- natural fabric drape`,
    `- realistic wrinkles and fabric folds`,
    `- correct garment scaling to body`,
    `- front-facing pose, full upper body visible`,
    `- neutral light studio background`,
    `- soft fashion lighting`,
    ``,
    `Style: premium e-commerce look, realistic human model, photographic, no distortion.`,
    ``,
    `Negative: floating clothes, mannequin, headless body, duplicate limbs, warped body, fake logos, text artifacts, watermark, deformed hands.`,
  ];
  return lines.filter(Boolean).join("\n");
}
