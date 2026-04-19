// ─── FIT VISUAL ─────────────────────────────────────────────────────────────
// THE hero: body + cloth anchored to body. Cloth visibly responds to size.
// Replaces the old centered-image VisualFitCard.

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import SafeImage from "@/components/SafeImage";
import BodySilhouette from "./BodySilhouette";
import { calculateFit, silhouetteCopy } from "@/lib/fit/simpleFitEngine";
import { getClothStyle } from "@/lib/visual/renderCloth";
import {
  getDefaultFit,
  DEFAULT_USER_BODY,
  type SimpleSizeKey,
} from "@/lib/fit/defaultFitData";

interface Props {
  productImage: string;
  productName: string;
  category: string;
  activeSize: string;
  /** real user body if available */
  userChestCm?: number;
  userShoulderCm?: number;
  /** optional AI try-on URL — if present, supersedes the 2D render */
  tryOnImageUrl?: string | null;
  /** generation lifecycle: drives the badge + loading overlay */
  tryOnStatus?: "idle" | "generating" | "resolving_image" | "missing_image" | "ready" | "fallback" | "error" | "invalid_body";
  /** which provider produced the image (for the small label) */
  tryOnProvider?: "replicate" | "perplexity" | null;
  /** called when the user taps the "Scan Body" CTA shown on invalid input */
  onRescanBody?: () => void;
}

function normalizeSizeKey(size: string): SimpleSizeKey {
  const upper = size.toUpperCase();
  if (upper === "S" || upper === "M" || upper === "L" || upper === "XL") {
    return upper as SimpleSizeKey;
  }
  // numeric (waist sizes for bottoms) → bucket
  const num = parseInt(size, 10);
  if (!isNaN(num)) {
    if (num <= 30) return "S";
    if (num <= 32) return "M";
    if (num <= 34) return "L";
    return "XL";
  }
  return "M";
}

