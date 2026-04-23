// ─── GARMENT CHART LOADER ───────────────────────────────────────────────────
// Loads ALL sizes for a product from the existing `garment_measurements` table
// (the same table feeding the locked working FIT pipeline). Falls back to
// category defaults when no row exists. Triggers an on-demand scrape if no
// rows are returned and we have a product URL.
//
// IMPORTANT: this is the only place that reads garment_measurements for the
// new sizing pipeline. The existing `garmentSizeResolver` is unchanged.

import { supabase } from "@/integrations/supabase/client";
import {
  CATEGORY_RULES,
  normalizeSizingCategory,
  getDefaultChartForGender,
} from "./categoryRules";
import { requestSizeChartFetch, makeProductKey } from "@/lib/fit/garmentSizeResolver";
import type { Gender, Region, SizingCategory } from "./types";

export interface SizeMeasurements {
  shoulder?: number;
  chest?: number;
  waist?: number;
  hip?: number;
  thigh?: number;
  sleeve?: number;
  inseam?: number;
  length?: number;
}

export interface GarmentChart {
  category: SizingCategory;
  /** Map size label → measurements. Ordered list available via `sizeOrder`. */
  sizes: Record<string, SizeMeasurements>;
  sizeOrder: string[];
  /** Where each size came from. */
  sources: Record<string, "exact" | "graded" | "categoryDefault">;
  /** True when at least one row was found in DB for this product. */
  hasAnyRealData: boolean;
  /** True when we filled in any size from category defaults. */
  usedCategoryDefaults: boolean;
  /** Confidence in the chart as a whole. */
  confidence: "high" | "medium" | "low";
}

interface DbRow {
  size_label: string;
  shoulder_cm: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  sleeve_cm: number | null;
  total_length_cm: number | null;
  thigh_cm: number | null;
  inseam_cm: number | null;
}

const COLS = "size_label, shoulder_cm, chest_cm, waist_cm, hip_cm, sleeve_cm, total_length_cm, thigh_cm, inseam_cm" as const;

const NUMERIC_SIZE = /^\d+(\.\d+)?$/;
const SIZE_RANK: Record<string, number> = {
  XXS: -1, XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5, "2XL": 5, XXXL: 6, "3XL": 6,
};

function normSize(s: string): string {
  return (s || "").trim().toUpperCase();
}

function rankOf(size: string): number {
  if (NUMERIC_SIZE.test(size)) return parseFloat(size);
  return SIZE_RANK[size] ?? 99;
}

function rowToMeasurements(r: DbRow): SizeMeasurements {
  const m: SizeMeasurements = {};
  if (r.shoulder_cm != null)     m.shoulder = Number(r.shoulder_cm);
  if (r.chest_cm != null)        m.chest    = Number(r.chest_cm);
  if (r.waist_cm != null)        m.waist    = Number(r.waist_cm);
  if (r.hip_cm != null)          m.hip      = Number(r.hip_cm);
  if (r.sleeve_cm != null)       m.sleeve   = Number(r.sleeve_cm);
  if (r.total_length_cm != null) m.length   = Number(r.total_length_cm);
  if (r.thigh_cm != null)        m.thigh    = Number(r.thigh_cm);
  if (r.inseam_cm != null)       m.inseam   = Number(r.inseam_cm);
  return m;
}

/** Required regions for this category (drives chart-completeness scoring). */
function requiredRegions(category: SizingCategory): Region[] {
  return CATEGORY_RULES[category].regions;
}

interface ChartInput {
  productUrl?: string | null;
  productName?: string | null;
  brand?: string | null;
  category?: string | null;
  /** When true, fire an on-demand scrape if no DB rows are found. */
  triggerScrape?: boolean;
  /**
   * Resolved gender of the product audience. Drives which standard size
   * table is used for the fallback chart (male vs female per the strict
   * FIT spec). When unknown, the unisex default is used.
   */
  productGender?: Gender | null;
}

