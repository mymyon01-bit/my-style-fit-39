// ─── GARMENT DNA — V3.6 ────────────────────────────────────────────────────
// Inferential metadata model for any garment. Drives the fit-physics layer
// and gets injected into the visual prompt so the AI render reflects real
// fabric behavior (drape vs stiffness vs stretch) instead of guessing.
//
// Pure, deterministic, no I/O — safe for both web and edge runtimes.

export type GarmentMacroCategory =
  | "top" | "bottom" | "dress" | "outerwear" | "footwear" | "accessory" | "unknown";

export type GarmentType =
  // tops
  | "t-shirt" | "shirt" | "blouse" | "hoodie" | "sweater" | "jacket"
  | "coat" | "vest" | "tank-top" | "crop-top"
  // bottoms
  | "jeans" | "trousers" | "skirt" | "shorts" | "leggings" | "joggers" | "cargo"
  // dresses
  | "mini-dress" | "midi-dress" | "maxi-dress" | "bodycon-dress" | "loose-dress"
  // accessories
  | "bag" | "backpack" | "belt" | "hat" | "sunglasses" | "jewelry"
  // footwear
  | "shoes"
  | "unknown";

export type FabricType =
  | "cotton" | "denim" | "knit" | "wool" | "fleece" | "leather"
  | "silk" | "satin" | "linen" | "polyester" | "spandex" | "synthetic"
  | "unknown";

export type IntendedFit  = "slim" | "regular" | "relaxed" | "oversized";
export type Silhouette   = "tight" | "structured" | "regular" | "boxy" | "drapey";
export type FabricWeight = "light" | "medium" | "heavy";
export type Level3       = "low" | "medium" | "high";

export interface GarmentDNA {
  garmentType: GarmentType;
  category: GarmentMacroCategory;
  intendedFit: IntendedFit;
  silhouette: Silhouette;
  fabricType: FabricType;
  fabricWeight: FabricWeight;
  stiffness: Level3;
  elasticity: Level3;
  thickness: Level3;
  drapeLevel: Level3;
  stretchLevel: Level3;
  sleeveLength: "none" | "short" | "long";
  shoulderStructure: "structured" | "natural" | "dropped";
  waistbandBehavior: "rigid" | "flexible" | "elastic" | "none";
  riseType: "low" | "mid" | "high" | "none";
  inseamBehavior: "cropped" | "regular" | "long" | "none";
  oversizedRatio: number;        // 0–1 (0 = fitted, 1 = extreme oversized)
  compressionZones: string[];    // regions that hug the body
  wrinkleZones: string[];        // regions where wrinkles naturally form
  /** Best-effort confidence the inference engine has in this DNA. 0–1. */
  confidence: number;
  /** Whether physical measurements were available. */
  measurementConfidence: "exact" | "inferred" | "default";
}

export interface GarmentInferenceInput {
  name?: string | null;
  brand?: string | null;
  category?: string | null;        // discovery category (loose: "tops" / "bottoms" / etc.)
  description?: string | null;
  breadcrumb?: string | null;
  fitType?: string | null;
  hasSizeChart?: boolean;
}

const lower = (s?: string | null) => (s ?? "").toLowerCase();

