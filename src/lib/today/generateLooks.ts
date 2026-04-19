import type { QuizAnswer } from "./quizOptions";

export interface TodayLookPiece {
  name: string;
  color: string;
  category: string;
}

export interface TodayLook {
  id: string;
  title: string;
  vibe: string;
  pieces: TodayLookPiece[];
  reason: string;
  weatherTag: string;
}

interface Ctx {
  temp: number;
  condition: string;
  aqiLevel: "good" | "moderate" | "unhealthy" | "hazardous";
  answers: QuizAnswer;
}

const COLOR_PALETTES: Record<string, string[]> = {
  minimal: ["#E8E4DC", "#1A1A1A", "#8B8680", "#FFFFFF", "#A89F95"],
  street: ["#1A1A1A", "#3A3A3A", "#D4A574", "#5C5C5C", "#E8E4DC"],
  classic: ["#2C2A28", "#8B6F47", "#E8DCC4", "#1A1A1A", "#A89F95"],
  soft: ["#F5E6E8", "#D4A5A5", "#E8DCC4", "#FFFFFF", "#C9B5B0"],
  bold: ["#8B0000", "#1A1A1A", "#D4A574", "#2C2A28", "#FFFFFF"],
};

const VIBES: Record<string, string> = {
  work: "polished",
  casual: "easy",
  date: "elevated",
  active: "performance",
  event: "statement",
};

function pickPalette(style: string): string[] {
  return COLOR_PALETTES[style] ?? COLOR_PALETTES.minimal;
}

function dustNote(level: Ctx["aqiLevel"]): string | null {
  if (level === "unhealthy") return "Lightweight scarf or mask layer recommended.";
  if (level === "hazardous") return "Cover up — high-collar layer + mask.";
  return null;
}

function weatherLayer(temp: number): { outer: string | null; bottom: string; top: string; shoes: string } {
  if (temp <= 5) return { outer: "Wool overcoat", bottom: "Wool trousers", top: "Knit turtleneck", shoes: "Leather boots" };
  if (temp <= 12) return { outer: "Tailored blazer", bottom: "Straight denim", top: "Fine-knit sweater", shoes: "Chelsea boots" };
  if (temp <= 18) return { outer: "Light overshirt", bottom: "Pleated trousers", top: "Cotton shirt", shoes: "Loafers" };
  if (temp <= 24) return { outer: null, bottom: "Tailored chinos", top: "Linen shirt", shoes: "White sneakers" };
  return { outer: null, bottom: "Wide-leg shorts", top: "Linen tee", shoes: "Canvas sneakers" };
}

export function generateTodayLooks(ctx: Ctx): TodayLook[] {
  const palette = pickPalette(ctx.answers.style);
  const baseVibe = VIBES[ctx.answers.occasion] ?? "easy";
  const layers = weatherLayer(ctx.temp);
  const dust = dustNote(ctx.aqiLevel);

  const concepts = [
    { title: "Morning Calm", twist: "soft contrast" },
    { title: "Confident Standard", twist: "structured fit" },
    { title: "Effortless Layer", twist: "tonal flow" },
    { title: "Weekend Ease", twist: "relaxed silhouette" },
    { title: "Evening Edit", twist: "refined accent" },
  ];

  return concepts.map((c, i) => {
    const pieces: TodayLookPiece[] = [
      { name: layers.top, color: palette[i % palette.length], category: "top" },
      { name: layers.bottom, color: palette[(i + 1) % palette.length], category: "bottom" },
      { name: layers.shoes, color: palette[(i + 2) % palette.length], category: "shoes" },
    ];
    if (layers.outer) pieces.push({ name: layers.outer, color: palette[(i + 3) % palette.length], category: "outerwear" });

    const reasonParts = [
      `${baseVibe} for ${ctx.answers.occasion}`,
      `${ctx.answers.craving} energy`,
      `${ctx.temp}° ${ctx.condition}`,
      c.twist,
    ];
    if (dust) reasonParts.push(dust);

    return {
      id: `look-${i}`,
      title: c.title,
      vibe: `${baseVibe} · ${ctx.answers.style}`,
      pieces,
      reason: reasonParts.join(" — "),
      weatherTag: ctx.condition,
    };
  });
}
