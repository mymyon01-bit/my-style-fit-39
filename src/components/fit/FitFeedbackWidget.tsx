// ─── FIT FEEDBACK WIDGET ────────────────────────────────────────────────────
// Lets the user say whether the recommended size actually fit them. Three
// thumbs (too small / perfect / too large) plus optional region tags. Result
// feeds the brand-calibration learning loop in `loadBrandCalibration`.

import { useState } from "react";
import { Check, MessageSquare } from "lucide-react";
import { submitFitFeedback, type FitFeedbackType, type Region, type SizeRecommendation } from "@/lib/sizing";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Props {
  recommendation: SizeRecommendation | null;
  productKey: string;
  productBrand: string | null;
  productCategory: string | null;
  /** Currently-selected size in the parent UI. */
  activeSize: string | null;
}

const TYPE_OPTIONS: { value: FitFeedbackType; label: string; emoji: string }[] = [
  { value: "too_small", label: "Too small", emoji: "👎" },
  { value: "perfect",   label: "Perfect",   emoji: "✨" },
  { value: "too_large", label: "Too large", emoji: "📏" },
];

const AREA_OPTIONS: { value: Region; label: string }[] = [
  { value: "shoulder", label: "Shoulder" },
  { value: "chest",    label: "Chest" },
  { value: "waist",    label: "Waist" },
  { value: "hip",      label: "Hip" },
  { value: "sleeve",   label: "Sleeve" },
  { value: "length",   label: "Length" },
];

export default function FitFeedbackWidget({
  recommendation,
  productKey,
  productBrand,
  productCategory,
  activeSize,
}: Props) {
  const { user } = useAuth();
  const [type, setType] = useState<FitFeedbackType | null>(null);
  const [areas, setAreas] = useState<Region[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!recommendation) return null;
  const chosenSize = activeSize ?? recommendation.primarySize ?? "—";

  const toggleArea = (a: Region) => {
    setAreas((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  };

  const handleSubmit = async () => {
    if (!type) return;
    if (!user) {
      toast.error("Sign in to share fit feedback.");
      return;
    }
    setSubmitting(true);
    const res = await submitFitFeedback({
      productKey,
      brand: productBrand,
      category: productCategory,
      productGender: recommendation.productGender,
      userGender: recommendation.bodyGender,
      recommendedSize: recommendation.primarySize,
      chosenSize,
      feedbackType: type,
      feedbackAreas: areas,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't save feedback");
      return;
    }
    setSubmitted(true);
    toast.success("Thanks — we'll use this to improve sizing for everyone.");
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-500">
        <Check className="h-4 w-4" />
        <span>Feedback recorded for {chosenSize}.</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-card/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-foreground/40" />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/60">
          How did size {chosenSize} fit?
        </span>
      </div>
      <div className="flex gap-2">
        {TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setType(o.value)}
            className={`flex-1 rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition-colors ${
              type === o.value
                ? "border-accent bg-accent/10 text-accent"
                : "border-foreground/10 bg-background/50 text-foreground/70 hover:border-foreground/25"
            }`}
          >
            <span className="mr-1">{o.emoji}</span>
            {o.label}
          </button>
        ))}
      </div>
      {type && type !== "perfect" && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-foreground/50">
            Where? (optional)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {AREA_OPTIONS.map((a) => {
              const on = areas.includes(a.value);
              return (
                <button
                  key={a.value}
                  onClick={() => toggleArea(a.value)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    on
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : "border-foreground/10 text-foreground/60 hover:border-foreground/25"
                  }`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {type && (
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-xl bg-foreground py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-background transition-opacity disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Submit feedback"}
        </button>
      )}
    </div>
  );
}
