import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShieldCheck, AlertTriangle, ExternalLink, RotateCcw, Pencil, Sparkles, Loader2, Lock, Wand2, Globe2, X, BarChart3, Info } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FitResult, SizeFitResult } from "@/lib/fitEngine";
import SafeImage from "@/components/SafeImage";
import TryOnPreviewModal, { TryOnContext } from "@/components/fit/TryOnPreviewModal";
import SelectedProductCard from "@/components/fit/SelectedProductCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { FitMode } from "@/pages/FitPage";
import { buildFitExplanation as buildLegacyExplanation, confidenceTier } from "@/lib/fit/explain";
import { normalizeBodyProfile } from "@/lib/fit/bodyProfile";
import { estimateGlobalSize, shouldUseGlobalFallback } from "@/lib/fit/globalSize";
import FitVisual from "@/components/fit/FitVisual";
import { useFitTryOn } from "@/hooks/useFitTryOn";
import { buildBodyProfile } from "@/lib/fit/buildBodyProfile";
import { buildGarmentFitMap } from "@/lib/fit/buildGarmentFitMap";
import { buildBodyShapeScales, type BodyShapeInput } from "@/lib/fit/bodyShape";
import { buildFitExplanation as buildSizeExplanation, buildFitBreakdown } from "@/lib/fit/buildFitExplanation";
import { solveFit, FIT_TYPE_LABEL } from "@/lib/fit/fitSolver";
import FitBreakdown from "@/components/fit/FitBreakdown";
import FitSummaryPanel from "@/components/fit/FitSummaryPanel";
import FitExplanationCard from "@/components/fit/FitExplanationCard";
import SelectedSizeFitCard from "@/components/fit/SelectedSizeFitCard";
import { resolveBestProductImage } from "@/lib/fit/resolveBestProductImage";
import RegionFitTable from "@/components/fit/RegionFitTable";
import { useResolvedGarmentSize } from "@/hooks/useResolvedGarmentSize";
import { computeRegionFit } from "@/lib/fit/regionFitEngine";
import { useSizeRecommendation } from "@/hooks/useSizeRecommendation";
import SizeRecommendationPanel from "@/components/fit/SizeRecommendationPanel";
import { overallLabelText, type FitPreference, type RegionStatus } from "@/lib/sizing";
import { baselineFitVerdict, describeBaselineConsequence } from "@/lib/fit/sizeBaseline";
import ChangeBodySheet, { type ChangeBodyAction } from "@/components/fit/ChangeBodySheet";
import { computeBodyDNA } from "@/lib/fit/bodyDNA";
import { useBodySignatureGuard } from "@/hooks/useBodySignatureGuard";
import { extractGarmentDNA } from "@/lib/fit/garmentDNA";
import { computeRegionPhysics, buildVisualInstructionLines, describeOverallFit } from "@/lib/fit/fitPhysics";
import FitTrustStrip from "@/components/fit/FitTrustStrip";
import { computeSizeCorrelation, sizesFromGarmentChart } from "@/lib/fit/sizeCorrelationEngine";
import FitAnalysisPanel from "@/components/fit/FitAnalysisPanel";
import { applyBrandFitBias } from "@/lib/fit/brandFitBias";
import {
  buildGenderedSizeContext,
  buildGenderDirective,
  defaultMeasurementsForAllSizes,
} from "@/lib/fit/genderedSizeSystem";

/** Map measurement-engine status → visual try-on fit descriptor. */
const STATUS_TO_FIT_DESCRIPTOR: Record<RegionStatus, string> = {
  tooTight: "too-tight",
  slightlyTight: "slightly-tight",
  regular: "regular",
  slightlyLoose: "slightly-loose",
  loose: "loose",
  oversized: "oversized",
};

interface FitProduct {
  id: string;
  name: string;
  brand: string;
  price: number | null;
  image: string;
  url: string;
  category: string;
}

interface Props {
  result: FitResult;
  product: FitProduct;
  explanation: string | null;
  loadingExplanation: boolean;
  fitMode: FitMode;
  canUsePremium: boolean;
  refining: boolean;
  bodyHeightCm?: number;
  bodyWeightKg?: number | null;
  bodyShape?: BodyShapeInput;
  /** Optional structured user measurements (cm) for the new sizing engine. */
  bodyGender?: string | null;
  bodyShoulderCm?: number | null;
  bodyChestCm?: number | null;
  bodyWaistCm?: number | null;
  bodyHipCm?: number | null;
  bodyInseamCm?: number | null;
  userBodyImageUrl?: string | null;
  onRefineFit?: () => void;
  onRescan?: () => void;
  onEditMeasurements?: () => void;
}

/* ── helpers ── */

const FRIENDLY_LABEL: Record<string, string> = {
  "balanced": "PERFECT FIT",
  "fitted": "FITTED",
  "relaxed": "RELAXED",
  "oversized": "SLIGHTLY LOOSE",
  "slightly-tight": "SNUG",
  "too-tight": "TOO TIGHT",
  "too-loose": "TOO LOOSE",
  "good-length": "RIGHT LENGTH",
  "slightly-short": "SLIGHTLY SHORT",
  "too-short": "TOO SHORT",
  "slightly-long": "SLIGHTLY LONG",
  "too-long": "TOO LONG",
};
const fitLabel = (fit: string) => FRIENDLY_LABEL[fit] ?? fit.replace(/-/g, " ").toUpperCase();

