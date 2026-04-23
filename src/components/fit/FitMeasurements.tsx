import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { BodyMeasurements, ConfidenceLevel, estimateBodyFromProfile, type BodyTypeKey, type BodyHint } from "@/lib/fitEngine";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import BodyShapeInputs from "@/components/fit/BodyShapeInputs";
import type { BodyShapeInput } from "@/lib/fit/bodyShape";

interface Props {
  measurements: Record<keyof BodyMeasurements, { value: number; confidence: ConfidenceLevel }>;
  onUpdate: (key: keyof BodyMeasurements, value: number) => void;
  onBulkUpdate?: (updates: Partial<Record<keyof BodyMeasurements, number>>) => void;
  weightKg?: number | null;
  onWeightChange?: (weight: number) => void;
  bodyShape?: BodyShapeInput;
  onBodyShapeChange?: (next: BodyShapeInput) => void;
  /** Notify parent when the user picks Male / Female so the visual silhouette updates immediately. */
  onGenderChange?: (gender: "male" | "female") => void;
}

const BODY_TYPES: { key: BodyTypeKey; label: string; labelKo: string; icon: string }[] = [
  { key: "slim", label: "Slim", labelKo: "마른 편", icon: "│" },
  { key: "regular", label: "Regular", labelKo: "보통", icon: "▌" },
  { key: "solid", label: "Solid", labelKo: "조금 굵은 편", icon: "█" },
  { key: "heavy", label: "Heavy", labelKo: "큰 편", icon: "██" },
];

const BODY_HINTS: { key: BodyHint; label: string }[] = [
  { key: "broad-shoulders", label: "Broad shoulders" },
  { key: "narrow-shoulders", label: "Narrow shoulders" },
  { key: "long-legs", label: "Long legs" },
  { key: "short-legs", label: "Short legs" },
  { key: "short-torso", label: "Short torso" },
  { key: "long-torso", label: "Long torso" },
  { key: "thick-thighs", label: "Thick thighs" },
  { key: "slim-legs", label: "Slim legs" },
];

