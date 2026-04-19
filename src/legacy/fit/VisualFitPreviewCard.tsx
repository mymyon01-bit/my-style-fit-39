import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { RegionFit, SizeFitResult } from "@/lib/fitEngine";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  // Either pass a single (legacy) regions+activeSize or the full sizeResults for S/M/L toggle.
  regions: RegionFit[];
  category: string;
  activeSize: string;
  fitScore: number;
  // New optional props for layered try-on
  sizeResults?: SizeFitResult[];
  productImageUrl?: string;
  productName?: string;
  onSizeChange?: (size: string) => void;
}

/* ── Cutout cache (localStorage) ── */
const CUTOUT_KEY_PREFIX = "wb_cutout_v1::";
const cutoutCache = new Map<string, string>();

function readCutout(srcUrl: string): string | null {
  if (!srcUrl) return null;
  if (cutoutCache.has(srcUrl)) return cutoutCache.get(srcUrl)!;
  try {
    const v = localStorage.getItem(CUTOUT_KEY_PREFIX + srcUrl);
    if (v) cutoutCache.set(srcUrl, v);
    return v;
  } catch {
    return null;
  }
}

function writeCutout(srcUrl: string, dataUrl: string) {
  cutoutCache.set(srcUrl, dataUrl);
  try {
    // Cap one cutout to ~700KB to avoid blowing localStorage quotas.
    if (dataUrl.length < 700_000) localStorage.setItem(CUTOUT_KEY_PREFIX + srcUrl, dataUrl);
  } catch {
    /* quota exceeded — silent */
  }
}

/* ── Fit → visual transform deltas ── */
function regionDelta(regions: RegionFit[], name: string): number {
  return regions.find((r) => r.region === name)?.delta ?? 0;
}

function regionFit(regions: RegionFit[], name: string): string {
  return regions.find((r) => r.region === name)?.fit?.toString() ?? "balanced";
}

/**
 * Convert fit deltas to CSS transforms for the garment overlay.
 * Positive chest/waist delta = looser → widen horizontally.
 * Negative = tighter → compress slightly.
 * Length delta drives vertical scale.
 */
function buildGarmentTransform(regions: RegionFit[], category: string) {
  const isBottom = category === "bottoms";
  const chestDelta = regionDelta(regions, "Chest");
  const waistDelta = regionDelta(regions, "Waist");
  const hipDelta = regionDelta(regions, "Hip");
  const lengthDelta = isBottom
    ? regionDelta(regions, "Inseam")
    : regionDelta(regions, "Length");

  // Map cm → scale factor. Cap so we never look broken.
  const widthBias = isBottom ? (waistDelta + hipDelta) / 2 : (chestDelta + waistDelta) / 2;
  const scaleX = Math.max(0.85, Math.min(1.18, 1 + widthBias / 80));
  const scaleY = Math.max(0.92, Math.min(1.12, 1 + lengthDelta / 60));

  return { scaleX, scaleY };
}

/**
 * Confidence/quality affects visual sharpness:
 * higher fitScore → sharper, less blur.
 */
function buildConfidenceFx(fitScore: number) {
  // 100 → 0px blur, 50 → 1.4px blur
  const blur = Math.max(0, (100 - fitScore) / 35);
  const opacity = fitScore >= 65 ? 1 : 0.92;
  return { blur, opacity };
}

