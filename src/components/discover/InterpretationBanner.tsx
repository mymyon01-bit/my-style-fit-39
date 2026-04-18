/**
 * InterpretationBanner
 * --------------------
 * Lightweight chip row that tells the user how the engine interpreted
 * their query. Sits between the DB grid and Styled Looks per UX spec.
 *
 * Pure presentation — receives an already-summarized chip list.
 */
import { Sparkles } from "lucide-react";

interface InterpretationBannerProps {
  query: string;
  chips: string[];
  fallbackUsed?: "alias" | "ai" | null;
}

export default function InterpretationBanner({ query, chips, fallbackUsed }: InterpretationBannerProps) {
  if (!query.trim() || chips.length === 0) return null;
  return (
    <div className="my-6 rounded-2xl border border-foreground/10 bg-foreground/5 px-5 py-4">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-foreground/70">
        <Sparkles className="h-3 w-3" />
        <span>We interpreted this as</span>
        {fallbackUsed === "ai" && (
          <span className="ml-2 rounded-full bg-foreground/10 px-2 py-0.5 text-[9px] tracking-[0.2em] text-foreground/60">
            AI assist
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-foreground/15 bg-background/60 px-3 py-1 text-[12px] font-medium text-foreground/90"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
