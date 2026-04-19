// Map a product category/title/tags to a 3D garment template type.
export type GarmentType = "top" | "outerwear" | "bottom" | "full";

const TOP = ["t-shirt","tshirt","tee","top","shirt","blouse","knit","sweater","sweatshirt","hoodie","tank","crop"];
const OUTER = ["jacket","coat","blazer","outerwear","parka","puffer","cardigan","trench"];
const BOTTOM = ["pant","pants","trouser","jean","jeans","short","shorts","skirt","legging","chino"];
const FULL = ["dress","jumpsuit","romper","overall","gown","set"];

export function getGarmentType(input: {
  category?: string | null;
  name?: string | null;
  tags?: string[] | null;
}): GarmentType {
  const haystack = [
    input.category ?? "",
    input.name ?? "",
    ...(input.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  // Outerwear is checked first — "denim jacket" must beat "denim".
  if (OUTER.some((k) => haystack.includes(k))) return "outerwear";
  if (FULL.some((k) => haystack.includes(k))) return "full";
  if (BOTTOM.some((k) => haystack.includes(k))) return "bottom";
  if (TOP.some((k) => haystack.includes(k))) return "top";

  // Sensible default: most fashion catalog items are tops.
  return "top";
}

/** Suggest a simple sub-template for richer 3D shape. */
export function getGarmentSubtype(input: {
  category?: string | null;
  name?: string | null;
}): "tee" | "hoodie" | "jacket" | "pants" | "dress" {
  const h = `${input.category ?? ""} ${input.name ?? ""}`.toLowerCase();
  if (h.includes("hood")) return "hoodie";
  if (h.includes("jacket") || h.includes("coat") || h.includes("blazer")) return "jacket";
  if (h.includes("dress") || h.includes("jumpsuit") || h.includes("gown")) return "dress";
  if (h.includes("pant") || h.includes("jean") || h.includes("trouser") || h.includes("short") || h.includes("skirt")) return "pants";
  return "tee";
}
