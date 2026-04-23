import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, RefreshCw, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { FitTryOnState } from "@/hooks/useFitTryOn";
import FitImageCanvas from "@/components/fit/FitImageCanvas";
import {
  profileFromOverall,
  profileFromSizeLetter,
  type SizeWarpProfile,
} from "@/lib/fit/sizeWarpProfile";
import type { OverallFitLabel } from "@/lib/sizing";

interface Props {
  productName: string;
  activeSize: string;
  state: FitTryOnState;
  onRescanBody?: () => void;
  onRetry?: () => void;
  /** Per-region fit chips (optional). */
  fitChips?: Array<{ region: string; fit: string; tone: "tight" | "regular" | "loose" }>;
  /** Hint that the user's body photo was missing details. */
  poseDegraded?: boolean;
  /**
   * Overall fit label from the measurement-driven sizing engine for the
   * currently selected size. Drives the deterministic per-size silhouette
   * warp applied on top of the AI image — this is what guarantees XL never
   * looks identical to S even when the AI ignores fit hints.
   */
  overallFit?: OverallFitLabel | null;
}

const TONE_STYLE: Record<string, { dot: string; label: string }> = {
  tight: { dot: "bg-orange-500", label: "TIGHT" },
  regular: { dot: "bg-emerald-500", label: "REGULAR" },
  loose: { dot: "bg-sky-500", label: "LOOSE" },
};

/**
 * VISUAL FIT — three states only:
 *   1) loading      → animated silhouette + "Generating final fitting image…"
 *   2) ready        → final AI image (persistent storage URL)
 *   3) failed       → error message + RETRY (last good image preserved if any)
 *
 * No floating garment composite, no half-processed mock as the main result.
 */
