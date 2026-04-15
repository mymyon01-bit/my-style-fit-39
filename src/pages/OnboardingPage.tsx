import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Camera, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const styleOptions = ["minimal", "streetwear", "classic", "oldMoney", "chic", "cleanFit"] as const;
const occasions = ["daily", "office", "date", "travel"] as const;

const OnboardingPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);

  const toggleStyle = (s: string) =>
    setSelectedStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const toggleOccasion = (o: string) =>
    setSelectedOccasions((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));

  const steps = [
    // Step 0: Welcome
    <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <span className="text-5xl">✨</span>
      <h1 className="mt-6 font-display text-3xl font-bold text-foreground">{t("onboardingTitle1")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("onboardingDesc1")}</p>
    </motion.div>,

    // Step 1: Style selection
    <motion.div key="style" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 px-6 pt-8">
      <h2 className="font-display text-2xl font-bold text-foreground">{t("whatsYourStyle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("styleDescription")}</p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        {styleOptions.map((s) => (
          <button
            key={s}
            onClick={() => toggleStyle(s)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              selectedStyles.includes(s)
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground"
            }`}
          >
            {t(s as any)}
          </button>
        ))}
      </div>
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("occasion")}</p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {occasions.map((o) => (
            <button
              key={o}
              onClick={() => toggleOccasion(o)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                selectedOccasions.includes(o)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground"
              }`}
            >
              {t(o as any)}
            </button>
          ))}
        </div>
      </div>
    </motion.div>,

    // Step 2: Body info / photos
    <motion.div key="body" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 px-6 pt-8">
      <h2 className="font-display text-2xl font-bold text-foreground">{t("tellUsAboutYou")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("uploadPhotos")}</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-muted-foreground transition-colors hover:border-accent hover:text-accent">
          <Camera className="h-6 w-6" />
          <span className="text-xs font-medium">{t("fullBodyPhoto")}</span>
        </button>
        <button className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-muted-foreground transition-colors hover:border-accent hover:text-accent">
          <Upload className="h-6 w-6" />
          <span className="text-xs font-medium">{t("facePhoto")}</span>
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {[
          { label: t("height"), placeholder: "175 cm" },
          { label: t("weight"), placeholder: "70 kg" },
          { label: t("shoulderWidth"), placeholder: "45 cm" },
          { label: t("waist"), placeholder: "80 cm" },
          { label: t("hairStyle"), placeholder: "Short, textured" },
        ].map((field) => (
          <div key={field.label}>
            <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
            <input
              type="text"
              placeholder={field.placeholder}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-accent"
            />
          </div>
        ))}
      </div>
    </motion.div>,

    // Step 3: Profile ready
    <motion.div key="ready" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
        <span className="text-4xl">🎯</span>
      </div>
      <h2 className="mt-6 font-display text-2xl font-bold text-foreground">{t("aiProfileReady")}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        We've analyzed your style preferences and body profile to create personalized recommendations.
      </p>
    </motion.div>,
  ];

  const isLast = step === steps.length - 1;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Progress */}
      <div className="flex gap-1.5 px-6 pt-4">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-accent" : "bg-border"
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">{steps[step]}</AnimatePresence>

      {/* Actions */}
      <div className="px-6 pb-10 pt-4">
        <button
          onClick={() => {
            if (isLast) {
              localStorage.setItem("wardrobe-onboarded", "true");
              navigate("/");
            } else {
              setStep(step + 1);
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {isLast ? t("seeRecommendations") : step === 0 ? t("getStarted") : t("next")}
          <ChevronRight className="h-4 w-4" />
        </button>
        {step > 0 && !isLast && (
          <button
            onClick={() => {
              if (isLast) return;
              setStep(step + 1);
            }}
            className="mt-2 w-full py-2 text-xs font-medium text-muted-foreground"
          >
            {t("skip")}
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
