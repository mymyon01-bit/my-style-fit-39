import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Check, User } from "lucide-react";
import { BodyMeasurements, ConfidenceLevel, defaultBodyMeasurements } from "@/lib/fitEngine";

interface Props {
  measurements: Record<keyof BodyMeasurements, { value: number; confidence: ConfidenceLevel }>;
  onUpdate: (key: keyof BodyMeasurements, value: number) => void;
}

const DISPLAY: { key: keyof BodyMeasurements; label: string; unit: string }[] = [
  { key: "heightCm", label: "Height", unit: "cm" },
  { key: "shoulderWidthCm", label: "Shoulder Width", unit: "cm" },
  { key: "chestCm", label: "Chest", unit: "cm" },
  { key: "waistCm", label: "Waist", unit: "cm" },
  { key: "hipCm", label: "Hip", unit: "cm" },
  { key: "inseamCm", label: "Inseam", unit: "cm" },
  { key: "torsoLengthCm", label: "Torso Length", unit: "cm" },
  { key: "legLengthCm", label: "Leg Length", unit: "cm" },
  { key: "sleeveCm", label: "Sleeve", unit: "cm" },
  { key: "thighCm", label: "Thigh", unit: "cm" },
  { key: "neckCm", label: "Neck", unit: "cm" },
  { key: "calfCm", label: "Calf", unit: "cm" },
];

const confidenceColor: Record<ConfidenceLevel, string> = {
  high: "text-green-500",
  medium: "text-accent",
  low: "text-orange-500",
};

const confidenceBg: Record<ConfidenceLevel, string> = {
  high: "bg-green-500/10",
  medium: "bg-accent/10",
  low: "bg-orange-500/10",
};

export default function FitMeasurements({ measurements, onUpdate }: Props) {
  const [editing, setEditing] = useState<keyof BodyMeasurements | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (key: keyof BodyMeasurements) => {
    setEditing(key);
    setEditValue(measurements[key].value.toString());
  };

  const commitEdit = () => {
    if (editing && editValue) {
      onUpdate(editing, parseFloat(editValue));
    }
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      {/* Avatar preview placeholder */}
      <div className="flex justify-center">
        <div className="relative h-48 w-24 rounded-2xl border border-foreground/[0.06] bg-card/30 flex items-center justify-center">
          <User className="h-16 w-16 text-foreground/8" />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-card border border-foreground/[0.06] px-3 py-1">
            <span className="text-[9px] font-semibold tracking-[0.15em] text-foreground/30">AVATAR</span>
          </div>
        </div>
      </div>

      {/* Measurements list */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-foreground/[0.04]">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/30">BODY MEASUREMENTS</p>
        </div>
        <div className="divide-y divide-foreground/[0.04]">
          {DISPLAY.map(({ key, label, unit }) => {
            const m = measurements[key];
            const isEditing = editing === key;

            return (
              <motion.div
                key={key}
                className="flex items-center justify-between px-5 py-3"
                layout
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-foreground/50">{label}</span>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${confidenceBg[m.confidence]} ${confidenceColor[m.confidence]}`}>
                    {m.confidence}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <input
                        type="number"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-16 rounded-lg bg-foreground/5 px-2 py-1 text-right text-sm text-foreground outline-none"
                        autoFocus
                        onKeyDown={e => e.key === "Enter" && commitEdit()}
                      />
                      <button onClick={commitEdit} className="text-green-500">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-foreground">{m.value} {unit}</span>
                      <button onClick={() => startEdit(key)} className="text-foreground/20 hover:text-foreground/40">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