export default function FitVisual({
  productImage,
  productName,
  category,
  activeSize,
  userChestCm,
  userShoulderCm,
  tryOnImageUrl,
  tryOnStatus = "idle",
  tryOnProvider,
  onRescanBody,
}: Props) {
  const fitTable = getDefaultFit(category);
  const sizeKey = normalizeSizeKey(activeSize);
  const sizeData = fitTable[sizeKey];

  const user = {
    chest: userChestCm && userChestCm > 60 ? userChestCm * 0.5 + 28 : DEFAULT_USER_BODY.chest,
    shoulder: userShoulderCm && userShoulderCm > 30 ? userShoulderCm : DEFAULT_USER_BODY.shoulder,
  };

  const fit = calculateFit(user, sizeData);
  const copy = silhouetteCopy(fit.silhouette);
  const clothStyle = getClothStyle(fit, category);

  const frameFactor = Math.max(0.92, Math.min(1.08, user.shoulder / 46));

  // ── Render-mode decision ─────────────────────────────────────────────────
  // Primary: real Replicate (or Gemini fallback) generated image.
  // Secondary: silhouette + cloth overlay, clearly labelled "Preview only".
  const hasReal = !!tryOnImageUrl && (tryOnStatus === "ready" || tryOnStatus === "fallback");
  const isGenerating = tryOnStatus === "generating";
  const isResolvingImage = tryOnStatus === "resolving_image";
  const isMissingImage = tryOnStatus === "missing_image";

  const badgeLabel =
    hasReal && tryOnProvider === "replicate" ? "AI TRY-ON"
    : hasReal && tryOnProvider === "perplexity" ? "AI TRY-ON · FALLBACK"
    : isResolvingImage ? "FETCHING IMAGE"
    : isMissingImage ? "IMAGE REQUIRED"
    : isGenerating ? "GENERATING"
    : tryOnStatus === "invalid_body" ? "BODY IMAGE NEEDED"
    : tryOnStatus === "error" ? "PREVIEW ONLY"
    : "PREVIEW";

  const badgeTone =
    hasReal && tryOnProvider === "replicate" ? "text-accent"
    : hasReal && tryOnProvider === "perplexity" ? "text-amber-400/90"
    : isResolvingImage ? "text-foreground/60"
    : isMissingImage ? "text-orange-400/90"
    : isGenerating ? "text-foreground/60"
    : tryOnStatus === "invalid_body" ? "text-amber-400/90"
    : tryOnStatus === "error" ? "text-orange-400/85"
    : "text-foreground/55";

  return (
    <div className="rounded-3xl border border-foreground/[0.08] bg-gradient-to-b from-card/60 to-card/20 p-5 space-y-4 overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">
          VISUAL FIT
        </p>
        <span className={`text-[9px] font-semibold tracking-[0.18em] flex items-center gap-1 ${badgeTone}`}>
          <Sparkles className="h-2.5 w-2.5" /> {badgeLabel} · SIZE {activeSize}
        </span>
      </div>

      {/* stage */}
      <div className="relative mx-auto h-[460px] w-full max-w-[320px] rounded-2xl bg-gradient-to-b from-foreground/[0.04] via-foreground/[0.02] to-foreground/[0.06] border border-foreground/[0.04] overflow-hidden fit-root">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, hsl(var(--accent) / 0.06), transparent 60%)",
          }}
          aria-hidden
        />

        {hasReal ? (
          // ── PRIMARY: Replicate / Gemini generated image ──────────────
          <motion.div
            key={tryOnImageUrl}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <SafeImage
              src={tryOnImageUrl!}
              alt={`${productName} virtual try-on`}
              className="h-full w-full object-cover"
              fallbackClassName="h-full w-full bg-foreground/[0.05]"
            />
          </motion.div>
        ) : (
          // ── FALLBACK: silhouette + cloth overlay ─────────────────────
          <>
            <BodySilhouette frameFactor={frameFactor} />

            {productImage ? (
              <motion.div
                key={`${activeSize}-${productImage}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: isGenerating ? 0.35 : 0.85, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 0.9, 0.27, 1.02] }}
                style={clothStyle}
                className="cloth"
              >
                <SafeImage
                  src={productImage}
                  alt={productName}
                  className="h-auto w-full object-contain"
                  fallbackClassName="h-40 w-full bg-foreground/[0.05] rounded-xl"
                />
              </motion.div>
            ) : (
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] text-foreground/40">
                No product image
              </div>
            )}

            {/* Generating overlay */}
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-background/85 via-background/55 to-transparent px-4 pb-5 pt-10"
              >
                <div className="h-1 w-24 overflow-hidden rounded-full bg-foreground/10">
                  <motion.div
                    className="h-full w-1/3 rounded-full bg-accent"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <p className="text-[10px] font-semibold tracking-[0.22em] text-foreground/75">
                  GENERATING VISUAL FIT…
                </p>
                <p className="text-[9px] tracking-[0.15em] text-foreground/45">
                  Replicate · 10–40s
                </p>
              </motion.div>
            )}

            {/* Invalid body image — block try-on, prompt for re-scan */}
            {tryOnStatus === "invalid_body" && (
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-background/95 via-background/75 to-transparent px-5 pb-5 pt-12">
                <p className="text-[11px] font-semibold text-center text-foreground/85 leading-snug max-w-[240px]">
                  Upload a full-body front image for accurate fit preview
                </p>
                {onRescanBody && (
                  <button
                    onClick={onRescanBody}
                    className="mt-1 rounded-full bg-accent px-4 py-1.5 text-[10px] font-bold tracking-[0.18em] text-accent-foreground hover:bg-accent/90 transition-colors"
                  >
                    SCAN BODY
                  </button>
                )}
              </div>
            )}

            {/* Idle / fallback label */}
            {!isGenerating && tryOnStatus !== "ready" && tryOnStatus !== "invalid_body" && (
              <div className="absolute left-3 bottom-3 rounded-md bg-background/70 px-2 py-1 backdrop-blur-sm">
                <p className="text-[8.5px] font-bold tracking-[0.2em] text-foreground/65">
                  {tryOnStatus === "error" ? "PREVIEW · TRY-ON UNAVAILABLE" : "PREVIEW SILHOUETTE"}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* style context */}
      <div
        className={`rounded-xl border p-3 ${
          fit.silhouette === "regular"
            ? "border-green-500/20 bg-green-500/[0.04]"
            : fit.silhouette === "tight"
            ? "border-orange-500/20 bg-orange-500/[0.04]"
            : "border-foreground/[0.08] bg-card/30"
        }`}
      >
        <p className="text-[9px] font-bold tracking-[0.22em] text-foreground/50 mb-1">
          {copy.label.toUpperCase()}
        </p>
        <p
          className={`text-[12px] leading-relaxed ${
            fit.silhouette === "regular"
              ? "text-green-400/90"
              : fit.silhouette === "tight"
              ? "text-orange-400/90"
              : "text-foreground/75"
          }`}
        >
          {copy.line}
        </p>
      </div>
    </div>
  );
}
