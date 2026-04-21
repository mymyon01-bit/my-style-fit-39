import type {
  FitResult,
  FitAnalysis,
  ChestFit,
  LengthFit,
  ShoulderFit,
  SleeveFit,
  OverallFit,
} from "./types";

export function interpretFit(r: FitResult): FitAnalysis {
  const chestFit = classifyChest(r.chestDiff);
  const lengthFit = classifyLength(r.lengthDiff);
  const shoulderFit = classifyShoulder(r.shoulderDiff);
  const sleeveFit = classifySleeve(r.sleeveDiff);
  const overall = classifyOverall(r.chestDiff, r.shoulderDiff);
  return { chestFit, lengthFit, shoulderFit, sleeveFit, overall };
}

function classifyChest(d: number): ChestFit {
  if (d < 2) return "tight";
  if (d <= 6) return "regular";
  return "loose";
}

function classifyLength(d: number): LengthFit {
  if (d < -3) return "short";
  if (d <= 4) return "perfect";
  return "long";
}

function classifyShoulder(d: number): ShoulderFit {
  if (d < -1) return "tight";
  if (d <= 2) return "perfect";
  return "dropped";
}

function classifySleeve(d: number): SleeveFit {
  if (d < -3) return "short";
  if (d <= 3) return "perfect";
  return "long";
}

function classifyOverall(chestDiff: number, shoulderDiff: number): OverallFit {
  // Use the dominant signal across chest + shoulder.
  const score = chestDiff + shoulderDiff * 1.5;
  if (score < 1) return "tight";
  if (score <= 6) return "regular";
  if (score <= 14) return "relaxed";
  return "oversized";
}
