import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShieldCheck, AlertTriangle, ExternalLink, RotateCcw, Pencil, Sparkles, Loader2, Lock, Wand2, Globe2 } from "lucide-react";
import { useEffect, useState } from "react";
import { FitResult, SizeFitResult } from "@/lib/fitEngine";
import SafeImage from "@/components/SafeImage";
import TryOnPreviewModal, { TryOnContext } from "@/components/fit/TryOnPreviewModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { FitMode } from "@/pages/FitPage";
import { buildFitExplanation, confidenceTier } from "@/lib/fit/explain";
import { normalizeBodyProfile } from "@/lib/fit/bodyProfile";
import { estimateGlobalSize, shouldUseGlobalFallback } from "@/lib/fit/globalSize";
import FitVisual from "@/components/fit/FitVisual";
import { useReplicateTryOn } from "@/hooks/useReplicateTryOn";

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
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${
            result.fitScore >= 80 ? "text-green-500" : result.fitScore >= 60 ? "text-accent" : "text-orange-500"
          }`}>{result.fitScore}</span>
          <ChevronDown className={`h-4 w-4 text-foreground/40 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
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
  result, product, explanation, loadingExplanation,
  fitMode, canUsePremium, refining, bodyHeightCm, bodyWeightKg,
  onRefineFit, onRescan, onEditMeasurements,
}: Props) {
  const { user } = useAuth();
  const isRefined = fitMode === "premium";

  // Active size = user-selected; defaults to recommended.
  const [activeSize, setActiveSize] = useState<string>(result.recommendedSize);
  useEffect(() => { setActiveSize(result.recommendedSize); }, [result.recommendedSize]);
  const activeSizeResult = result.sizeResults.find(s => s.size === activeSize)
    ?? result.sizeResults.find(s => s.recommended);
  const heroScore = activeSizeResult?.fitScore ?? 0;

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
  const builtExplanation = buildFitExplanation(result, confTier, usedGlobalFallback);

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
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("body_scan_images")
        .select("public_url, image_type, created_at")
        .eq("user_id", user.id)
        .eq("image_type", "front")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.public_url) setUserImageUrl(data.public_url);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const tryOnReady = !!userImageUrl && !!product.image;
  const productKey = `${product.url || product.name}::${product.brand || ""}`.toLowerCase().slice(0, 200);
  const tryOnContext: TryOnContext | null = tryOnReady
    ? {
        userImageUrl: userImageUrl!,
        productImageUrl: product.image,
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

  // ── PRIMARY visual generation: auto-call Replicate via fit-tryon-router ──
  const tryOn = useReplicateTryOn({
    enabled: tryOnReady,
    userImageUrl,
    productImageUrl: product.image,
    productKey,
    productCategory: product.category,
    selectedSize: activeSize,
    fitDescriptor: activeSizeResult?.regions.find(r => r.region === "Chest")?.fit?.toString() || "regular",
    regions: activeSizeResult?.regions?.map(r => ({ region: r.region, fit: String(r.fit) })) ?? [],
  });

  return (
    <div className="space-y-5">
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

      {/* Product header */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-4">
        <div className="flex gap-4">
          {product.image ? (
            <SafeImage src={product.image} alt={product.name}
              className="h-28 w-20 rounded-xl object-cover"
              fallbackClassName="h-28 w-20 rounded-xl bg-foreground/[0.04] flex items-center justify-center" />
          ) : (
            <div className="h-28 w-20 rounded-xl bg-foreground/[0.04] flex items-center justify-center">
              <span className="font-display text-2xl font-bold text-foreground/75">{product.name.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <p className="text-[10px] tracking-[0.1em] text-foreground/50 uppercase">{product.brand}</p>
            <p className="font-display text-sm font-semibold text-foreground leading-tight">{product.name}</p>
            {product.price && <p className="text-base font-bold text-foreground">${product.price}</p>}
            <div className="flex items-center gap-1 mt-1">
              <ShieldCheck className="h-3 w-3 text-foreground/40" />
              <span className="text-[10px] text-foreground/50">Brand data {result.productDataQuality}/100 · Scan {result.scanQuality}/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Limited confidence warning */}
      {confTier === "limited" && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
          <span className="text-[11px] text-orange-400/80">
            Limited confidence — brand size chart or scan quality is below ideal. Treat as approximate.
          </span>
        </div>
      )}

      {/* ══ 1. SCORE + 3. SIZE — hero card ══ */}
      <div className="rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/[0.06] to-accent/[0.02] p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`relative flex h-24 w-24 items-center justify-center rounded-full ring-2 ${heroRing} bg-background/40`}>
              <motion.span key={heroScore} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className={`font-display text-4xl font-bold ${heroColor}`}>
                {heroScore}
              </motion.span>
              <span className="absolute bottom-1.5 text-[8px] font-bold tracking-[0.2em] text-foreground/40">/100</span>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50">FIT SCORE</p>
              <p className={`text-sm font-semibold ${heroColor}`}>{heroFitType}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-[0.2em] text-foreground/50 mb-1">SIZE</p>
            <p className="font-display text-5xl font-bold text-foreground leading-none">{activeSize}</p>
            {result.alternateSize !== "N/A" && activeSize !== result.alternateSize && (
              <p className="text-[10px] text-foreground/40 mt-1">alt: {result.alternateSize}</p>
            )}
          </div>
        </div>

        {/* Size switcher */}
        <div className="mt-5 flex flex-wrap gap-2">
          {result.sizeResults.map((sr) => {
            const isActive = sr.size === activeSize;
            return (
              <button key={sr.size} onClick={() => setActiveSize(sr.size)}
                className={`relative flex flex-col items-center justify-center rounded-xl border px-3 py-2 transition-all ${
                  isActive ? "border-accent/50 bg-accent/15 text-foreground"
                    : "border-foreground/10 bg-background/40 text-foreground/60 hover:bg-foreground/[0.04]"
                }`}>
                <span className="font-display text-sm font-bold leading-none">{sr.size}</span>
                <span className={`text-[9px] font-bold tracking-wider mt-0.5 ${
                  sr.fitScore >= 80 ? "text-green-500" : sr.fitScore >= 65 ? "text-accent" : "text-orange-500"
                }`}>{sr.fitScore}</span>
                {sr.recommended && (
                  <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-accent ring-2 ring-background" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ VISUAL FIT — Replicate-generated try-on (primary) ══ */}
      <FitVisual
        productImage={product.image}
        productName={product.name}
        category={product.category}
        activeSize={activeSize}
        userChestCm={estUserChest}
        userShoulderCm={estUserShoulder}
        userHeightCm={bodyHeightCm}
        userWeightKg={bodyWeightKg}
        tryOnImageUrl={tryOn.imageUrl}
        tryOnStatus={tryOn.status}
        tryOnProvider={tryOn.provider}
        onRescanBody={onRescan}
      />
      {tryOn.status === "error" && (
        <p className="text-[10px] text-center text-orange-400/75 -mt-3">
          Couldn't generate try-on ({tryOn.error || "unknown error"}). Showing preview silhouette.
        </p>
      )}
      {tryOn.status === "invalid_body" && (
        <p className="text-[10px] text-center text-amber-400/85 -mt-3">
          Body image needs a full-body front shot for an accurate try-on.
        </p>
      )}
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
