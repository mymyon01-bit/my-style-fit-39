import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OCCASION_OPTIONS, STYLE_OPTIONS, CRAVING_OPTIONS, type QuizAnswer } from "@/lib/today/quizOptions";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (a: QuizAnswer) => void;
  initial?: Partial<QuizAnswer>;
}

const STEPS = [
  { key: "occasion" as const, title: "What's the occasion?", options: OCCASION_OPTIONS },
  { key: "style" as const, title: "Your usual style?", options: STYLE_OPTIONS },
  { key: "craving" as const, title: "What are you craving?", options: CRAVING_OPTIONS },
];

export default function TodayQuizSheet({ open, onOpenChange, onSubmit, initial }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswer>>(initial ?? {});
  const [customValue, setCustomValue] = useState("");

  const current = STEPS[step];
  const selected = answers[current.key];

  const handleSelect = (val: string) => {
    const next = { ...answers, [current.key]: val };
    setAnswers(next);
    setCustomValue("");
    setTimeout(() => {
      if (step < STEPS.length - 1) {
        setStep(step + 1);
      } else if (next.occasion && next.style && next.craving) {
        onSubmit(next as QuizAnswer);
        setStep(0);
        setAnswers({});
      }
    }, 200);
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) handleSelect(customValue.trim());
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl border-foreground/10 bg-background">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-xl text-foreground/90">Today's Look</SheetTitle>
            <span className="text-[10px] tracking-[0.25em] text-foreground/50">{step + 1} / {STEPS.length}</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-accent/70" : "bg-foreground/10"}`} />
            ))}
          </div>
        </SheetHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            <p className="font-display text-2xl text-foreground/90 mb-6">{current.title}</p>

            {current.options.map((opt) => {
              const isActive = selected === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all ${
                    isActive ? "border-accent/60 bg-accent/10" : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/20"
                  }`}
                >
                  <span className="text-[14px] text-foreground/85">{opt.label}</span>
                  {isActive && <Check className="h-4 w-4 text-accent" />}
                </button>
              );
            })}

            <div className="pt-3">
              <input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                placeholder="Or type your own…"
                className="w-full rounded-2xl border border-dashed border-foreground/15 bg-transparent px-5 py-4 text-[14px] text-foreground/85 placeholder:text-foreground/40 focus:border-accent/50 focus:outline-none"
              />
              {customValue.trim() && (
                <button
                  onClick={handleCustomSubmit}
                  className="mt-2 text-[10px] tracking-[0.25em] text-accent/80 hover:text-accent"
                >
                  USE "{customValue.trim().toUpperCase()}"
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
