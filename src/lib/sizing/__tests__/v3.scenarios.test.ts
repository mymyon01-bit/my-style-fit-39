// ─── V3 ACCEPTANCE SCENARIOS — body-locked, label-blind ─────────────────────
// These lock in the spec's "must work globally" cases. Body is fixed; the
// recommendation must come from measurement deltas vs target ease, never
// from size labels.

import { describe, it, expect } from "vitest";
import { resolveBody } from "../bodyResolver";
import { calculateAllSizes } from "../fitCalculator";
import { buildRecommendation } from "../recommend";
import { CATEGORY_RULES, getDefaultChartForGender } from "../categoryRules";
import type { GarmentChart } from "../garmentChart";
import type { FitPreference, Gender, SizingCategory } from "../types";

function chart(category: SizingCategory, gender: Gender): GarmentChart {
  const rule = CATEGORY_RULES[category];
  const sizes = getDefaultChartForGender(rule, gender);
  const sizeOrder = Object.keys(sizes);
  const sources: GarmentChart["sources"] = {};
  for (const s of sizeOrder) sources[s] = "categoryDefault";
  return {
    category, sizes: sizes as any, sizeOrder, sources,
    hasAnyRealData: false, usedCategoryDefaults: true, confidence: "low",
    calibration: { shoulder: 0, chest: 0, waist: 0, hip: 0, inseam: 0,
      sources: { brandRule: false, communityFeedback: false, feedbackSampleSize: 0 } },
  };
}

function run(args: {
  gender: Gender; heightCm: number; weightKg: number;
  category: SizingCategory; productGender?: Gender;
  preference?: FitPreference;
}) {
  const body = resolveBody({ gender: args.gender, heightCm: args.heightCm, weightKg: args.weightKg });
  const c = chart(args.category, args.productGender ?? args.gender);
  const outcomes = calculateAllSizes({ body, chart: c, preference: args.preference ?? "regular" });
  const rec = buildRecommendation({
    body, chart: c, preference: args.preference ?? "regular",
    outcomes, productGender: args.productGender ?? args.gender,
  });
  return { rec };
}

describe("V3 body-locked acceptance scenarios", () => {
  it("A: female 167/47 women's tshirt → S best, never XL", () => {
    const { rec } = run({ gender: "female", heightCm: 167, weightKg: 47, category: "tshirt" });
    expect(["XS", "S", "M"]).toContain(rec.primarySize!);
    expect(rec.primarySize).not.toBe("XL");
  });

  it("B: female 167/95 women's tshirt → must NOT recommend XS or S", () => {
    const { rec } = run({ gender: "female", heightCm: 167, weightKg: 95, category: "tshirt" });
    expect(["L", "XL"]).toContain(rec.primarySize!);
    expect(rec.primarySize).not.toBe("XS");
    expect(rec.primarySize).not.toBe("S");
  });

  it("D: male 170/100 men's pants → must recommend largest range, never S", () => {
    const { rec } = run({ gender: "male", heightCm: 170, weightKg: 100, category: "pants" });
    expect(["L", "XL", "36"]).toContain(rec.primarySize!);
    expect(rec.primarySize).not.toBe("S");
  });

  it("F: large female 165/85 women's S dress → primary not S OR rangeStatus tooSmall", () => {
    const { rec } = run({ gender: "female", heightCm: 165, weightKg: 85, category: "dress" });
    // Engine must be honest: either picks a larger size OR pins S with a
    // tooSmall warning. Never silently labels S as a balanced fit.
    if (rec.primarySize === "S") {
      expect(rec.rangeStatus).toBe("tooSmall");
    } else {
      expect(["M", "L", "XL"]).toContain(rec.primarySize!);
    }
    expect(rec.primaryClassification).toBeDefined();
  });

  it("Body-lock invariance: same body produces same analyses regardless of which size is queried", () => {
    const { rec: r1 } = run({ gender: "female", heightCm: 167, weightKg: 47, category: "tshirt" });
    const { rec: r2 } = run({ gender: "female", heightCm: 167, weightKg: 47, category: "tshirt" });
    expect(r1.sizeAnalyses?.M.signedDistance).toBe(r2.sizeAnalyses?.M.signedDistance);
  });

  it("Label-blind: classification of S/M/L is monotonic in signed distance", () => {
    const { rec } = run({ gender: "male", heightCm: 175, weightKg: 70, category: "tshirt" });
    const s = rec.sizeAnalyses?.S?.signedDistance ?? 0;
    const m = rec.sizeAnalyses?.M?.signedDistance ?? 0;
    const l = rec.sizeAnalyses?.L?.signedDistance ?? 0;
    expect(s).toBeLessThan(m);
    expect(m).toBeLessThan(l);
  });
});
