/**
 * WARDROBE Recommendation Engine
 * 
 * Weighted scoring system:
 * - Core User Profile Score (0.24)
 * - Body Compatibility Score (0.22)
 * - Context Score (0.16)
 * - Behavior Score (0.20)
 * - Social/Trend Score (0.10)
 * - Purchase Intent Score (0.08)
 */

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  category: "clothing" | "bags" | "shoes" | "accessories" | "tops" | "bottoms" | "outerwear";
  fitScore: number;
  reason: string;
  recommendedSize: string;
  fitComment: string;
  url: string;
  source_url?: string | null;
  store_name?: string | null;
  platform?: string | null;
}

// --- Types ---

export interface UserProfile {
  preferredStyles: string[];
  dislikedStyles: string[];
  preferredFit: string;
  budgetRange: string;
  favoriteBrands: string[];
}

export interface BodyProfile {
  silhouetteType: "athletic" | "straight" | "inverted-triangle" | "pear" | "balanced";
  shoulderWidth: number; // cm
  waist: number;
  hips: number;
  torsoLegRatio: number; // >1 = longer torso
  height: number;
}

export interface ContextData {
  weather: { temp: number; condition: string };
  mood: string | null;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  season: "spring" | "summer" | "fall" | "winter";
}

export interface BehaviorData {
  likedProductIds: string[];
  savedProductIds: string[];
  viewedProductIds: string[];
  skippedProductIds: string[];
  starredOOTDIds: string[];
}

export interface ProductScoreBreakdown {
  coreProfile: number;
  bodyCompat: number;
  context: number;
  behavior: number;
  social: number;
  purchaseIntent: number;
  final: number;
  explanation: string;
}

// --- Weights ---
const WEIGHTS = {
  coreProfile: 0.24,
  bodyCompat: 0.22,
  context: 0.16,
  behavior: 0.20,
  social: 0.10,
  purchaseIntent: 0.08,
};

// --- Style-to-product mapping ---
const STYLE_PRODUCT_MAP: Record<string, string[]> = {
  minimal: ["COS", "ARKET", "Lemaire"],
  streetwear: ["Our Legacy", "AMI Paris"],
  classic: ["COS", "AMI Paris", "Lemaire"],
  oldMoney: ["COS", "Lemaire", "ARKET"],
  chic: ["AMI Paris", "Lemaire"],
  cleanFit: ["COS", "ARKET"],
  sporty: ["Our Legacy"],
};

// --- Category-to-weather mapping ---
const WEATHER_CATEGORY_AFFINITY: Record<string, Record<string, number>> = {
  hot: { tops: 0.7, bottoms: 0.8, outerwear: 0.1, shoes: 0.6, accessories: 0.8 },
  warm: { tops: 0.8, bottoms: 0.9, outerwear: 0.3, shoes: 0.7, accessories: 0.7 },
  cool: { tops: 0.9, bottoms: 0.9, outerwear: 0.8, shoes: 0.8, accessories: 0.6 },
  cold: { tops: 0.6, bottoms: 0.7, outerwear: 1.0, shoes: 0.9, accessories: 0.5 },
};

// --- Mood-to-style affinity ---
const MOOD_STYLE_AFFINITY: Record<string, string[]> = {
  relaxed2: ["minimal", "cleanFit"],
  confident: ["classic", "chic", "oldMoney"],
  casual: ["cleanFit", "minimal", "streetwear"],
  sharp: ["classic", "oldMoney", "chic"],
  lazy: ["minimal", "cleanFit"],
  dateReady: ["chic", "classic", "oldMoney"],
  energetic: ["streetwear", "sporty"],
  creative: ["streetwear", "chic"],
};

// --- Scoring Functions ---