const TYPE_PATTERNS: Array<[RegExp, GarmentType, GarmentMacroCategory]> = [
  // dresses first — they often contain "skirt"/"top" words
  [/\bbodycon\b/, "bodycon-dress", "dress"],
  [/\bmaxi\b.*\bdress\b|\bdress\b.*maxi/, "maxi-dress", "dress"],
  [/\bmidi\b.*\bdress\b/, "midi-dress", "dress"],
  [/\bmini\b.*\bdress\b/, "mini-dress", "dress"],
  [/\bdress\b|\bgown\b/, "loose-dress", "dress"],
  // tops
  [/\bhoodie\b|\bhooded\b/, "hoodie", "top"],
  [/\bsweater\b|\bjumper\b|\bknit\b|\bcardigan\b/, "sweater", "top"],
  [/\bblouse\b/, "blouse", "top"],
  [/\bshirt\b/, "shirt", "top"],
  [/\btee\b|\bt-shirt\b|\btshirt\b/, "t-shirt", "top"],
  [/\btank\b|\bcamisole\b/, "tank-top", "top"],
  [/\bcrop\b/, "crop-top", "top"],
  [/\bvest\b/, "vest", "top"],
  [/\bcoat\b|\bparka\b|\btrench\b/, "coat", "outerwear"],
  [/\bjacket\b|\bblazer\b|\bbomber\b/, "jacket", "outerwear"],
  // bottoms
  [/\bjeans?\b|\bdenim\b/, "jeans", "bottom"],
  [/\blegging/, "leggings", "bottom"],
  [/\bjogger/, "joggers", "bottom"],
  [/\bcargo/, "cargo", "bottom"],
  [/\bshorts?\b/, "shorts", "bottom"],
  [/\bskirt\b/, "skirt", "bottom"],
  [/\b(trouser|pants?|chino|slack)\b/, "trousers", "bottom"],
  // accessories / footwear
  [/\bbackpack\b/, "backpack", "accessory"],
  [/\b(bag|tote|clutch|crossbody)\b/, "bag", "accessory"],
  [/\bbelt\b/, "belt", "accessory"],
  [/\b(hat|cap|beanie)\b/, "hat", "accessory"],
  [/\b(sunglasses?|eyewear)\b/, "sunglasses", "accessory"],
  [/\b(necklace|earring|ring|bracelet|jewel)/, "jewelry", "accessory"],
  [/\b(shoe|sneaker|boot|heel|loafer|sandal|trainer)\b/, "shoes", "footwear"],
];

const FABRIC_PATTERNS: Array<[RegExp, FabricType]> = [
  [/\bdenim\b|\bjeans?\b/, "denim"],
  [/\bleather\b/, "leather"],
  [/\bwool\b/, "wool"],
  [/\bfleece\b/, "fleece"],
  [/\b(knit|cashmere|merino)\b/, "knit"],
  [/\bsatin\b/, "satin"],
  [/\bsilk\b/, "silk"],
  [/\blinen\b/, "linen"],
  [/\bspandex|elastane|lycra\b/, "spandex"],
  [/\bpolyester|nylon\b/, "polyester"],
  [/\bcotton\b/, "cotton"],
];

interface FabricProfile {
  fabricType: FabricType;
  fabricWeight: FabricWeight;
  stiffness: Level3;
  elasticity: Level3;
  thickness: Level3;
  drapeLevel: Level3;
  stretchLevel: Level3;
}

const FABRIC_DEFAULTS: Record<FabricType, FabricProfile> = {
  cotton:    { fabricType: "cotton",    fabricWeight: "medium", stiffness: "low",    elasticity: "medium", thickness: "medium", drapeLevel: "medium", stretchLevel: "medium" },
  denim:     { fabricType: "denim",     fabricWeight: "heavy",  stiffness: "high",   elasticity: "low",    thickness: "high",   drapeLevel: "low",    stretchLevel: "low" },
  knit:      { fabricType: "knit",      fabricWeight: "medium", stiffness: "low",    elasticity: "high",   thickness: "medium", drapeLevel: "medium", stretchLevel: "high" },
  wool:      { fabricType: "wool",      fabricWeight: "medium", stiffness: "medium", elasticity: "medium", thickness: "medium", drapeLevel: "medium", stretchLevel: "medium" },
  fleece:    { fabricType: "fleece",    fabricWeight: "heavy",  stiffness: "low",    elasticity: "medium", thickness: "high",   drapeLevel: "medium", stretchLevel: "medium" },
  leather:   { fabricType: "leather",   fabricWeight: "heavy",  stiffness: "high",   elasticity: "low",    thickness: "high",   drapeLevel: "low",    stretchLevel: "low" },
  silk:      { fabricType: "silk",      fabricWeight: "light",  stiffness: "low",    elasticity: "low",    thickness: "low",    drapeLevel: "high",   stretchLevel: "low" },
  satin:     { fabricType: "satin",     fabricWeight: "light",  stiffness: "low",    elasticity: "low",    thickness: "low",    drapeLevel: "high",   stretchLevel: "low" },
  linen:     { fabricType: "linen",     fabricWeight: "light",  stiffness: "medium", elasticity: "low",    thickness: "medium", drapeLevel: "medium", stretchLevel: "low" },
  polyester: { fabricType: "polyester", fabricWeight: "medium", stiffness: "low",    elasticity: "medium", thickness: "medium", drapeLevel: "medium", stretchLevel: "medium" },
  spandex:   { fabricType: "spandex",   fabricWeight: "light",  stiffness: "low",    elasticity: "high",   thickness: "low",    drapeLevel: "low",    stretchLevel: "high" },
  synthetic: { fabricType: "synthetic", fabricWeight: "medium", stiffness: "low",    elasticity: "medium", thickness: "medium", drapeLevel: "medium", stretchLevel: "medium" },
  unknown:   { fabricType: "unknown",   fabricWeight: "medium", stiffness: "low",    elasticity: "medium", thickness: "medium", drapeLevel: "medium", stretchLevel: "medium" },
};