/* ── Silhouette (lightweight inline SVG) ── */
function Silhouette({ category }: { category: string }) {
  const isBottom = category === "bottoms";
  return (
    <svg
      viewBox="0 0 200 380"
      className="absolute inset-0 h-full w-full"
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id="silGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--foreground) / 0.10)" />
          <stop offset="100%" stopColor="hsl(var(--foreground) / 0.04)" />
        </linearGradient>
      </defs>
      {/* Head */}
      <circle cx="100" cy="32" r="18" fill="url(#silGrad)" />
      {/* Neck */}
      <rect x="92" y="48" width="16" height="10" rx="3" fill="url(#silGrad)" />
      {/* Shoulders + torso */}
      <path
        d="M62 70 Q100 55 138 70 L150 130 Q150 175 138 200 L100 210 L62 200 Q50 175 50 130 Z"
        fill="url(#silGrad)"
      />
      {/* Hips */}
      <path
        d="M62 200 L138 200 L142 230 Q142 240 138 245 L62 245 Q58 240 62 230 Z"
        fill="url(#silGrad)"
      />
      {/* Legs */}
      <path
        d="M70 245 L88 360 L100 360 L100 245 Z M100 245 L100 360 L112 360 L130 245 Z"
        fill="url(#silGrad)"
      />
      {/* Arms */}
      <path d="M50 130 L38 220 L48 220 L62 140 Z" fill="url(#silGrad)" />
      <path d="M150 130 L162 220 L152 220 L138 140 Z" fill="url(#silGrad)" />
      {/* Soft ground shadow */}
      <ellipse cx="100" cy="370" rx={isBottom ? 50 : 42} ry="4" fill="hsl(var(--foreground) / 0.06)" />
    </svg>
  );
}

/* ── Bounding box for garment overlay per category ── */
function garmentBox(category: string) {
  // Returns position + size in % of the silhouette stage.
  if (category === "bottoms") {
    return { top: "52%", left: "50%", width: "62%", height: "44%" };
  }
  if (category === "outerwear") {
    return { top: "16%", left: "50%", width: "78%", height: "56%" };
  }
  // tops (default)
  return { top: "17%", left: "50%", width: "72%", height: "44%" };
}

