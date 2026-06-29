/**
 * BodyDnaPanel — Phase 4 of the MYMYON rebrand.
 *
 * Editorial dashboard sitting above the FIT wizard. Shows:
 *  - Body DNA Analysis (Shoulder / Bust / Waist / Hip / Height / Weight + shape)
 *  - AI Score rings (Fit Accuracy, Comfort, Silhouette)
 *  - New capability chips (Virtual fitting, Cross-brand sizing, Outfit
 *    compatibility scoring, Fabric tension, Size confidence)
 */
import { motion } from "framer-motion";
import {
  Sparkles, Layers, Shirt, Wind, ShieldCheck,
} from "lucide-react";

type Metric = { label: string; value: string | number; unit?: string };
type ShapeKey = "hourglass" | "pear" | "rectangle" | "triangle" | "round" | "—";

interface BodyDnaPanelProps {
  shoulderCm?: number | null;
  bustCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  shape?: ShapeKey;
  fitAccuracy?: number;   // 0–100
  comfort?: number;       // 0–100
  silhouette?: number;    // 0–100
  onEdit?: () => void;
}

const fmt = (v?: number | null, digits = 0): string =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits);

const CAPABILITIES = [
  { icon: Layers,       label: "Virtual fitting prediction" },
  { icon: Shirt,        label: "Cross-brand sizing normalization" },
  { icon: Sparkles,     label: "Outfit compatibility scoring" },
  { icon: Wind,         label: "Fabric tension prediction" },
  { icon: ShieldCheck,  label: "Size recommendation confidence" },
];

const ScoreRing = ({ value, label }: { value: number; label: string }) => {
  const R = 36;
  const C = 2 * Math.PI * R;
  const offset = C - (Math.max(0, Math.min(100, value)) / 100) * C;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[92px] w-[92px]">
        <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
          <circle
            cx="48" cy="48" r={R} fill="none"
            stroke="hsl(var(--border))" strokeWidth="4"
          />
          <motion.circle
            cx="48" cy="48" r={R} fill="none"
            stroke="hsl(var(--accent))" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[22px] font-semibold tracking-tight text-foreground">
            {Math.round(value)}<span className="text-[12px] text-foreground/60">%</span>
          </span>
        </div>
      </div>
      <span className="text-[9.5px] font-medium tracking-[0.22em] text-foreground/70">
        {label.toUpperCase()}
      </span>
    </div>
  );
};

const MetricCell = ({ m }: { m: Metric }) => (
  <div className="flex flex-col items-start gap-1 border-l border-foreground/10 pl-3 first:border-l-0 first:pl-0">
    <span className="text-[9px] font-medium tracking-[0.22em] text-foreground/55">
      {m.label.toUpperCase()}
    </span>
    <span className="font-display text-[18px] font-semibold leading-none text-foreground">
      {m.value}
      {m.unit && <span className="ml-0.5 text-[10px] font-normal text-foreground/55">{m.unit}</span>}
    </span>
  </div>
);

const BodyDnaPanel = ({
  shoulderCm, bustCm, waistCm, hipCm, heightCm, weightKg,
  shape = "—",
  fitAccuracy = 92, comfort = 88, silhouette = 90,
  onEdit,
}: BodyDnaPanelProps) => {
  const metrics: Metric[] = [
    { label: "Shoulder", value: fmt(shoulderCm), unit: "cm" },
    { label: "Bust",     value: fmt(bustCm),     unit: "cm" },
    { label: "Waist",    value: fmt(waistCm),    unit: "cm" },
    { label: "Hip",      value: fmt(hipCm),      unit: "cm" },
    { label: "Height",   value: fmt(heightCm),   unit: "cm" },
    { label: "Weight",   value: fmt(weightKg),   unit: "kg" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="mb-10 overflow-hidden rounded-2xl border border-foreground/10 bg-card/60 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
        <div>
          <span className="text-[9.5px] font-medium tracking-[0.28em] text-foreground/60">
            BODY DNA ANALYSIS
          </span>
          <h2 className="mt-1 font-display text-[20px] font-semibold leading-tight text-foreground">
            Your Body, Decoded
          </h2>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="rounded-full border border-foreground/20 px-3 py-1.5 text-[9.5px] font-medium tracking-[0.22em] text-foreground/80 transition hover:border-accent hover:text-foreground"
          >
            EDIT
          </button>
        )}
      </div>

      {/* Body metrics */}
      <div className="grid grid-cols-3 gap-y-5 px-5 py-5 sm:grid-cols-6">
        {metrics.map((m) => <MetricCell key={m.label} m={m} />)}
      </div>

      {/* Body shape badge */}
      <div className="flex items-center justify-between border-t border-foreground/10 px-5 py-3">
        <span className="text-[9.5px] font-medium tracking-[0.22em] text-foreground/55">
          BODY SHAPE CLASSIFICATION
        </span>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-display text-[12px] font-medium tracking-wide text-foreground">
          {shape === "—" ? "Calibrating…" : shape.charAt(0).toUpperCase() + shape.slice(1)}
        </span>
      </div>

      {/* AI Score rings */}
      <div className="border-t border-foreground/10 bg-background/40 px-5 py-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[9.5px] font-medium tracking-[0.28em] text-foreground/60">
            AI CALCULATIONS
          </span>
          <span className="text-[9.5px] tracking-[0.22em] text-foreground/40">
            LIVE
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <ScoreRing value={fitAccuracy} label="Fit Accuracy" />
          <ScoreRing value={comfort}     label="Comfort" />
          <ScoreRing value={silhouette}  label="Silhouette" />
        </div>
      </div>

      {/* Capabilities */}
      <div className="border-t border-foreground/10 px-5 py-5">
        <span className="mb-3 block text-[9.5px] font-medium tracking-[0.28em] text-foreground/60">
          NEW CAPABILITIES
        </span>
        <div className="flex flex-wrap gap-2">
          {CAPABILITIES.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-card/60 px-3 py-1.5 text-[10px] tracking-wide text-foreground/80"
            >
              <Icon className="h-3 w-3 text-accent" strokeWidth={1.8} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  );
};

export default BodyDnaPanel;
