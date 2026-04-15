import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft } from "lucide-react";

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
}

const STEPS: QuizStep[] = [
  {
    key: "preferredStyles",
    title: "What speaks to you?",
    subtitle: "Select all that resonate",
    options: ["Minimal", "Street", "Classic", "Edgy", "Clean Fit", "Old Money", "Chic"],
    multi: true,
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
    subtitle: "We'll steer away from these",
    options: ["Sporty", "Loud Prints", "Ultra Slim", "Heavy Logos", "Oversized", "Formal"],
    multi: true,
  },
];

const StyleQuiz = ({ onComplete, onClose }: StyleQuizProps) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

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

  const isSelected = (option: string) => {
    if (current.multi) return ((selected as string[]) || []).includes(option);
    return selected === option;
  };

  const canProceed = current.multi
    ? ((selected as string[]) || []).length > 0
    : !!selected;

  const handleNext = () => {
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
                i <= step ? "bg-accent/50" : "bg-foreground/[0.06]"
              }`}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          className="text-[10px] tracking-[0.2em] text-foreground/62 hover:text-foreground/62 transition-colors"
        >
          CLOSE
        </button>
      </div>

      {/* Step counter */}
      <div className="px-8 pt-6 md:px-12">
        <span className="text-[10px] font-medium tracking-[0.25em] text-foreground/60">
          {step + 1} / {STEPS.length}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center px-8 md:px-12 lg:px-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="max-w-lg mx-auto w-full"
          >
            <h2 className="font-display text-2xl font-light text-foreground/80 md:text-3xl">
              {current.title}
            </h2>
            <p className="mt-3 text-[12px] text-foreground/80 md:text-[13px]">
              {current.subtitle}
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              {current.options.map(option => (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={`rounded-full px-6 py-3.5 text-[13px] font-light transition-all duration-300 md:text-[14px] ${
                    isSelected(option)
                      ? "bg-accent/15 text-accent/90 ring-1 ring-accent/25"
                      : "text-foreground/68 hover:text-foreground/68 ring-1 ring-foreground/[0.06] hover:ring-foreground/[0.12]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-8 pb-12 md:px-12">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : onClose()}
          className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.15em] text-foreground/62 hover:text-foreground/62 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {step > 0 ? "BACK" : "EXIT"}
        </button>

        {canProceed ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.15em] text-foreground/60 hover:text-foreground transition-colors"
          >
            {isLast ? "SEE MY PICKS" : "NEXT"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={() => !isLast && setStep(step + 1)}
            className="text-[10px] text-foreground/80 transition-colors hover:text-foreground/62"
          >
            SKIP
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default StyleQuiz;
