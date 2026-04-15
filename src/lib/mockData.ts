export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  category: "tops" | "bottoms" | "outerwear" | "shoes" | "accessories";
  fitScore: number;
  reason: string;
  recommendedSize: string;
  fitComment: string;
  url: string;
}

export interface Brand {
  id: string;
  name: string;
  logo: string;
  matchScore: number;
  reason: string;
}

export interface OutfitBundle {
  id: string;
  name: string;
  items: Product[];
  occasion: string;
  totalPrice: number;
}

export interface OOTDPost {
  id: string;
  creator: string;
  avatar: string;
  image: string;
  caption: string;
  tags: { style: string; weather: string; occasion: string };
  stars: number;
  items: Product[];
  createdAt: string;
}

export const mockBrands: Brand[] = [
  { id: "1", name: "COS", logo: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&h=100&fit=crop", matchScore: 94, reason: "Matches your clean minimal preference" },
  { id: "2", name: "ARKET", logo: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=100&h=100&fit=crop", matchScore: 91, reason: "Works with your body proportions" },
  { id: "3", name: "Lemaire", logo: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=100&h=100&fit=crop", matchScore: 89, reason: "Suits your relaxed silhouette direction" },
  { id: "4", name: "AMI Paris", logo: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=100&h=100&fit=crop", matchScore: 87, reason: "Fits your style vibe and budget" },
  { id: "5", name: "Our Legacy", logo: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=100&h=100&fit=crop", matchScore: 85, reason: "Complements your appearance mood" },
];

export const mockProducts: Product[] = [
  {
    id: "1", name: "Relaxed Wool Coat", brand: "COS", price: 290,
    image: "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=400&h=500&fit=crop",
    category: "outerwear", fitScore: 92, reason: "Balances your upper body proportions",
    recommendedSize: "M", fitComment: "Shoulders fit well in M. The relaxed cut elongates your silhouette.", url: "#"
  },
  {
    id: "2", name: "Straight Leg Trousers", brand: "ARKET", price: 89,
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop",
    category: "bottoms", fitScore: 88, reason: "Works with your leg ratio and waist",
    recommendedSize: "32", fitComment: "Straight cut balances your shoulder-to-hip ratio well.", url: "#"
  },
  {
    id: "3", name: "Oversized Cotton Shirt", brand: "Lemaire", price: 195,
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop",
    category: "tops", fitScore: 85, reason: "Matches your soft and clean appearance",
    recommendedSize: "S", fitComment: "Semi-oversized S gives the right drape for your frame.", url: "#"
  },
  {
    id: "4", name: "Minimal Leather Sneakers", brand: "COS", price: 135,
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=500&fit=crop",
    category: "shoes", fitScore: 90, reason: "Completes your clean minimal look",
    recommendedSize: "42", fitComment: "True to size. Sleek profile matches your style direction.", url: "#"
  },
  {
    id: "5", name: "Merino Crew Neck", brand: "AMI Paris", price: 220,
    image: "https://images.unsplash.com/photo-1434389677669-e08b4cda3a5d?w=400&h=500&fit=crop",
    category: "tops", fitScore: 87, reason: "Flattering for your shoulder line",
    recommendedSize: "M", fitComment: "Slim crew neck highlights your proportions without being tight.", url: "#"
  },
  {
    id: "6", name: "Wide Leg Linen Pants", brand: "Our Legacy", price: 175,
    image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=500&fit=crop",
    category: "bottoms", fitScore: 82, reason: "Better for hot weather and your body shape",
    recommendedSize: "M", fitComment: "Relaxed fit with high waist suits your proportions in summer.", url: "#"
  },
  {
    id: "7", name: "Cotton Canvas Tote", brand: "ARKET", price: 45,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=500&fit=crop",
    category: "accessories", fitScore: 80, reason: "Matches your minimal aesthetic",
    recommendedSize: "One Size", fitComment: "Clean design pairs with your overall style direction.", url: "#"
  },
  {
    id: "8", name: "Lightweight Bomber", brand: "AMI Paris", price: 345,
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop",
    category: "outerwear", fitScore: 91, reason: "Semi-cropped length improves your proportions",
    recommendedSize: "M", fitComment: "Cropped bomber balances your torso-to-leg ratio perfectly.", url: "#"
  },
];

export const mockOutfits: OutfitBundle[] = [
  {
    id: "1", name: "Clean Office Look", occasion: "Office",
    items: [mockProducts[2], mockProducts[1], mockProducts[3]],
    totalPrice: 419,
  },
  {
    id: "2", name: "Weekend Minimal", occasion: "Daily",
    items: [mockProducts[4], mockProducts[5], mockProducts[3]],
    totalPrice: 530,
  },
  {
    id: "3", name: "Rainy Day Smart", occasion: "Daily",
    items: [mockProducts[0], mockProducts[1], mockProducts[6]],
    totalPrice: 424,
  },
];

export const mockUserProfile = {
  style: "Minimal / Clean Fit",
  bodyType: "Semi-athletic, balanced proportions",
  silhouette: "Straight shoulders, medium waist, balanced legs",
  colorDirection: "Neutral tones — black, white, beige, navy, olive",
  fitDirection: "Relaxed-to-regular fit. Avoid ultra-slim or extreme oversized.",
  aiSummary: [
    "Your proportions work better with semi-cropped outerwear and straight or semi-wide pants.",
    "Your face and hair vibe suit clean minimal styling more than aggressive oversized streetwear.",
    "In warm weather, lightweight relaxed shirts and straight trousers are more flattering than bulky tops.",
    "Neutral color palettes with occasional muted earth tones complement your overall appearance.",
  ],
};

export const mockOOTDPosts: OOTDPost[] = [
  {
    id: "1", creator: "minjae.k", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop",
    image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=600&h=800&fit=crop",
    caption: "Keeping it clean for the office", tags: { style: "Minimal", weather: "Cool", occasion: "Office" },
    stars: 47, items: [mockProducts[2], mockProducts[1]], createdAt: "2026-04-15",
  },
  {
    id: "2", creator: "sofia.r", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop",
    caption: "Weekend layers", tags: { style: "Classic", weather: "Warm", occasion: "Daily" },
    stars: 83, items: [mockProducts[0], mockProducts[5]], createdAt: "2026-04-14",
  },
  {
    id: "3", creator: "luca.m", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop",
    image: "https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600&h=800&fit=crop",
    caption: "Summer vibes", tags: { style: "Clean Fit", weather: "Hot", occasion: "Travel" },
    stars: 124, items: [mockProducts[4], mockProducts[3]], createdAt: "2026-04-13",
  },
  {
    id: "4", creator: "yuna.c", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop",
    caption: "Date night ready", tags: { style: "Chic", weather: "Cool", occasion: "Date" },
    stars: 156, items: [mockProducts[7], mockProducts[1]], createdAt: "2026-04-12",
  },
  {
    id: "5", creator: "tae.p", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop",
    image: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=600&h=800&fit=crop",
    caption: "Rainy day essentials", tags: { style: "Streetwear", weather: "Rainy", occasion: "Daily" },
    stars: 68, items: [mockProducts[0], mockProducts[6]], createdAt: "2026-04-11",
  },
  {
    id: "6", creator: "elena.v", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=800&fit=crop",
    caption: "Old money aesthetic", tags: { style: "Old Money", weather: "Cool", occasion: "Office" },
    stars: 201, items: [mockProducts[4], mockProducts[1], mockProducts[3]], createdAt: "2026-04-10",
  },
];
