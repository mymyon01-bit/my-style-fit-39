// ─── GARMENT SIZE RESOLVER (HIERARCHY: exact → graded → category → average) ─
// Single source of truth for "what measurements should we use for THIS
// product in THIS size?" Implements a strict 5-step hierarchy and reports
// honestly which step was used so the UI can show the right confidence /
// "approximate preview" warning.
//
// STEP 1 — Exact size in DB (`garment_measurements`)
// STEP 2 — Same product, neighbouring size + size grading deltas
// STEP 3 — Category fallback table (regular shirt / oversized / hoodie / …)
// STEP 4 — Brand-or-category averaged values across all DB rows
// STEP 5 — Mark approximate, return empty measurements + warning
//
// The fit engine consumes the result of this resolver and produces region
// deltas. Higher steps reduce confidence and surface warnings.

import { supabase } from "@/integrations/supabase/client";
import {
  getFallbackMeasurements,
  gradeMeasurementsFromNeighbour,
  pickFallbackCategory,
} from "./garmentFallbackTable";

export type ResolverSource =
  | "db_exact"          // step 1 — exact selected size present in DB
  | "db_graded"         // step 2 — neighbour size + grading
  | "category_fallback" // step 3 — generic category chart
  | "brand_average"     // step 4 — averaged across category in DB
  | "approximate";      // step 5 — nothing usable, marked low conf

export interface ResolvedGarmentSize {
  selectedSize: string;
  category: string;
  exactSizeDataAvailable: boolean;
  source: ResolverSource;
  /** Human-readable reason — surfaced as a warning when not "db_exact". */
  resolverNote: string;
  confidence: "high" | "medium" | "low";
  measurements: {
    shoulderCm?: number;
    chestCm?: number;
    waistCm?: number;
    hipCm?: number;
    sleeveLengthCm?: number;
    totalLengthCm?: number;
    thighCm?: number;
    inseamCm?: number;
    riseCm?: number;
    stretchFactor?: number;
  };
  missingFields: string[];
  lastUpdatedAt?: string | null;
}

/** Required fields per category — drives the missingFields report. */
const EXPECTED_FIELDS: Record<string, string[]> = {
  tops:      ["shoulderCm", "chestCm", "totalLengthCm", "sleeveLengthCm"],
  shirts:    ["shoulderCm", "chestCm", "totalLengthCm", "sleeveLengthCm"],
  hoodies:   ["shoulderCm", "chestCm", "totalLengthCm", "sleeveLengthCm"],
  jackets:   ["shoulderCm", "chestCm", "totalLengthCm", "sleeveLengthCm"],
  outerwear: ["shoulderCm", "chestCm", "totalLengthCm", "sleeveLengthCm"],
  dresses:   ["shoulderCm", "chestCm", "waistCm", "totalLengthCm"],
  pants:     ["waistCm", "hipCm", "inseamCm", "thighCm"],
  jeans:     ["waistCm", "hipCm", "inseamCm", "thighCm"],
  skirts:    ["waistCm", "hipCm", "totalLengthCm"],
  bottoms:   ["waistCm", "hipCm", "inseamCm"],
  other:     ["chestCm", "totalLengthCm"],
};

function normalizeCategory(raw?: string | null): string {
  const c = (raw || "").toLowerCase();
  if (/(jean|denim)/.test(c)) return "jeans";
  if (/(pant|trouser|short|legging)/.test(c)) return "pants";
  if (/(skirt)/.test(c)) return "skirts";
  if (/(dress|gown|jumpsuit)/.test(c)) return "dresses";
  if (/(hood)/.test(c)) return "hoodies";
  if (/(jacket|coat|blazer|outer|parka)/.test(c)) return "jackets";
  if (/(shirt|polo|button)/.test(c)) return "shirts";
  if (/(top|tee|t-shirt|tshirt|sweater|knit|tank|sweatshirt)/.test(c)) return "tops";
  return "other";
}

function isBottomCategory(category: string): boolean {
  return /(pant|jean|short|legging|skirt|bottom)/.test(category);
}

function normalizeSize(raw: string): string {
  return (raw || "").trim().toUpperCase();
}

/** Build the canonical product key the DB uses (mirrors fit-tryons usage). */
export function makeProductKey(input: {
  url?: string | null;
  name?: string | null;
  brand?: string | null;
}): string {
  return `${input.url || input.name || ""}::${input.brand || ""}`
    .toLowerCase()
    .slice(0, 200);
}

interface ResolveInput {
  productKey: string;
  productId?: string | null;
  productName?: string | null;
  selectedSize: string;
  category?: string | null;
}

