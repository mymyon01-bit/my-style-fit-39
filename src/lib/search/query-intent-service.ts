export type QueryType = "product" | "brand" | "style" | "scenario" | "weather";

const BRANDS = [
  "gucci", "nike", "prada", "adidas", "zara", "uniqlo", "cos", "asos",
  "balenciaga", "new balance", "converse", "vans", "h&m", "mango",
  "arket", "muji", "acne", "stussy", "supreme", "carhartt",
  "the north face", "patagonia", "levi", "gap", "ralph lauren",
  "burberry", "saint laurent", "celine", "bottega veneta", "dior",
];

const PRODUCTS = [
  "jacket", "coat", "blazer", "shirt", "tee", "t-shirt", "hoodie", "sweater",
  "pants", "trousers", "jeans", "shorts", "skirt", "dress", "sneakers",
  "boots", "shoes", "loafers", "sandals", "bag", "tote", "backpack",
  "hat", "cap", "scarf", "belt", "watch",
];

const WEATHER = ["rain", "rainy", "snow", "snowy", "winter", "summer", "spring", "fall", "autumn", "humid", "cold", "hot"];

const SCENARIOS = ["outfit", "vacation", "date", "wedding", "office", "gym", "travel", "beach", "party", "festival", "interview", "brunch"];

export function classifyQuery(query: string): QueryType {
  const q = query.toLowerCase();
  if (BRANDS.some((b) => q.includes(b))) return "brand";
  if (PRODUCTS.some((p) => new RegExp(`\\b${p}\\b`).test(q))) return "product";
  if (WEATHER.some((w) => q.includes(w))) return "weather";
  if (SCENARIOS.some((s) => q.includes(s))) return "scenario";
  return "style";
}
