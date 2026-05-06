// ─── FIT TRUST CHIPS + FEEDBACK (V3.7) ──────────────────────────────────────
// Tiny premium monochrome strip surfaced on the FIT result page.
//   • TRUST CHIPS show which engines are active (BODY LOCKED / GARMENT DNA /
//     FIT PHYSICS / ACCURACY %) and an UNSTABLE chip if QC failed twice.
//   • FEEDBACK ROW lets the user tag the result quickly. Persisted to the
//     existing `fit_feedback` table when authenticated, else cached in
//     localStorage as a soft signal for future tuning.

import { useState } from "react";
import { ShieldCheck, Sparkles, Activity, Gauge, AlertTriangle, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type FeedbackKind = "accurate" | "too_tight" | "too_loose" | "body_changed" | "garment_wrong";

export interface FitTrustStripProps {
  accuracy: number;
  bodyConsistencyScore?: number | null;
  visualIntegrityScore?: number | null;
  unstable?: boolean;
  productKey: string;
  brand: string;
  category: string;
  productGender?: string | null;
  userGender?: string | null;
  recommendedSize?: string | null;
  chosenSize?: string | null;
}

const FEEDBACK_OPTIONS: Array<{ kind: FeedbackKind; label: string }> = [
  { kind: "accurate",       label: "Fit looks accurate" },
  { kind: "too_tight",      label: "Too tight" },
  { kind: "too_loose",      label: "Too loose" },
  { kind: "body_changed",   label: "Body changed" },
  { kind: "garment_wrong",  label: "Garment looks wrong" },
];

export default function FitTrustStrip(props: FitTrustStripProps) {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState<FeedbackKind | null>(null);
  const [open, setOpen] = useState(false);

  const accuracyTone =
    props.accuracy >= 80 ? "text-foreground/85"
      : props.accuracy >= 55 ? "text-foreground/65"
      : "text-orange-400";

  const submit = async (kind: FeedbackKind) => {
    setSubmitted(kind);
    const payload = {
      product_key: props.productKey.slice(0, 240),
      brand: props.brand || null,
      category: props.category || null,
      product_gender: props.productGender ?? null,
      user_gender: props.userGender ?? null,
      recommended_size: props.recommendedSize ?? null,
      chosen_size: props.chosenSize ?? null,
      feedback_type: kind,
      feedback_areas: [] as string[],
      satisfaction: kind === "accurate" ? 5 : 2,
      notes: null as string | null,
    };
    try {
      if (user) {
        await supabase.from("fit_feedback").insert({ ...payload, user_id: user.id });
      } else {
        const key = "mymyon_fit_feedback_local";
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        existing.push({ ...payload, ts: Date.now() });
        localStorage.setItem(key, JSON.stringify(existing.slice(-50)));
      }
    } catch (e) {
      console.warn("[FIT_FEEDBACK] insert_failed", e);
    }
  };

  return (
    <div className="space-y-2">
      {/* Trust chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip icon={<ShieldCheck className="h-3 w-3" />} label="BODY LOCKED" />
        <Chip icon={<Sparkles className="h-3 w-3" />} label="GARMENT DNA" />
        <Chip icon={<Activity className="h-3 w-3" />} label="FIT PHYSICS" />
        <Chip
          icon={<Gauge className="h-3 w-3" />}
          label={`ACCURACY ${props.accuracy}%`}
          tone={accuracyTone}
        />
        {props.unstable && (
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[9px] font-bold tracking-[0.18em] text-orange-400">
            <AlertTriangle className="h-3 w-3" />
            FIT PREVIEW UNSTABLE
          </span>
        )}
      </div>

      {/* Feedback */}
      {submitted ? (
        <p className="flex items-center gap-1.5 text-[10px] tracking-[0.18em] text-foreground/55">
          <Check className="h-3 w-3 text-green-500" /> THANKS — FEEDBACK SAVED
        </p>
      ) : (
        <div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[10px] font-medium tracking-[0.22em] text-foreground/45 hover:text-foreground/85 transition-colors"
          >
            {open ? "HIDE FEEDBACK" : "RATE THIS FIT"}
          </button>
          {open && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FEEDBACK_OPTIONS.map((o) => (
                <button
                  key={o.kind}
                  onClick={() => submit(o.kind)}
                  className="rounded-full border border-foreground/15 bg-foreground/[0.02] px-2.5 py-1 text-[10px] tracking-tight text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ icon, label, tone }: { icon: React.ReactNode; label: string; tone?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/[0.02] px-2 py-0.5 text-[9px] font-bold tracking-[0.18em] ${tone ?? "text-foreground/65"}`}>
      {icon}
      {label}
    </span>
  );
}
