import { useState, memo } from "react";
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

/**
 * HARDCODED QUIZ BANK — do not generate dynamically.
 * Curated, deduplicated, fixed order. Maps each answer to the
 * StyleQuizAnswers shape consumed by the recommendation pipeline.
 */
type AnswerKey = keyof StyleQuizAnswers;

interface QuizQuestion {
  id: string;
  group: "Style" | "Fit" | "Color" | "Shopping" | "Occasion";
  title: string;
  subtitle: string;
  options: string[];
  multi?: boolean;
  // Where each selection is stored
  target: AnswerKey;
}

const QUESTIONS: QuizQuestion[] = [
  // Group A — Style identity
  {
    id: "style-lean",
    group: "Style",
    title: "Which overall style do you lean toward most?",
    subtitle: "Pick the directions that feel like you",
    options: ["Minimal", "Modern", "Street", "Classic", "Relaxed", "Formal"],
    multi: true,
    target: "preferredStyles",
  },
  {
    id: "vibe",
    group: "Style",
    title: "Which vibe fits you best?",
    subtitle: "Your day-to-day energy",
    options: ["Clean", "Bold", "Soft", "Sharp", "Casual", "Edgy"],
    target: "dailyVibe",
  },
  // Group B — Fit
  {
    id: "tops-fit",
    group: "Fit",
    title: "How do you like your tops to fit?",
    subtitle: "Your usual silhouette up top",
    options: ["Slim", "Regular", "Relaxed", "Oversized"],
    target: "fitPreference",
  },
  {
    id: "bottoms-fit",
    group: "Fit",
    title: "How do you like your bottoms to fit?",
    subtitle: "Your usual cut below",
    options: ["Slim", "Straight", "Relaxed", "Wide"],
    // stored alongside fit modifier — we keep last selection as preferredFit refinement
    target: "fitPreference",
  },
  // Group C — Color
  {
    id: "color-range",
    group: "Color",
    title: "Which color range do you wear most?",
    subtitle: "Your everyday palette",
    options: [
      "Black / Grey / White",
      "Beige / Brown / Earth tones",
      "Navy / Blue",
      "Mixed colors",
      "Dark tones",
      "Light tones",
    ],
    target: "colorPreference",
  },
  {
    id: "color-avoid",
    group: "Color",
    title: "Which color do you usually avoid?",
    subtitle: "We'll steer away from these",
    options: ["Bright colors", "Dark colors", "Earth tones", "Monochrome", "No preference"],
    target: "dislikedStyles",
    multi: true,
  },
  // Group D — Shopping
  {
    id: "shop-first",
    group: "Shopping",
    title: "What do you usually shop for first?",
    subtitle: "Your priority categories",
    options: ["Jackets / Outerwear", "Tops", "Bottoms", "Shoes", "Bags", "Accessories"],
    multi: true,
    target: "brandFamiliarity", // reused as shopping signal bucket
  },
  {
    id: "matters-most",
    group: "Shopping",
    title: "What matters most when choosing an item?",
    subtitle: "Your top criteria",
    options: ["Fit", "Style", "Comfort", "Versatility", "Brand", "Price"],
    target: "budgetRange",
  },
  // Group E — Occasion
  {
    id: "dress-for",
    group: "Occasion",
    title: "What do you dress for most often?",
    subtitle: "Your usual contexts",
    options: ["Everyday", "Work", "Going out", "Travel", "Date / social", "Special occasions"],
    multi: true,
    target: "occasionPreference",
  },
  {
    id: "wardrobe-vision",
    group: "Occasion",
    title: "Which description sounds most like your ideal wardrobe?",
    subtitle: "Your north star",
    options: [
      "Clean and versatile",
      "Fashion-forward and expressive",
      "Comfortable and relaxed",
      "Refined and structured",
      "Street and trend-aware",
    ],
    target: "preferredStyles",
    multi: true,
  },
];

const StyleQuiz = ({ onComplete, onClose }: StyleQuizProps) => {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string | string[]>>({});

  const current = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const selected = responses[current.id];

  const handleSelect = (option: string) => {
    if (current.multi) {
      const arr = (selected as string[]) || [];
      const updated = arr.includes(option)
        ? arr.filter((x) => x !== option)
        : [...arr, option];
      setResponses({ ...responses, [current.id]: updated });
    } else {
      setResponses({ ...responses, [current.id]: option });
    }
  };

  const isSelected = (option: string) => {
    if (current.multi) return ((selected as string[]) || []).includes(option);
    return selected === option;
  };

  const canProceed = current.multi
    ? ((selected as string[]) || []).length > 0
    : !!selected;

  const buildAnswers = (): StyleQuizAnswers => {
    const get = (id: string) => responses[id];
    const asArr = (id: string) => (get(id) as string[]) || [];
    const asStr = (id: string) => (get(id) as string) || "";

    const preferredStyles = [
      ...asArr("style-lean"),
      ...asArr("wardrobe-vision"),
    ];
    return {
      preferredStyles: Array.from(new Set(preferredStyles)),
      fitPreference: asStr("tops-fit") || asStr("bottoms-fit") || "Regular",
      colorPreference: asStr("color-range") || "Mixed",
      dailyVibe: asStr("vibe") || "Casual",
      occasionPreference: asArr("dress-for"),
      brandFamiliarity: asArr("shop-first"),
      budgetRange: asStr("matters-most") || "Style",
      dislikedStyles: asArr("color-avoid"),
    };
  };

  const handleNext = () => {
    if (isLast) {
      onComplete(buildAnswers());
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    if (isLast) handleNext();
    else setStep(step + 1);
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
        <div className="flex flex-1 gap-1.5 mr-6">
          {QUESTIONS.map((_, i) => (
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

      {/* Step counter + group */}
      <div className="flex items-center justify-between px-8 pt-6 md:px-12">
        <span className="text-[11px] font-medium tracking-[0.25em] text-foreground/70">
          {step + 1} / {QUESTIONS.length}
        </span>
        <span className="text-[10px] tracking-[0.3em] text-accent/70 uppercase">
          {current.group}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-center overflow-y-auto px-8 md:px-12 lg:px-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mx-auto w-full max-w-lg"
          >
            <h2 className="font-display text-2xl font-light text-foreground/90 md:text-3xl">
              {current.title}
            </h2>
            <p className="mt-3 text-[13px] text-foreground/70 md:text-[14px]">
              {current.subtitle}
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              {current.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleSelect(option)}
                  className={`rounded-full px-6 py-3.5 text-[13px] font-light transition-all duration-300 md:text-[14px] ${
                    isSelected(option)
                      ? "bg-accent text-accent-foreground ring-1 ring-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.18)]"
                      : "text-foreground/75 ring-1 ring-foreground/[0.08] hover:text-foreground hover:ring-foreground/[0.15]"
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
          onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
          className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.15em] text-foreground/70 transition-colors hover:text-foreground"
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
            } disabled:cursor-not-allowed disabled:opacity-30`}
          >
            {isLast ? "SEE MY PICKS" : "NEXT"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default memo(StyleQuiz);
