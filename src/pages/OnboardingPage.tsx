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
    `py-2.5 px-4 text-[11px] font-light transition-all duration-300 ${
      active ? "text-accent/80" : "text-foreground/20 hover:text-foreground/35"
    }`;

  const saveProfileData = async () => {
    if (!user) return;
    const userId = user.id;
    await supabase.from("style_profiles").upsert({
      user_id: userId, preferred_styles: selectedStyles, disliked_styles: dislikedStyles,
      preferred_fit: selectedFit || null, budget: selectedBudget || null, occasions: selectedOccasions,
    } as any, { onConflict: "user_id" });

    const h = parseFloat(bodyData.height), w = parseFloat(bodyData.weight);
    const s = parseFloat(bodyData.shoulder), wa = parseFloat(bodyData.waist);
    if (h || w || s || wa) {
      await supabase.from("body_profiles").upsert({
        user_id: userId, height_cm: h || null, weight_kg: w || null,
        shoulder_width_cm: s || null, waist_cm: wa || null,
      } as any, { onConflict: "user_id" });
    }
    await supabase.from("profiles").update({ onboarded: true } as any).eq("user_id", userId);
  };

  const steps = [
    // Welcome
    <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <h1 className="font-display text-3xl font-light text-foreground/80">{t("onboardingTitle1")}</h1>
      <p className="mt-5 text-[12px] leading-[1.8] text-foreground/25 max-w-[260px]">{t("onboardingDesc1")}</p>
    </motion.div>,

    // Style
    <motion.div key="style" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 px-8 pt-10 overflow-y-auto">
      <h2 className="font-display text-xl font-light text-foreground/70">{t("whatsYourStyle")}</h2>
      <p className="mt-2 text-[11px] text-foreground/20">{t("selectStylesYouLove")}</p>
      <div className="mt-6 flex flex-wrap gap-1">
        {styleOptions.map(s => (
          <button key={s} onClick={() => toggle(selectedStyles, setSelectedStyles, s)} className={chipClass(selectedStyles.includes(s))}>
            {t(s as any)}
          </button>
        ))}
      </div>

      <p className="mt-10 text-[9px] font-medium tracking-[0.2em] text-foreground/15">{t("selectDislikedStyles")}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {styleOptions.filter(s => !selectedStyles.includes(s)).map(s => (
          <button key={s} onClick={() => toggle(dislikedStyles, setDislikedStyles, s)}
            className={`py-2.5 px-4 text-[11px] font-light transition-all duration-300 ${
              dislikedStyles.includes(s) ? "text-destructive/50 line-through" : "text-foreground/15 hover:text-foreground/25"
            }`}>
            {t(s as any)}
          </button>
        ))}
      </div>

      <p className="mt-10 text-[9px] font-medium tracking-[0.2em] text-foreground/15">{t("occasion")}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {occasions.map(o => (
          <button key={o} onClick={() => toggle(selectedOccasions, setSelectedOccasions, o)} className={chipClass(selectedOccasions.includes(o))}>
            {t(o as any)}
          </button>
        ))}
      </div>
    </motion.div>,

    // Fit + Budget
    <motion.div key="fit" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 px-8 pt-10">
      <h2 className="font-display text-xl font-light text-foreground/70">{t("preferredFit")}</h2>
      <div className="mt-6 flex flex-wrap gap-1">
        {fitOptions.map(f => (
          <button key={f} onClick={() => setSelectedFit(f)} className={chipClass(selectedFit === f)}>
            {t(f as any)}
          </button>
        ))}
      </div>

      <p className="mt-10 text-[9px] font-medium tracking-[0.2em] text-foreground/15">{t("budgetRange")}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {budgetOptions.map(b => (
          <button key={b} onClick={() => setSelectedBudget(b)} className={chipClass(selectedBudget === b)}>
            {t(b as any)}
          </button>
        ))}
      </div>
    </motion.div>,

    // Body
    <motion.div key="body" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 px-8 pt-10">
      <h2 className="font-display text-xl font-light text-foreground/70">{t("bodyScan")}</h2>
      <p className="mt-2 text-[11px] text-foreground/20">{t("bodyScanDesc")}</p>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <button className="flex flex-col items-center justify-center gap-3 py-14 text-foreground/12 hover:text-accent/30 transition-colors">
          <User className="h-7 w-7" />
          <span className="text-[9px] font-medium tracking-wider">{t("frontPhoto")}</span>
        </button>
        <button className="flex flex-col items-center justify-center gap-3 py-14 text-foreground/12 hover:text-accent/30 transition-colors">
          <Camera className="h-7 w-7" />
          <span className="text-[9px] font-medium tracking-wider">{t("sidePhoto")}</span>
        </button>
      </div>

      <div className="mt-8 space-y-4">
        {[
          { label: t("height"), placeholder: "175 cm", key: "height" },
          { label: t("weight"), placeholder: "70 kg", key: "weight" },
          { label: t("shoulderWidth"), placeholder: "45 cm", key: "shoulder" },
          { label: t("waist"), placeholder: "80 cm", key: "waist" },
        ].map(field => (
          <div key={field.key}>
            <label className="text-[9px] font-medium text-foreground/20">{field.label}</label>
            <input
              type="text"
              placeholder={field.placeholder}
              value={bodyData[field.key as keyof typeof bodyData]}
              onChange={e => setBodyData(prev => ({ ...prev, [field.key]: e.target.value }))}
              className="mt-1 w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-foreground/12 border-b border-foreground/[0.05] focus:border-foreground/10 transition-colors"
            />
          </div>
        ))}
      </div>
    </motion.div>,

    // Ready
    <motion.div key="ready" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      {isAnalyzing ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-accent/40" />
          <p className="mt-6 text-[11px] text-foreground/25">{t("analyzing")}</p>
        </>
      ) : (
        <>
          <h2 className="font-display text-2xl font-light text-foreground/70">{t("aiProfileReady")}</h2>
          <p className="mt-4 text-[12px] leading-[1.8] text-foreground/25 max-w-[280px]">{t("profileGenerated")}</p>
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
      <div className="flex gap-2 px-8 pt-6">
        {steps.map((_, i) => (
          <div key={i} className={`h-px flex-1 transition-colors duration-500 ${i <= step ? "bg-accent/40" : "bg-foreground/[0.04]"}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>

      {/* Actions */}
      <div className="px-8 pb-12 pt-6">
        {!isAnalyzing && (
          <>
            <button
              onClick={handleNext}
              className="flex w-full items-center justify-center gap-2 py-3.5 text-[10px] font-medium tracking-[0.15em] text-foreground/50 transition-colors hover:text-foreground"
            >
              {isLast ? t("seeRecommendations") : step === 0 ? t("getStarted") : t("next")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {step > 0 && !isLast && (
              <button onClick={() => setStep(step + 1)} className="mt-1 w-full py-2 text-[9px] text-foreground/15">
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
