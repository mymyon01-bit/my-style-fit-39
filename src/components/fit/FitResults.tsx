import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShieldCheck, AlertTriangle, ExternalLink, User, RotateCcw, Pencil, Sparkles, Loader2, Lock, TrendingUp, TrendingDown, Minus, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { FitResult, SizeFitResult } from "@/lib/fitEngine";
import SafeImage from "@/components/SafeImage";
import BodySilhouette from "@/components/fit/BodySilhouette";
import TryOnPreviewModal, { TryOnContext } from "@/components/fit/TryOnPreviewModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { FitMode } from "@/pages/FitPage";

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
  onRefineFit?: () => void;
  onRescan?: () => void;
  onEditMeasurements?: () => void;
}

/* ── helpers ── */

const fitLabel = (fit: string) => fit.replace(/-/g, " ");

const fitColor = (fit: string) => {
  if (fit.includes("tight")) return "text-orange-500";
  if (fit.includes("short")) return "text-orange-400";
  if (fit === "fitted" || fit === "balanced" || fit === "good-length") return "text-green-500";
  if (fit === "relaxed") return "text-blue-400";
  if (fit.includes("loose") || fit === "oversized") return "text-blue-500";
  if (fit.includes("long")) return "text-blue-400";
  return "text-foreground/75";
};

const fitBg = (fit: string) => {
  if (fit.includes("tight") || fit.includes("short")) return "bg-orange-500/15";
  if (fit === "fitted" || fit === "balanced" || fit === "good-length") return "bg-green-500/15";
  return "bg-blue-500/15";
};

const fitIcon = (fit: string) => {
  if (fit.includes("tight") || fit.includes("short")) return <TrendingDown className="h-3 w-3" />;
  if (fit === "fitted" || fit === "balanced" || fit === "good-length") return <Minus className="h-3 w-3" />;
  return <TrendingUp className="h-3 w-3" />;
};

const regionPercent = (score: number) => Math.min(100, Math.max(0, score));

const confidenceLabel = (mod: number) => {
  if (mod >= 0.8) return { text: "HIGH", color: "text-green-500", bg: "bg-green-500/10" };
  if (mod >= 0.6) return { text: "MEDIUM", color: "text-accent", bg: "bg-accent/10" };
  return { text: "LOW", color: "text-orange-500", bg: "bg-orange-500/10" };
};

const fitToPercent = (fit: string): number => {
  const map: Record<string, number> = {
    "too-tight": 20, "slightly-tight": 65, "fitted": 90, "balanced": 95,
    "relaxed": 82, "oversized": 55, "too-loose": 25,
    "too-short": 25, "slightly-short": 65, "good-length": 95,
    "slightly-long": 70, "too-long": 25,
  };
  return map[fit] ?? 50;
};