function computeCoreProfileScore(product: Product, profile: UserProfile): number {
  let score = 50; // baseline

  // Brand preference boost
  if (profile.favoriteBrands.includes(product.brand)) score += 25;

  // Style alignment via brand
  const alignedStyles = profile.preferredStyles.filter(
    s => STYLE_PRODUCT_MAP[s]?.includes(product.brand)
  );
  score += alignedStyles.length * 12;

  // Disliked style penalty
  const dislikedMatch = profile.dislikedStyles.filter(
    s => STYLE_PRODUCT_MAP[s]?.includes(product.brand)
  );
  score -= dislikedMatch.length * 20;

  // Budget alignment
  const budgetMap: Record<string, [number, number]> = {
    low: [0, 80],
    mid: [50, 200],
    high: [150, 400],
    luxury: [300, 9999],
  };
  const range = budgetMap[profile.budgetRange] || [0, 9999];
  if (product.price >= range[0] && product.price <= range[1]) score += 15;
  else score -= 10;

  return Math.max(0, Math.min(100, score));
}

function computeBodyCompatScore(product: Product, body: BodyProfile): number {
  // Use the product's existing fitScore as a proxy for body compatibility
  // In production, this would compare garment measurements to body measurements
  let score = product.fitScore;

  // Silhouette-specific adjustments
  if (body.silhouetteType === "athletic" && product.category === "tops") score += 5;
  if (body.silhouetteType === "inverted-triangle" && product.category === "bottoms") score += 5;
  if (body.torsoLegRatio > 1.1 && product.category === "outerwear") {
    // Longer torso benefits from cropped outerwear
    if (product.name.toLowerCase().includes("cropped") || product.name.toLowerCase().includes("bomber")) {
      score += 8;
    }
  }

  return Math.max(0, Math.min(100, score));
}

function computeContextScore(product: Product, context: ContextData): number {
  let score = 50;

  // Weather
  const weatherKey = context.weather.temp > 28 ? "hot" :
    context.weather.temp > 20 ? "warm" :
    context.weather.temp > 10 ? "cool" : "cold";
  
  const categoryAffinity = WEATHER_CATEGORY_AFFINITY[weatherKey]?.[product.category] ?? 0.5;
  score += (categoryAffinity - 0.5) * 40;

  // Mood alignment
  if (context.mood) {
    const moodStyles = MOOD_STYLE_AFFINITY[context.mood] || [];
    const brandMatchesMood = moodStyles.some(s => STYLE_PRODUCT_MAP[s]?.includes(product.brand));
    if (brandMatchesMood) score += 20;
  }

  // Season
  if (context.season === "summer" && product.category === "outerwear") score -= 15;
  if (context.season === "winter" && product.category === "outerwear") score += 15;

  return Math.max(0, Math.min(100, score));
}

function computeBehaviorScore(product: Product, behavior: BehaviorData): number {
  let score = 50;

  if (behavior.likedProductIds.includes(product.id)) score += 20;
  if (behavior.savedProductIds.includes(product.id)) score += 25;
  if (behavior.viewedProductIds.includes(product.id)) score += 10;
  if (behavior.skippedProductIds.includes(product.id)) score -= 15;

  // Brand affinity from behavior
  const likedBrands = behavior.likedProductIds.length > 0 ? 5 : 0;
  score += likedBrands;

  return Math.max(0, Math.min(100, score));
}

function computeSocialScore(product: Product, trendingBrands: string[]): number {
  let score = 50;
  if (trendingBrands.includes(product.brand)) score += 25;
  if (product.fitScore > 88) score += 10; // high-fit products tend to be popular
  return Math.max(0, Math.min(100, score));
}

function computePurchaseIntentScore(product: Product, behavior: BehaviorData): number {
  let score = 30;
  const viewCount = behavior.viewedProductIds.filter(id => id === product.id).length;
  score += viewCount * 15;
  if (behavior.savedProductIds.includes(product.id)) score += 30;
  return Math.max(0, Math.min(100, score));
}

// --- Explanation Generator ---

