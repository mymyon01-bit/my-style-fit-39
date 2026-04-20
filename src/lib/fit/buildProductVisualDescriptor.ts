// ─── PRODUCT VISUAL DESCRIPTOR ──────────────────────────────────────────────
// Convert title/category/description into a stable visual descriptor used
// inside the FIT generation prompt.

export interface ProductInput {
  title: string;
  category?: string | null;
  description?: string | null;
  brand?: string | null;
  fitType?: string | null;
  material?: string | null;
}

export interface ProductVisualDescriptor {
  garmentType: string;
  color: string | null;
  printPlacement: string | null;
  fabricWeight: string | null;
  styleMood: string;
  visualSummary: string;
}

const COLORS = [
  "black", "white", "ivory", "cream", "beige", "tan", "khaki", "olive",
  "brown", "chocolate", "navy", "blue", "denim", "indigo", "teal", "green",
  "mint", "yellow", "mustard", "orange", "red", "burgundy", "pink", "rose",
  "purple", "lilac", "grey", "gray", "charcoal", "silver",
];

const GARMENT_HINTS: Array<[RegExp, string]> = [
  [/(long sleeve)\s*(graphic|print|logo)?\s*(t-?shirt|tee)/i, "long sleeve graphic tee"],
  [/(t-?shirt|tee)/i, "t-shirt"],
  [/(blouse)/i, "blouse"],
  [/(button[- ]?down|oxford|dress shirt|shirt)/i, "shirt"],
  [/(hoodie|hooded)/i, "hoodie"],
  [/(sweatshirt|crewneck)/i, "sweatshirt"],
  [/(sweater|knit|cardigan|pullover)/i, "sweater"],
  [/(blazer|sport coat|suit jacket)/i, "blazer"],
  [/(trench)/i, "trench coat"],
  [/(parka|puffer|down jacket)/i, "puffer jacket"],
  [/(jacket|coat)/i, "jacket"],
  [/(dress)/i, "dress"],
  [/(skirt)/i, "skirt"],
  [/(jeans)/i, "jeans"],
  [/(shorts)/i, "shorts"],
  [/(pants|trouser|chino|slacks)/i, "pants"],
];

const STYLE_MOODS: Array<[RegExp, string]> = [
  [/(streetwear|street|graphic|skate|hype)/i, "streetwear"],
  [/(minimal|clean|essential|basic)/i, "minimalist"],
  [/(formal|tailored|business)/i, "tailored"],
  [/(athletic|sport|gym|active|performance)/i, "athletic"],
  [/(vintage|retro|90s|y2k)/i, "vintage"],
  [/(luxury|premium|silk|cashmere)/i, "luxury"],
];

const FABRIC_WEIGHTS: Array<[RegExp, string]> = [
  [/(heavyweight|heavy|thick|fleece)/i, "heavy"],
  [/(midweight|medium|jersey)/i, "medium"],
  [/(lightweight|light|sheer|fine)/i, "light"],
  [/(silk|satin|chiffon)/i, "fluid"],
  [/(denim|canvas|twill)/i, "structured"],
  [/(linen|cotton)/i, "breathable"],
  [/(wool|cashmere|knit)/i, "knit"],
];

function findColor(text: string): string | null {
  for (const c of COLORS) {
    if (new RegExp(`\\b${c}\\b`, "i").test(text)) return c;
  }
  return null;
}

function findGarment(text: string): string {
  for (const [re, label] of GARMENT_HINTS) if (re.test(text)) return label;
  return "garment";
}

function findStyleMood(text: string): string {
  for (const [re, label] of STYLE_MOODS) if (re.test(text)) return label;
  return "modern casual";
}

function findFabric(text: string, materialHint?: string | null): string | null {
  const combined = `${text} ${materialHint ?? ""}`;
  for (const [re, label] of FABRIC_WEIGHTS) if (re.test(combined)) return label;
  return null;
}

function findPrintPlacement(text: string): string | null {
  if (/(chest (graphic|print|logo)|centered (print|graphic))/i.test(text)) return "centered chest graphic";
  if (/(back (print|graphic|logo))/i.test(text)) return "back print";
  if (/(allover|all-over|repeat)/i.test(text)) return "all-over print";
  if (/(stripe[ds]?)/i.test(text)) return "stripes";
  if (/(check|plaid|tartan)/i.test(text)) return "check pattern";
  if (/(floral)/i.test(text)) return "floral pattern";
  if (/(graphic|print|logo)/i.test(text)) return "front graphic";
  return null;
}

export function buildProductVisualDescriptor(p: ProductInput): ProductVisualDescriptor {
  const text = `${p.title || ""} ${p.description || ""} ${p.category || ""}`.toLowerCase();
  const garmentType = findGarment(text);
  const color = findColor(text);
  const printPlacement = findPrintPlacement(text);
  const fabricWeight = findFabric(text, p.material);
  const styleMood = findStyleMood(text);

  const summaryParts: string[] = [];
  if (color) summaryParts.push(color);
  if (fabricWeight) summaryParts.push(fabricWeight);
  summaryParts.push(garmentType);
  if (printPlacement) summaryParts.push(`with ${printPlacement}`);
  const visualSummary = summaryParts.join(" ").trim() || (p.title || "garment").slice(0, 100);

  return {
    garmentType,
    color,
    printPlacement,
    fabricWeight,
    styleMood,
    visualSummary,
  };
}
