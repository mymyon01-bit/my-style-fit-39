import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Plus, X } from "lucide-react";

export interface StyleQuizAnswers {
  preferredStyles: string[];
  fitPreference: string;
  colorPreference: string;
  dailyVibe: string;
  occasionPreference: string[];
  brandFamiliarity: string[];
  budgetRange: string;
  dislikedStyles: string[];
}

interface StyleQuizProps {
  onComplete: (answers: StyleQuizAnswers) => void;
  onClose: () => void;
}

interface QuizStep {
  key: keyof StyleQuizAnswers;
  title: string;
  subtitle: string;
  options: string[];
  multi?: boolean;
  allowCustom?: boolean;
}

const STEPS: QuizStep[] = [
  {
    key: "preferredStyles",
    title: "What speaks to you?",
    subtitle: "Select all that resonate — or add your own",
    options: ["Minimal", "Street", "Classic", "Edgy", "Clean Fit", "Old Money", "Chic"],
    multi: true,
    allowCustom: true,
  },
  {
    key: "fitPreference",
    title: "How do you wear it?",
    subtitle: "Your ideal silhouette",
    options: ["Oversized", "Regular", "Slim", "Relaxed"],
  },
  {
    key: "colorPreference",
    title: "Your color world",
    subtitle: "What palette draws you in",
    options: ["Neutral", "Dark", "Mixed", "Bold", "Earth Tones"],
  },
  {
    key: "dailyVibe",
    title: "Day-to-day energy",
    subtitle: "How you naturally dress",
    options: ["Relaxed", "Clean", "Sharp", "Casual", "Confident"],
  },
  {
    key: "occasionPreference",
    title: "Where are you going?",
    subtitle: "Select your usual contexts",
    options: ["Daily", "Work", "Social", "Date", "Travel", "Mixed"],
    multi: true,
  },
  {
    key: "brandFamiliarity",
    title: "Brands you know",
    subtitle: "Optional — helps us curate better",
    options: ["COS", "ARKET", "Lemaire", "AMI Paris", "Our Legacy", "Acne Studios", "None"],
    multi: true,
  },
  {
    key: "budgetRange",
    title: "Investment level",
    subtitle: "Per piece, roughly",
    options: ["Under $80", "$80–200", "$200–400", "$400+"],
  },
  {
    key: "dislikedStyles",
    title: "What's not for you?",
    subtitle: "We'll steer away from these — or add your own",
    options: ["Sporty", "Loud Prints", "Ultra Slim", "Heavy Logos", "Oversized", "Formal"],
    multi: true,
    allowCustom: true,
  },
];

