import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, RefreshCw, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CanvasTryOnState } from "@/hooks/useCanvasTryOn";

interface Props {
  productName: string;
  activeSize: string;
  state: CanvasTryOnState;
  /** Raw product image — final fallback so the preview is NEVER blank. */
  productImageUrl?: string | null;
  onRescanBody?: () => void;
  onReload?: () => void;
}

const TONE_STYLE: Record<string, { dot: string; label: string }> = {
  tight: { dot: "bg-orange-500", label: "TIGHT" },
  regular: { dot: "bg-emerald-500", label: "REGULAR" },
  loose: { dot: "bg-sky-500", label: "LOOSE" },
};

export default function FitVisual({
  productName,
  activeSize,
  state,
  productImageUrl,
  onRescanBody,
  onReload,
}: Props) {
  // Preview source priority — ALWAYS include productImageUrl as the last
  // resort so the preview is never blank. The SVG placeholder cannot fail
  // to load (data URI), but if every other source breaks we still render
  // the real product image rather than a skeleton.
  const previewCandidates = useMemo(
    () =>
      [
        state.aiImageUrl,
        state.compositeImageUrl,
        state.fallbackImageUrl,
        state.localPlaceholderUrl,
        state.previewSrc,
        state.imageUrl,
        productImageUrl ?? null,
      ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index),
    [
      state.aiImageUrl,
      state.compositeImageUrl,
      state.fallbackImageUrl,
      state.localPlaceholderUrl,
      state.previewSrc,
      state.imageUrl,
      productImageUrl,
    ]
  );

  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrcs([]);
    setLoadedSrc(null);
  }, [state.requestId, state.aiImageUrl, state.compositeImageUrl, state.fallbackImageUrl, state.localPlaceholderUrl, productImageUrl]);

  const previewSrc = useMemo(
    () => previewCandidates.find((src) => !failedSrcs.includes(src)) ?? null,
    [previewCandidates, failedSrcs]
  );

  const shouldRenderPreview = Boolean(previewSrc);
  const isLoading = !shouldRenderPreview;
  const isRefining = state.stage === "polling_ai";
  const hasImage = shouldRenderPreview;

  useEffect(() => {
    setLoadedSrc(null);
  }, [previewSrc]);

  useEffect(() => {
    console.log("[FIT_PREVIEW]", {
      event: "preview_render",
      requestId: state.requestId,
      stage: state.stage,
      aiImageUrl: state.aiImageUrl,
      compositeImageUrl: state.compositeImageUrl,
      fallbackImageUrl: state.fallbackImageUrl,
      localPlaceholderUrl: state.localPlaceholderUrl,
      previewSrc,
      shouldRenderPreview,
    });
  }, [
    state.requestId,
    state.stage,
    state.aiImageUrl,
    state.compositeImageUrl,
    state.fallbackImageUrl,
    state.localPlaceholderUrl,
    previewSrc,
    shouldRenderPreview,
  ]);

  const sourceLabel =
    previewSrc && previewSrc === state.aiImageUrl
      ? "AI TRY-ON"
      : previewSrc && previewSrc === state.localPlaceholderUrl
      ? "PLACEHOLDER"
      : "STYLE PREVIEW";

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

  const handleImageLoad = () => {
    if (!previewSrc) return;
    setLoadedSrc(previewSrc);
    console.log("[FIT_PREVIEW]", {
      event: "preview_image_loaded",
      requestId: state.requestId,
      stage: state.stage,
      previewSrc,
      shouldRenderPreview,
    });
  };

  const handleImageError = () => {
    if (!previewSrc) return;
    // Never blacklist the raw productImageUrl — it's our last-resort guarantee.
    if (previewSrc === productImageUrl) {
      console.warn("[FIT_PREVIEW]", { event: "product_image_failed_keeping_anyway", previewSrc });
      return;
    }
    console.warn("[FIT_PREVIEW]", {
      event: "preview_image_error_try_next",
      requestId: state.requestId,
      stage: state.stage,
      failedSrc: previewSrc,
    });
    setFailedSrcs((prev) => (prev.includes(previewSrc) ? prev : [...prev, previewSrc]));
  };

  return (
    <div className="space-y-3 overflow-hidden rounded-3xl border border-foreground/[0.08] bg-gradient-to-b from-card/60 to-card/20 p-3 sm:p-4">
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">VISUAL FIT</p>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[9px] font-semibold tracking-[0.18em] text-accent">
            <Sparkles className="h-2.5 w-2.5" /> SIZE {activeSize}
            {isRefining && <span className="text-foreground/35"> · REFINING</span>}
          </span>
          {onReload && (
            <button
              onClick={onReload}
              disabled={isLoading}
              aria-label="Reload try-on"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/10 text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
          {hasImage && (
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
        {shouldRenderPreview ? (
          <>
            <div className="relative h-full w-full">
              {/* Skeleton sits BEHIND the image — never blocks/replaces it.
                  Image is always opacity-100 so cached images & SVG data URIs
                  show even if onLoad never fires (StrictMode, prefetched). */}
              {loadedSrc !== previewSrc && (
                <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.02]" aria-hidden />
              )}
              <img
                key={previewSrc}
                src={previewSrc!}
                alt={`${productName} try-on, size ${activeSize}`}
                className="relative h-full w-full object-cover"
                loading="eager"
                decoding="async"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            </div>
            <div className="absolute bottom-3 left-3 rounded-full bg-background/70 px-2.5 py-1 backdrop-blur-md">
              <span className="text-[9px] font-semibold tracking-[0.18em] text-foreground/80">
                {sourceLabel}
              </span>
            </div>
            {isRefining && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-1 backdrop-blur-md">
                <Loader2 className="h-3 w-3 animate-spin text-accent" />
                <span className="text-[9px] font-semibold tracking-[0.18em] text-foreground/80">
                  ENHANCING
                </span>
              </div>
            )}
          </>
        ) : productImageUrl ? (
          // Hard fallback — if the cascade somehow yields nothing (every
          // candidate marked failed, or state not yet committed), STILL show
          // the raw product image rather than a gray box.
          <div className="relative h-full w-full">
            <img
              src={productImageUrl}
              alt={`${productName} (preview unavailable)`}
              className="h-full w-full object-cover opacity-90"
              loading="eager"
              decoding="async"
            />
            <div className="absolute bottom-3 left-3 rounded-full bg-background/70 px-2.5 py-1 backdrop-blur-md">
              <span className="text-[9px] font-semibold tracking-[0.18em] text-foreground/80">
                PRODUCT
              </span>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full">
            <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.02]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
              <div className="h-1 w-40 overflow-hidden rounded-full bg-foreground/10">
                <motion.div
                  className="h-full w-1/3 rounded-full bg-accent"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-foreground/70">
                {state.stage === "compositing"
                  ? "PREPARING PREVIEW"
                  : state.stage === "polling_ai"
                  ? "REFINING PREVIEW"
                  : "LOADING PREVIEW"}
              </p>
            </div>
          </div>
        )}
      </div>

      {state.poseDegraded && hasImage && (
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

      {state.fitChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {state.fitChips.map((chip) => {
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
        {previewSrc === state.aiImageUrl
          ? "AI-refined preview"
          : state.poseDegraded
          ? "Style preview based on your measurements"
          : "Style preview built from your body photo"}
      </p>
    </div>
  );
}