/* ── Main component ── */
export default function VisualFitPreviewCard({
  regions,
  category,
  activeSize,
  fitScore,
  sizeResults,
  productImageUrl,
  productName,
  onSizeChange,
}: Props) {
  // Sizes available for the toggle
  const availableSizes = sizeResults?.map((s) => s.size) ?? [activeSize];
  const [internalSize, setInternalSize] = useState(activeSize);
  useEffect(() => setInternalSize(activeSize), [activeSize]);

  const currentRegions = useMemo(() => {
    if (!sizeResults) return regions;
    return sizeResults.find((s) => s.size === internalSize)?.regions ?? regions;
  }, [sizeResults, internalSize, regions]);

  const currentScore = useMemo(() => {
    if (!sizeResults) return fitScore;
    return sizeResults.find((s) => s.size === internalSize)?.fitScore ?? fitScore;
  }, [sizeResults, internalSize, fitScore]);

  /* ── Cutout fetch on first view ── */
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(() =>
    productImageUrl ? readCutout(productImageUrl) : null
  );
  const [cutoutLoading, setCutoutLoading] = useState(false);

  useEffect(() => {
    if (!productImageUrl) return;
    const cached = readCutout(productImageUrl);
    if (cached) {
      setCutoutUrl(cached);
      return;
    }
    let cancelled = false;
    setCutoutLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("cutout-product", {
          body: { imageUrl: productImageUrl, productName },
        });
        if (cancelled) return;
        if (!error && data?.cutoutUrl) {
          writeCutout(productImageUrl, data.cutoutUrl);
          setCutoutUrl(data.cutoutUrl);
        }
      } catch (e) {
        console.warn("cutout failed, falling back to raw image", e);
      } finally {
        if (!cancelled) setCutoutLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productImageUrl, productName]);

  /* ── Visual transforms ── */
  const { scaleX, scaleY } = buildGarmentTransform(currentRegions, category);
  const { blur, opacity } = buildConfidenceFx(currentScore);
  const box = garmentBox(category);

  const handleSize = (s: string) => {
    setInternalSize(s);
    onSizeChange?.(s);
  };

  // Region badges shown beside the body
  const headlineFits = currentRegions.slice(0, 4);

  return (
    <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/50 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-accent" />
          VISUAL TRY-ON
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[9px] tracking-[0.2em] text-foreground/40">SIZE {internalSize}</span>
          <span className="text-[9px] tracking-[0.2em] text-foreground/40">·</span>
          <span className="text-[10px] font-bold text-foreground/70">{currentScore}/100</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1.1fr,1fr] gap-2 p-3">
        {/* LEFT — layered silhouette + product */}
        <div className="relative rounded-xl bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.01] overflow-hidden min-h-[340px]">
          <div className="relative h-full w-full" style={{ aspectRatio: "200 / 380" }}>
            <Silhouette category={category} />

            {/* Garment overlay */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${internalSize}-${cutoutUrl ? "cut" : productImageUrl ? "raw" : "none"}`}
                initial={{ opacity: 0, scale: 0.94, y: 6 }}
                animate={{ opacity, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 220, damping: 22 }}
                className="absolute"
                style={{
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: box.height,
                  transform: `translate(-50%, -50%) scale(${scaleX}, ${scaleY})`,
                  transformOrigin: "center top",
                  filter: `drop-shadow(0 8px 14px hsl(var(--foreground) / 0.18)) blur(${blur}px)`,
                  willChange: "transform, opacity",
                }}
              >
                {productImageUrl ? (
                  <img
                    src={cutoutUrl ?? productImageUrl}
                    alt={productName ?? "Garment"}
                    className="h-full w-full object-contain"
                    style={{
                      // If we don't have a real cutout, gently blend onto the silhouette.
                      mixBlendMode: cutoutUrl ? "normal" : "multiply",
                    }}
                    draggable={false}
                  />
                ) : (
                  <div className="h-full w-full rounded-2xl bg-accent/30" />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Cutout loading shimmer */}
            {cutoutLoading && !cutoutUrl && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-background/70 px-2 py-1 backdrop-blur">
                <Loader2 className="h-3 w-3 animate-spin text-accent" />
                <span className="text-[9px] font-bold tracking-[0.15em] text-foreground/60">
                  REFINING
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — region chips + size toggle */}
        <div className="rounded-xl bg-foreground/[0.02] p-3 flex flex-col gap-3">
          <div className="space-y-1.5">
            {headlineFits.map((r) => {
              const isGood = r.fit === "balanced" || r.fit === "fitted" || r.fit === "good-length";
              const isWarn = r.fit === "too-tight" || r.fit === "too-loose" || r.fit === "too-short" || r.fit === "too-long";
              const color = isGood ? "text-green-500" : isWarn ? "text-orange-500" : "text-accent";
              const bg = isGood ? "bg-green-500/8" : isWarn ? "bg-orange-500/8" : "bg-accent/8";
              return (
                <div key={r.region} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${bg}`}>
                  <span className="text-[11px] font-semibold text-foreground/80">{r.region}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${color}`}>
                    {friendlyFit(r.fit)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Size toggle */}
          {availableSizes.length > 1 && (
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] text-foreground/50 mb-2">COMPARE SIZES</p>
              <div className="flex flex-wrap gap-1.5">
                {availableSizes.map((s) => {
                  const sr = sizeResults?.find((x) => x.size === s);
                  const isActive = s === internalSize;
                  return (
                    <button
                      key={s}
                      onClick={() => handleSize(s)}
                      className={`flex flex-col items-center justify-center rounded-lg border px-2.5 py-1.5 transition-all ${
                        isActive
                          ? "border-accent/50 bg-accent/15 text-foreground"
                          : "border-foreground/10 bg-background/40 text-foreground/60 hover:bg-foreground/[0.04]"
                      }`}
                    >
                      <span className="font-display text-xs font-bold leading-none">{s}</span>
                      {sr && (
                        <span
                          className={`text-[9px] font-bold mt-0.5 ${
                            sr.fitScore >= 80
                              ? "text-green-500"
                              : sr.fitScore >= 65
                              ? "text-accent"
                              : "text-orange-500"
                          }`}
                        >
                          {sr.fitScore}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function friendlyFit(fit: string): string {
  const map: Record<string, string> = {
    "balanced": "PERFECT",
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
  return map[fit] ?? fit.replace(/-/g, " ").toUpperCase();
}
