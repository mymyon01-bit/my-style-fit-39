import { describe, expect, it } from "vitest";
import { extractGarmentDNA } from "../garmentDNA";
import type { SizeMeasurementInput } from "../sizeCorrelationEngine";
import { buildFitRenderState, buildWearerBodyDNA, resolveWearerSex } from "../fitRenderState";

// Section P — automated size validation body.
const MALE_BODY = buildWearerBodyDNA({
  gender: "male",
  heightCm: 177,
  weightKg: 72,
  shoulderCm: 44,
  chestCm: 96,
  waistCm: 82,
  hipCm: 96,
});

const SIZES: SizeMeasurementInput[] = [
  { size: "S",  measurements: { shoulder: 42, chest: 96,  length: 65, sleeve: 59 }, source: "exact" },
  { size: "M",  measurements: { shoulder: 44, chest: 102, length: 67, sleeve: 61 }, source: "exact" },
  { size: "L",  measurements: { shoulder: 46, chest: 108, length: 69, sleeve: 63 }, source: "exact" },
  { size: "XL", measurements: { shoulder: 48, chest: 114, length: 71, sleeve: 65 }, source: "exact" },
];

const DNA = extractGarmentDNA({ name: "Cotton T-Shirt", category: "tops" });

function stateFor(size: string) {
  const s = buildFitRenderState({ garmentId: "test-garment", bodyDNA: MALE_BODY, garmentDNA: DNA, sizes: SIZES, selectedSize: size });
  if (!s) throw new Error(`no render state for ${size}`);
  return s;
}

describe("fit render state — size is a first-class variable", () => {
  const all = ["S", "M", "L", "XL"].map(stateFor);

  it("resolves different physical garment measurements per size", () => {
    const chests = all.map((s) => s.garment.measurements.chest);
    expect(new Set(chests).size).toBe(4);
  });

  it("produces different chest deltas per size", () => {
    const deltas = all.map((s) => s.fit.delta.chest);
    expect(deltas).toEqual([0, 6, 12, 18]);
  });

  it("produces monotonically decreasing tension from S to XL", () => {
    const t = all.map((s) => s.fit.tension.chest!);
    expect(t[0]).toBeGreaterThan(t[1]);
    expect(t[1]).toBeGreaterThan(t[2]);
    expect(t[2]).toBeGreaterThan(t[3]);
  });

  it("keeps the wearer body identical across sizes", () => {
    const hashes = new Set(all.map((s) => s.wearer.bodyHash));
    expect(hashes.size).toBe(1);
    expect(all.every((s) => s.wearer.bodyDNA.chestOrBustCm === 96)).toBe(true);
  });

  it("generates a distinct cache key per size", () => {
    expect(new Set(all.map((s) => s.hash)).size).toBe(4);
  });

  it("never renders a mannequin wearer", () => {
    expect(all.every((s) => s.wearer.type === "real_human")).toBe(true);
  });
});

describe("sex mapping", () => {
  it("keeps the profile sex when provided", () => {
    expect(resolveWearerSex("female", {}).sex).toBe("female");
    expect(resolveWearerSex("male", {}).sex).toBe("male");
  });

  it("infers a body profile instead of falling back to neutral", () => {
    const inferred = resolveWearerSex(null, { chestCm: 88, waistCm: 66, hipCm: 96 });
    expect(inferred.sex).toBe("female");
    expect(inferred.source).toBe("inferred");
  });

  it("uses female-specific regions for a female wearer", () => {
    const female = buildWearerBodyDNA({ gender: "female", heightCm: 167, weightKg: 52, chestCm: 88, waistCm: 68, hipCm: 94 });
    expect(female.underbustCm).toBe(76);
    expect(female.seatCm).toBe(95);
    const s = buildFitRenderState({ garmentId: "g", bodyDNA: female, garmentDNA: DNA, sizes: SIZES, selectedSize: "M" });
    expect(s?.fit.priorityRegions[0]).toBe("chest");
  });

  it("prioritizes shoulder for a male wearer", () => {
    expect(stateFor("M").fit.priorityRegions[0]).toBe("shoulder");
  });
});

describe("fabric behavior", () => {
  it("treats rigid denim as tighter than stretch knit at the same delta", () => {
    const denim = extractGarmentDNA({ name: "Denim Jacket", category: "outerwear", description: "rigid denim" });
    const knit = extractGarmentDNA({ name: "Knit Sweater", category: "tops", description: "soft knit" });
    const sizes: SizeMeasurementInput[] = [{ size: "S", measurements: { chest: 96, shoulder: 44 }, source: "exact" }];
    const a = buildFitRenderState({ garmentId: "d", bodyDNA: MALE_BODY, garmentDNA: denim, sizes, selectedSize: "S" })!;
    const b = buildFitRenderState({ garmentId: "k", bodyDNA: MALE_BODY, garmentDNA: knit, sizes, selectedSize: "S" })!;
    expect(a.fit.tension.chest!).toBeGreaterThan(b.fit.tension.chest!);
  });
});
