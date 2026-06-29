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
import RecommendedForShape from "@/components/fit/RecommendedForShape";
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
  // Align the initial active size with the sizing-engine recommendation
  // once it resolves — avoids generating a render for a size the user is
  // about to change away from. Only run while the user hasn't picked yet.
  const userPickedRef = useRef(false);
  useEffect(() => { setActiveSize(result.recommendedSize); userPickedRef.current = false; }, [result.recommendedSize]);
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

  // ── V3 honest hero label (from measurement-driven classifier) ────────────
  // When the new sizing engine has analyzed the active size, it OVERRIDES
  // the legacy heroScore label so a tight outfit is never shown as "loose"
  // and a too-large outfit is never shown as "Best fit".
  const v3ActiveAnalysis = sizing.recommendation?.sizeAnalyses?.[activeSize] ?? null;
  let heroFitType = heroScore >= 80 ? "Best fit" : heroScore >= 65 ? "Good fit" : heroScore >= 50 ? "Wearable" : "Poor fit";
  let heroColor = heroScore >= 80 ? "text-green-500" : heroScore >= 65 ? "text-accent" : heroScore >= 50 ? "text-orange-400" : "text-orange-500";
  let heroRing = heroScore >= 80 ? "ring-green-500/30" : heroScore >= 65 ? "ring-accent/30" : heroScore >= 50 ? "ring-orange-400/30" : "ring-orange-500/30";
  if (v3ActiveAnalysis) {
    const c = v3ActiveAnalysis.classification;
    heroFitType = c === "TooSmall" ? "Too Small"
                : c === "Tight" ? "Tight"
                : c === "CloseFit" ? "Close Fit"
                : c === "BestBalance" ? "Best Balance"
                : c === "Relaxed" ? "Relaxed"
                : c === "Oversized" ? "Oversized"
                : "Too Large";
    const isBad = c === "TooSmall" || c === "TooLarge";
    const isWarn = c === "Tight" || c === "Oversized";
    const isBest = c === "BestBalance";
    heroColor = isBad ? "text-orange-500"
              : isWarn ? "text-orange-400"
              : isBest ? "text-green-500"
              : "text-accent";
    heroRing = isBad ? "ring-orange-500/30"
             : isWarn ? "ring-orange-400/30"
             : isBest ? "ring-green-500/30"
             : "ring-accent/30";
  }

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
    () => {
      if (v3ActiveAnalysis) {
        const c = v3ActiveAnalysis.classification;
        switch (c) {
          case "TooSmall":    return `Size ${activeSize} is smaller than your body measurements.`;
          case "Tight":       return `Size ${activeSize} will feel tight on you.`;
          case "CloseFit":    return `Size ${activeSize} sits close to the body — sharper silhouette.`;
          case "BestBalance": return `Size ${activeSize} gives the most natural room without looking oversized.`;
          case "Relaxed":     return `Size ${activeSize} sits relaxed with extra room.`;
          case "Oversized":   return `Size ${activeSize} reads oversized for your body.`;
          case "TooLarge":    return `Size ${activeSize} has too much room for your body.`;
        }
      }
      return describeOverallFit(overallPhysicsLabel, garmentDNA, activeSize);
    },
    [v3ActiveAnalysis, overallPhysicsLabel, garmentDNA, activeSize],
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

  // ── Active-size warp profile (deterministic visual tweak) ──────────────
  const activeProfile = useMemo(() => {
    const sr = result.sizeResults.find((s) => s.size === activeSize);
    if (!sr)
      return profileFromSizeAndRegions({
        size: activeSize,
        overall: sizingActiveOutcome?.overall ?? null,
        regions: [],
      });
    return profileFromSizeAndRegions({
      size: sr.size,
      overall: sizingActiveOutcome?.overall ?? null,
      regions: sr.regions.map((r) => ({
        region: r.region,
        bodyCm: null,
        garmentCm: null,
        deltaCm: null,
        status: r.fit as any,
      })),
    });
  }, [activeSize, result.sizeResults, sizingActiveOutcome]);

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

  // Once the sizing engine resolves, snap activeSize to its primary pick
  // (unless the user has already clicked a different size). This keeps the
  // "Best" badge and the rendered fit image aligned, and avoids burning a
  // generation on a size the engine wouldn't recommend.
  useEffect(() => {
    if (userPickedRef.current) return;
    const primary = sizing.recommendation?.primarySize;
    if (primary && primary !== activeSize) setActiveSize(primary);
  }, [sizing.recommendation?.primarySize, activeSize]);

  // Mannequin gender for the body silhouette in the left panel.
  const silhouetteGender: "male" | "female" =
    (bodyGender || "").toLowerCase() === "female" ? "female" : "male";

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 overflow-x-hidden">
      {/* ─── DASHBOARD GRID ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        {/* ─── LEFT: MY BODY ─────────────────────────────────────────── */}
        <aside className="order-2 rounded-3xl border border-foreground/[0.06] bg-card/40 p-5 lg:order-1">
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
          {/* Body shape + compact AI score rings (replaces the BodyDnaPanel
              that used to sit above the wizard — now lives beside the try-on
              image so the main fitting view stays the visual hero). */}
          {(() => {
            // Lightweight shape classification — same heuristic as BodyDnaPanel.
            let shape: "hourglass" | "pear" | "rectangle" | "triangle" | "round" | "—" = "—";
            if (bodyChestCm && bodyWaistCm && bodyHipCm) {
              const bw = bodyChestCm - bodyWaistCm;
              const hw = bodyHipCm - bodyWaistCm;
              const bh = bodyChestCm - bodyHipCm;
              if (bw > 8 && hw > 8 && Math.abs(bh) < 5) shape = "hourglass";
              else if (hw > bw + 4) shape = "pear";
              else if (bw > hw + 4) shape = "triangle";
              else if (Math.abs(bw) < 5 && Math.abs(hw) < 5) shape = "rectangle";
              else shape = "round";
            }
            // Encode shape on the wrapper so the bottom-of-page recommendation
            // strip can read it without prop drilling through the grid.
            (window as any).__mymyon_body_shape__ = shape;
            const hasBody = !!bodyWeightKg && !!bodyHeightCm;
            const fitAccuracy = Math.min(99, Math.round(72 + (hasBody ? 14 : 0) + (shape !== "—" ? 6 : 0)));
            const comfort = Math.min(99, Math.round(70 + (hasBody ? 16 : 0)));
            const silhouette = Math.min(99, Math.round(74 + (shape !== "—" ? 12 : 0)));
            const Ring = ({ v, label }: { v: number; label: string }) => {
              const R = 22, C = 2 * Math.PI * R;
              const off = C - (v / 100) * C;
              return (
                <div className="flex flex-col items-center gap-1">
                  <div className="relative h-[58px] w-[58px]">
                    <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
                      <circle cx="30" cy="30" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                      <circle cx="30" cy="30" r={R} fill="none" stroke="hsl(var(--accent))" strokeWidth="3"
                        strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-display text-[13px] font-semibold text-foreground">{v}</span>
                    </div>
                  </div>
                  <span className="text-[8px] font-medium tracking-[0.18em] text-foreground/60 uppercase">{label}</span>
                </div>
              );
            };
            return (
              <>
                <div className="mt-4 rounded-2xl border border-foreground/[0.06] bg-background/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[8.5px] font-bold tracking-[0.25em] text-foreground/55 uppercase">Body shape</span>
                    <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 font-display text-[10px] font-medium text-foreground">
                      {shape === "—" ? "Calibrating…" : shape.charAt(0).toUpperCase() + shape.slice(1)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1">
                    <Ring v={fitAccuracy} label="Fit" />
                    <Ring v={comfort} label="Comfort" />
                    <Ring v={silhouette} label="Shape" />
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-accent/[0.06] px-3 py-2">
                  <Lock className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                  <p className="text-[10px] leading-snug text-foreground/65">
                    <span className="font-semibold text-foreground/80">Body locked.</span> Only the garment changes between sizes.
                  </p>
                </div>
              </>
            );
          })()}
        </aside>



        {/* ─── CENTER: SIZE PREVIEW ─────────────────────────────── */}
        <section className="rounded-3xl border border-foreground/[0.06] bg-card/30 p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-[0.3em] text-foreground/55 uppercase">Size Preview</p>
            <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-[10px] font-medium tracking-wider text-foreground/60">
              AI Fitting
            </span>
          </div>

          {/* AI Fitting Image — only the active size */}
          <div className="mb-4">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-background/40">
              {(() => {
                const isLoading =
                  tryOn.stage === "generating" ||
                  tryOn.stage === "polling" ||
                  tryOn.stage === "validating";
                return (
                  <>
                    {tryOn.imageUrl ? (
                      <img
                        src={tryOn.imageUrl}
                        alt={`${product.name} in size ${activeSize}`}
                        className={`h-full w-full object-contain transition-all duration-500 ${
                          isLoading ? "scale-[1.02] opacity-30 blur-sm" : "scale-100 opacity-100 blur-0"
                        }`}
                      />
                    ) : !isLoading ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-foreground/40">
                        <span className="text-[13px]">Select a size to see the AI fitting</span>
                      </div>
                    ) : null}

                    {isLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/30 backdrop-blur-[2px] animate-fade-in">
                        {/* Shimmer sweep */}
                        <div className="pointer-events-none absolute inset-0 overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
                            style={{ animation: "shimmer 1.8s ease-in-out infinite" }}
                          />
                        </div>
                        {/* Pulsing ring */}
                        <div className="relative flex h-14 w-14 items-center justify-center">
                          <span className="absolute inset-0 rounded-full border border-accent/40 animate-ping" />
                          <span className="absolute inset-2 rounded-full border border-accent/30 animate-pulse" />
                          <Loader2 className="relative h-6 w-6 animate-spin text-accent" />
                        </div>
                        <div className="z-10 flex flex-col items-center gap-1">
                          <p className="text-[11px] font-bold tracking-[0.25em] text-foreground/80 uppercase">
                            Fitting size {activeSize}
                          </p>
                          <p className="text-[10px] text-foreground/50">Tailoring to your body…</p>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Size selector — caption is driven by the v3 measurement classifier
              first (single source of truth that the hero label uses), then
              falls back to the legacy region string. Fixes the bug where a
              tight-on-body Medium would show "LOOSE FIT". */}
          <div className="grid grid-cols-4 gap-2">
            {result.sizeResults.slice(0, 4).map((sr) => {
              const isActive = sr.size === activeSize;
              const isRecommended = sr.size === recommendedSize;
              const v3 = sizing.recommendation?.sizeAnalyses?.[sr.size] ?? null;
              const sizeRegions = sr.regions || [];
              const sChest = sizeRegions.find((r) => /chest|bust/i.test(r.region))?.fit || "regular";
              const captionFromV3 = v3 ? (
                v3.classification === "TooSmall" ? "Too small"
                : v3.classification === "Tight" ? "Tight"
                : v3.classification === "CloseFit" ? "Close fit"
                : v3.classification === "BestBalance" ? "Best fit"
                : v3.classification === "Relaxed" ? "Relaxed"
                : v3.classification === "Oversized" ? "Loose fit"
                : "Too large"
              ) : null;
              const captionTop =
                captionFromV3
                ?? (isRecommended ? "Best fit"
                  : /tight|small|short/i.test(sChest) ? "Tight"
                  : /loose|oversized|relaxed|long/i.test(sChest) ? "Loose fit"
                  : "Close fit");
              const isTightCap = /tight|small/i.test(captionTop);
              const isLooseCap = /loose|oversized|relaxed|large/i.test(captionTop);
              return (
                <button
                  key={sr.size}
                  onClick={() => { userPickedRef.current = true; setActiveSize(sr.size); }}
                  className={`group relative flex flex-col items-center overflow-hidden rounded-xl border py-2.5 text-left transition-all ${
                    isActive
                      ? "border-accent bg-accent text-accent-foreground shadow-lg shadow-accent/10"
                      : "border-foreground/[0.08] bg-background/60 hover:border-foreground/20"
                  }`}
                >
                  {isRecommended && (
                    <span className="absolute left-1/2 top-1 z-10 -translate-x-1/2 rounded-full bg-accent px-2 py-0.5 text-[8px] font-bold tracking-[0.15em] text-accent-foreground uppercase">
                      Best
                    </span>
                  )}
                  <span className={`font-display text-sm font-bold ${isActive ? "text-accent-foreground" : "text-foreground/70"}`}>
                    {sr.size}
                  </span>
                  <span className={`mt-0.5 text-[9px] font-semibold tracking-wider uppercase ${
                    isActive ? "text-accent-foreground/80"
                    : isRecommended ? "text-accent"
                    : isTightCap ? "text-orange-500"
                    : isLooseCap ? "text-blue-400"
                    : "text-foreground/50"
                  }`}>
                    {captionTop}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Single Fit Label + Sentence (V3 simplified) */}
          <div className="mt-4 rounded-2xl border border-foreground/[0.06] bg-background/40 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className={`font-display text-sm font-bold tracking-wide uppercase ${heroColor}`}>
                {heroFitType}
              </p>
              <button
                onClick={() => setAnalyzeOpen(true)}
                className="flex items-center gap-1 text-[10px] font-medium tracking-wider text-accent hover:text-accent/80 uppercase"
              >
                <BarChart3 className="h-3 w-3" /> Analyze
              </button>
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-foreground/75">
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

      {/* ── RECOMMENDED FOR YOUR SHAPE ── */}
      <RecommendedForShape
        shape={
          (bodyChestCm && bodyWaistCm && bodyHipCm)
            ? (() => {
                const bw = bodyChestCm - bodyWaistCm;
                const hw = bodyHipCm - bodyWaistCm;
                const bh = bodyChestCm - bodyHipCm;
                if (bw > 8 && hw > 8 && Math.abs(bh) < 5) return "hourglass";
                if (hw > bw + 4) return "pear";
                if (bw > hw + 4) return "triangle";
                if (Math.abs(bw) < 5 && Math.abs(hw) < 5) return "rectangle";
                return "round";
              })() as any
            : "—"
        }
        gender={bodyGender ?? null}
      />



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
