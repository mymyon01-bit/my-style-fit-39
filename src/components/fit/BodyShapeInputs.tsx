// ─── BODY SHAPE INPUTS — simplified shape selectors ─────────────────────────
// Maps directly to BodyShapeInput → BodyShapeScales (0.85–1.15).
// No raw cm asked. Tap to select. Premium-minimal styling.

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type {
  BodyShapeInput, ShoulderType, ChestBuild, WaistShape, ArmThickness, LegBuild,
} from "@/lib/fit/bodyShape";

interface Props {
  value: BodyShapeInput;
  onChange: (next: BodyShapeInput) => void;
}

type Group<T extends string> = { key: T; label: string }[];

const SHOULDERS: Group<ShoulderType> = [
  { key: "narrow", label: "Narrow" },
  { key: "average", label: "Average" },
  { key: "wide", label: "Wide" },
];
const CHEST: Group<ChestBuild> = [
  { key: "flat", label: "Flat" },
  { key: "normal", label: "Normal" },
  { key: "full", label: "Full" },
];
const WAIST: Group<WaistShape> = [
  { key: "slim", label: "Slim" },
  { key: "straight", label: "Straight" },
  { key: "thick", label: "Thick" },
];
const ARM: Group<ArmThickness> = [
  { key: "thin", label: "Thin" },
  { key: "normal", label: "Normal" },
  { key: "thick", label: "Thick" },
];
const LEG: Group<LegBuild> = [
  { key: "slim", label: "Slim" },
  { key: "normal", label: "Normal" },
  { key: "thick", label: "Thick" },
];

function Row<T extends string>({
  title, items, selected, onSelect,
}: {
  title: string;
  items: Group<T>;
  selected: T | undefined;
  onSelect: (k: T) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-foreground/65">{title}</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const active = selected === it.key;
          return (
            <motion.button
              key={it.key}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(it.key)}
              className={`relative flex items-center justify-center rounded-xl border px-3 py-2.5 text-[12px] font-medium transition-all ${
                active
                  ? "border-accent/50 bg-accent/10 text-foreground"
                  : "border-foreground/[0.08] bg-card/30 text-foreground/65 hover:border-foreground/15"
              }`}
            >
              {it.label}
              {active && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-accent flex items-center justify-center">
                  <Check className="h-2 w-2 text-accent-foreground" strokeWidth={3} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default function BodyShapeInputs({ value, onChange }: Props) {
  const set = <K extends keyof BodyShapeInput>(k: K, v: BodyShapeInput[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-bold tracking-[0.2em] text-foreground">BODY SHAPE</p>
        <span className="text-[10px] text-foreground/45">refines fit accuracy</span>
      </div>
      <Row title="SHOULDERS"  items={SHOULDERS} selected={value.shoulderType} onSelect={(k) => set("shoulderType", k)} />
      <Row title="CHEST"      items={CHEST}     selected={value.chestBuild}   onSelect={(k) => set("chestBuild", k)} />
      <Row title="WAIST"      items={WAIST}     selected={value.waistShape}   onSelect={(k) => set("waistShape", k)} />
      <Row title="ARMS"       items={ARM}       selected={value.armThickness} onSelect={(k) => set("armThickness", k)} />
      <Row title="LEGS"       items={LEG}       selected={value.legBuild}     onSelect={(k) => set("legBuild", k)} />
    </div>
  );
}
