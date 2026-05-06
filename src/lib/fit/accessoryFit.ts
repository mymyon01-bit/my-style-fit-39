// ─── ACCESSORY FIT — V3.8 ──────────────────────────────────────────────────
// Bags / backpacks / hats / sunglasses don't fit by chest cm — they fit by
// proportion. Returns a one-line analysis copy + a balance class.

export type AccessoryBalance = "compact" | "balanced" | "oversized";

export interface AccessoryFitInput {
  /** Garment dimensions in cm — any subset is fine. */
  widthCm?: number | null;
  heightCm?: number | null;
  depthCm?: number | null;
  /** Strap drop (bag) in cm — used to predict where the bag sits. */
  strapDropCm?: number | null;

  /** User body. */
  bodyHeightCm?: number | null;
  bodyShoulderCm?: number | null;

  garmentType: "bag" | "backpack" | "hat" | "belt" | "sunglasses" | "jewelry" | "shoes" | "unknown";
}

export interface AccessoryFitResult {
  balance: AccessoryBalance;
  copy: string;
  /** 0–100 — how well the proportions feel on this frame. */
  score: number;
}

export function computeAccessoryFit(input: AccessoryFitInput): AccessoryFitResult {
  const { garmentType } = input;

  // Bags / backpacks: width vs shoulder, height vs torso.
  if (garmentType === "bag" || garmentType === "backpack") {
    const w = input.widthCm ?? null;
    const h = input.heightCm ?? null;
    const torso = input.bodyHeightCm ? input.bodyHeightCm * 0.32 : null;
    const shoulder = input.bodyShoulderCm ?? (input.bodyHeightCm ? input.bodyHeightCm * 0.255 : null);

    if (!w && !h) return { balance: "balanced", copy: "Bag dimensions unavailable.", score: 60 };

    let widthRatio = w && shoulder ? w / shoulder : null;     // 1.0 = same as shoulder width
    let heightRatio = h && torso ? h / torso : null;          // 1.0 = same as torso length

    let balance: AccessoryBalance = "balanced";
    let score = 80;
    const tooSmall = (widthRatio != null && widthRatio < 0.45) || (heightRatio != null && heightRatio < 0.4);
    const tooLarge = (widthRatio != null && widthRatio > 0.95) || (heightRatio != null && heightRatio > 0.85);
    if (tooSmall) { balance = "compact"; score = 70; }
    else if (tooLarge) { balance = "oversized"; score = 65; }

    const copy =
      balance === "compact"
        ? "This bag will look compact on your frame — works as a daily mini-shoulder bag."
        : balance === "oversized"
        ? "This bag will read as oversized on your frame — strong silhouette statement."
        : "This bag is well-proportioned to your frame.";
    return { balance, copy, score };
  }

  if (garmentType === "hat") {
    return { balance: "balanced", copy: "Hat sizing relies on head circumference — verify with brand chart.", score: 60 };
  }
  if (garmentType === "sunglasses") {
    return { balance: "balanced", copy: "Eyewear fit depends on face width — visual proportion only.", score: 60 };
  }
  if (garmentType === "belt") {
    return { balance: "balanced", copy: "Belt fit depends on waist circumference — verify with brand chart.", score: 60 };
  }
  return { balance: "balanced", copy: "Accessory proportion looks neutral on your frame.", score: 60 };
}