function generateExplanation(
  product: Product,
  scores: Omit<ProductScoreBreakdown, "final" | "explanation">,
  context: ContextData,
  profile: UserProfile
): string {
  const reasons: string[] = [];

  if (scores.coreProfile > 70) {
    if (profile.preferredStyles.length > 0) {
      reasons.push(`matches your ${profile.preferredStyles[0]} preference`);
    }
  }
  if (scores.bodyCompat > 85) {
    reasons.push("fits your body proportions well");
  }
  if (scores.context > 65 && context.mood) {
    reasons.push(`works with your ${context.mood} mood today`);
  }
  if (scores.context > 65 && context.weather) {
    const weatherKey = context.weather.temp > 28 ? "hot" :
      context.weather.temp > 20 ? "warm" :
      context.weather.temp > 10 ? "cool" : "cold";
    reasons.push(`good for ${weatherKey} weather`);
  }
  if (scores.social > 65) {
    reasons.push("trending in the community");
  }
  if (scores.behavior > 65) {
    reasons.push("similar to items you've liked");
  }

  if (reasons.length === 0) reasons.push("curated for your profile");
  
  return reasons.slice(0, 2).join(" · ");
}

// --- Main Ranking Function ---

export function rankProducts(
  products: Product[],
  profile: UserProfile,
  body: BodyProfile,
  context: ContextData,
  behavior: BehaviorData,
  trendingBrands: string[] = []
): (Product & { scoreBreakdown: ProductScoreBreakdown })[] {
  const scored = products.map(product => {
    const coreProfile = computeCoreProfileScore(product, profile);
    const bodyCompat = computeBodyCompatScore(product, body);
    const contextScore = computeContextScore(product, context);
    const behaviorScore = computeBehaviorScore(product, behavior);
    const social = computeSocialScore(product, trendingBrands);
    const purchaseIntent = computePurchaseIntentScore(product, behavior);

    const final = Math.round(
      WEIGHTS.coreProfile * coreProfile +
      WEIGHTS.bodyCompat * bodyCompat +
      WEIGHTS.context * contextScore +
      WEIGHTS.behavior * behaviorScore +
      WEIGHTS.social * social +
      WEIGHTS.purchaseIntent * purchaseIntent
    );

    const scores = { coreProfile, bodyCompat, context: contextScore, behavior: behaviorScore, social, purchaseIntent };
    const explanation = generateExplanation(product, scores, context, profile);

    return {
      ...product,
      scoreBreakdown: { ...scores, final, explanation },
    };
  });

  // Sort by final score descending
  scored.sort((a, b) => b.scoreBreakdown.final - a.scoreBreakdown.final);

  // Add controlled exploration: swap position 4 and 6 to add novelty
  if (scored.length > 6) {
    [scored[3], scored[5]] = [scored[5], scored[3]];
  }

  return scored;
}

// --- Default profiles for demo ---

export const defaultUserProfile: UserProfile = {
  preferredStyles: ["minimal", "cleanFit"],
  dislikedStyles: ["sporty"],
  preferredFit: "regular",
  budgetRange: "mid",
  favoriteBrands: ["COS", "ARKET"],
};

export const defaultBodyProfile: BodyProfile = {
  silhouetteType: "balanced",
  shoulderWidth: 45,
  waist: 80,
  hips: 95,
  torsoLegRatio: 0.95,
  height: 175,
};

export const defaultBehavior: BehaviorData = {
  likedProductIds: ["1", "4"],
  savedProductIds: ["3"],
  viewedProductIds: ["1", "2", "3", "4", "5"],
  skippedProductIds: ["6"],
  starredOOTDIds: ["3", "6"],
};

export function getDefaultContext(mood: string | null = null): ContextData {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
  const month = new Date().getMonth();
  const season = month <= 2 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "fall";
  
  return {
    weather: { temp: 22, condition: "partly-cloudy" },
    mood,
    timeOfDay: timeOfDay as ContextData["timeOfDay"],
    season: season as ContextData["season"],
  };
}
