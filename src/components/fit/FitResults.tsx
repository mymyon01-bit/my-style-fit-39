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
import FitImageCanvas from "@/components/fit/FitImageCanvas";
import { profileFromSizeAndRegions } from "@/lib/fit/sizeWarpProfile";
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

  // ── Per-size mini visuals (S/M/L/XL grid) ──────────────────────────────
  // Each card shows the AI fitting image for the active size. Inactive cards
  // get the same hero image with a deterministic warp so users see size
  // differences instantly without firing 4 generations at once.
  const heroImageUrl = tryOn.imageUrl;

  // Region summary chips for the rail (✓ / ◐ / ✗).
  const regionRailRows = useMemo(() => {
    const rows: Array<{ key: string; label: string; status: "good" | "warn" | "bad"; note: string }> = [];
    const isBottom = garmentFit.category === "bottom";
    const toneFor = (fit: string): "good" | "warn" | "bad" => {
      const l = (fit || "").toLowerCase();
      if (/(too-tight|impossible|too-large|extremely-oversized|too-loose|too-short|too-long)/.test(l)) return "bad";
      if (/(tight|loose|short|long|relaxed|oversized|snug|trim|dropped)/.test(l)) return "warn";
      return "good";
    };
    const noteFor = (tone: "good" | "warn" | "bad") =>
      tone === "good" ? "Comfortable" : tone === "warn" ? "Mid-range" : "Off";
    const push = (key: string, label: string, fit: string) => {
      const t = toneFor(fit);
      rows.push({ key, label, status: t, note: noteFor(t) });
    };
    push("chest", "Chest", solver.regions.chest.fit);
    push("waist", "Waist", solver.regions.waist.fit);
    if (!isBottom) push("shoulder", "Shoulder", solver.regions.shoulder.fit);
    push("length", "Length", solver.regions.length.fit);
    if (!isBottom) push("sleeve", "Sleeve", solver.regions.sleeve.fit);
    return rows;
  }, [solver, garmentFit.category]);

  // ── Recommended size for the BEST pill ─────────────────────────────────
  const recommendedSize = sizing.recommendation?.primarySize ?? result.recommendedSize;
  const recommendedReason = sizing.recommendation?.primaryReason ?? "Best balance for your measurements.";

  // Mannequin gender for the body silhouette in the left panel.
  const silhouetteGender: "male" | "female" =
    (bodyGender || "").toLowerCase() === "female" ? "female" : "male";

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 overflow-x-hidden">
      {/* ─── DASHBOARD GRID ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* ─── LEFT: MY BODY ─────────────────────────────────────────── */}
        <aside className="rounded-3xl border border-foreground/[0.06] bg-card/40 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold tracking-[0.3em] text-foreground/50 uppercase">My Body</p>
            {onEditMeasurements && (
              <button
                onClick={onEditMeasurements}
                className="flex items-center gap-1 text-[10px] font-medium text-accent hover:text-accent/80"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>
          <div className="mt-3 space-y-1">
            <p className="font-display text-lg font-medium capitalize text-foreground">
              {bodyGender || "Body"}
            </p>
            <p className="text-[11px] tracking-wider text-foreground/55">
              {bodyHeightCm ? `${bodyHeightCm}cm` : "—"} · {bodyWeightKg ? `${bodyWeightKg}kg` : "—"}
            </p>
          </div>
          <div className="mt-4 space-y-1.5 border-t border-foreground/[0.06] pt-3">
            {[
              { l: "Bust", v: bodyChestCm },
              { l: "Waist", v: bodyWaistCm },
              { l: "Hip", v: bodyHipCm },
              { l: "Shoulder", v: bodyShoulderCm },
            ].map((r) => (
              <div key={r.l} className="flex items-center justify-between text-[11px]">
                <span className="text-foreground/50">{r.l}</span>
                <span className="font-medium tabular-nums text-foreground/85">
                  {r.v ? `${r.v}cm` : "—"}
                </span>
              </div>
            ))}
          </div>
          {/* Mannequin silhouette */}
          <div className="mt-4 flex items-center justify-center rounded-2xl bg-background/40 py-4 text-foreground/70">
            {silhouetteGender === "female" ? (
              <svg viewBox="0 0 200 280" className="h-32 w-auto opacity-50" fill="currentColor" aria-hidden>
                <ellipse cx="100" cy="40" rx="20" ry="24" />
                <path d="M68 108 Q100 86 132 108 L138 150 Q100 158 62 150 Z" />
                <path d="M70 150 Q100 162 130 150 L150 230 Q100 248 50 230 Z" />
                <rect x="68" y="226" width="28" height="54" rx="8" />
                <rect x="104" y="226" width="28" height="54" rx="8" />
              </svg>
            ) : (
              <svg viewBox="0 0 200 280" className="h-32 w-auto opacity-50" fill="currentColor" aria-hidden>
                <ellipse cx="100" cy="40" rx="20" ry="24" />
                <path d="M58 108 Q100 80 142 108 L146 200 Q100 210 54 200 Z" />
                <rect x="68" y="200" width="28" height="78" rx="8" />
                <rect x="104" y="200" width="28" height="78" rx="8" />
              </svg>
            )}
          </div>
          <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-accent/[0.06] px-3 py-2">
            <Lock className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
            <p className="text-[10px] leading-snug text-foreground/65">
              <span className="font-semibold text-foreground/80">Your body is locked.</span> We only change the garment to show the fit.
            </p>
          </div>
        </aside>

        {/* ─── CENTER: SIZE PREVIEW GRID ─────────────────────────────── */}
        <section className="rounded-3xl border border-foreground/[0.06] bg-card/30 p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-[0.3em] text-foreground/55 uppercase">Size Preview</p>
            <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-[10px] font-medium tracking-wider text-foreground/60">
              AI Fitting
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {result.sizeResults.slice(0, 4).map((sr) => {
              const isActive = sr.size === activeSize;
              const isRecommended = sr.size === recommendedSize;
              // Mini caption from solver / region fits for THAT size.
              const sizeRegions = sr.regions || [];
              const sChest = sizeRegions.find((r) => /chest|bust/i.test(r.region))?.fit || "regular";
              const sLen = sizeRegions.find((r) => /length|hem|inseam/i.test(r.region))?.fit || "regular";
              const captionTop =
                isRecommended ? "Best fit"
                : /tight|small|short/i.test(sChest) ? "Too tight"
                : /loose|oversized|relaxed|long/i.test(sChest) ? "Loose fit"
                : "Close fit";
              const captionBottom =
                isRecommended ? "Balanced silhouette"
                : /tight|small/i.test(sChest) ? "Chest & waist tight"
                : /oversized|relaxed/i.test(sChest) ? "Extra room in torso"
                : /long/i.test(sLen) ? "Hem hangs longer"
                : "Slightly fitted";
              const profile = profileFromSizeAndRegions({
                size: sr.size,
                overall: isActive ? sizingActiveOutcome?.overall ?? null : null,
                regions: sizeRegions.map((r) => ({
                  region: r.region,
                  bodyCm: null,
                  garmentCm: null,
                  deltaCm: null,
                  status: r.fit as any,
                })),
              });

              return (
                <button
                  key={sr.size}
                  onClick={() => setActiveSize(sr.size)}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all ${
                    isActive
                      ? "border-accent bg-background shadow-lg shadow-accent/10"
                      : "border-foreground/[0.06] bg-background/60 hover:border-foreground/20"
                  }`}
                >
                  {isRecommended && (
                    <span className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full bg-accent px-2.5 py-0.5 text-[9px] font-bold tracking-[0.18em] text-accent-foreground uppercase">
                      Best
                    </span>
                  )}
                  <div className="flex items-center justify-between px-3 pb-1 pt-3">
                    <span className={`font-display text-base font-bold ${isActive ? "text-foreground" : "text-foreground/60"}`}>
                      {sr.size}
                    </span>
                    {isActive && <Sparkles className="h-3 w-3 text-accent" />}
                  </div>
                  <div className="relative aspect-[3/4] w-full bg-background/40">
                    {heroImageUrl ? (
                      <FitImageCanvas
                        src={heroImageUrl}
                        alt={`${product.name} in size ${sr.size}`}
                        profile={profile}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        {tryOn.stage === "generating" || tryOn.stage === "polling" || tryOn.stage === "validating" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-foreground/30" />
                        ) : (
                          <span className="text-[10px] text-foreground/30">—</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 px-3 pb-3 pt-2">
                    <p className={`text-[11px] font-bold tracking-wider uppercase ${
                      isRecommended ? "text-accent"
                        : /tight|small/i.test(sChest) ? "text-orange-500"
                        : /loose|oversized/i.test(sChest) ? "text-blue-400"
                        : "text-foreground/70"
                    }`}>
                      {captionTop}
                    </p>
                    <p className="text-[10px] leading-tight text-foreground/55">{captionBottom}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Fit Tip */}
          <div className="mt-4 rounded-2xl border border-foreground/[0.06] bg-background/40 px-4 py-3">
            <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/45 uppercase">Fit Tip</p>
            <p className="mt-1 text-[12px] leading-snug text-foreground/75">
              {overallFitSentence ||
                "If you prefer a more relaxed look, try one size up for a looser silhouette."}
            </p>
          </div>

          {tryOn.error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-[11px] text-orange-400/80">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="flex-1">{friendlyTryOnError(tryOn.error)}</div>
              <button
                onClick={() => { tryOn.retry(); setReloadToken((n) => n + 1); }}
                className="rounded-md border border-orange-500/30 px-2 py-0.5 text-[10px] hover:bg-orange-500/10"
              >
                Retry
              </button>
            </div>
          )}
        </section>

        {/* ─── RIGHT: PRODUCT + FIT SUMMARY RAIL ──────────────────────── */}
        <aside className="space-y-3 rounded-3xl border border-foreground/[0.06] bg-card/40 p-5">
          {/* Product header */}
          <div>
            <p className="text-[9px] font-bold tracking-[0.3em] text-foreground/45 uppercase">Product</p>
            <h1 className="mt-1.5 font-display text-base font-medium leading-tight text-foreground">
              {product.name}
            </h1>
            <p className="mt-0.5 text-[10px] tracking-[0.25em] text-foreground/50 uppercase">{product.brand}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[9px] font-bold tracking-wider text-accent uppercase">
                AI Fitting
              </span>
              <span className="rounded-full bg-foreground/[0.06] px-2.5 py-0.5 text-[9px] font-medium tracking-wider text-foreground/60 uppercase">
                {garmentDNA.fabricType || "Light fabric"}
              </span>
            </div>
          </div>

          {/* Size chips */}
          <div className="border-t border-foreground/[0.06] pt-3">
            <p className="text-[9px] font-bold tracking-[0.3em] text-foreground/45 uppercase">Size</p>
            <div className="mt-2 flex gap-1.5">
              {result.sizeResults.map((sr) => {
                const active = sr.size === activeSize;
                return (
                  <button
                    key={sr.size}
                    onClick={() => setActiveSize(sr.size)}
                    className={`flex-1 rounded-lg border py-1.5 text-[12px] font-bold tracking-wider transition-colors ${
                      active
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-foreground/10 bg-background/40 text-foreground/70 hover:border-foreground/30"
                    }`}
                  >
                    {sr.size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Best size for you */}
          <div className="rounded-2xl border border-accent/20 bg-accent/[0.05] p-3">
            <p className="text-[9px] font-bold tracking-[0.25em] text-accent uppercase">Best Size For You</p>
            <p className="mt-1 font-display text-lg font-bold text-foreground">Size {recommendedSize}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-foreground/65">{recommendedReason}</p>
            <button
              onClick={() => setAnalyzeOpen(true)}
              className="mt-2 flex items-center gap-1 text-[10px] font-medium text-accent hover:text-accent/80"
            >
              Why this size? <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {/* Fit summary */}
          <div className="border-t border-foreground/[0.06] pt-3">
            <p className="text-[9px] font-bold tracking-[0.3em] text-foreground/45 uppercase">Fit Summary</p>
            <div className="mt-2 space-y-1">
              {regionRailRows.map((r) => {
                const dot = r.status === "good" ? "bg-green-500" : r.status === "warn" ? "bg-orange-400" : "bg-red-500";
                return (
                  <div key={r.key} className="flex items-center justify-between rounded-lg px-1 py-1 text-[11px]">
                    <span className="flex items-center gap-2 text-foreground/70">
                      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {r.label}
                    </span>
                    <span className={`font-medium ${
                      r.status === "good" ? "text-green-500"
                        : r.status === "warn" ? "text-orange-400"
                        : "text-red-500"
                    }`}>
                      {r.note}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-2 border-t border-foreground/[0.06] pt-3">
            {product.url && product.url !== "#" && (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-[12px] font-bold tracking-[0.2em] text-background uppercase transition-opacity hover:opacity-90"
              >
                Add to bag <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button
              onClick={() => setChangeBodyOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 text-[10px] font-medium tracking-[0.25em] text-foreground/55 uppercase hover:text-foreground/80"
            >
              <RotateCcw className="h-3 w-3" /> Change body
            </button>
          </div>
        </aside>
      </div>

      {/* ── CHANGE BODY SHEET ── */}
      <ChangeBodySheet
        open={changeBodyOpen}
        onOpenChange={setChangeBodyOpen}
        onAction={handleChangeBody}
      />

      {/* ── ANALYZE SHEET (full deep-dive, opened by "Why this size?") ── */}
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

          <div className="space-y-6 px-6 py-6">
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

            {sizeCorrelation && (
              <FitAnalysisPanel
                correlation={sizeCorrelation}
                activeSize={activeSize}
                onPickSize={(s) => setActiveSize(s)}
                genderNote={genderedContext.genderSizeWarning || undefined}
                crossGenderApprox={genderedContext.equivalentApproximation || undefined}
              />
            )}

            <SelectedSizeFitCard
              recommendation={sizing.recommendation}
              activeSize={activeSize}
              onPickRecommended={(size) => setActiveSize(size)}
            />

            <RegionFitTable
              fit={regionFit}
              loading={resolvedSize.loading}
              fetching={resolvedSize.fetching}
              selectedSize={activeSize}
            />

            <FitSummaryPanel
              size={activeSize}
              score={heroScore}
              fitTypeLabel={heroFitType}
              silhouette={solver.silhouette}
              confidence={confLabel as "HIGH" | "MEDIUM" | "LIMITED"}
              regions={activeSizeResult?.regions ?? []}
            />

            <FitBreakdown solver={solver} isBottom={garmentFit.category === "bottom"} />

            {!isRefined && onRefineFit && (
              <button
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
              </button>
            )}

            <button
              onClick={() => setTryOnOpen(true)}
              disabled={!tryOnReady}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] py-3 text-sm font-medium text-foreground/70 hover:bg-foreground/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Wand2 className="h-4 w-4" />
              {tryOnReady ? "Try it on (photo)" : "Try-on unavailable"}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <TryOnPreviewModal open={tryOnOpen} onClose={() => setTryOnOpen(false)} context={tryOnContext} />
    </div>
  );
}

// Small helper to surface AI errors in the new UI.
function friendlyTryOnError(raw?: string | null): string {
  if (!raw) return "The fitting service is busy. Please retry.";
  const s = String(raw).toLowerCase();
  if (s.includes("rate") || s.includes("429") || s.includes("throttle")) return "AI fitting is busy — please retry.";
  if (s.includes("credit") || s.includes("402")) return "AI credits unavailable. Try again shortly.";
  if (s.includes("timeout")) return "Fitting took too long. Retry.";
  return "Fitting unavailable right now. Retry.";
}
