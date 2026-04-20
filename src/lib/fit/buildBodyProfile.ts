// ─── BODY PROFILE NORMALIZER ────────────────────────────────────────────────
// Convert raw user measurements into normalized body proportions + a
// human-readable summary. Used by the garment fit map and prompt builder.

export interface RawBody {
  heightCm?: number | null;
  weightKg?: number | null;
  shoulderCm?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  inseamCm?: number | null;
  bodyType?: string | null;
}

export type BuildKind =
  | "lean"
  | "lean-athletic"
  | "athletic"
  | "regular"
  | "solid"
  | "fuller";

export interface BodyProfile {
  overallHeight: number;
  build: BuildKind;
  shoulderRatio: number;   // shoulder vs reference 44cm
  chestRatio: number;      // chest vs reference 96cm
  waistRatio: number;      // waist vs reference 80cm
  hipRatio: number;        // hip vs reference 94cm
  legRatio: number;        // inseam vs reference 78cm
  torsoRatio: number;      // derived: torso vs legs
  bmi: number | null;
  bodySummary: string;
}

const REF = {
  height: 172,
  weight: 68,
  shoulder: 44,
  chest: 96,
  waist: 80,
  hip: 94,
  inseam: 78,
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function inferBuild(bmi: number | null, shoulder: number): BuildKind {
  if (bmi == null) return "regular";
  if (bmi < 20) return "lean";
  if (bmi < 23) return shoulder >= 46 ? "lean-athletic" : "lean";
  if (bmi < 26) return shoulder >= 47 ? "athletic" : "regular";
  if (bmi < 29) return "solid";
  return "fuller";
}

function summarize(b: BodyProfile): string {
  const parts: string[] = [];
  parts.push(b.build.replace("-", " ") + " build");
  if (b.shoulderRatio >= 1.08) parts.push("broad shoulders");
  else if (b.shoulderRatio <= 0.94) parts.push("narrow shoulders");
  if (b.chestRatio - b.waistRatio >= 0.14) parts.push("tapered upper body");
  else if (b.waistRatio - b.chestRatio >= 0.05) parts.push("fuller midsection");
  if (b.legRatio >= 1.06) parts.push("longer legs");
  else if (b.legRatio <= 0.94) parts.push("shorter legs");
  return parts.join(", ");
}

export function buildBodyProfile(raw: RawBody): BodyProfile {
  const h = raw.heightCm ?? REF.height;
  const w = raw.weightKg ?? REF.weight;
  const shoulder = raw.shoulderCm ?? REF.shoulder;
  const chest = raw.chestCm ?? REF.chest;
  const waist = raw.waistCm ?? REF.waist;
  const hip = raw.hipCm ?? REF.hip;
  const inseam = raw.inseamCm ?? REF.inseam;

  const bmi = h && w ? w / Math.pow(h / 100, 2) : null;

  const profile: BodyProfile = {
    overallHeight: Math.round(h),
    build: inferBuild(bmi, shoulder),
    shoulderRatio: clamp(shoulder / REF.shoulder, 0.85, 1.2),
    chestRatio: clamp(chest / REF.chest, 0.85, 1.25),
    waistRatio: clamp(waist / REF.waist, 0.82, 1.3),
    hipRatio: clamp(hip / REF.hip, 0.85, 1.28),
    legRatio: clamp(inseam / REF.inseam, 0.9, 1.12),
    torsoRatio: 1, // filled below
    bmi: bmi != null ? Math.round(bmi * 10) / 10 : null,
    bodySummary: "",
  };
  // Torso ratio = (height - inseam) / inseam, normalized to a reference of ~1.20
  const torso = (h - inseam) / inseam / 1.2;
  profile.torsoRatio = clamp(torso, 0.85, 1.2);
  profile.bodySummary = summarize(profile);
  return profile;
}
