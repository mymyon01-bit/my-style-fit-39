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

  // body frame slightly tracks user shoulder
  const frameFactor = Math.max(0.92, Math.min(1.08, user.shoulder / 46));

  return (
    <div className="rounded-3xl border border-foreground/[0.08] bg-gradient-to-b from-card/60 to-card/20 p-5 space-y-4 overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.25em] text-foreground/55">
          VISUAL FIT
        </p>
        <span className="text-[9px] font-semibold tracking-[0.18em] text-accent/80 flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" /> SIZE {activeSize}
        </span>
      </div>

      {/* stage */}
      <div className="relative mx-auto h-[380px] w-full max-w-[280px] rounded-2xl bg-gradient-to-b from-foreground/[0.04] via-foreground/[0.02] to-foreground/[0.06] border border-foreground/[0.04] overflow-hidden fit-root">
        {/* subtle radial highlight */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, hsl(var(--accent) / 0.06), transparent 60%)",
          }}
          aria-hidden
        />

        {tryOnImageUrl ? (
          // AI try-on path: full image fills the stage
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <SafeImage
              src={tryOnImageUrl}
              alt={`${productName} try-on`}
              className="h-full w-full object-cover"
              fallbackClassName="h-full w-full bg-foreground/[0.05]"
            />
          </motion.div>
        ) : (
          <>
            {/* body */}
            <BodySilhouette frameFactor={frameFactor} />

            {/* cloth — anchored to body, scales with fit */}
            {productImage ? (
              <motion.div
                key={`${activeSize}-${productImage}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
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
