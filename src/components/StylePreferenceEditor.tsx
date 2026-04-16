import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";

const STYLES = ["minimal", "streetwear", "classic", "oldMoney", "chic", "cleanFit", "sporty"];
const FITS = ["slim", "regular", "relaxed", "oversized"];
const BUDGETS = ["low", "mid", "high", "luxury"];
const OCCASIONS = ["daily", "office", "date", "travel"];
const BRANDS = ["Nike", "Zara", "H&M", "Uniqlo", "COS", "Arket", "Lemaire", "AMI Paris", "Acne Studios", "Our Legacy", "Stüssy", "New Balance"];

interface Props {
  initial: {
    preferred_styles?: string[];
    disliked_styles?: string[];
    preferred_fit?: string;
    budget?: string;
    occasions?: string[];
    favorite_brands?: string[];
  } | null;
  onSave: () => void;
  onClose: () => void;
}

export default function StylePreferenceEditor({ initial, onSave, onClose }: Props) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [styles, setStyles] = useState<string[]>(initial?.preferred_styles || []);
  const [disliked, setDisliked] = useState<string[]>(initial?.disliked_styles || []);
  const [fit, setFit] = useState(initial?.preferred_fit || "");
  const [budget, setBudget] = useState(initial?.budget || "");
  const [occasions, setOccasions] = useState<string[]>(initial?.occasions || []);
  const [brands, setBrands] = useState<string[]>(initial?.favorite_brands || []);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"styles" | "fit" | "brands">("styles");

  const toggle = (arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);

  const chip = (active: boolean, variant?: "dislike") =>
    `rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all ${
      variant === "dislike"
        ? active ? "bg-destructive/10 text-destructive/60 line-through" : "bg-foreground/[0.04] text-foreground/75"
        : active ? "bg-accent/15 text-accent/80" : "bg-foreground/[0.04] text-foreground/75"
    }`;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("style_profiles").upsert({
        user_id: user.id,
        preferred_styles: styles,
        disliked_styles: disliked,
        preferred_fit: fit || null,
        budget: budget || null,
        occasions,
        favorite_brands: brands.length > 0 ? brands : null,
      } as any, { onConflict: "user_id" });
      toast.success("Style preferences saved");
      onSave();
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "styles" as const, label: "STYLES" },
    { id: "fit" as const, label: "FIT & BUDGET" },
    { id: "brands" as const, label: "BRANDS" },
  ];

  return (
    <div className="rounded-2xl border border-border/20 bg-card/40 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-foreground/70">EDIT STYLE PROFILE</p>
        <button onClick={onClose} className="text-foreground/70 hover:text-foreground/70"><X className="h-4 w-4" /></button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`flex-1 py-2 text-[11px] font-semibold tracking-[0.15em] rounded-lg transition-colors ${
              tab === tb.id ? "bg-accent/10 text-accent/70" : "text-foreground/70 hover:text-foreground/70"
            }`}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "styles" && (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] text-foreground/75 mb-2">PREFERRED</p>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map(s => (
                <button key={s} onClick={() => toggle(styles, setStyles, s)} className={chip(styles.includes(s))}>
                  {t(s as any)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-foreground/75 mb-2">AVOID</p>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.filter(s => !styles.includes(s)).map(s => (
                <button key={s} onClick={() => toggle(disliked, setDisliked, s)} className={chip(disliked.includes(s), "dislike")}>
                  {t(s as any)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-foreground/75 mb-2">OCCASIONS</p>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map(o => (
                <button key={o} onClick={() => toggle(occasions, setOccasions, o)} className={chip(occasions.includes(o))}>
                  {t(o as any)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "fit" && (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] text-foreground/75 mb-2">PREFERRED FIT</p>
            <div className="flex flex-wrap gap-1.5">
              {FITS.map(f => (
                <button key={f} onClick={() => setFit(f)} className={chip(fit === f)}>
                  {t(f as any)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-foreground/75 mb-2">BUDGET RANGE</p>
            <div className="flex flex-wrap gap-1.5">
              {BUDGETS.map(b => (
                <button key={b} onClick={() => setBudget(b)} className={chip(budget === b)}>
                  {t(b as any)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "brands" && (
        <div>
          <p className="text-[11px] text-foreground/75 mb-2">FAVORITE BRANDS</p>
          <div className="flex flex-wrap gap-1.5">
            {BRANDS.map(b => (
              <button key={b} onClick={() => toggle(brands, setBrands, b)} className={chip(brands.includes(b))}>
                {b}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent/10 py-3 text-[11px] font-semibold text-accent/70 hover:bg-accent/15 disabled:opacity-50">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
        Save Preferences
      </button>
    </div>
  );
}
