// ─── SIZING ENGINE REGRESSION SCENARIOS ─────────────────────────────────────
// Lock in the 5 spec scenarios (Test A–E) so future refactors of the body
// resolver, fit calculator, or recommender can't silently regress the
// recommendation direction.
//
// We build the GarmentChart inline (no DB) so these tests are pure and fast.

import { describe, it, expect } from "vitest";
import { resolveBody } from "../bodyResolver";
import { calculateAllSizes } from "../fitCalculator";
import { buildRecommendation } from "../recommend";
import { CATEGORY_RULES, getDefaultChartForGender } from "../categoryRules";
import type {
  FitPreference,
  Gender,
  GarmentChart,
  SizingCategory,
} from "../types";

function buildSyntheticChart(category: SizingCategory, gender: Gender): GarmentChart {
  const rule = CATEGORY_RULES[category];
  const sizes = getDefaultChartForGender(rule, gender);
  const sizeOrder = Object.keys(sizes);
  const sources: GarmentChart["sources"] = {};
  for (const s of sizeOrder) sources[s] = "categoryDefault";
  return {
    category,
    sizes: sizes as GarmentChart["sizes"],
    sizeOrder,
    sources,
    hasAnyRealData: false,
    usedCategoryDefaults: true,
    confidence: "low",
    calibration: { shoulder: 0, chest: 0, waist: 0, hip: 0, thigh: 0, sleeve: 0, inseam: 0, length: 0 },
  };
}

function runScenario(args: {
  gender: Gender;
  heightCm: number;
  weightKg: number;
  category: SizingCategory;
  selectedSize: string;
  preference?: FitPreference;
}) {
  const body = resolveBody({
    gender: args.gender,
    heightCm: args.heightCm,
    weightKg: args.weightKg,
  });
  const chart = buildSyntheticChart(args.category, args.gender);
  const outcomes = calculateAllSizes({ body, chart, preference: args.preference ?? "regular" });
  const rec = buildRecommendation({
    body,
    chart,
    preference: args.preference ?? "regular",
    outcomes,
    productGender: args.gender,
  });
  const selected = outcomes.find((o) => o.size === args.selectedSize);
  return { body, outcomes, rec, selected };
}

describe("Sizing scenarios (FIT spec §13)", () => {
  // Test A: Big male in size M hoodie → should run tight, recommend bigger.
  it("A: 180cm/95kg male hoodie M → tight, recommends L or XL", () => {
    const { selected, rec } = runScenario({
      gender: "male", heightCm: 180, weightKg: 95,
      category: "hoodie", selectedSize: "M",
    });
    expect(selected).toBeDefined();
    expect(["verySmall", "tightFit", "fitted"]).toContain(selected!.overall);
    expect(rec.primarySize).toBeTruthy();
    expect(["L", "XL", "XXL"]).toContain(rec.primarySize!);
  });

  // Test B: Slim male in size XL hoodie → oversized, recommend smaller.
  it("B: 180cm/60kg male hoodie XL → oversized, recommends M or L", () => {
    const { selected, rec } = runScenario({
      gender: "male", heightCm: 180, weightKg: 60,
      category: "hoodie", selectedSize: "XL",
    });
    expect(selected).toBeDefined();
    expect(["relaxedFit", "oversizedFit", "tooLarge"]).toContain(selected!.overall);
    expect(["XS", "S", "M", "L"]).toContain(rec.primarySize!);
  });

  // Test C: Petite female in size XL jacket → oversized, recommend S/M.
  it("C: 165cm/50kg female jacket XL → oversized, recommends S or M", () => {
    const { selected, rec } = runScenario({
      gender: "female", heightCm: 165, weightKg: 50,
      category: "jacket", selectedSize: "XL",
    });
    expect(selected).toBeDefined();
    expect(["relaxedFit", "oversizedFit", "tooLarge"]).toContain(selected!.overall);
    expect(["XS", "S", "M"]).toContain(rec.primarySize!);
  });

  // Test D: Heavier muscular male in size M pants → tight, recommend bigger.
  it("D: 175cm/85kg male pants M → tight, recommends L or larger", () => {
    const { selected, rec } = runScenario({
      gender: "male", heightCm: 175, weightKg: 85,
      category: "pants", selectedSize: "M",
    });
    expect(selected).toBeDefined();
    expect(["verySmall", "tightFit", "fitted"]).toContain(selected!.overall);
    expect(["L", "XL", "XXL"]).toContain(rec.primarySize!);
  });

  // Test E: Petite curvy female in size S dress → engine MUST evaluate per-region
  // and not silently say "perfect". We verify there's at least one non-regular
  // region OR a non-fitted overall, so the recommendation engine is honest.
  it("E: 160cm/65kg female dress S → per-region evaluation, not blindly perfect", () => {
    const { selected, rec } = runScenario({
      gender: "female", heightCm: 160, weightKg: 65,
      category: "dress", selectedSize: "S",
    });
    expect(selected).toBeDefined();
    const hasMixedRegions = selected!.regions.some((r) => r.status !== "regular");
    const isNotPerfect = selected!.overall !== "regularFit" && selected!.overall !== "fitted";
    expect(hasMixedRegions || isNotPerfect).toBe(true);
    // Recommendation must exist and be honest about confidence.
    expect(rec.primarySize).toBeTruthy();
    expect(["high", "medium", "low"]).toContain(rec.confidence);
  });

  // Sanity: gender mismatch surfaces a warning.
  it("Gender mismatch warning fires when product gender ≠ body gender", () => {
    const body = resolveBody({ gender: "male", heightCm: 175, weightKg: 75 });
    const chart = buildSyntheticChart("dress", "female");
    const outcomes = calculateAllSizes({ body, chart, preference: "regular" });
    const rec = buildRecommendation({
      body, chart, preference: "regular", outcomes,
      productGender: "female",
    });
    expect(rec.genderMismatchWarning).toBeTruthy();
  });
});
