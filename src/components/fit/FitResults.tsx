import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShieldCheck, AlertTriangle, ExternalLink, RotateCcw, Pencil, Sparkles, Loader2, Lock, Wand2, Globe2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { resolveBestProductImage } from "@/lib/fit/resolveBestProductImage";
import RegionFitTable from "@/components/fit/RegionFitTable";
import { useResolvedGarmentSize } from "@/hooks/useResolvedGarmentSize";
import { computeRegionFit } from "@/lib/fit/regionFitEngine";
import { useSizeRecommendation } from "@/hooks/useSizeRecommendation";
import SizeRecommendationPanel from "@/components/fit/SizeRecommendationPanel";
import type { FitPreference, RegionStatus } from "@/lib/sizing";

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
      isRecommended ? "border-accent/30 bg-accent/[0.04]"
        : isAlternate ? "border-foreground/[0.08] bg-card/40"
        : "border-foreground/[0.04] bg-card/20"
    }`}>
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl font-bold text-foreground">{result.size}</span>
          {isRecommended && (
            <span className="text-[10px] font-bold tracking-[0.12em] px-2.5 py-1 rounded-full bg-accent/15 text-accent">
              RECOMMENDED
            </span>
          )}
          {isAlternate && (
            <span className="text-[10px] font-bold tracking-[0.12em] px-2.5 py-1 rounded-full bg-foreground/5 text-foreground/60">
              ALTERNATE
            </span>
          )}
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
  const syncedRecRef = useRef(false);
  useEffect(() => {
    if (syncedRecRef.current) return;
    const rec = sizing.recommendation?.primarySize;
    if (!rec) return;
    if (result.sizeResults.some((s) => s.size === rec)) {
      setActiveSize(rec);
      syncedRecRef.current = true;
    }
  }, [sizing.recommendation?.primarySize, result.sizeResults]);

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
  const productKey = `${product.url || product.name}::${product.brand || ""}`.toLowerCase().slice(0, 200);
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
    regions:
      sizingActiveOutcome
        ? sizingActiveOutcome.regions.map((r) => ({
            region: r.region,
            fit: STATUS_TO_FIT_DESCRIPTOR[r.status],
          }))
        : activeSizeResult?.regions?.map((r) => ({ region: r.region, fit: String(r.fit) })) ?? [],
    bodyProfileSummary: {
      heightCm: bodyHeightCm ?? null,
      weightKg: bodyWeightKg ?? null,
      build: bodyShape ? String((bodyShape as any).build ?? "") : null,
      gender: bodyGender ?? null,
    },
    reloadToken,
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

  return (
    <div className="space-y-6">
      {/* Mode + Confidence row */}
      <div className="flex items-center justify-between">
        {isRefined ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-accent">
            <Sparkles className="h-3 w-3" /> REFINED FIT
          </span>
        ) : (
          <span className="text-[10px] font-bold tracking-[0.15em] text-foreground/50">ESTIMATED FIT</span>
        )}
        <span className={`text-[10px] font-bold tracking-[0.1em] px-2.5 py-1 rounded-full ${confBg} ${confColor}`}>
          {confLabel} CONFIDENCE
        </span>
      </div>

      {/* ══ 2-COLUMN GRID — left: input/score/summary · right: visual ══
          Stacks on mobile, side-by-side on lg+ to make the input → result
          relationship feel connected. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        {/* ── LEFT COLUMN ───────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Product header — premium selected card carried from Discover */}
          <SelectedProductCard
            brand={product.brand}
            name={product.name}
            price={product.price}
            image={product.image}
            url={product.url}
            category={product.category}
            dataQuality={result.productDataQuality}
            onChange={onRescan ? undefined : undefined /* change handled in CHECK */}
            compact
          />
          <p className="-mt-2 px-1 text-[10px] text-foreground/45">
            Brand data {result.productDataQuality}/100 · Scan {result.scanQuality}/100
          </p>

          {/* Limited confidence warning */}
          {confTier === "limited" && (
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
              <span className="text-[11px] text-orange-400/80">
                Limited confidence — brand size chart or scan quality is below ideal. Treat as approximate.
              </span>
            </div>
          )}

          {/* ══ EDITORIAL SIZE DISPLAY — measurement-driven, no scores ══ */}
          <div className="border-t border-b border-foreground/20 py-7">
            <div className="flex items-end justify-between gap-6">
              <div className="space-y-1.5">
                <p className="text-[9px] font-semibold tracking-[0.32em] text-foreground/40">
                  RECOMMENDED SIZE
                </p>
                <motion.p
                  key={activeSize}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="font-display text-[88px] font-medium leading-[0.85] tracking-[-0.06em] text-foreground"
                >
                  {activeSize}
                </motion.p>
                <p className={`text-[15px] font-medium tracking-tight ${heroColor}`}>
                  {heroFitType}
                </p>
              </div>
              {result.alternateSize !== "N/A" && activeSize !== result.alternateSize && (
                <div className="text-right pb-2">
                  <p className="text-[9px] font-semibold tracking-[0.32em] text-foreground/40 mb-1">
                    ALTERNATE
                  </p>
                  <p className="font-display text-[36px] font-medium leading-[0.9] tracking-[-0.04em] text-foreground/70">
                    {result.alternateSize}
                  </p>
                </div>
              )}
            </div>

            {/* Size switcher — minimal pills, no scores */}
            <div className="mt-6 flex flex-wrap gap-1.5">
              {result.sizeResults.map((sr) => {
                const isActive = sr.size === activeSize;
                return (
                  <button
                    key={sr.size}
                    onClick={() => setActiveSize(sr.size)}
                    className={`relative flex min-w-[52px] items-center justify-center border px-4 py-2.5 transition-all duration-200 ${
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/15 bg-transparent text-foreground/55 hover:border-foreground/50 hover:text-foreground"
                    }`}
                  >
                    <span className="font-display text-[13px] font-medium leading-none tracking-tight">{sr.size}</span>
                    {sr.recommended && !isActive && (
                      <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ══ FIT RESULT SUMMARY — visible BEFORE image generates ══ */}
          <FitSummaryPanel
            size={activeSize}
            score={heroScore}
            fitTypeLabel={heroFitType}
            silhouette={solver.silhouette}
            confidence={confLabel as "HIGH" | "MEDIUM" | "LIMITED"}
            regions={activeSizeResult?.regions ?? []}
          />

          {/* ══ REGION-BY-REGION FIT — measurement-driven, honest ══ */}
          <RegionFitTable
            fit={regionFit}
            loading={resolvedSize.loading}
            fetching={resolvedSize.fetching}
            selectedSize={activeSize}
          />
        </div>

        {/* ── RIGHT COLUMN ───────────────────────────────────────── */}
        <div className="space-y-5 lg:sticky lg:top-24">
          {/* ══ VISUAL FIT — direct AI-generated final fitting image ══ */}
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
          />
        </div>
      </div>

      {/* ══ SILHOUETTE + FIT BREAKDOWN — driven by FitSolver ══ */}
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

      {/* ══ 4. EXPLANATION — main trust layer ══ */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50">FIT ANALYSIS</p>
          {isRefined && <Sparkles className="h-3 w-3 text-accent/60" />}
        </div>
        {loadingExplanation ? (
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-foreground/[0.04] animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-foreground/[0.04] animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-foreground/[0.04] animate-pulse" />
          </div>
        ) : explanation ? (
          // Premium AI explanation (free-form prose)
          <p className="text-sm font-light leading-relaxed text-foreground/80">{explanation}</p>
        ) : (
          // Deterministic explanation (always rendered if no AI text)
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

      {/* ══ 5. GLOBAL SIZE FALLBACK MAPPING (only when brand data is weak) ══ */}
      {usedGlobalFallback && globalSize && (
        <div className="rounded-2xl border border-foreground/[0.08] bg-card/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Globe2 className="h-3.5 w-3.5 text-foreground/50" />
            <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50">GLOBAL SIZE GUIDE</p>
          </div>
          <p className="text-[11px] text-foreground/60">
            Estimated from your height ({profile?.heightCm}cm) — brand size chart is incomplete.
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

      {/* Refine Fit CTA */}
      {!isRefined && onRefineFit && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onRefineFit} disabled={refining}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-all ${
            canUsePremium ? "border-accent/30 bg-accent/[0.06] text-accent hover:bg-accent/[0.12]"
              : "border-foreground/10 bg-foreground/[0.03] text-foreground/50"
          } disabled:opacity-50`}>
          {refining ? (<><Loader2 className="h-4 w-4 animate-spin" /> Refining analysis…</>)
            : canUsePremium ? (<><Sparkles className="h-4 w-4" /> Refine Fit — High Precision</>)
            : (<><Lock className="h-3.5 w-3.5" /> Refined Fit (Premium)</>)}
        </motion.button>
      )}

      {/* ══ MEASUREMENT-DRIVEN SIZE RECOMMENDATION (new pipeline) ══
          Shows per-size fit calculated from real body cm vs garment cm.
          Selecting a size here also drives the visual try-on prompt above. */}
      <SizeRecommendationPanel
        recommendation={sizing.recommendation}
        loading={sizing.loadingChart}
        inferredFields={sizing.body?.inferredFieldNames ?? []}
        preference={sizing.preference}
        onPreferenceChange={(p) => setSizingPrefOverride(p)}
        onAddMeasurements={onEditMeasurements}
        activeSize={activeSize}
        onSizeSelect={(s) => setActiveSize(s)}
      />

      {/* Size comparison (collapsed by default for non-recommended) */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50 mb-3">SIZE COMPARISON</p>
        <div className="space-y-2">
          {result.sizeResults.map(sr => (
            <SizeComparisonCard key={sr.size} result={sr} isRecommended={sr.recommended} isAlternate={sr.alternate} />
          ))}
        </div>
      </div>

      {/* ══ 7. OPTIONAL TRY-ON ══ */}
      <div className="space-y-2">
        <button
          onClick={() => setTryOnOpen(true)}
          disabled={!tryOnReady}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] py-3 text-sm font-medium text-foreground/70 hover:bg-foreground/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={tryOnReady ? "Generate a virtual try-on" : "Try-on unavailable — upload a front body scan first"}
        >
          <Wand2 className="h-4 w-4" />
          {tryOnReady ? "Try it on (optional)" : "Try-on unavailable"}
        </button>
        {!tryOnReady && (
          <p className="text-[10px] text-center text-foreground/40">
            Add a front body scan in SCAN to enable virtual try-on
          </p>
        )}
        {product.url && product.url !== "#" && (
          <a href={product.url} target="_blank" rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90">
            <ExternalLink className="h-4 w-4" /> SHOP NOW
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-6 pt-2">
        {onRescan && (
          <button onClick={onRescan} className="flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground/80 transition-colors">
            <RotateCcw className="h-3 w-3" /> Rescan body
          </button>
        )}
        {onEditMeasurements && (
          <button onClick={onEditMeasurements} className="flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground/80 transition-colors">
            <Pencil className="h-3 w-3" /> Edit measurements
          </button>
        )}
      </div>

      <TryOnPreviewModal open={tryOnOpen} onClose={() => setTryOnOpen(false)} context={tryOnContext} />
    </div>
  );
}