const StyleQuiz = ({ onComplete, onClose }: StyleQuizProps) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [customInput, setCustomInput] = useState("");

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const selected = answers[current.key];

  const handleSelect = (option: string) => {
    if (current.multi) {
      const arr = (selected as string[]) || [];
      const updated = arr.includes(option)
        ? arr.filter(x => x !== option)
        : [...arr, option];
      setAnswers({ ...answers, [current.key]: updated });
    } else {
      setAnswers({ ...answers, [current.key]: option });
    }
  };

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (current.multi) {
      const arr = (selected as string[]) || [];
      if (!arr.includes(trimmed)) {
        setAnswers({ ...answers, [current.key]: [...arr, trimmed] });
      }
    } else {
      setAnswers({ ...answers, [current.key]: trimmed });
    }
    setCustomInput("");
  };

  const isSelected = (option: string) => {
    if (current.multi) return ((selected as string[]) || []).includes(option);
    return selected === option;
  };

  const canProceed = current.multi
    ? ((selected as string[]) || []).length > 0
    : !!selected;

  const handleNext = () => {
    setCustomInput("");
    if (isLast) {
      onComplete({
        preferredStyles: (answers.preferredStyles as string[]) || [],
        fitPreference: (answers.fitPreference as string) || "Regular",
        colorPreference: (answers.colorPreference as string) || "Mixed",
        dailyVibe: (answers.dailyVibe as string) || "Casual",
        occasionPreference: (answers.occasionPreference as string[]) || [],
        brandFamiliarity: (answers.brandFamiliarity as string[]) || [],
        budgetRange: (answers.budgetRange as string) || "$80–200",
        dislikedStyles: (answers.dislikedStyles as string[]) || [],
      });
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    setCustomInput("");
    if (isLast) {
      // Skip last step = submit with whatever we have
      handleNext();
    } else {
      setStep(step + 1);
    }
  };

  // Get all custom items (items not in the original options)
  const customItems = current.multi
    ? ((selected as string[]) || []).filter(s => !current.options.includes(s))
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Progress */}
      <div className="flex items-center justify-between px-8 pt-8 md:px-12">
        <div className="flex gap-1.5 flex-1 mr-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-[2px] flex-1 transition-all duration-500 ${
                i <= step ? "bg-accent/60" : "bg-foreground/[0.08]"
              }`}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          className="text-[11px] tracking-[0.2em] text-foreground/70 hover:text-foreground transition-colors"
        >
          CLOSE
        </button>
      </div>

      {/* Step counter */}
      <div className="px-8 pt-6 md:px-12">
        <span className="text-[11px] font-medium tracking-[0.25em] text-foreground/70">
          {step + 1} / {STEPS.length}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center px-8 md:px-12 lg:px-16 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="max-w-lg mx-auto w-full"
          >
            <h2 className="font-display text-2xl font-light text-foreground/90 md:text-3xl">
              {current.title}
            </h2>
            <p className="mt-3 text-[13px] text-foreground/70 md:text-[14px]">
              {current.subtitle}
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              {current.options.map(option => (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={`rounded-full px-6 py-3.5 text-[13px] font-light transition-all duration-300 md:text-[14px] ${
                    isSelected(option)
                      ? "bg-accent text-accent-foreground ring-1 ring-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.18)]"
                      : "text-foreground/75 hover:text-foreground ring-1 ring-foreground/[0.08] hover:ring-foreground/[0.15]"
                  }`}
                >
                  {option}
                </button>
              ))}

              {/* Show custom-added items */}
              {customItems.map(item => (
                <button
                  key={item}
                  onClick={() => handleSelect(item)}
                  className="rounded-full px-6 py-3.5 text-[13px] font-light bg-accent text-accent-foreground ring-1 ring-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.18)] flex items-center gap-1.5"
                >
                  {item}
                  <X className="h-3 w-3 opacity-70" />
                </button>
              ))}
            </div>

            {/* Custom style input */}
            {current.allowCustom && (
              <div className="mt-6 flex items-center gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddCustom()}
                  placeholder="+ Add your own style…"
                  maxLength={30}
                  className="flex-1 rounded-full border border-foreground/[0.08] bg-transparent px-5 py-3 text-[13px] text-foreground outline-none placeholder:text-foreground/40 focus:border-accent/30 transition-colors"
                />
                <button
                  onClick={handleAddCustom}
                  disabled={!customInput.trim()}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/[0.08] text-foreground/60 hover:text-accent hover:border-accent/30 transition-colors disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-8 pb-12 md:px-12">
        <button
          onClick={() => { setCustomInput(""); step > 0 ? setStep(step - 1) : onClose(); }}
          className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.15em] text-foreground/70 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {step > 0 ? "BACK" : "EXIT"}
        </button>

        <div className="flex items-center gap-5">
          {!canProceed && !isLast && (
            <button
              onClick={handleSkip}
              className="text-[11px] tracking-[0.15em] text-foreground/50 transition-colors hover:text-foreground/80"
            >
              SKIP
            </button>
          )}
          <button
            onClick={canProceed ? handleNext : handleSkip}
            disabled={isLast && !canProceed}
            className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-[11px] font-medium tracking-[0.15em] transition-all ${
              canProceed
                ? "bg-accent text-accent-foreground hover:bg-accent/90"
                : "text-foreground/60 ring-1 ring-foreground/[0.12] hover:text-foreground hover:ring-foreground/[0.2]"
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {isLast ? "SEE MY PICKS" : "NEXT"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default StyleQuiz;