/* ── Region Card ── */
function RegionIndicator({ region, fit, delta }: { region: string; fit: string; delta: number }) {
  const pct = fitToPercent(fit);
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-20 shrink-0">
        <p className="text-[11px] font-semibold text-foreground/80">{region}</p>
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-semibold uppercase ${fitColor(fit)}`}>
            {fitLabel(fit)}
          </span>
          <span className="text-[11px] font-bold text-foreground/70">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`h-full rounded-full ${
              pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-accent" : "bg-orange-500"
            }`}
          />
        </div>
      </div>
      <div className={`shrink-0 flex items-center justify-center h-6 w-6 rounded-full ${fitBg(fit)} ${fitColor(fit)}`}>
        {fitIcon(fit)}
      </div>
    </div>
  );
}

/* ── Size Comparison Card ── */
function SizeComparisonCard({ result, isRecommended, isAlternate }: {
  result: SizeFitResult;
  isRecommended: boolean;
  isAlternate: boolean;
}) {
  const [expanded, setExpanded] = useState(isRecommended);

  const overallLabel = result.fitScore >= 80 ? "Best balance" :
    result.fitScore >= 65 ? "Acceptable fit" : "Potential issues";

  return (
    <div className={`rounded-2xl border transition-colors ${
      isRecommended
        ? "border-accent/30 bg-accent/[0.04]"
        : isAlternate
        ? "border-foreground/[0.08] bg-card/40"
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
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-1 border-t border-foreground/[0.04] pt-3">
              {result.regions.map(r => (
                <div key={r.region} className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-foreground/60">{r.region}</span>
                  <span className={`text-[10px] font-bold uppercase ${fitColor(r.fit)}`}>
                    {fitLabel(r.fit)}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-foreground/[0.04]">
                <p className="text-[10px] text-foreground/50">
                  Overall: <span className="font-semibold text-foreground/70">{overallLabel}</span>
                </p>
              </div>
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
  fitMode, canUsePremium, refining, onRefineFit,
  onRescan, onEditMeasurements,
}: Props) {
  const { user } = useAuth();
  const conf = confidenceLabel(result.confidenceModifier);
  const isRefined = fitMode === "premium";
  const recommended = result.sizeResults.find(s => s.recommended);
  const alternate = result.sizeResults.find(s => s.alternate);

  // Active size = user-selected; defaults to recommended.
  const [activeSize, setActiveSize] = useState<string>(result.recommendedSize);
  useEffect(() => { setActiveSize(result.recommendedSize); }, [result.recommendedSize]);
  const activeSizeResult = result.sizeResults.find(s => s.size === activeSize) ?? recommended;
  const heroScore = activeSizeResult?.fitScore ?? 0;
  const heroFitType =
    heroScore >= 80 ? "Best fit" :
    heroScore >= 65 ? "Good fit" :
    heroScore >= 50 ? "Wearable" : "Poor fit";
  const heroColor =
    heroScore >= 80 ? "text-green-500" :
    heroScore >= 65 ? "text-accent" :
    heroScore >= 50 ? "text-orange-400" : "text-orange-500";
  const heroRing =
    heroScore >= 80 ? "ring-green-500/30" :
    heroScore >= 65 ? "ring-accent/30" :
    heroScore >= 50 ? "ring-orange-400/30" : "ring-orange-500/30";

  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [userImageUrl, setUserImageUrl] = useState<string | null>(null);

  // Fetch the user's stored front body-scan image (used as the try-on base).
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
  const tryOnContext: TryOnContext | null = tryOnReady
    ? {
        userImageUrl: userImageUrl!,
        productImageUrl: product.image,
        productName: product.name,
        productBrand: product.brand,
        productUrl: product.url,
        category: product.category,
        recommendedSize: activeSize,
        confidence: conf.text,
      }
    : null;

  return (
    <div className="space-y-5">
      {/* Mode & Confidence badges */}
      <div className="flex items-center justify-between">
        {isRefined ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.15em] text-accent">
            <Sparkles className="h-3 w-3" /> REFINED FIT
          </span>
        ) : (
          <span className="text-[10px] font-bold tracking-[0.15em] text-foreground/50">
            ESTIMATED FIT
          </span>
        )}
        <span className={`text-[10px] font-bold tracking-[0.1em] px-2.5 py-1 rounded-full ${conf.bg} ${conf.color}`}>
          {conf.text} CONFIDENCE
        </span>
      </div>

      {/* Product header */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-4">
        <div className="flex gap-4">
          {product.image ? (
            <SafeImage
              src={product.image}
              alt={product.name}
              className="h-28 w-20 rounded-xl object-cover"
              fallbackClassName="h-28 w-20 rounded-xl bg-foreground/[0.04] flex items-center justify-center"
            />
          ) : (
            <div className="h-28 w-20 rounded-xl bg-foreground/[0.04] flex items-center justify-center">
              <span className="font-display text-2xl font-bold text-foreground/75">{product.name.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1 space-y-1.5">
            <p className="text-[10px] tracking-[0.1em] text-foreground/50 uppercase">{product.brand}</p>
            <p className="font-display text-sm font-semibold text-foreground leading-tight">{product.name}</p>
            {product.price && <p className="text-base font-bold text-foreground">${product.price}</p>}
            <div className="flex gap-3 mt-1 flex-wrap">
              <div className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-foreground/40" />
                <span className="text-[10px] text-foreground/50">Data {result.productDataQuality}/100</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-foreground/40" />
                <span className="text-[10px] text-foreground/50">Scan {result.scanQuality}/100</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Low confidence warning */}
      {result.confidenceModifier < 0.7 && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
          <span className="text-[11px] text-orange-400/80">
            Limited confidence — product data or scan quality is below ideal. Treat as approximate.
          </span>
        </div>
      )}

      {/* ══ RECOMMENDED SIZE BLOCK ══ */}
      <div className="rounded-2xl border border-accent/20 bg-accent/[0.03] p-5">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50 mb-3">RECOMMENDED SIZE</p>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-5xl font-bold text-foreground">{result.recommendedSize}</span>
          {result.alternateSize !== "N/A" && (
            <span className="text-sm text-foreground/40">alt: {result.alternateSize}</span>
          )}
        </div>
        {recommended && (
          <p className="text-[11px] text-foreground/60 mt-3 leading-relaxed">
            {recommended.regions.filter(r => r.fit === "balanced" || r.fit === "fitted" || r.fit === "good-length").length > 0
              ? `Best fit across ${recommended.regions.filter(r => r.fit === "balanced" || r.fit === "fitted" || r.fit === "good-length").map(r => r.region.toLowerCase()).join(", ")}.`
              : ""
            }
            {recommended.regions.filter(r => r.fit.includes("tight")).length > 0
              ? ` Slightly snug at ${recommended.regions.filter(r => r.fit.includes("tight")).map(r => r.region.toLowerCase()).join(", ")}.`
              : ""
            }
            {alternate && ` ${alternate.size} offers ${
              alternate.regions.filter(r => r.fit === "balanced" || r.fit === "relaxed").length > recommended.regions.filter(r => r.fit === "balanced" || r.fit === "relaxed").length
                ? "more room" : "a tighter feel"
            } as an alternative.`}
          </p>
        )}
      </div>

      {/* ══ BODY DIAGRAM ══ */}
      {recommended && (
        <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50 mb-2">BODY FIT MAP</p>
          <BodySilhouette regions={recommended.regions} category={product.category} />
        </div>
      )}

      {/* ══ REGION-BASED FIT INDICATORS ══ */}
      {recommended && (
        <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50 mb-1">REGION ANALYSIS</p>
          <div className="divide-y divide-foreground/[0.04]">
            {recommended.regions.map(r => (
              <RegionIndicator key={r.region} region={r.region} fit={r.fit} delta={r.delta} />
            ))}
          </div>
        </div>
      )}

      {/* Refine Fit CTA */}
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
          {refining ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Refining analysis…</>
          ) : canUsePremium ? (
            <><Sparkles className="h-4 w-4" /> Refine Fit — High Precision</>
          ) : (
            <><Lock className="h-3.5 w-3.5" /> Refined Fit (Premium)</>
          )}
        </motion.button>
      )}

      {/* ══ SIZE-BY-SIZE COMPARISON ══ */}
      <div>
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50 mb-3">SIZE COMPARISON</p>
        <div className="space-y-2">
          {result.sizeResults.map(sr => (
            <SizeComparisonCard
              key={sr.size}
              result={sr}
              isRecommended={sr.recommended}
              isAlternate={sr.alternate}
            />
          ))}
        </div>
      </div>

      {/* AI Explanation */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50">FIT ANALYSIS</p>
          {isRefined && <Sparkles className="h-3 w-3 text-accent/60" />}
        </div>
        {loadingExplanation ? (
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-foreground/[0.04] animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-foreground/[0.04] animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-foreground/[0.04] animate-pulse" />
          </div>
        ) : (
          <p className="text-sm font-light leading-relaxed text-foreground/80">
            {explanation || result.summary}
          </p>
        )}
      </div>

      {/* Try It On + Shop Now — fixed action row */}
      <div className="space-y-2">
        <button
          onClick={() => setTryOnOpen(true)}
          disabled={!tryOnReady}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] py-3 text-sm font-semibold text-accent hover:bg-accent/[0.12] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={tryOnReady ? "Generate a virtual try-on" : "Upload a front body scan to enable try-on"}
        >
          <Wand2 className="h-4 w-4" />
          TRY IT ON
        </button>
        {!tryOnReady && (
          <p className="text-[10px] text-center text-foreground/40">
            Upload a front body scan to enable try-on
          </p>
        )}
        {product.url && product.url !== "#" && (
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            <ExternalLink className="h-4 w-4" />
            SHOP NOW
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

      {/* Try-on modal */}
      <TryOnPreviewModal
        open={tryOnOpen}
        onClose={() => setTryOnOpen(false)}
        context={tryOnContext}
      />
    </div>
  );
}
