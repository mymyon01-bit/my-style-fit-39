// ─── BODY DNA — locked body signature ──────────────────────────────────────
// MYMYON FIT V3.5: produces a deterministic signature for the user's body
// configuration. The signature is appended to the try-on cache key so that
// every (body + garment + size) combination is a stable, reusable cell.
//
// Result: when the user switches between sizes the BODY part of the key is
// constant, and only the size segment changes. Two different bodies on the
// same garment NEVER collide. The same body on a refreshed session always
// re-reads the cached image.

export interface BodyDNAInput {
  heightCm?: number | null;
  weightKg?: number | null;
  gender?: string | null;
  shoulderCm?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  inseamCm?: number | null;
  bodyImageUrl?: string | null;
}

export interface BodyDNA {
  signature: string;     // short stable hash — used in cache keys
  accuracy: number;      // 0–100 confidence in the locked body signal
  filledFields: number;  // count of non-null measurements
}

const round5 = (n: number | null | undefined) => (n ? Math.round(n / 5) * 5 : 0);
const norm = (s: string | null | undefined) => (s ? s.toLowerCase().trim().slice(0, 8) : "_");

// FNV-1a 32-bit — fast, tiny, deterministic. No crypto needed for cache keys.
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36).padStart(7, "0");
}

export function computeBodyDNA(input: BodyDNAInput): BodyDNA {
  const fields = [
    `g:${norm(input.gender)}`,
    `h:${round5(input.heightCm)}`,
    `w:${round5(input.weightKg)}`,
    `sh:${round5(input.shoulderCm)}`,
    `ch:${round5(input.chestCm)}`,
    `wa:${round5(input.waistCm)}`,
    `hi:${round5(input.hipCm)}`,
    `in:${round5(input.inseamCm)}`,
    `img:${input.bodyImageUrl ? "y" : "n"}`,
  ];
  const signature = fnv1a(fields.join("|"));

  // Body Accuracy Score — what % of the lock signal is filled.
  const optional = [
    input.shoulderCm, input.chestCm, input.waistCm, input.hipCm, input.inseamCm,
  ];
  const filledOptional = optional.filter((v) => !!v && v > 0).length;
  const filledFields = filledOptional
    + (input.heightCm ? 1 : 0)
    + (input.weightKg ? 1 : 0)
    + (input.gender ? 1 : 0)
    + (input.bodyImageUrl ? 1 : 0);

  // Weighting: image=25, height=20, weight=20, gender=10, each measure=5.
  let score = 0;
  if (input.heightCm)     score += 20;
  if (input.weightKg)     score += 20;
  if (input.gender)       score += 10;
  if (input.bodyImageUrl) score += 25;
  score += filledOptional * 5;
  const accuracy = Math.min(100, score);

  return { signature, accuracy, filledFields };
}