interface MeasurementRow {
  size_label: string;
  shoulder_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  sleeve_cm: number | null;
  total_length_cm: number | null;
  thigh_cm: number | null;
  inseam_cm: number | null;
  rise_cm: number | null;
  stretch_factor: number | null;
  updated_at: string | null;
}

function rowToMeasurements(row: MeasurementRow): ResolvedGarmentSize["measurements"] {
  return {
    shoulderCm:     numOrUndef(row.shoulder_cm),
    chestCm:        numOrUndef(row.chest_cm),
    waistCm:        numOrUndef(row.waist_cm),
    hipCm:          numOrUndef(row.hip_cm),
    sleeveLengthCm: numOrUndef(row.sleeve_cm),
    totalLengthCm:  numOrUndef(row.total_length_cm),
    thighCm:        numOrUndef(row.thigh_cm),
    inseamCm:       numOrUndef(row.inseam_cm),
    riseCm:         numOrUndef(row.rise_cm),
    stretchFactor:  numOrUndef(row.stretch_factor),
  };
}

function computeConfidence(missingCount: number, expectedCount: number): "high" | "medium" | "low" {
  if (expectedCount === 0) return "low";
  const completeness = 1 - missingCount / expectedCount;
  return completeness >= 0.85 ? "high" : completeness >= 0.5 ? "medium" : "low";
}

function logResolver(event: string, payload: Record<string, unknown>) {
  console.log("[FIT_RESOLVER]", { event, ...payload });
}

/**
 * Strict measurement resolution. Tries each step in order and returns as
 * soon as something usable is found. Always returns honest source + warning.
 */