// Type-driven defaults for fields fabric alone can't decide.
const TYPE_BEHAVIOR: Partial<Record<GarmentType, Partial<GarmentDNA>>> = {
  "t-shirt":   { sleeveLength: "short", shoulderStructure: "natural",    waistbandBehavior: "none",     riseType: "none", inseamBehavior: "none",     compressionZones: ["chest", "shoulder"],   wrinkleZones: ["waist", "underarm"] },
  "shirt":     { sleeveLength: "long",  shoulderStructure: "structured", waistbandBehavior: "none",     riseType: "none", inseamBehavior: "none",     compressionZones: ["shoulder", "chest"],   wrinkleZones: ["elbow", "waist"] },
  "blouse":    { sleeveLength: "long",  shoulderStructure: "natural",    waistbandBehavior: "none",     riseType: "none", inseamBehavior: "none",     compressionZones: ["chest"],               wrinkleZones: ["waist", "elbow"] },
  "hoodie":    { sleeveLength: "long",  shoulderStructure: "dropped",    waistbandBehavior: "elastic",  riseType: "none", inseamBehavior: "none",     compressionZones: ["wrist", "hem"],        wrinkleZones: ["torso", "underarm"] },
  "sweater":   { sleeveLength: "long",  shoulderStructure: "natural",    waistbandBehavior: "elastic",  riseType: "none", inseamBehavior: "none",     compressionZones: ["wrist", "hem"],        wrinkleZones: ["elbow"] },
  "jacket":    { sleeveLength: "long",  shoulderStructure: "structured", waistbandBehavior: "rigid",    riseType: "none", inseamBehavior: "none",     compressionZones: ["shoulder"],            wrinkleZones: ["elbow", "back"] },
  "coat":      { sleeveLength: "long",  shoulderStructure: "structured", waistbandBehavior: "rigid",    riseType: "none", inseamBehavior: "none",     compressionZones: ["shoulder"],            wrinkleZones: ["elbow", "back"] },
  "vest":      { sleeveLength: "none",  shoulderStructure: "structured", waistbandBehavior: "rigid",    riseType: "none", inseamBehavior: "none",     compressionZones: ["chest"],               wrinkleZones: [] },
  "tank-top":  { sleeveLength: "none",  shoulderStructure: "natural",    waistbandBehavior: "none",     riseType: "none", inseamBehavior: "none",     compressionZones: ["chest"],               wrinkleZones: ["waist"] },
  "crop-top":  { sleeveLength: "short", shoulderStructure: "natural",    waistbandBehavior: "none",     riseType: "none", inseamBehavior: "none",     compressionZones: ["chest"],               wrinkleZones: [] },
  "jeans":     { sleeveLength: "none",  shoulderStructure: "natural",    waistbandBehavior: "rigid",    riseType: "mid",  inseamBehavior: "regular",  compressionZones: ["thigh", "waist"],      wrinkleZones: ["knee", "rise"] },
  "trousers":  { sleeveLength: "none",  shoulderStructure: "natural",    waistbandBehavior: "flexible", riseType: "mid",  inseamBehavior: "regular",  compressionZones: ["waist"],               wrinkleZones: ["knee"] },
  "skirt":     { sleeveLength: "none",  shoulderStructure: "natural",    waistbandBehavior: "flexible", riseType: "mid",  inseamBehavior: "none",     compressionZones: ["waist", "hip"],        wrinkleZones: [] },
  "shorts":    { sleeveLength: "none",  shoulderStructure: "natural",    waistbandBehavior: "flexible", riseType: "mid",  inseamBehavior: "cropped",  compressionZones: ["waist"],               wrinkleZones: ["thigh"] },
  "leggings":  { sleeveLength: "none",  shoulderStructure: "natural",    waistbandBehavior: "elastic",  riseType: "high", inseamBehavior: "regular",  compressionZones: ["thigh", "calf", "waist"], wrinkleZones: ["knee"] },
  "joggers":   { sleeveLength: "none",  shoulderStructure: "natural",    waistbandBehavior: "elastic",  riseType: "mid",  inseamBehavior: "cropped",  compressionZones: ["ankle", "waist"],      wrinkleZones: ["knee", "rise"] },
  "cargo":     { sleeveLength: "none",  shoulderStructure: "natural",    waistbandBehavior: "rigid",    riseType: "mid",  inseamBehavior: "regular",  compressionZones: ["waist"],               wrinkleZones: ["knee", "thigh"] },
  "mini-dress":   { sleeveLength: "short", shoulderStructure: "natural", waistbandBehavior: "none",     riseType: "none", inseamBehavior: "cropped",  compressionZones: ["chest", "waist"],      wrinkleZones: ["hem"] },
  "midi-dress":   { sleeveLength: "short", shoulderStructure: "natural", waistbandBehavior: "none",     riseType: "none", inseamBehavior: "regular",  compressionZones: ["chest"],               wrinkleZones: ["hem"] },
  "maxi-dress":   { sleeveLength: "long",  shoulderStructure: "natural", waistbandBehavior: "none",     riseType: "none", inseamBehavior: "long",     compressionZones: ["chest"],               wrinkleZones: ["hem"] },
  "bodycon-dress":{ sleeveLength: "short", shoulderStructure: "natural", waistbandBehavior: "elastic",  riseType: "none", inseamBehavior: "cropped",  compressionZones: ["chest", "waist", "hip"], wrinkleZones: [] },
  "loose-dress":  { sleeveLength: "short", shoulderStructure: "dropped", waistbandBehavior: "none",     riseType: "none", inseamBehavior: "regular",  compressionZones: [],                      wrinkleZones: ["hem", "underarm"] },
};

