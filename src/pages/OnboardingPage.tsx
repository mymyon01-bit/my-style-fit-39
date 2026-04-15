import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Camera, User, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const styleOptions = ["minimal", "streetwear", "classic", "oldMoney", "chic", "cleanFit", "sporty"] as const;
const fitOptions = ["slim", "regular", "relaxed2", "oversized"] as const;
const budgetOptions = ["low", "mid", "high", "luxury"] as const;
const occasions = ["daily", "office", "date", "travel"] as const;

const OnboardingPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [dislikedStyles, setDislikedStyles] = useState<string[]>([]);
  const [selectedFit, setSelectedFit] = useState<string>("");
  const [selectedBudget, setSelectedBudget] = useState<string>("");
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [bodyData, setBodyData] = useState({ height: "", weight: "", shoulder: "", waist: "" });

  const toggle = (arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    set(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);

  const chipClass = (active: boolean) =>
    `rounded-full border px-4 py-2.5 text-sm font-medium transition-all ${
      active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
    }`;

  const saveProfileData = async () => {
    if (!user) return;
    const userId = user.id;

    // Save style profile
    await supabase.from("style_profiles").upsert({
      user_id: userId,
      preferred_styles: selectedStyles,
      disliked_styles: dislikedStyles,
      preferred_fit: selectedFit || null,
      budget: selectedBudget || null,
      occasions: selectedOccasions,
    } as any, { onConflict: "user_id" });

    // Save body profile
    const h = parseFloat(bodyData.height);
    const w = parseFloat(bodyData.weight);
    const s = parseFloat(bodyData.shoulder);
    const wa = parseFloat(bodyData.waist);
    if (h || w || s || wa) {
      await supabase.from("body_profiles").upsert({
        user_id: userId,
        height_cm: h || null,
        weight_kg: w || null,
        shoulder_width_cm: s || null,
        waist_cm: wa || null,
      } as any, { onConflict: "user_id" });
    }

    // Mark onboarded
    await supabase.from("profiles").update({ onboarded: true } as any).eq("user_id", userId);
  };

  const steps = [
    // Step 0: Welcome
    <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10">
        <span className="text-4xl">✨</span>
      </div>
      <h1 className="mt-8 font-display text-3xl font-bold text-foreground">{t("onboardingTitle1")}</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground max-w-[280px]">{t("onboardingDesc1")}</p>
    </motion.div>,

    // Step 1: Style preferences + disliked + occasions
    <motion.div key="style" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 px-6 pt-8 overflow-y-auto">
      <h2 className="font-display text-2xl font-bold text-foreground">{t("whatsYourStyle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("selectStylesYouLove")}</p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        {styleOptions.map(s => (
          <button key={s} onClick={() => toggle(selectedStyles, setSelectedStyles, s)} className={chipClass(selectedStyles.includes(s))}>
            {t(s as any)}
          </button>
        ))}
      </div>

      <p className="mt-7 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("selectDislikedStyles")}</p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {styleOptions.filter(s => !selectedStyles.includes(s)).map(s => (
          <button key={s} onClick={() => toggle(dislikedStyles, setDislikedStyles, s)}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-all ${
              dislikedStyles.includes(s) ? "border-destructive/50 bg-destructive/10 text-destructive line-through" : "border-border text-muted-foreground"
            }`}>
            {t(s as any)}
          </button>
        ))}
      </div>

      <p className="mt-7 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("occasion")}</p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {occasions.map(o => (
          <button key={o} onClick={() => toggle(selectedOccasions, setSelectedOccasions, o)} className={chipClass(selectedOccasions.includes(o))}>
            {t(o as any)}
          </button>
        ))}
      </div>
    </motion.div>,

    // Step 2: Fit + Budget
    <motion.div key="fit" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 px-6 pt-8">
      <h2 className="font-display text-2xl font-bold text-foreground">{t("preferredFit")}</h2>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {fitOptions.map(f => (
          <button key={f} onClick={() => setSelectedFit(f)}
            className={`rounded-xl border py-4 text-center text-sm font-medium transition-all ${
              selectedFit === f ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
            }`}>
            {t(f as any)}
          </button>
        ))}
      </div>

      <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("budgetRange")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {budgetOptions.map(b => (
          <button key={b} onClick={() => setSelectedBudget(b)}
            className={`rounded-xl border py-4 text-center text-sm font-medium transition-all ${
              selectedBudget === b ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
            }`}>
            {t(b as any)}
          </button>
        ))}
      </div>
    </motion.div>,

    // Step 3: Body Scan
    <motion.div key="body" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 px-6 pt-8">
      <h2 className="font-display text-2xl font-bold text-foreground">{t("bodyScan")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("bodyScanDesc")}</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border py-14 text-muted-foreground transition-colors hover:border-accent hover:text-accent">
          <User className="h-8 w-8" />
          <span className="text-xs font-medium">{t("frontPhoto")}</span>
        </button>
        <button className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border py-14 text-muted-foreground transition-colors hover:border-accent hover:text-accent">
          <Camera className="h-8 w-8" />
          <span className="text-xs font-medium">{t("sidePhoto")}</span>
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {[
          { label: t("height"), placeholder: "175 cm", key: "height" },
          { label: t("weight"), placeholder: "70 kg", key: "weight" },
          { label: t("shoulderWidth"), placeholder: "45 cm", key: "shoulder" },
          { label: t("waist"), placeholder: "80 cm", key: "waist" },
        ].map(field => (
          <div key={field.key}>
            <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
            <input
              type="text"
              placeholder={field.placeholder}
              value={bodyData[field.key as keyof typeof bodyData]}
              onChange={e => setBodyData(prev => ({ ...prev, [field.key]: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent transition-colors"
            />
          </div>
        ))}
      </div>
    </motion.div>,

    // Step 4: Profile Ready
    <motion.div key="ready" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      {isAnalyzing ? (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
          <p className="mt-6 text-sm font-medium text-muted-foreground">{t("analyzing")}</p>
        </>
      ) : (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10">
            <span className="text-4xl">🎯</span>
          </div>
          <h2 className="mt-6 font-display text-2xl font-bold text-foreground">{t("aiProfileReady")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-[300px]">
            {t("profileGenerated")}
          </p>
        </>
      )}
    </motion.div>,
  ];

  const isLast = step === steps.length - 1;

  const handleNext = async () => {
    if (isLast) {
      navigate("/", { replace: true });
    } else if (step === steps.length - 2) {
      setStep(step + 1);
      setIsAnalyzing(true);
      await saveProfileData();
      setTimeout(() => setIsAnalyzing(false), 2000);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Progress */}
      <div className="flex gap-1.5 px-6 pt-4">
        {steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-accent" : "bg-border"}`} />
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>

      {/* Actions */}
      <div className="px-6 pb-10 pt-4">
        {!isAnalyzing && (
          <>
            <button onClick={handleNext}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              {isLast ? t("seeRecommendations") : step === 0 ? t("getStarted") : t("next")}
              <ChevronRight className="h-4 w-4" />
            </button>
            {step > 0 && !isLast && (
              <button onClick={() => setStep(step + 1)}
                className="mt-2 w-full py-2 text-xs font-medium text-muted-foreground">
                {t("skip")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