const fitColor = (fit: string) => {
  if (fit.includes("tight")) return "text-orange-500";
  if (fit.includes("short")) return "text-orange-400";
  if (fit === "fitted" || fit === "balanced" || fit === "good-length") return "text-green-500";
  if (fit === "relaxed") return "text-blue-400";
  if (fit.includes("loose") || fit === "oversized") return "text-blue-500";
  if (fit.includes("long")) return "text-blue-400";
  return "text-foreground/75";
};

/* ── Size Comparison Card ── */
function SizeComparisonCard({ result, isRecommended, isAlternate }: {
  result: SizeFitResult;
  isRecommended: boolean;
  isAlternate: boolean;
}) {
  const [expanded, setExpanded] = useState(isRecommended);
  return (
    <div className={`rounded-2xl border transition-colors ${
      isRecommended ? "border-foreground/[0.08] bg-card/40"
        : isAlternate ? "border-foreground/[0.08] bg-card/40"
        : "border-foreground/[0.04] bg-card/20"
    }`}>
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl font-bold text-foreground">{result.size}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-1 border-t border-foreground/[0.04] pt-3">
              {result.regions.map(r => (
                <div key={r.region} className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-foreground/60">{r.region}</span>
                  <span className={`text-[10px] font-bold uppercase ${fitColor(r.fit)}`}>{fitLabel(r.fit)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Component ── */
export default function FitResults({
  result,
  product,
  explanation,
  loadingExplanation,
  fitMode,
  canUsePremium,
  refining,
  bodyHeightCm,
  bodyWeightKg,
  bodyShape,
  bodyGender,
  bodyShoulderCm,
  bodyChestCm,
  bodyWaistCm,
  bodyHipCm,
  bodyInseamCm,
  userBodyImageUrl,
  onRefineFit,
  onRescan,
  onEditMeasurements,
}: Props) {
  const { user } = useAuth();
  const isRefined = fitMode === "premium";

  // ── CANONICAL PRODUCT IMAGE — defense in depth ──────────────────────────
  // Re-resolve through the canonical helper so downstream consumers (FitVisual,
  // useCanvasTryOn, TryOnPreviewModal) all see the same recovered image even
  // if the upstream product object had an empty/null image field.
  const resolvedProductImage = useMemo(
    () => resolveBestProductImage(product).src ?? product.image ?? "",
    [product]
  );

  // Active size = user-selected; defaults to recommended.
  const [activeSize, setActiveSize] = useState<string>(result.recommendedSize);
  useEffect(() => { setActiveSize(result.recommendedSize); }, [result.recommendedSize]);
  const activeSizeResult = result.sizeResults.find(s => s.size === activeSize)
    ?? result.sizeResults.find(s => s.recommended);
  const heroScore = activeSizeResult?.fitScore ?? 0;

  // ══ NEW MEASUREMENT-DRIVEN SIZING PIPELINE ═══════════════════════════════
  // Runs ALONGSIDE the legacy fitEngine (which stays the locked working model
  // for the visual try-on prompt). The new panel + recommendation feeds back
  // into `activeSize` and into the visual try-on `regions` payload so the AI
  // image visualizes the CALCULATED fit (S=tight / M=fit / L=regular / XL=loose).
  const [sizingPrefOverride, setSizingPrefOverride] = useState<FitPreference | null>(null);
  // Per-region body-type scales — computed early so the sizing hook can use
  // them. (Legacy uses are below; this memo replaces the duplicate at line 265.)
  const shapeScales = useMemo(() => buildBodyShapeScales(bodyShape ?? null), [bodyShape]);
  const sizing = useSizeRecommendation({
    productUrl: product.url,
    productName: product.name,
    brand: product.brand,
    category: product.category,
    productGender: (product as any).gender ?? null,
    productBreadcrumb: (product as any).breadcrumb ?? null,
    body: {
      gender: bodyGender ?? null,
      bodyType: bodyShape ? String((bodyShape as any).build ?? "") : null,
      heightCm: bodyHeightCm ?? null,
      weightKg: bodyWeightKg ?? null,
      shoulderCm: bodyShoulderCm ?? null,
      chestCm: bodyChestCm ?? null,
      waistCm: bodyWaistCm ?? null,
      hipCm: bodyHipCm ?? null,
      inseamCm: bodyInseamCm ?? null,
      // Pass per-region body-type scales so slim/regular/solid/heavy users
      // with the same H/W don't collapse into identical estimated bodies.
      shapeScales: shapeScales ?? null,
    },
    preferenceOverride: sizingPrefOverride,
  });

  // When the new engine produces a primary size that exists in the legacy
  // size ladder, prefer it as the default active size. Never override a user
  // pick — only sync once when the recommendation first arrives.
  // (Auto-sync to "recommended" size removed — user picks their own size; we
  // never push them toward a recommendation. The visualization simply reflects
  // whichever size they tapped.)

  // Active size outcome from the new measurement-driven engine.
  // Used to feed the visual try-on with calculated per-region fit so the AI
  // image visualizes the computed result instead of guessing.
  const sizingActiveOutcome = useMemo(
    () => sizing.recommendation?.sizes.find((s) => s.size === activeSize) ?? null,
    [sizing.recommendation, activeSize],
  );

  // ── Global fallback + confidence (honest tiers) ──────────────────────────
  const usedGlobalFallback = shouldUseGlobalFallback(result.productDataQuality, true) || result.productDataQuality < 50;
  const confTier = confidenceTier(result.confidenceModifier, usedGlobalFallback);
  const confLabel = confTier === "high" ? "HIGH" : confTier === "medium" ? "MEDIUM" : "LIMITED";
  const confColor = confTier === "high" ? "text-green-500"
                  : confTier === "medium" ? "text-accent"
                  : "text-orange-500";
  const confBg = confTier === "high" ? "bg-green-500/10"
                : confTier === "medium" ? "bg-accent/10"
                : "bg-orange-500/10";

  const heroFitType = heroScore >= 80 ? "Best fit" : heroScore >= 65 ? "Good fit" : heroScore >= 50 ? "Wearable" : "Poor fit";
  const heroColor = heroScore >= 80 ? "text-green-500" : heroScore >= 65 ? "text-accent" : heroScore >= 50 ? "text-orange-400" : "text-orange-500";
  const heroRing = heroScore >= 80 ? "ring-green-500/30" : heroScore >= 65 ? "ring-accent/30" : heroScore >= 50 ? "ring-orange-400/30" : "ring-orange-500/30";

  // ── Deterministic explanation (always available; AI text overrides if present) ──
  const builtExplanation = buildLegacyExplanation(result, confTier, usedGlobalFallback);

  // ── NEW: size-aware silhouette explanation + breakdown ──
  // (shapeScales is declared earlier so the new sizing hook can read it.)
  const newBodyProfile = useMemo(() => buildBodyProfile({
    heightCm: bodyHeightCm ?? null,
    weightKg: bodyWeightKg ?? null,
    shapeScales,
  }), [bodyHeightCm, bodyWeightKg, shapeScales]);
  const garmentFit = useMemo(() => buildGarmentFitMap({
    category: product.category,
    selectedSize: activeSize,
    fitType: null,
    body: newBodyProfile,
  }), [product.category, activeSize, newBodyProfile]);
  const breakdown = useMemo(() => buildFitBreakdown(garmentFit), [garmentFit]);

  // ── FIT SOLVER — deterministic source of truth (score / labels / hints) ──
  const solver = useMemo(
    () => solveFit({
      body: newBodyProfile,
      fit: garmentFit,
      category: garmentFit.category,
      selectedSize: activeSize,
    }),
    [newBodyProfile, garmentFit, activeSize],
  );

  // Explanation reads solver labels so the copy always matches the visual.
  const sizeExplanation = useMemo(
    () => buildSizeExplanation({ fit: garmentFit, body: newBodyProfile, size: activeSize, solver }),
    [garmentFit, newBodyProfile, activeSize, solver],
  );

  // ── REGION FIT (truthful, region-by-region, with on-demand size scrape) ──
  const resolvedSize = useResolvedGarmentSize({
    productUrl: product.url,
    productName: product.name,
    brand: product.brand,
    category: product.category,
    selectedSize: activeSize,
  });
  const regionFit = useMemo(
    () =>
      resolvedSize.resolved
        ? computeRegionFit({ body: newBodyProfile, garment: resolvedSize.resolved })
        : null,
    [resolvedSize.resolved, newBodyProfile],
  );

  // ── GARMENT DNA + FIT PHYSICS (V3.6) ─────────────────────────────────────
  const garmentDNA = useMemo(
    () => extractGarmentDNA({
      name: product.name,
      brand: product.brand,
      category: product.category,
      breadcrumb: (product as any).breadcrumb ?? null,
      description: (product as any).description ?? null,
      fitType: (product as any).fitType ?? null,
      hasSizeChart: !!resolvedSize.resolved,
    }),
    [product, resolvedSize.resolved],
  );
  const regionPhysics = useMemo(() => {
    if (!regionFit) return [];
    return regionFit.regions.map((r) =>
      computeRegionPhysics(
        { region: r.region.toLowerCase(), bodyCm: r.bodyValueCm ?? null, garmentCm: r.garmentValueCm ?? null },
        garmentDNA,
      ),
    );
  }, [regionFit, garmentDNA]);
  const visualInstructionLines = useMemo(
    () => buildVisualInstructionLines(regionPhysics, garmentDNA),
    [regionPhysics, garmentDNA],
  );
  // Overall fit label for the active size (used by analysis copy).
  const overallPhysicsLabel: import("@/lib/fit/fitPhysics").FitLabel = useMemo(() => {
    if (!regionPhysics.length) return "regular";
    const counts: Record<string, number> = {};
    regionPhysics.forEach((r) => { counts[r.fitLabel] = (counts[r.fitLabel] ?? 0) + 1; });
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "regular") as any;
  }, [regionPhysics]);
  const overallFitSentence = useMemo(
    () => describeOverallFit(overallPhysicsLabel, garmentDNA, activeSize),
    [overallPhysicsLabel, garmentDNA, activeSize],
  );

  // ── GENDERED SIZE SYSTEM (V3.9) — target gender + cross-gender context ──
  const genderedContext = useMemo(
    () => buildGenderedSizeContext({
      body: { gender: (bodyGender as any) ?? null },
      detection: {
        name: product.name,
        brand: product.brand,
        category: product.category,
        breadcrumb: (product as any).breadcrumb ?? null,
        description: (product as any).description ?? null,
        url: product.url,
        sizeLabels: sizing.chart?.sizeOrder ?? null,
        metadataGender: (product as any).gender ?? null,
      },
      macro: garmentDNA.category,
      type: garmentDNA.garmentType,
      selectedSizeLabel: activeSize,
      hasExactChart: !!sizing.chart && (sizing.chart.sizeOrder?.length ?? 0) > 0,
    }),
    [bodyGender, product, sizing.chart, garmentDNA.category, garmentDNA.garmentType, activeSize],
  );

  // ── SIZE CORRELATION (V3.8 + V3.9) — per-size numeric fit + directives ────
  const sizeCorrelation = useMemo(() => {
    // Prefer exact chart; fall back to gender-aware default measurements.
    let sizes = sizing.chart && sizing.chart.sizeOrder?.length
      ? sizesFromGarmentChart(sizing.chart as any)
      : defaultMeasurementsForAllSizes({
          targetGender: genderedContext.garmentTargetGender,
          macro: garmentDNA.category,
          type: garmentDNA.garmentType,
        });
    if (!sizes.length) return null;
    const adjustedBody = applyBrandFitBias(
      {
        shoulderCm: bodyShoulderCm ?? null,
        chestCm: bodyChestCm ?? null,
        waistCm: bodyWaistCm ?? null,
        hipCm: bodyHipCm ?? null,
        inseamCm: bodyInseamCm ?? null,
      },
      product.brand,
      product.category,
      1,
      genderedContext.garmentTargetGender,
    );
    return computeSizeCorrelation({
      body: {
        gender: (bodyGender as any) ?? null,
        heightCm: bodyHeightCm ?? null,
        weightKg: bodyWeightKg ?? null,
        ...adjustedBody,
      },
      garmentDNA,
      sizes,
      selectedSize: activeSize,
      preference: sizing.preference as any,
    });
  }, [sizing.chart, sizing.preference, garmentDNA, activeSize, bodyHeightCm, bodyWeightKg, bodyGender, bodyShoulderCm, bodyChestCm, bodyWaistCm, bodyHipCm, bodyInseamCm, product.brand, product.category, genderedContext]);



  // ── Global size fallback card (only when truly missing brand data) ───────
  const profile = bodyHeightCm
    ? normalizeBodyProfile({ heightCm: bodyHeightCm, weightKg: bodyWeightKg ?? null })
    : null;
  const globalSize = profile ? estimateGlobalSize(profile.heightCm, profile.frame) : null;

  // ── User body extracts for visual (estimated from height/weight) ─────────
  const estUserShoulder = profile?.frame === "broad" ? 50 : profile?.frame === "slim" ? 42 : 46;
  const estUserChest = bodyWeightKg ? Math.max(50, Math.min(72, bodyWeightKg * 0.55 + 18)) : 56;

  // ── Try-on availability ─────────────────────────────────────────────────
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [dbUserImageUrl, setDbUserImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (userBodyImageUrl) {
      setDbUserImageUrl(null);
      return;
    }
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("body_scan_images")
        .select("public_url, storage_path, image_type, created_at")
        .eq("user_id", user.id)
        .eq("image_type", "front")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      let url = data.public_url ?? null;
      if (!url && data.storage_path) {
        const { data: signed } = await supabase.storage
          .from("body-scans")
          .createSignedUrl(data.storage_path, 60 * 60 * 6);
        url = signed?.signedUrl ?? null;
      }
      if (!cancelled && url) setDbUserImageUrl(url);
    })();
    return () => { cancelled = true; };
  }, [user, userBodyImageUrl]);

  const resolvedUserImageUrl = userBodyImageUrl ?? dbUserImageUrl ?? null;

  useEffect(() => {
    console.log("[FIT_PREVIEW]", {
      event: "fit_results_image_source",
      hasPropImage: !!userBodyImageUrl,
      hasDbImage: !!dbUserImageUrl,
      resolvedUserImageUrl: resolvedUserImageUrl ? "present" : "missing",
      productImageUrl: resolvedProductImage ? "present" : "missing",
      productImageSource: resolveBestProductImage(product).source,
      productKey: `${product.url || product.name}::${product.brand || ""}`.toLowerCase().slice(0, 200),
    });
  }, [userBodyImageUrl, dbUserImageUrl, resolvedUserImageUrl, resolvedProductImage, product]);

  const tryOnReady = !!resolvedUserImageUrl && !!resolvedProductImage;
  // ── BODY DNA — locks (body + garment + size) into a single cache cell ──
  // Means switching sizes only flips the size segment of the key. Switching
  // bodies (presets, new upload, edits) creates a fresh signature so the AI
  // image regenerates instead of returning a stale cached result on top of
  // the new body.
  const bodyDNA = useMemo(() => computeBodyDNA({
    heightCm: bodyHeightCm ?? null,
    weightKg: bodyWeightKg ?? null,
    gender: bodyGender ?? null,
    shoulderCm: bodyShoulderCm ?? null,
    chestCm: bodyChestCm ?? null,
    waistCm: bodyWaistCm ?? null,
    hipCm: bodyHipCm ?? null,
    inseamCm: bodyInseamCm ?? null,
    bodyImageUrl: resolvedUserImageUrl ?? null,
  }), [bodyHeightCm, bodyWeightKg, bodyGender, bodyShoulderCm, bodyChestCm, bodyWaistCm, bodyHipCm, bodyInseamCm, resolvedUserImageUrl]);
  // V4.0 — drop every cached fit artifact when the body changes, abort stale renders.
  useBodySignatureGuard(bodyDNA.signature);
  const productKey = `${product.url || product.name}::${product.brand || ""}::body_${bodyDNA.signature}`.toLowerCase().slice(0, 240);
  const tryOnContext: TryOnContext | null = tryOnReady
    ? {
        userImageUrl: resolvedUserImageUrl!,
        productImageUrl: resolvedProductImage,
        productName: product.name,
        productBrand: product.brand,
        productUrl: product.url,
        category: product.category,
        recommendedSize: activeSize,
        confidence: confLabel,
        fitDescriptor: activeSizeResult?.regions.find(r => r.region === "Chest")?.fit?.toString() || "regular",
        productKey,
        regions: activeSizeResult?.regions ?? [],
      }
    : null;

  // ── Reload token: bump to force-regenerate the AI fitting image ──
  const [reloadToken, setReloadToken] = useState(0);

  // ── PRIMARY visual: DIRECT AI fitting image (no intermediate composite) ──
  // The fit-tryon-router edge function persists every successful generation
  // to the `fit-composites` storage bucket and returns a stable public URL,
  // so the same result renders identically in preview, new windows, and on
  // any device for any logged-in user with a body scan.
  const tryOn = useFitTryOn({
    // Studio AI fit only needs the product image + body measurements.
    // The user photo is optional — public visitors and users without a body
    // scan still get a final AI fitting image. This unblocks new windows /
    // other accounts where the signed body-scan URL isn't available.
    enabled: !!resolvedProductImage,
    productKey,
    productImageUrl: resolvedProductImage,
    productName: product.name,
    productCategory: product.category,
    selectedSize: activeSize,
    userImageUrl: resolvedUserImageUrl ?? null,
    // ── PRIMARY: feed the visual try-on the CALCULATED per-region fit from
    // the new measurement-driven engine, so the AI image visualizes the
    // computed fit (S=tight, M=fitted, L=regular, XL=oversized) instead of
    // generating a generic fashion shot. Falls back to legacy regions if the
    // engine hasn't resolved yet.
    fitDescriptor:
      sizingActiveOutcome?.overall ??
      (activeSizeResult?.regions.find((r) => r.region === "Chest")?.fit?.toString() || "regular"),
    regions: (() => {
      const bodyByRegion: Record<string, number | null> = {
        shoulder: bodyShoulderCm ?? null,
        chest: bodyChestCm ?? null,
        waist: bodyWaistCm ?? null,
        hip: bodyHipCm ?? null,
        inseam: bodyInseamCm ?? null,
      };
      const lookup = (region: string) => bodyByRegion[region.toLowerCase()] ?? null;
      if (sizingActiveOutcome) {
        return sizingActiveOutcome.regions.map((r) => {
          const bodyCm = lookup(r.region);
          const garmentCm = bodyCm != null && r.deltaCm != null ? Math.round((bodyCm + r.deltaCm) * 10) / 10 : null;
          return {
            region: r.region,
            fit: STATUS_TO_FIT_DESCRIPTOR[r.status],
            deltaCm: r.deltaCm ?? null,
            bodyCm,
            garmentCm,
          };
        });
      }
      return activeSizeResult?.regions?.map((r) => ({ region: r.region, fit: String(r.fit) })) ?? [];
    })(),
    bodyProfileSummary: {
      heightCm: bodyHeightCm ?? null,
      weightKg: bodyWeightKg ?? null,
      build: bodyShape ? String((bodyShape as any).build ?? "") : null,
      gender: bodyGender ?? null,
      bodyType: bodyShape ? String((bodyShape as any).build ?? "") : null,
      shoulderCm: bodyShoulderCm ?? null,
      chestCm: bodyChestCm ?? null,
      waistCm: bodyWaistCm ?? null,
      hipCm: bodyHipCm ?? null,
      inseamCm: bodyInseamCm ?? null,
      userBodyImageUrl: resolvedUserImageUrl ?? null,
    },
    baselineVerdict: (() => {
      // Cross-gender support: compute baseline against the GARMENT's gender
      // chart when the user's body gender differs from the product's intended
      // audience. A 80kg male picking a women's L gets a verdict reflecting
      // women's L (≈ tops out at 75kg) — i.e. one step undersized — instead
      // of being silently mapped to a men's L.
      const productGender = (product as any).gender ?? null;
      const v = baselineFitVerdict(activeSize, bodyWeightKg ?? null, bodyGender ?? null, productGender);
      return {
        baseline: v.baseline,
        offset: v.offset,
        verdict: v.verdict,
        consequence: describeBaselineConsequence({
          weightKg: bodyWeightKg ?? null,
          gender: bodyGender ?? null,
          currentSize: activeSize,
          category: product.category,
          productGender,
        }),
        // Mark as fallback when product brand-data quality is low.
        fallbackMode: result.productDataQuality < 50,
      };
    })(),
    reloadToken,
    genderDirective: buildGenderDirective(genderedContext, { gender: (bodyGender as any) ?? null }),
    genderedSizing: {
      targetGender: genderedContext.garmentTargetGender,
      isCrossGender: genderedContext.isCrossGender,
      sizeSystem: genderedContext.sizeSystem,
      confidence: genderedContext.confidence,
    },
  });

  // (sizingActiveOutcome memo is declared earlier so useFitTryOn can read it.)

  // Per-region fit chips computed from the deterministic solver.
  const fitChipsForVisual = useMemo(() => {
    const isBottom = garmentFit.category === "bottom";
    const tone = (fit: string): "tight" | "regular" | "loose" => {
      if (/(tight|snug|pulled|trim|short)/i.test(fit)) return "tight";
      if (/(loose|oversized|relaxed|roomy|dropped|long)/i.test(fit)) return "loose";
      return "regular";
    };
    const all = [
      { region: "Chest", fit: solver.regions.chest.fit },
      { region: "Waist", fit: solver.regions.waist.fit },
      ...(isBottom ? [] : [{ region: "Shoulder", fit: solver.regions.shoulder.fit }]),
      { region: "Length", fit: solver.regions.length.fit },
      ...(isBottom ? [] : [{ region: "Sleeve", fit: solver.regions.sleeve.fit }]),
    ];
    return all.map((r) => ({ ...r, tone: tone(r.fit) }));
  }, [solver, garmentFit.category]);

  // ── Analyze sheet (holds the deep numbers + region tables + comparisons) ──
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [changeBodyOpen, setChangeBodyOpen] = useState(false);

  const handleChangeBody = (a: ChangeBodyAction) => {
    if (a.type === "rescan") onRescan?.();
    else if (a.type === "edit") onEditMeasurements?.();
    // Presets: signal a rescan-style flow today; future hook can swap profile.
    else if (a.type === "preset") onEditMeasurements?.();
    setReloadToken((n) => n + 1);
  };

  // ── Editorial fit phrases — short fashion language for the hero caption.
  // Driven by the deterministic solver so wording always matches the visual.
  const editorialPhrases = useMemo(() => {
    const phrase = (raw: string, region: "torso" | "waist" | "shoulder" | "length") => {
      const l = (raw || "").toLowerCase();
      const tone = /(tight|snug|trim|pulled|short)/.test(l)
        ? "Trim"
        : /(loose|oversized|relaxed|roomy|dropped|long)/.test(l)
        ? "Relaxed"
        : "Clean";
      const noun =
        region === "torso" ? "torso"
        : region === "waist" ? "waist silhouette"
        : region === "shoulder" ? "shoulder structure"
        : "length line";
      return `${tone} ${noun}`;
    };
    const isBottom = garmentFit.category === "bottom";
    const arr: string[] = [];
    if (!isBottom) arr.push(phrase(solver.regions.shoulder.fit, "shoulder"));
    arr.push(phrase(solver.regions.chest.fit, "torso"));
    arr.push(phrase(solver.regions.waist.fit, "waist"));
    return arr;
  }, [solver, garmentFit.category]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl space-y-12 overflow-x-hidden md:space-y-16">
      {/* Eyebrow — refined chapter heading, no boxes */}
      <div className="flex items-center justify-center gap-2">
        {isRefined && <Sparkles className="h-3 w-3 text-accent" />}
        <span className="text-[9px] font-medium tracking-[0.45em] text-foreground/45 uppercase">
          {isRefined ? "Refined Fitting" : "The Fitting"}
        </span>
      </div>

      {/* ══ HERO — visual is the emotional center ══ */}
      <div className="space-y-10 md:space-y-14">
        {/* Editorial visual — extends edge-to-edge on mobile */}
        <div className="-mx-4 sm:mx-0">
          <FitVisual
            productName={product.name}
            activeSize={activeSize}
            state={tryOn}
            onRescanBody={onRescan}
            onRetry={() => {
              tryOn.retry();
              setReloadToken((n) => n + 1);
            }}
            fitChips={fitChipsForVisual}
            overallFit={sizingActiveOutcome?.overall ?? null}
            fitRegions={sizingActiveOutcome?.regions ?? []}
            bodyGender={bodyGender ?? null}
          />
        </div>

        {/* Magazine caption — brand · garment · size */}
        <div className="space-y-3 px-2 text-center">
          <p className="text-[10px] font-medium tracking-[0.4em] text-foreground/45 uppercase">
            {product.brand}
          </p>
          <h1 className="font-display text-2xl font-light leading-tight tracking-[-0.01em] text-foreground md:text-3xl">
            {product.name}
          </h1>
          <motion.p
            key={activeSize}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="pt-1 text-[11px] tracking-[0.3em] text-foreground/45 uppercase"
          >
            Size <span className="ml-1 text-foreground/80">{activeSize}</span>
          </motion.p>
        </div>

        {/* Editorial fit narrative */}
        <div className="mx-auto max-w-md space-y-5 text-center">
          <p className="text-[15px] font-light leading-[1.7] text-foreground/80">
            {overallFitSentence}
          </p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 pt-1">
            {editorialPhrases.map((p) => (
              <span
                key={p}
                className="text-[10px] tracking-[0.2em] text-foreground/55 uppercase"
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Size selector — quiet underline switcher, no heavy boxes */}
        <div className="space-y-4">
          <p className="text-center text-[9px] font-medium tracking-[0.4em] text-foreground/40 uppercase">
            Try another size
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {result.sizeResults.map((sr) => {
              const isActive = sr.size === activeSize;
              return (
                <button
                  key={sr.size}
                  onClick={() => setActiveSize(sr.size)}
                  className={`relative px-5 py-2 text-[12px] font-medium tracking-[0.18em] uppercase transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-foreground/35 hover:text-foreground/70"
                  }`}
                >
                  {sr.size}
                  {isActive && (
                    <motion.span
                      layoutId="fit-size-underline"
                      className="absolute -bottom-0.5 left-1/2 h-px w-6 -translate-x-1/2 bg-accent"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quiet actions — text-led, no heavy primary buttons */}
      <div className="flex flex-col items-center gap-6 pt-2">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setAnalyzeOpen(true)}
            className="text-[10px] font-medium tracking-[0.32em] text-foreground/80 uppercase transition-colors hover:text-foreground"
          >
            View full analysis
          </button>
          <span className="h-3 w-px bg-foreground/15" />
          <button
            onClick={() => setChangeBodyOpen(true)}
            className="text-[10px] font-medium tracking-[0.32em] text-foreground/80 uppercase transition-colors hover:text-foreground"
          >
            Change body
          </button>
        </div>
        {product.url && product.url !== "#" && (
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border-b border-accent/40 pb-1 text-[10px] font-medium tracking-[0.32em] text-accent uppercase transition-colors hover:border-accent"
          >
            Shop this look
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {onEditMeasurements && (
          <button
            onClick={onEditMeasurements}
            className="flex items-center gap-1.5 text-[10px] tracking-[0.22em] text-foreground/35 uppercase transition-colors hover:text-foreground/70"
          >
            <Pencil className="h-3 w-3" /> Edit measurements
          </button>
        )}
      </div>

      {/* ══ CHANGE BODY SHEET — V3.5 ══ */}
      <ChangeBodySheet
        open={changeBodyOpen}
        onOpenChange={setChangeBodyOpen}
        onAction={handleChangeBody}
      />

      {/* ══ ANALYZE SHEET — all the deep numbers live here ══ */}
      <Sheet open={analyzeOpen} onOpenChange={setAnalyzeOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl overflow-y-auto bg-background border-l border-border/30 p-0"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/30 bg-background/95 backdrop-blur-md px-6 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-accent" />
              <span className="text-[10px] font-bold tracking-[0.25em] text-foreground/85">FIT ANALYSIS</span>
              <span className="text-[10px] text-foreground/40">· Size {activeSize}</span>
            </div>
            <button
              onClick={() => setAnalyzeOpen(false)}
              className="text-foreground/45 hover:text-foreground transition-colors"
              aria-label="Close analysis"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* Confidence + Body Accuracy — pulled in from the hero for a cleaner main view */}
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-foreground/[0.06]">
              <div className="space-y-1">
                <p className="text-[9px] font-semibold tracking-[0.25em] text-foreground/45 uppercase">Confidence</p>
                <p className={`text-[12px] font-bold tracking-[0.18em] ${confColor}`}>{confLabel}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[9px] font-semibold tracking-[0.25em] text-foreground/45 uppercase">Body Accuracy</p>
                <p className={`text-[12px] font-bold tracking-tight ${
                  bodyDNA.accuracy >= 80 ? "text-green-500"
                    : bodyDNA.accuracy >= 55 ? "text-accent"
                    : "text-orange-500"
                }`}>{bodyDNA.accuracy}%</p>
              </div>
            </div>

            {/* Trust + feedback — moved out of hero */}
            <FitTrustStrip
              accuracy={bodyDNA.accuracy}
              bodyConsistencyScore={tryOn.qualityVerdict?.bodyConsistencyScore ?? null}
              visualIntegrityScore={tryOn.qualityVerdict?.visualIntegrityScore ?? null}
              unstable={tryOn.qualityUnstable}
              productKey={productKey}
              brand={product.brand}
              category={product.category}
              productGender={(product as any).gender ?? null}
              userGender={bodyGender ?? null}
              recommendedSize={result.recommendedSize}
              chosenSize={activeSize}
            />

            {confTier === "limited" && (
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                <span className="text-[11px] text-orange-400/80">
                  Limited confidence — brand size chart is partial. Treat as approximate.
                </span>
              </div>
            )}


            {sizeCorrelation && (
              <FitAnalysisPanel
                correlation={sizeCorrelation}
                activeSize={activeSize}
                onPickSize={(s) => setActiveSize(s)}
                genderNote={genderedContext.genderSizeWarning || undefined}
                crossGenderApprox={genderedContext.equivalentApproximation || undefined}
              />
            )}

            {/* SELECTED-SIZE-FIRST EXPLANATION */}
            <SelectedSizeFitCard
              recommendation={sizing.recommendation}
              activeSize={activeSize}
              onPickRecommended={(size) => setActiveSize(size)}
            />


            {/* PARALLEL FIT EXPLANATION LAYER */}
            {bodyHeightCm ? (
              <FitExplanationCard
                heightCm={bodyHeightCm}
                weightKg={bodyWeightKg ?? null}
                category={product.category}
                selectedSize={activeSize}
                garment={resolvedSize.resolved ? {
                  chest:    (resolvedSize.resolved as any).chestCm,
                  shoulder: (resolvedSize.resolved as any).shoulderCm,
                  length:   (resolvedSize.resolved as any).lengthCm ?? (resolvedSize.resolved as any).totalLengthCm,
                  waist:    (resolvedSize.resolved as any).waistCm,
                  hip:      (resolvedSize.resolved as any).hipCm,
                  thigh:    (resolvedSize.resolved as any).thighCm,
                  inseam:   (resolvedSize.resolved as any).inseamCm,
                  sleeve:   (resolvedSize.resolved as any).sleeveCm,
                } : null}
                sizeLabel={`SIZE ${activeSize}`}
              />
            ) : null}

            {/* FIT SUMMARY */}
            <FitSummaryPanel
              size={activeSize}
              score={heroScore}
              fitTypeLabel={heroFitType}
              silhouette={solver.silhouette}
              confidence={confLabel as "HIGH" | "MEDIUM" | "LIMITED"}
              regions={activeSizeResult?.regions ?? []}
            />

            {/* REGION-BY-REGION */}
            <RegionFitTable
              fit={regionFit}
              loading={resolvedSize.loading}
              fetching={resolvedSize.fetching}
              selectedSize={activeSize}
            />

            {/* SILHOUETTE + BREAKDOWN */}
            <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">SILHOUETTE</p>
                  <span className="text-[10px] text-foreground/40">· {FIT_TYPE_LABEL[solver.fitType]}</span>
                </div>
                <span className="rounded-full bg-accent/10 px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-accent">
                  {solver.silhouette.toUpperCase()}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-foreground/80">{solver.summary}</p>
              <FitBreakdown solver={solver} isBottom={garmentFit.category === "bottom"} />
            </div>

            {/* FULL EXPLANATION */}
            <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50">EXPLANATION</p>
                {isRefined && <Sparkles className="h-3 w-3 text-accent/60" />}
              </div>
              {loadingExplanation ? (
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-foreground/[0.04] animate-pulse" />
                  <div className="h-3 w-3/4 rounded bg-foreground/[0.04] animate-pulse" />
                </div>
              ) : explanation ? (
                <p className="text-sm font-light leading-relaxed text-foreground/80">{explanation}</p>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-sm font-semibold text-foreground">{builtExplanation.headline}</p>
                  <ul className="space-y-1.5">
                    {builtExplanation.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-foreground/75 leading-relaxed">
                        <span className="text-accent mt-1">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  {builtExplanation.caveat && (
                    <p className="text-[11px] text-foreground/50 pt-1 border-t border-foreground/[0.04]">{builtExplanation.caveat}</p>
                  )}
                </div>
              )}
            </div>

            {/* GLOBAL SIZE FALLBACK */}
            {usedGlobalFallback && globalSize && (
              <div className="rounded-2xl border border-foreground/[0.08] bg-card/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Globe2 className="h-3.5 w-3.5 text-foreground/50" />
                  <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50">GLOBAL SIZE GUIDE</p>
                </div>
                <p className="text-[11px] text-foreground/60">
                  Estimated from your height ({profile?.heightCm}cm) — brand chart is incomplete.
                </p>
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {[
                    { label: "INTL", value: globalSize.letter },
                    { label: "US", value: globalSize.us },
                    { label: "EU", value: globalSize.eu },
                    { label: "KR", value: globalSize.kr },
                    { label: "JP", value: globalSize.jp },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg bg-background/40 border border-foreground/[0.04] py-2 text-center">
                      <p className="text-[8px] font-bold tracking-[0.15em] text-foreground/40">{m.label}</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Size recommendation panel removed — user picks their own size, only the visualization is shown. */}

            {/* SIZE COMPARISON */}
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50 mb-3">SIZE COMPARISON</p>
              <div className="space-y-2">
                {result.sizeResults.map((sr) => (
                  <SizeComparisonCard key={sr.size} result={sr} isRecommended={sr.recommended} isAlternate={sr.alternate} />
                ))}
              </div>
            </div>

            {/* REFINE FIT */}
            {!isRefined && onRefineFit && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onRefineFit}
                disabled={refining}
                className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-all ${
                  canUsePremium
                    ? "border-accent/30 bg-accent/[0.06] text-accent hover:bg-accent/[0.12]"
                    : "border-foreground/10 bg-foreground/[0.03] text-foreground/50"
                } disabled:opacity-50`}
              >
                {refining ? (<><Loader2 className="h-4 w-4 animate-spin" /> Refining…</>)
                  : canUsePremium ? (<><Sparkles className="h-4 w-4" /> Refine Fit — High Precision</>)
                  : (<><Lock className="h-3.5 w-3.5" /> Refined Fit (Premium)</>)}
              </motion.button>
            )}

            {/* OPTIONAL PHOTO TRY-ON */}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => setTryOnOpen(true)}
                disabled={!tryOnReady}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] py-3 text-sm font-medium text-foreground/70 hover:bg-foreground/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title={tryOnReady ? "Generate a virtual try-on" : "Upload a front body scan first"}
              >
                <Wand2 className="h-4 w-4" />
                {tryOnReady ? "Try it on (photo)" : "Try-on unavailable"}
              </button>
              {!tryOnReady && (
                <p className="text-[10px] text-center text-foreground/40">
                  Add a front body scan in SCAN to enable photo try-on
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <TryOnPreviewModal open={tryOnOpen} onClose={() => setTryOnOpen(false)} context={tryOnContext} />
    </div>
  );
}
