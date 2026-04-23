// ─── useSizeRecommendation ──────────────────────────────────────────────────
// Orchestrates the new measurement-driven sizing pipeline:
//   1. resolve body (user-provided + inferred + profile gender fallback)
//   2. load garment chart (DB rows → category default fallback, optional scrape)
//   3. calculate all sizes for current preference
//   4. build recommendation + confidence + gender mismatch check
//
// Reactively recomputes on preference change without re-fetching the chart.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  resolveBody,
  loadGarmentChart,
  calculateAllSizes,
  buildRecommendation,
  inferProductGender,
  type FitPreference,
  type GarmentChart,
  type ResolvedBody,
  type SizeRecommendation,
} from "@/lib/sizing";

interface Args {
  productUrl?: string | null;
  productName?: string | null;
  brand?: string | null;
  category?: string | null;
  /** Free-text gender hint already known about the product (e.g. "women"). */
  productGender?: string | null;
  /** Breadcrumb path from the listing/source — improves audience inference. */
  productBreadcrumb?: string | string[] | null;
  /** User body inputs — pass whatever you have. */
  body: {
    gender?: string | null;
    /** slim / regular / solid / heavy — drives the deterministic weight_adj. */
    bodyType?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    shoulderCm?: number | null;
    chestCm?: number | null;
    waistCm?: number | null;
    hipCm?: number | null;
    inseamCm?: number | null;
    /**
     * Per-region body-type scales derived from the user's stated build
     * (slim / regular / solid / heavy → shoulder/chest/waist/hip/leg).
     * Without this two users of the same H/W collapse into identical bodies.
     */
    shapeScales?: {
      shoulderWidthScale?: number;
      chestScale?: number;
      waistScale?: number;
      hipScale?: number;
      legScale?: number;
    } | null;
  };
  /** Per-product override of the global preferred_fit. */
  preferenceOverride?: FitPreference | null;
  enabled?: boolean;
}

interface State {
  body: ResolvedBody | null;
  chart: GarmentChart | null;
  recommendation: SizeRecommendation | null;
  preference: FitPreference;
  globalPreference: FitPreference;
  loadingChart: boolean;
  error: string | null;
}

const DEFAULT_PREFERENCE: FitPreference = "regular";
const VALID_PREFS: FitPreference[] = ["fitted", "regular", "relaxed", "oversized"];

function normalizePref(raw?: string | null): FitPreference {
  const v = (raw || "").toLowerCase();
  if (VALID_PREFS.includes(v as FitPreference)) return v as FitPreference;
  if (v === "slim") return "fitted";
  return DEFAULT_PREFERENCE;
}

export function useSizeRecommendation(args: Args): State {
  const { user } = useAuth();
  const [globalPreference, setGlobalPreference] = useState<FitPreference>(DEFAULT_PREFERENCE);
  const [profileGender, setProfileGender] = useState<string | null>(null);
  const [chart, setChart] = useState<GarmentChart | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1a. Load global preferred_fit from style_profiles (one-shot per user).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("style_profiles")
          .select("preferred_fit")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled && data?.preferred_fit) {
          setGlobalPreference(normalizePref(data.preferred_fit));
        }
      } catch { /* ignore — keep default */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // 1b. Load gender_preference from profiles as a fallback when caller didn't
  //     pass body.gender. This guarantees recommendations are always gendered.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("gender_preference")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled && data?.gender_preference) {
          setProfileGender(data.gender_preference);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const preference: FitPreference = args.preferenceOverride ?? globalPreference;

  // 2. Resolve body — gender falls back to profile when caller didn't supply one.
  const effectiveBodyGender = args.body.gender ?? profileGender ?? null;
  // Stable key so memo doesn't churn on every render of an inline scales object.
  const shapeScalesKey = args.body.shapeScales
    ? JSON.stringify(args.body.shapeScales)
    : "";
  const body = useMemo<ResolvedBody | null>(() => {
    if (args.enabled === false) return null;
    return resolveBody({
      ...args.body,
      gender: effectiveBodyGender,
      bodyType: args.body.bodyType ?? null,
      shapeScales: args.body.shapeScales ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    args.enabled,
    effectiveBodyGender,
    args.body.bodyType,
    args.body.heightCm,
    args.body.weightKg,
    args.body.shoulderCm,
    args.body.chestCm,
    args.body.waistCm,
    args.body.hipCm,
    args.body.inseamCm,
    shapeScalesKey,
  ]);

  // 4. Infer product gender once (depends only on product strings).
  const productGender = useMemo(
    () => inferProductGender({
      explicit: args.productGender ?? null,
      category: args.category ?? null,
      name: args.productName ?? null,
      brand: args.brand ?? null,
      breadcrumb: args.productBreadcrumb ?? null,
    }),
    [args.productGender, args.category, args.productName, args.brand, args.productBreadcrumb],
  );

  // 3. Load chart (async; depends only on product identity, not preference).
  useEffect(() => {
    if (args.enabled === false) return;
    let cancelled = false;
    setLoadingChart(true);
    setError(null);
    (async () => {
      try {
        const c = await loadGarmentChart({
          productUrl: args.productUrl,
          productName: args.productName,
          brand: args.brand,
          category: args.category,
          triggerScrape: true,
          productGender,
        });
        if (!cancelled) setChart(c);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "chart_load_failed");
      } finally {
        if (!cancelled) setLoadingChart(false);
      }
    })();
    return () => { cancelled = true; };
  }, [args.enabled, args.productUrl, args.productName, args.brand, args.category, productGender]);

  // 5. Calculate + recommend (synchronous; recomputes on preference change).
  const recommendation = useMemo<SizeRecommendation | null>(() => {
    if (!body || !chart) return null;
    const outcomes = calculateAllSizes({ body, chart, preference });
    return buildRecommendation({ body, chart, preference, outcomes, productGender });
  }, [body, chart, preference, productGender]);

  return {
    body,
    chart,
    recommendation,
    preference,
    globalPreference,
    loadingChart,
    error,
  };
}
