// ─── FIT VISUAL ─────────────────────────────────────────────────────────────
// HERO: AI-generated try-on image (edge-to-edge). The previous 3D viewer
// has been demoted to legacy code (Fit3DViewer.tsx still exists but is no
// longer rendered). Silhouette is shown ONLY as final fallback.
//
// States rendered:
//   1. generating      → clean overlay with thin progress bar
//   2. ready/fallback  → full image, edge-to-edge
//   3. invalid_body    → CTA to upload body photo (text-prompt path still works)
//   4. error / missing → silhouette + "Preview unavailable"

import { motion } from "framer-motion";
import { Sparkles, Camera, ImageOff, User } from "lucide-react";
import SafeImage from "@/components/SafeImage";

export type TryOnUiStatus =
  | "idle"
  | "generating"
  | "resolving_image"
  | "missing_image"
  | "ready"
  | "fallback"
  | "error"
  | "invalid_body";

interface Props {
  productImage: string;
  productName: string;
  category: string;
  activeSize: string;

  /** AI try-on result (primary visual) */
  tryOnImageUrl?: string | null;
  tryOnStatus?: TryOnUiStatus;
  tryOnProvider?: "replicate" | "perplexity" | "replicate-text" | null;
  tryOnMode?: "photo" | "text";
  cacheHit?: boolean;

  onRescanBody?: () => void;
}

function FallbackSilhouette({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-foreground/[0.04] to-foreground/[0.02]">
      <User className="h-20 w-20 text-foreground/15" strokeWidth={1} />
      <p className="text-[10px] font-semibold tracking-[0.22em] text-foreground/45">
        {label}
      </p>
    </div>
  );
}

export default function FitVisual({
  productImage,
  productName,
  activeSize,
  tryOnImageUrl,
  tryOnStatus = "idle",
  tryOnProvider,
  tryOnMode = "text",
  cacheHit = false,
  onRescanBody,
}: Props) {
  const hasReal =
    !!tryOnImageUrl &&
    (tryOnStatus === "ready" || tryOnStatus === "fallback");
  // Treat idle as generating so the UI never shows a stuck "PREPARING…" label.
  const isGenerating =
    tryOnStatus === "generating" ||
    tryOnStatus === "resolving_image" ||
    tryOnStatus === "idle";
  const isInvalidBody = tryOnStatus === "invalid_body";
  const isMissing = tryOnStatus === "missing_image";
  const isError = tryOnStatus === "error";

  console.log("[FitVisual] render", {
    tryOnStatus,
    hasImage: !!tryOnImageUrl,
    hasReal,
    isGenerating,
    provider: tryOnProvider,
    activeSize,
  });

  const providerLabel =
    tryOnProvider === "replicate"
      ? "AI TRY-ON"
      : tryOnProvider === "perplexity"
      ? "STYLE PREVIEW"
      : tryOnProvider === "replicate-text"
      ? "STYLE PREVIEW"
      : tryOnMode === "photo"
      ? "AI TRY-ON"
      : "STYLE PREVIEW";

  return (
    <div className="rounded-3xl border border-foreground/[0.08] bg-gradient-to-b from-card/60 to-card/20 p-3 sm:p-4 space-y-3 overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">
          VISUAL FIT
        </p>
        <span className="flex items-center gap-1 text-[9px] font-semibold tracking-[0.18em] text-accent">
          <Sparkles className="h-2.5 w-2.5" /> SIZE {activeSize}
          {cacheHit && <span className="text-foreground/35"> · CACHED</span>}
        </span>
      </div>

      {/* ── HERO IMAGE — edge-to-edge ── */}
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-foreground/[0.06]"
        style={{ aspectRatio: "3 / 4", maxHeight: 560 }}
      >
        {hasReal ? (
          <SafeImage
            src={tryOnImageUrl!}
            alt={`${productName} try-on, size ${activeSize}`}
            className="h-full w-full object-cover"
            fallbackClassName="h-full w-full"
            loading="lazy"
          />
        ) : isGenerating ? (
          <div className="relative h-full w-full bg-gradient-to-b from-background/80 to-background/40">
            {/* faint preview using product image */}
            {productImage && (
              <div className="absolute inset-0 opacity-[0.12]">
                <SafeImage
                  src={productImage}
                  alt=""
                  className="h-full w-full object-contain"
                  fallbackClassName="h-full w-full"
                />
              </div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
              <div className="h-1 w-32 overflow-hidden rounded-full bg-foreground/10">
                <motion.div
                  className="h-full w-1/3 rounded-full bg-accent"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <p className="text-[10px] font-semibold tracking-[0.24em] text-foreground/75">
                GENERATING TRY-ON…
              </p>
              <p className="text-[10px] text-foreground/45 max-w-[260px] text-center leading-relaxed">
                Building a realistic preview at size <strong>{activeSize}</strong>
              </p>
            </div>
          </div>
        ) : isInvalidBody ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center bg-gradient-to-b from-background/80 to-background/40">
            <Camera className="h-10 w-10 text-accent/70" strokeWidth={1.4} />
            <p className="text-[12px] font-semibold leading-snug text-foreground/85 max-w-[260px]">
              Upload a full-body front photo for a personalized try-on
            </p>
            <p className="text-[10px] text-foreground/45 max-w-[240px] leading-relaxed">
              We'll show a style preview meanwhile.
            </p>
            {onRescanBody && (
              <button
                onClick={onRescanBody}
                className="rounded-full bg-accent px-5 py-2 text-[10px] font-bold tracking-[0.18em] text-accent-foreground hover:bg-accent/90 transition-colors"
              >
                SCAN BODY
              </button>
            )}
          </div>
        ) : isMissing ? (
          <div className="relative h-full w-full">
            <FallbackSilhouette label="AI PREVIEW UNAVAILABLE — SHOWING ESTIMATED FIT" />
            <div className="absolute bottom-4 left-0 right-0 px-6 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] text-amber-400/90">
                <ImageOff className="h-3 w-3" /> Product image missing
              </div>
            </div>
          </div>
        ) : isError ? (
          <div className="relative h-full w-full">
            <FallbackSilhouette label="AI PREVIEW UNAVAILABLE — SHOWING ESTIMATED FIT" />
          </div>
        ) : (
          // idle
          <FallbackSilhouette label="PREPARING…" />
        )}

        {/* provider chip overlay (only when image is shown) */}
        {hasReal && (
          <div className="absolute bottom-3 left-3 rounded-full bg-background/70 px-2.5 py-1 backdrop-blur-md">
            <span className="text-[9px] font-semibold tracking-[0.18em] text-foreground/80">
              {providerLabel}
            </span>
          </div>
        )}
      </div>

      {/* tiny footer */}
      <p className="text-center text-[10px] tracking-[0.18em] text-foreground/45">
        {hasReal
          ? tryOnMode === "photo"
            ? "Generated from your body photo"
            : "Style preview · upload a body photo for personal try-on"
          : isGenerating
          ? "Usually ready in a few seconds"
          : "Switch sizes to compare fit"}
      </p>
    </div>
  );
}