function inferType(input: GarmentInferenceInput): { type: GarmentType; macro: GarmentMacroCategory; confidence: number } {
  const blob = `${lower(input.name)} ${lower(input.breadcrumb)} ${lower(input.description)} ${lower(input.category)}`;
  for (const [re, type, macro] of TYPE_PATTERNS) {
    if (re.test(blob)) return { type, macro, confidence: 0.9 };
  }
  // Fallback by category hint
  const cat = lower(input.category);
  if (cat.includes("bottom") || cat.includes("pant")) return { type: "trousers", macro: "bottom", confidence: 0.45 };
  if (cat.includes("dress")) return { type: "loose-dress", macro: "dress", confidence: 0.45 };
  if (cat.includes("shoe"))  return { type: "shoes",     macro: "footwear", confidence: 0.6 };
  if (cat.includes("bag"))   return { type: "bag",       macro: "accessory", confidence: 0.6 };
  if (cat.includes("top"))   return { type: "t-shirt",   macro: "top", confidence: 0.45 };
  return { type: "unknown", macro: "unknown", confidence: 0.2 };
}

function inferFabric(input: GarmentInferenceInput, type: GarmentType): { profile: FabricProfile; confidence: number } {
  const blob = `${lower(input.name)} ${lower(input.description)}`;
  for (const [re, fabric] of FABRIC_PATTERNS) {
    if (re.test(blob)) return { profile: FABRIC_DEFAULTS[fabric], confidence: 0.85 };
  }
  // Type-driven fallback
  const fallback: Record<GarmentType, FabricType> = {
    "t-shirt": "cotton", "shirt": "cotton", "blouse": "polyester", "hoodie": "fleece",
    "sweater": "knit", "jacket": "polyester", "coat": "wool", "vest": "polyester",
    "tank-top": "cotton", "crop-top": "cotton",
    "jeans": "denim", "trousers": "polyester", "skirt": "polyester", "shorts": "cotton",
    "leggings": "spandex", "joggers": "cotton", "cargo": "cotton",
    "mini-dress": "polyester", "midi-dress": "polyester", "maxi-dress": "polyester",
    "bodycon-dress": "spandex", "loose-dress": "polyester",
    "bag": "leather", "backpack": "polyester", "belt": "leather", "hat": "cotton",
    "sunglasses": "synthetic", "jewelry": "synthetic",
    "shoes": "synthetic",
    "unknown": "unknown",
  };
  return { profile: FABRIC_DEFAULTS[fallback[type] ?? "unknown"], confidence: 0.5 };
}

