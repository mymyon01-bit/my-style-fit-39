// ─── BODY SILHOUETTE ────────────────────────────────────────────────────────
// Clear, deliberate body reference. Not a ghost. Slightly darker than the
// stage background so the user immediately reads it as "a body".

import { motion } from "framer-motion";
import { getAnchors } from "@/lib/visual/anchors";

interface Props {
  /** body frame factor — 0.92 slim → 1.4 plus-size. Overrides height/weight if provided. */
  frameFactor?: number;
  /** Optional: derive frame from real height (cm) + weight (kg). */
  heightCm?: number | null;
  weightKg?: number | null;
}

/** Map BMI → a width multiplier matching bodyToAvatar.ts. */
function bmiToFrame(heightCm: number, weightKg: number): number {
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  const f = 1 + (bmi - 23) * 0.045;
  return Math.max(0.85, Math.min(1.4, f));
}

export default function BodySilhouette({ frameFactor, heightCm, weightKg }: Props) {
  const a = getAnchors();
  const factor =
    typeof frameFactor === "number"
      ? frameFactor
      : heightCm && weightKg
        ? bmiToFrame(heightCm, weightKg)
        : 1;
  const shoulderW = 110 * factor;
  // heavier bodies have less waist taper
  const waistW = shoulderW * (factor > 1.15 ? 0.88 : 0.78);
  const hipW = shoulderW * (factor > 1.15 ? 0.95 : 0.86);
  const cx = 100; // svg center

  return (
    <svg
      viewBox="0 0 200 360"
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--foreground) / 0.16)" />
          <stop offset="100%" stopColor="hsl(var(--foreground) / 0.08)" />
        </linearGradient>
        <radialGradient id="body-floor" cx="50%" cy="100%" r="40%">
          <stop offset="0%" stopColor="hsl(var(--foreground) / 0.22)" />
          <stop offset="100%" stopColor="hsl(var(--foreground) / 0)" />
        </radialGradient>
      </defs>

      {/* floor shadow */}
      <ellipse cx={cx} cy={345} rx={shoulderW * 0.5} ry={6} fill="url(#body-floor)" />

      {/* head */}
      <motion.circle
        cx={cx}
        cy={36}
        r={20}
        fill="url(#body-grad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      {/* neck */}
      <rect x={cx - 8} y={54} width={16} height={14} rx={4} fill="url(#body-grad)" />

      {/* torso (shoulder → waist) */}
      <motion.path
        initial={false}
        animate={{
          d: `M ${cx - shoulderW / 2} ${(a.shoulderY / 100) * 360}
              Q ${cx - shoulderW / 2 - 2} ${(a.chestY / 100) * 360} ${cx - waistW / 2} ${(a.waistY / 100) * 360}
              L ${cx + waistW / 2} ${(a.waistY / 100) * 360}
              Q ${cx + shoulderW / 2 + 2} ${(a.chestY / 100) * 360} ${cx + shoulderW / 2} ${(a.shoulderY / 100) * 360} Z`,
        }}
        transition={{ type: "spring", stiffness: 180, damping: 22 }}
        fill="url(#body-grad)"
      />

      {/* arms */}
      <rect
        x={cx - shoulderW / 2 - 7}
        y={(a.shoulderY / 100) * 360 + 4}
        width={7}
        height={130}
        rx={3.5}
        fill="hsl(var(--foreground) / 0.10)"
      />
      <rect
        x={cx + shoulderW / 2}
        y={(a.shoulderY / 100) * 360 + 4}
        width={7}
        height={130}
        rx={3.5}
        fill="hsl(var(--foreground) / 0.10)"
      />

      {/* hips → legs */}
      <path
        d={`M ${cx - waistW / 2} ${(a.waistY / 100) * 360}
            L ${cx - hipW / 2} ${(a.hipY / 100) * 360}
            L ${cx - hipW / 2 + 4} 332
            L ${cx - 4} 332
            L ${cx - 3} ${(a.hipY / 100) * 360 + 6}
            L ${cx + 3} ${(a.hipY / 100) * 360 + 6}
            L ${cx + 4} 332
            L ${cx + hipW / 2 - 4} 332
            L ${cx + hipW / 2} ${(a.hipY / 100) * 360}
            L ${cx + waistW / 2} ${(a.waistY / 100) * 360} Z`}
        fill="url(#body-grad)"
      />
    </svg>
  );
}