export default function FitMeasurements({ measurements, onUpdate, onBulkUpdate, weightKg, onWeightChange, bodyShape, onBodyShapeChange, onGenderChange }: Props) {
  const { user } = useAuth();
  const [height, setHeight] = useState(measurements.heightCm?.value || 175);
  const [weight, setWeight] = useState<number>(weightKg ?? 70);
  const [weightTouched, setWeightTouched] = useState<boolean>(weightKg != null);
  const [bodyType, setBodyType] = useState<BodyTypeKey>("regular");
  const [selectedHints, setSelectedHints] = useState<BodyHint[]>([]);
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [interpreted, setInterpreted] = useState(false);
  const [gender, setGender] = useState<string | null>(null);

  // Sync external weight changes
  useEffect(() => {
    if (weightKg != null && weightKg !== weight) {
      setWeight(weightKg);
      setWeightTouched(true);
    }
  }, [weightKg]);

  useEffect(() => {
    if (user) loadSavedProfile();
  }, [user]);

  const loadSavedProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from("body_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      if (data.height_cm) setHeight(data.height_cm);
      if (data.weight_kg) {
        setWeight(Number(data.weight_kg));
        setWeightTouched(true);
        onWeightChange?.(Number(data.weight_kg));
      }
      // avatar removed
      if (data.silhouette_type) {
        const typeMap: Record<string, BodyTypeKey> = {
          "slim": "slim", "lean": "slim", "thin": "slim",
          "regular": "regular", "balanced": "regular", "rectangle": "regular",
          "solid": "solid", "trapezoid": "solid", "inverted-triangle": "solid",
          "heavy": "heavy", "triangle": "heavy", "hourglass": "regular",
        };
        setBodyType(typeMap[data.silhouette_type] || "regular");
      }
    }
    // Load gender from profile
    const { data: profile } = await supabase.from("profiles").select("gender_preference").eq("user_id", user.id).maybeSingle();
    if (profile?.gender_preference) {
      setGender(profile.gender_preference);
      const g = profile.gender_preference.toLowerCase().startsWith("f") ? "female" : "male";
      onGenderChange?.(g);
    }
  };


  const toggleHint = (hint: BodyHint) => {
    setSelectedHints(prev => {
      // Remove conflicting pairs
      const conflicts: Record<string, string> = {
        "broad-shoulders": "narrow-shoulders",
        "narrow-shoulders": "broad-shoulders",
        "long-legs": "short-legs",
        "short-legs": "long-legs",
        "short-torso": "long-torso",
        "long-torso": "short-torso",
        "thick-thighs": "slim-legs",
        "slim-legs": "thick-thighs",
      };
      const without = prev.filter(h => h !== hint && h !== conflicts[hint]);
      return prev.includes(hint) ? prev.filter(h => h !== hint) : [...without, hint];
    });
  };

  const applyEstimation = useCallback(() => {
    const estimated = estimateBodyFromProfile(height, weight, bodyType, selectedHints);
    if (onBulkUpdate) {
      onBulkUpdate(estimated);
    } else {
      for (const [key, val] of Object.entries(estimated)) {
        onUpdate(key as keyof BodyMeasurements, val);
      }
    }

    // Save to DB
    if (user) {
      supabase.from("body_profiles").upsert({
        user_id: user.id,
        height_cm: height,
        weight_kg: weight,
        silhouette_type: bodyType,
        shoulder_width_cm: estimated.shoulderWidthCm,
        waist_cm: estimated.waistCm,
        inseam_cm: estimated.inseamCm,
      }, { onConflict: "user_id" });
    }
  }, [height, weight, bodyType, selectedHints, onUpdate, onBulkUpdate, user]);

  // Auto-apply on changes
  useEffect(() => {
    applyEstimation();
  }, [height, weight, bodyType, selectedHints]);

  const handleDescriptionSubmit = async () => {
    if (!description.trim()) return;
    setInterpreting(true);
    try {
      const { data, error } = await supabase.functions.invoke("wardrobe-ai", {
        body: {
          type: "body-description-interpret",
          context: {
            description,
            height,
            weight,
            bodyType,
            hints: selectedHints,
          },
        },
      });
      if (!error && data?.adjustments) {
        const adj = data.adjustments;
        if (adj.bodyType && BODY_TYPES.some(bt => bt.key === adj.bodyType)) {
          setBodyType(adj.bodyType);
        }
        if (adj.hints?.length) {
          setSelectedHints(prev => {
            const merged = new Set([...prev, ...adj.hints]);
            return Array.from(merged) as BodyHint[];
          });
        }
        setInterpreted(true);
        toast.success("Body profile updated from description");
      }
    } catch {
      toast.error("Could not interpret description");
    } finally {
      setInterpreting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Height & Weight */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5 space-y-5">
        <p className="text-[11px] font-bold tracking-[0.2em] text-foreground">BASIC INFO</p>
        
        <div className="space-y-4">
          {/* Sex Selection */}
          <div>
            <span className="text-xs text-foreground/75">Sex</span>
            <div className="mt-2 flex gap-2">
              {(["male", "female"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setGender(s);
                    onGenderChange?.(s);
                    if (user) {
                      supabase.from("profiles").update({ gender_preference: s }).eq("user_id", user.id).then(() => {});
                    }
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-[12px] font-medium transition-all duration-200 border ${
                    gender === s
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-foreground/[0.06] bg-card/30 text-foreground/50 hover:text-foreground/70"
                  }`}
                >
                  {s === "male" ? "Male" : "Female"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-foreground/55">
              {gender
                ? `Note: the character in your fit image will be ${gender}.`
                : "Note: this choice decides whether the character in your fit image is male or female."}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-foreground/75">Height</span>
              <span className="text-sm font-bold text-foreground">{height} cm</span>
            </div>
            <input
              type="range"
              min={140}
              max={210}
              value={height}
              onChange={e => setHeight(Number(e.target.value))}
              className="w-full accent-accent h-1.5 rounded-full appearance-none bg-foreground/[0.08] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
            />
            <div className="flex justify-between text-[10px] text-foreground/40 mt-1">
              <span>140</span><span>175</span><span>210</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-foreground/75">
                Weight {!weightTouched && <span className="text-orange-500/90 font-bold">· required</span>}
              </span>
              <span className={`text-sm font-bold ${weightTouched ? "text-foreground" : "text-orange-500"}`}>
                {weightTouched ? `${weight} kg` : "— kg"}
              </span>
            </div>
            <input
              type="range"
              min={40}
              max={120}
              value={weight}
              onChange={e => {
                const w = Number(e.target.value);
                setWeight(w);
                setWeightTouched(true);
                onWeightChange?.(w);
              }}
              className="w-full accent-accent h-1.5 rounded-full appearance-none bg-foreground/[0.08] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
            />
            <div className="flex justify-between text-[10px] text-foreground/40 mt-1">
              <span>40</span><span>80</span><span>120</span>
            </div>
            {!weightTouched && (
              <p className="text-[10px] text-orange-500/80 mt-2 leading-relaxed">
                Slide to set your weight — needed for accurate fit (40–120 kg).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Body Type */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
        <p className="text-[11px] font-bold tracking-[0.2em] text-foreground">BODY TYPE</p>
        <div className="grid grid-cols-4 gap-2">
          {BODY_TYPES.map(bt => (
            <motion.button
              key={bt.key}
              onClick={() => setBodyType(bt.key)}
              whileTap={{ scale: 0.95 }}
              className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                bodyType === bt.key
                  ? "border-accent/40 bg-accent/[0.08]"
                  : "border-foreground/[0.06] bg-card/20 hover:border-foreground/10"
              }`}
            >
              <span className="text-xl font-mono text-foreground/60">{bt.icon}</span>
              <span className="text-[10px] font-semibold text-foreground/80">{bt.label}</span>
              <span className="text-[9px] text-foreground/50">{bt.labelKo}</span>
              {bodyType === bt.key && (
                <motion.div
                  layoutId="body-type-check"
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent flex items-center justify-center"
                >
                  <Check className="h-2.5 w-2.5 text-background" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Body Shape (simple selectors → 0.85–1.15 scales) */}
      {onBodyShapeChange && (
        <BodyShapeInputs value={bodyShape ?? {}} onChange={onBodyShapeChange} />
      )}

      {/* Body Hints */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[11px] font-bold tracking-[0.2em] text-foreground">BODY SHAPE HINTS</p>
          <span className="text-[9px] font-semibold text-destructive/80 tracking-[0.1em]">(OPTIONAL)</span>
        </div>
        <p className="text-[11px] text-foreground/50 mb-3">Tap what applies — helps fine-tune fit</p>
        <div className="flex flex-wrap gap-2">
          {BODY_HINTS.map(hint => (
            <button
              key={hint.key}
              onClick={() => toggleHint(hint.key)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
                selectedHints.includes(hint.key)
                  ? "border-accent/40 bg-accent/[0.1] text-accent"
                  : "border-foreground/[0.08] text-foreground/60 hover:border-foreground/15"
              }`}
            >
              {hint.label}
            </button>
          ))}
        </div>
      </div>

      {/* Free Text Description */}
      <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 p-5">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[11px] font-bold tracking-[0.2em] text-foreground">DESCRIBE YOUR BODY</p>
          <span className="text-[9px] font-semibold text-destructive/80 tracking-[0.1em]">(OPTIONAL)</span>
        </div>
        <p className="text-[11px] text-foreground/50 mb-3">AI will interpret this to improve fit</p>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="예: 어깨가 넓고 허리는 얇음 / Arms are short, prefer loose fit..."
          className="w-full rounded-xl border border-foreground/[0.06] bg-foreground/[0.03] p-3 text-sm text-foreground placeholder:text-foreground/30 outline-none resize-none h-20"
          maxLength={200}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-foreground/30">{description.length}/200</span>
          <button
            onClick={handleDescriptionSubmit}
            disabled={!description.trim() || interpreting}
            className="flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-[11px] font-medium text-accent disabled:opacity-40 transition-opacity"
          >
            {interpreting ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Interpreting…</>
            ) : interpreted ? (
              <><Check className="h-3 w-3" /> Applied</>
            ) : (
              <><Sparkles className="h-3 w-3" /> Interpret</>
            )}
          </button>
        </div>
      </div>

      {/* Confidence summary */}
      <div className="rounded-xl border border-foreground/[0.04] bg-card/20 p-4 text-center">
        <p className="text-[10px] text-foreground/50 mb-1">ESTIMATION CONFIDENCE</p>
        <p className={`text-xs font-semibold ${
          selectedHints.length > 0 || interpreted ? "text-accent" : "text-foreground/60"
        }`}>
          {interpreted ? "HIGH — AI-enhanced profile" :
           selectedHints.length >= 2 ? "MEDIUM — detailed hints applied" :
           "MEDIUM — based on height, weight & type"}
        </p>
      </div>

      {/* Advanced mode toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 mx-auto text-[11px] text-foreground/40 hover:text-foreground/60 transition-colors"
      >
        Advanced measurements
        <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
      </button>

      {/* Advanced measurements (hidden by default) */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-foreground/[0.06] bg-card/40 overflow-hidden">
              <div className="px-5 py-3 border-b border-foreground/[0.04]">
                <p className="text-[11px] font-bold tracking-[0.2em] text-foreground">DETAILED MEASUREMENTS</p>
                <p className="text-[10px] text-foreground/40 mt-0.5">Edit to override AI estimates</p>
              </div>
              <div className="divide-y divide-foreground/[0.04]">
                {(["shoulderWidthCm", "chestCm", "waistCm", "hipCm", "inseamCm", "thighCm"] as const).map(key => {
                  const labels: Record<string, string> = {
                    shoulderWidthCm: "Shoulder Width",
                    chestCm: "Chest",
                    waistCm: "Waist",
                    hipCm: "Hip",
                    inseamCm: "Inseam",
                    thighCm: "Thigh",
                  };
                  const m = measurements[key];
                  return (
                    <div key={key} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-foreground/80">{labels[key]}</span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                          m.confidence === "high" ? "bg-green-500/10 text-green-500" :
                          m.confidence === "medium" ? "bg-accent/10 text-accent" :
                          "bg-orange-500/10 text-orange-500"
                        }`}>{m.confidence}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={m.value}
                          onChange={e => onUpdate(key, parseFloat(e.target.value) || 0)}
                          className="w-16 rounded-lg bg-foreground/5 px-2 py-1 text-right text-sm text-foreground outline-none"
                        />
                        <span className="text-[10px] text-foreground/40">cm</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