function inferIntendedFit(input: GarmentInferenceInput): { fit: IntendedFit; silhouette: Silhouette; oversizedRatio: number } {
  const hint = `${lower(input.name)} ${lower(input.description)} ${lower(input.fitType)}`;
  if (/oversized|baggy|loose/.test(hint))   return { fit: "oversized", silhouette: "boxy",      oversizedRatio: 0.85 };
  if (/relaxed|easy|drape/.test(hint))      return { fit: "relaxed",   silhouette: "drapey",    oversizedRatio: 0.55 };
  if (/slim|fitted|skinny|bodycon/.test(hint)) return { fit: "slim",   silhouette: "tight",     oversizedRatio: 0.1  };
  if (/structured|tailored/.test(hint))     return { fit: "regular",   silhouette: "structured",oversizedRatio: 0.3  };
  return { fit: "regular", silhouette: "regular", oversizedRatio: 0.35 };
}

export function extractGarmentDNA(input: GarmentInferenceInput): GarmentDNA {
  const { type, macro, confidence: typeConf } = inferType(input);
  const { profile, confidence: fabricConf } = inferFabric(input, type);
  const intent = inferIntendedFit(input);

  const behavior = TYPE_BEHAVIOR[type] ?? {};
  const dna: GarmentDNA = {
    garmentType: type,
    category: macro,
    intendedFit: intent.fit,
    silhouette: intent.silhouette,
    oversizedRatio: intent.oversizedRatio,
    fabricType: profile.fabricType,
    fabricWeight: profile.fabricWeight,
    stiffness: profile.stiffness,
    elasticity: profile.elasticity,
    thickness: profile.thickness,
    drapeLevel: profile.drapeLevel,
    stretchLevel: profile.stretchLevel,
    sleeveLength: behavior.sleeveLength ?? "none",
    shoulderStructure: behavior.shoulderStructure ?? "natural",
    waistbandBehavior: behavior.waistbandBehavior ?? "none",
    riseType: behavior.riseType ?? "none",
    inseamBehavior: behavior.inseamBehavior ?? "none",
    compressionZones: behavior.compressionZones ?? [],
    wrinkleZones: behavior.wrinkleZones ?? [],
    confidence: Math.round(((typeConf * 0.6 + fabricConf * 0.4)) * 100) / 100,
    measurementConfidence: input.hasSizeChart ? "exact" : "inferred",
  };
  return dna;
}

/** Short human-readable line for analysis copy / debug. */
export function describeGarmentDNA(d: GarmentDNA): string {
  const fabric = d.fabricType !== "unknown" ? d.fabricType : "fabric";
  return `${d.intendedFit} ${d.garmentType.replace(/-/g, " ")} · ${d.fabricWeight} ${fabric} · drape ${d.drapeLevel} · stretch ${d.stretchLevel}`;
}
