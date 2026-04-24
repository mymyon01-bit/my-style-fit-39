/**
 * Showroom theme presets — premium editorial moods.
 * NOT a store. Pure aesthetic curation.
 */
export interface ShowroomTheme {
  key: string;
  label: string;
  description: string;
  bgClass: string; // tailwind background gradient
  cardClass: string;
  accentHex: string; // theme color suggestion
  suggestedTags: string[];
}

export const SHOWROOM_THEMES: ShowroomTheme[] = [
  {
    key: "minimal_gallery",
    label: "Minimal Gallery",
    description: "Clean white walls, generous space, gallery feel.",
    bgClass: "bg-gradient-to-b from-stone-50 to-stone-100 text-stone-900",
    cardClass: "bg-white border border-stone-200 shadow-sm",
    accentHex: "#1c1917",
    suggestedTags: ["minimal", "gallery", "quiet"],
  },
  {
    key: "luxury_room",
    label: "Luxury Room",
    description: "Soft beige, warm shadow, hotel suite mood.",
    bgClass: "bg-gradient-to-br from-[#1a1410] via-[#2a1f17] to-[#3d2c1f] text-amber-50",
    cardClass: "bg-amber-50/5 border border-amber-100/15 backdrop-blur-sm",
    accentHex: "#c9a17a",
    suggestedTags: ["luxury", "quietluxury", "evening"],
  },
  {
    key: "dress_room",
    label: "Dress Room",
    description: "Boutique dressing room with mirror light.",
    bgClass: "bg-gradient-to-b from-rose-50 via-pink-50 to-stone-50 text-stone-900",
    cardClass: "bg-white/80 border border-rose-100 backdrop-blur-sm",
    accentHex: "#be7b8e",
    suggestedTags: ["dress", "feminine", "boutique"],
  },
  {
    key: "streetwear_wall",
    label: "Streetwear Wall",
    description: "Poster wall, bold layout, downtown energy.",
    bgClass: "bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-zinc-100",
    cardClass: "bg-zinc-900/80 border border-zinc-700",
    accentHex: "#f59e0b",
    suggestedTags: ["streetwear", "urban", "graphic"],
  },
  {
    key: "car_lifestyle",
    label: "Car Lifestyle",
    description: "Garage editorial, chrome and leather.",
    bgClass: "bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900 text-slate-100",
    cardClass: "bg-slate-900/70 border border-slate-700",
    accentHex: "#60a5fa",
    suggestedTags: ["lifestyle", "automotive", "leather"],
  },
  {
    key: "beauty_table",
    label: "Beauty Table",
    description: "Cosmetics tabletop, soft pinks and porcelain.",
    bgClass: "bg-gradient-to-b from-pink-50 via-rose-50 to-amber-50 text-stone-900",
    cardClass: "bg-white/90 border border-pink-100",
    accentHex: "#f472b6",
    suggestedTags: ["beauty", "cosmetics", "softgirl"],
  },
  {
    key: "perfume_shelf",
    label: "Perfume Shelf",
    description: "Glass shelf, low light, niche fragrance feel.",
    bgClass: "bg-gradient-to-b from-stone-100 via-stone-200 to-stone-300 text-stone-900",
    cardClass: "bg-white border border-stone-300",
    accentHex: "#78716c",
    suggestedTags: ["fragrance", "niche", "shelf"],
  },
  {
    key: "vintage_archive",
    label: "Vintage Archive",
    description: "Sepia, archival, museum drawer.",
    bgClass: "bg-gradient-to-b from-amber-100 via-yellow-50 to-stone-100 text-stone-900",
    cardClass: "bg-amber-50/80 border border-amber-200",
    accentHex: "#92400e",
    suggestedTags: ["vintage", "archive", "thrift"],
  },
  {
    key: "travel_resort",
    label: "Travel Resort",
    description: "Sunlit terrace, linen and turquoise.",
    bgClass: "bg-gradient-to-br from-sky-100 via-cyan-50 to-amber-50 text-stone-900",
    cardClass: "bg-white/80 border border-sky-100",
    accentHex: "#0891b2",
    suggestedTags: ["resort", "travel", "summer"],
  },
  {
    key: "fashion_closet",
    label: "Fashion Closet",
    description: "Walk-in closet, soft warm lighting.",
    bgClass: "bg-gradient-to-b from-neutral-100 via-stone-100 to-amber-50 text-stone-900",
    cardClass: "bg-white border border-neutral-200",
    accentHex: "#404040",
    suggestedTags: ["closet", "wardrobe", "daily"],
  },
  {
    key: "party_look",
    label: "Tailored Party",
    description: "Tailored party, mirrorball, midnight black.",
    bgClass: "bg-gradient-to-br from-purple-950 via-fuchsia-950 to-black text-fuchsia-50",
    cardClass: "bg-fuchsia-950/40 border border-fuchsia-500/30 backdrop-blur-sm",
    accentHex: "#e879f9",
    suggestedTags: ["party", "tailored", "night"],
  },
];

export const getTheme = (key: string | null | undefined): ShowroomTheme =>
  SHOWROOM_THEMES.find((t) => t.key === key) ?? SHOWROOM_THEMES[0];
