// ─── GARMENT SIZE RESOLVER ──────────────────────────────────────────────────
// Single source of truth for "do we have REAL size measurements for this
// product + selected size?" Reads from the `garment_measurements` table and
// reports honestly when data is missing/partial. Never invents exact data.
//
// Used by FitEngine + UI to drive the "exact" vs "approximate" distinction.

import { supabase } from "@/integrations/supabase/client";

export interface ResolvedGarmentSize {
  selectedSize: string;
  category: string;                      // tops | bottoms | dresses | outerwear | other
  exactSizeDataAvailable: boolean;       // true only if we have REAL DB data for this size
  source: "db" | "estimator" | "scrape";
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
  /** Names of measurement fields we expected for this category but couldn't find. */
  missingFields: string[];
  /** When the data was last refreshed (DB row updated_at), if known. */
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
  selectedSize: string;
  category?: string | null;
}

/**
 * Look up DB measurements for the exact selected size. NEVER falls back to
 * another size silently — that would leak wrong data into the fit engine.
 */
export async function resolveGarmentSize(input: ResolveInput): Promise<ResolvedGarmentSize> {
  const category = normalizeCategory(input.category);
  const sizeLabel = normalizeSize(input.selectedSize);
  const expected = EXPECTED_FIELDS[category] ?? EXPECTED_FIELDS.other;

  // 1) Try exact (productKey + size) match.
  let row: any = null;
  try {
    const q = await supabase
      .from("garment_measurements")
      .select("*")
      .eq("product_key", input.productKey)
      .eq("size_label", sizeLabel)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = q.data;
  } catch (e) {
    console.warn("[GarmentSizeResolver] DB query failed", e);
  }

  if (row) {
    const measurements = {
      shoulderCm: numOrUndef(row.shoulder_cm),
      chestCm: numOrUndef(row.chest_cm),
      waistCm: numOrUndef(row.waist_cm),
      hipCm: numOrUndef(row.hip_cm),
      sleeveLengthCm: numOrUndef(row.sleeve_cm),
      totalLengthCm: numOrUndef(row.total_length_cm),
      thighCm: numOrUndef(row.thigh_cm),
      inseamCm: numOrUndef(row.inseam_cm),
      riseCm: numOrUndef(row.rise_cm),
      stretchFactor: numOrUndef(row.stretch_factor),
    };
    const missingFields = expected.filter(
      (f) => measurements[f as keyof typeof measurements] == null,
    );
    const completeness = 1 - missingFields.length / expected.length;
    const confidence: ResolvedGarmentSize["confidence"] =
      completeness >= 0.85 ? "high" : completeness >= 0.5 ? "medium" : "low";

    return {
      selectedSize: sizeLabel,
      category,
      exactSizeDataAvailable: missingFields.length === 0,
      source: "db",
      confidence,
      measurements,
      missingFields,
      lastUpdatedAt: row.updated_at ?? null,
    };
  }

  // 2) No DB row — return an explicit "missing" result. Fit engine will
  //    estimate from the existing `estimateGarment()` heuristic but the UI
  //    will render the "approximate preview" warning.
  return {
    selectedSize: sizeLabel,
    category,
    exactSizeDataAvailable: false,
    source: "estimator",
    confidence: "low",
    measurements: {},
    missingFields: expected,
    lastUpdatedAt: null,
  };
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
    return { ok: !!(data as any)?.ok, error: (data as any)?.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function numOrUndef(v: unknown): number | undefined {
  const n = typeof v === "string" ? parseFloat(v) : (v as number | null | undefined);
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}