export async function loadGarmentChart(input: ChartInput): Promise<GarmentChart> {
  const category = normalizeSizingCategory(input.category, input.productName);
  const productKey = makeProductKey({ url: input.productUrl, name: input.productName, brand: input.brand });

  // 1. Fetch any rows we already have.
  let rows = await fetchRows(productKey);

  // 2. If we have nothing AND can scrape — fire scraper, wait briefly, retry.
  if (rows.length === 0 && input.triggerScrape && (input.productUrl || input.productName)) {
    const scrape = requestSizeChartFetch({
      productKey,
      productUrl: input.productUrl,
      productName: input.productName,
      brand: input.brand,
      category: input.category,
      selectedSize: "M",
    });
    // Race against ~3s — never block longer than that.
    const timeout = new Promise<{ ok: false }>((res) => setTimeout(() => res({ ok: false }), 3000));
    await Promise.race([scrape, timeout]);
    rows = await fetchRows(productKey);
  }

  return buildChart(category, rows, input.productGender ?? null);
}

async function fetchRows(productKey: string): Promise<DbRow[]> {
  try {
    const { data } = await supabase
      .from("garment_measurements")
      .select(COLS)
      .eq("product_key", productKey)
      .order("updated_at", { ascending: false });
    return (data as DbRow[] | null) ?? [];
  } catch (e) {
    console.warn("[sizing/chart] db query failed", e);
    return [];
  }
}

function buildChart(category: SizingCategory, rows: DbRow[], productGender: Gender | null): GarmentChart {
  const rule = CATEGORY_RULES[category];
  const required = requiredRegions(category);
  // Pick the gender-aware standard size table when available — per the
  // strict FIT spec, men's and women's tops/pants don't share a chart.
  const fallbackChart = productGender
    ? getDefaultChartForGender(rule, productGender)
    : rule.defaultChart;

  const sizes: Record<string, SizeMeasurements> = {};
  const sources: Record<string, "exact" | "graded" | "categoryDefault"> = {};
  const hasAnyRealData = rows.length > 0;

  // 1. Real DB rows first.
  for (const r of rows) {
    const label = normSize(r.size_label);
    if (!label) continue;
    if (!sizes[label]) {
      sizes[label] = rowToMeasurements(r);
      sources[label] = "exact";
    }
  }

  // 2. Fill in default sizes that aren't present (so user always sees a full ladder).
  let usedCategoryDefaults = false;
  for (const [label, def] of Object.entries(fallbackChart)) {
    if (!sizes[label]) {
      sizes[label] = { ...def };
      sources[label] = "categoryDefault";
      usedCategoryDefaults = true;
    } else {
      // Merge missing fields from default chart so each size has a full picture.
      const cur = sizes[label];
      let mergedAny = false;
      for (const [k, v] of Object.entries(def)) {
        if ((cur as any)[k] == null && typeof v === "number") {
          (cur as any)[k] = v;
          mergedAny = true;
        }
      }
      if (mergedAny && sources[label] === "exact") sources[label] = "graded";
    }
  }

  const sizeOrder = Object.keys(sizes).sort((a, b) => rankOf(a) - rankOf(b));

  // Confidence: based on per-size completeness on required regions.
  let totalReq = 0;
  let totalFilled = 0;
  let exactSizes = 0;
  for (const size of sizeOrder) {
    const m = sizes[size];
    if (sources[size] === "exact") exactSizes += 1;
    for (const r of required) {
      totalReq += 1;
      if ((m as any)[r] != null) totalFilled += 1;
    }
  }
  const completeness = totalReq > 0 ? totalFilled / totalReq : 0;
  const exactRatio = sizeOrder.length > 0 ? exactSizes / sizeOrder.length : 0;
  let confidence: "high" | "medium" | "low" = "low";
  if (hasAnyRealData && exactRatio >= 0.6 && completeness >= 0.85) confidence = "high";
  else if (hasAnyRealData || completeness >= 0.7) confidence = "medium";

  return {
    category,
    sizes,
    sizeOrder,
    sources,
    hasAnyRealData,
    usedCategoryDefaults,
    confidence,
  };
}
