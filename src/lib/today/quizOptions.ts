export const OCCASION_OPTIONS = [
  { id: "work", label: "Work / Office" },
  { id: "casual", label: "Casual day out" },
  { id: "date", label: "Date night" },
  { id: "active", label: "Active / Sporty" },
  { id: "event", label: "Special event" },
] as const;

export const STYLE_OPTIONS = [
  { id: "minimal", label: "Minimal & clean" },
  { id: "street", label: "Street / urban" },
  { id: "classic", label: "Classic & polished" },
  { id: "soft", label: "Soft & feminine" },
  { id: "bold", label: "Bold & statement" },
] as const;

export const CRAVING_OPTIONS = [
  { id: "comfort", label: "Comfort first" },
  { id: "confidence", label: "Confidence boost" },
  { id: "warm", label: "Warm & cozy" },
  { id: "fresh", label: "Fresh & airy" },
  { id: "playful", label: "Playful & fun" },
] as const;

export type QuizAnswer = { occasion: string; style: string; craving: string };