export default function FitVisual({
  productName,
  activeSize,
  state,
  onRescanBody,
  onRetry,
  fitChips = [],
  poseDegraded = false,
  overallFit = null,
}: Props) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Deterministic per-size silhouette warp profile. Falls back to the size
  // letter when the measurement engine hasn't produced an overall label yet.
  const warpProfile: SizeWarpProfile = overallFit
    ? profileFromOverall(overallFit)
    : profileFromSizeLetter(activeSize);

  const previewSrc = state.imageUrl ?? null;
  const isReady = state.stage === "ready" && !!previewSrc && !imageError;
  const isFailed = state.stage === "failed";
  const isLoading = state.stage === "generating" || state.stage === "polling";
  // If failure but we have a sticky last-good image, surface it as fallback.
  const showStickyFallback = isFailed && !!previewSrc && !imageError;

  useEffect(() => {
    setLoadedSrc(null);
    setImageError(false);
  }, [previewSrc]);

  const handleShare = async () => {
    if (!previewSrc) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${productName} — try-on size ${activeSize}`,
          url: previewSrc,
        });
      } else {
        await navigator.clipboard.writeText(previewSrc);
        toast.success("Try-on image link copied");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(previewSrc);
        toast.success("Try-on image link copied");
      } catch {
        toast.error("Couldn't share image");
      }
    }
  };

  const showImage = isReady || showStickyFallback;

  const stageMessage = isLoading
    ? state.stage === "polling"
      ? "Generating final fitting image…"
      : "Preparing your fitting…"
    : "Generating final fitting image…";

  return (
    <div className="group/visual space-y-3 overflow-hidden rounded-3xl border border-foreground/[0.08] bg-gradient-to-br from-card/80 via-card/50 to-card/20 p-3 shadow-[0_8px_40px_-16px_hsl(var(--accent)/0.18)] backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_8px_40px_-12px_hsl(var(--accent)/0.28)] sm:p-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full ${
                isLoading ? "animate-ping bg-accent/60" : isFailed ? "bg-orange-500/60" : "bg-emerald-500/60"
              }`}
            />
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                isLoading ? "bg-accent" : isFailed ? "bg-orange-500" : "bg-emerald-500"
              }`}
            />
          </span>
          <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">VISUAL FIT</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[9px] font-semibold tracking-[0.18em] text-accent">
            <Sparkles className="h-2.5 w-2.5" /> SIZE {activeSize}
          </span>
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isLoading}
              aria-label="Regenerate try-on"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/10 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
          {showImage && (
            <button
              onClick={handleShare}
              aria-label="Share try-on image"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/10 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <Share2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-2xl border border-foreground/[0.06] bg-muted/20"
        style={{ aspectRatio: "3 / 4", maxHeight: 560 }}
      >
        {showImage && previewSrc ? (
          <>
            <div className="relative h-full w-full">
              {loadedSrc !== previewSrc && (
                <div
                  className="absolute inset-0 animate-pulse bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.02]"
                  aria-hidden
                />
              )}
              <img
                key={previewSrc}
                src={previewSrc}
                alt={`${productName} try-on, size ${activeSize}`}
                className="relative h-full w-full object-cover"
                loading="eager"
                decoding="async"
                onLoad={() => setLoadedSrc(previewSrc)}
                onError={() => {
                  console.warn("[FIT_TRYON] image_load_error", {
                    urlPrefix: previewSrc.slice(0, 80),
                  });
                  setImageError(true);
                }}
              />
            </div>
            <div className="absolute bottom-3 left-3 rounded-full bg-background/70 px-2.5 py-1 backdrop-blur-md">
              <span className="text-[9px] font-semibold tracking-[0.18em] text-foreground/80">
                AI FITTING · SIZE {activeSize}
              </span>
            </div>
            {showStickyFallback && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 backdrop-blur-md">
                <AlertTriangle className="h-3 w-3 text-orange-500" />
                <span className="text-[9px] font-semibold tracking-[0.18em] text-orange-400">
                  PREVIOUS RESULT
                </span>
              </div>
            )}
          </>
        ) : isFailed ? (
          // STATE 3 — FAILED: clear error + retry, never a misleading composite.
          <div className="relative h-full w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.06] via-foreground/[0.02] to-foreground/[0.04]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/60 backdrop-blur-md ring-1 ring-orange-500/30">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </div>
              <div className="space-y-2">
                <p className="text-[12px] font-semibold text-foreground/85">
                  Couldn't generate your fitting
                </p>
                <p className="mx-auto max-w-[260px] text-[10px] leading-relaxed text-foreground/55">
                  {state.error || "The AI service is temporarily unavailable."}
                </p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-background/60 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-foreground/85 transition-colors hover:bg-foreground/10"
                  >
                    <RefreshCw className="h-3 w-3" /> RETRY
                  </button>
                )}
                <p className="text-[10px] tracking-[0.18em] text-foreground/40">
                  Your fit analysis below is still valid.
                </p>
              </div>
            </div>
          </div>
        ) : (
          // STATE 1 — LOADING: animated silhouette skeleton, no fake garment.
          <div className="relative h-full w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.05] via-accent/[0.04] to-foreground/[0.02]" />
            <motion.div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/[0.08] to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute inset-0 flex items-end justify-center">
              <svg
                viewBox="0 0 200 280"
                className="h-[78%] w-auto opacity-[0.18]"
                fill="currentColor"
                aria-hidden
              >
                <ellipse cx="100" cy="44" rx="22" ry="26" />
                <path d="M52 110 Q100 80 148 110 L160 220 Q100 240 40 220 Z" />
                <rect x="60" y="200" width="32" height="78" rx="8" />
                <rect x="108" y="200" width="32" height="78" rx="8" />
              </svg>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/60 backdrop-blur-md ring-1 ring-foreground/10">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              </div>
              <div className="space-y-2 text-center">
                <p className="text-[12px] font-semibold text-foreground/80">{stageMessage}</p>
                <div className="mx-auto h-1 w-32 overflow-hidden rounded-full bg-foreground/10">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-accent"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <p className="text-[10px] tracking-[0.18em] text-foreground/45">
                  AI is rendering you in this garment
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {poseDegraded && showImage && (
        <div className="flex items-start gap-2 rounded-xl border border-orange-500/20 bg-orange-500/[0.06] px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />
          <div className="flex-1 space-y-1">
            <p className="text-[11px] font-semibold leading-tight text-foreground/85">
              Approximate fit preview
            </p>
            <p className="text-[10px] leading-relaxed text-foreground/55">
              Upload a clearer full-body front photo for a more personal try-on.
            </p>
          </div>
          {onRescanBody && (
            <button
              onClick={onRescanBody}
              className="shrink-0 rounded-full bg-foreground/10 px-3 py-1 text-[9px] font-bold tracking-[0.18em] text-foreground/85 transition-colors hover:bg-foreground/15"
            >
              UPLOAD
            </button>
          )}
        </div>
      )}

      {fitChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {fitChips.map((chip) => {
            const tone = TONE_STYLE[chip.tone] ?? TONE_STYLE.regular;
            return (
              <div
                key={chip.region}
                className="flex items-center gap-1.5 rounded-full border border-foreground/10 bg-background/50 px-2.5 py-1"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                <span className="text-[9px] font-semibold tracking-[0.14em] text-foreground/70">
                  {chip.region.toUpperCase()}
                </span>
                <span className="text-[9px] font-bold tracking-[0.14em] text-foreground/90">
                  {tone.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[10px] tracking-[0.18em] text-foreground/45">
        {showImage
          ? "AI-generated fitting based on your measurements"
          : isFailed
          ? "Final AI fitting could not be generated"
          : "Generating your final AI fitting…"}
      </p>
      {showImage && (
        <p className="px-2 text-center text-[9px] leading-relaxed text-foreground/35">
          Visual approximation — actual fit may differ slightly from this preview.
        </p>
      )}
    </div>
  );
}