export async function resolveGarmentSize(input: ResolveInput): Promise<ResolvedGarmentSize> {
  const category = normalizeCategory(input.category);
  const sizeLabel = normalizeSize(input.selectedSize);
  const expected = EXPECTED_FIELDS[category] ?? EXPECTED_FIELDS.other;
  const startedAt = Date.now();

  logResolver("resolve_start", { productKey: input.productKey, sizeLabel, category });

  // Pull every row for this product so steps 1, 2, and 4 can all consume it.
  let rows: MeasurementRow[] = [];
  try {
    const q = await supabase
      .from("garment_measurements")
      .select("size_label, shoulder_cm, chest_cm, waist_cm, hip_cm, sleeve_cm, total_length_cm, thigh_cm, inseam_cm, rise_cm, stretch_factor, updated_at")
      .eq("product_key", input.productKey)
      .order("updated_at", { ascending: false });
    rows = (q.data as MeasurementRow[] | null) ?? [];
  } catch (e) {
    console.warn("[FIT_RESOLVER] DB query failed", e);
  }

  // ── STEP 1 — exact size present ────────────────────────────────────────
  const exactRow = rows.find((r) => normalizeSize(r.size_label) === sizeLabel);
  if (exactRow) {
    const measurements = rowToMeasurements(exactRow);
    const missingFields = expected.filter((f) => measurements[f as keyof typeof measurements] == null);
    const result: ResolvedGarmentSize = {
      selectedSize: sizeLabel,
      category,
      exactSizeDataAvailable: missingFields.length === 0,
      source: "db_exact",
      resolverNote:
        missingFields.length === 0
          ? `Exact measurements for size ${sizeLabel} found.`
          : `Exact measurements for size ${sizeLabel} found but ${missingFields.length} field${missingFields.length === 1 ? "" : "s"} are missing.`,
      confidence: computeConfidence(missingFields.length, expected.length),
      measurements,
      missingFields,
      lastUpdatedAt: exactRow.updated_at ?? null,
    };
    logResolver("resolve_done", { source: result.source, confidence: result.confidence, ms: Date.now() - startedAt });
    return result;
  }

  // ── STEP 2 — neighbour size + grading ──────────────────────────────────
  if (rows.length > 0) {
    const orderRank: Record<string, number> = { XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5, "2XL": 5, XXXL: 5 };
    const targetRank = orderRank[sizeLabel] ?? 2;
    const ranked = rows
      .map((r) => ({ r, rank: orderRank[normalizeSize(r.size_label)] ?? -1 }))
      .filter((x) => x.rank >= 0)
      .sort((a, b) => Math.abs(a.rank - targetRank) - Math.abs(b.rank - targetRank));
    const nearest = ranked[0]?.r;
    if (nearest) {
      const sourceMeasurements = rowToMeasurements(nearest);
      const { measurements, steps } = gradeMeasurementsFromNeighbour({
        source: sourceMeasurements,
        sourceSize: nearest.size_label,
        targetSize: sizeLabel,
        isBottom: isBottomCategory(category),
      });
      const missingFields = expected.filter((f) => measurements[f as keyof typeof measurements] == null);
      const result: ResolvedGarmentSize = {
        selectedSize: sizeLabel,
        category,
        exactSizeDataAvailable: false,
        source: "db_graded",
        resolverNote: `Estimated from size ${nearest.size_label} using ${Math.abs(steps)}-step grading.`,
        confidence: missingFields.length / expected.length > 0.5 ? "low" : "medium",
        measurements,
        missingFields,
        lastUpdatedAt: nearest.updated_at ?? null,
      };
      logResolver("resolve_done", { source: result.source, confidence: result.confidence, ms: Date.now() - startedAt });
      return result;
    }
  }

  // ── STEP 3 — category fallback table ───────────────────────────────────
  const fallback = getFallbackMeasurements({
    category: input.category,
    productName: input.productName,
    selectedSize: sizeLabel,
  });
  const fallbackMissing = expected.filter((f) => fallback.measurements[f as keyof typeof fallback.measurements] == null);
  if (fallbackMissing.length < expected.length) {
    const result: ResolvedGarmentSize = {
      selectedSize: sizeLabel,
      category,
      exactSizeDataAvailable: false,
      source: "category_fallback",
      resolverNote: `Using ${humanizeFallback(fallback.category)} fallback chart for size ${fallback.size}.`,
      confidence: "low",
      measurements: fallback.measurements,
      missingFields: fallbackMissing,
      lastUpdatedAt: null,
    };
    logResolver("resolve_done", { source: result.source, confidence: result.confidence, ms: Date.now() - startedAt });
    return result;
  }

  // ── STEP 4 — brand/category averaged values ─────────────────────────────
  // (We don't track brand keys directly, so we average all rows with a
  // similar category as a wide net. Better than nothing.)
  if (rows.length > 0) {
    const sums: Record<string, { total: number; count: number }> = {};
    for (const r of rows) {
      const m = rowToMeasurements(r);
      for (const [k, v] of Object.entries(m)) {
        if (typeof v === "number") {
          sums[k] = sums[k] ?? { total: 0, count: 0 };
          sums[k].total += v;
          sums[k].count += 1;
        }
      }
    }
    const averaged: ResolvedGarmentSize["measurements"] = {};
    for (const [k, agg] of Object.entries(sums)) {
      if (agg.count > 0) (averaged as any)[k] = Math.round((agg.total / agg.count) * 10) / 10;
    }
    const missingFields = expected.filter((f) => averaged[f as keyof typeof averaged] == null);
    if (missingFields.length < expected.length) {
      const result: ResolvedGarmentSize = {
        selectedSize: sizeLabel,
        category,
        exactSizeDataAvailable: false,
        source: "brand_average",
        resolverNote: `Estimated from average of ${rows.length} known sizes for this product.`,
        confidence: "low",
        measurements: averaged,
        missingFields,
        lastUpdatedAt: null,
      };
      logResolver("resolve_done", { source: result.source, confidence: result.confidence, ms: Date.now() - startedAt });
      return result;
    }
  }

  // ── STEP 5 — completely missing, mark approximate ──────────────────────
  const result: ResolvedGarmentSize = {
    selectedSize: sizeLabel,
    category,
    exactSizeDataAvailable: false,
    source: "approximate",
    resolverNote: `No measurements available for size ${sizeLabel}. Preview is approximate.`,
    confidence: "low",
    measurements: {},
    missingFields: expected,
    lastUpdatedAt: null,
  };
  logResolver("resolve_done", { source: result.source, confidence: result.confidence, ms: Date.now() - startedAt });
  return result;
}

function humanizeFallback(c: ReturnType<typeof pickFallbackCategory>): string {
  return c.replace(/_/g, " ");
}

/**
 * Fire-and-forget: asks an edge function to scrape/AI-extract the product
 * size chart and persist it into garment_measurements. Caller can re-run
 * resolveGarmentSize() after this resolves to pick up fresh data.
 */
export async function requestSizeChartFetch(input: {
  productKey: string;
  productId?: string | null;
  productUrl?: string | null;
  productName?: string | null;
  brand?: string | null;
  category?: string | null;
  selectedSize: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("garment-size-fetch", {
      body: {
        productKey: input.productKey,
        productId: input.productId ?? null,
        productUrl: input.productUrl ?? null,
        productName: input.productName ?? null,
        brand: input.brand ?? null,
        category: input.category ?? null,
        selectedSize: input.selectedSize,
      },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: !!(data as { ok?: boolean })?.ok, error: (data as { error?: string })?.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function numOrUndef(v: unknown): number | undefined {
  const n = typeof v === "string" ? parseFloat(v) : (v as number | null | undefined);
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}
