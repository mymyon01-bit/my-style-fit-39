// ─── FIT BREAKDOWN ─────────────────────────────────────────────────────────
// Region-level result card driven entirely by SolverResult. Updates instantly
// when the user switches sizes.

import type { SolverResult } from "@/lib/fit/fitSolver";
import { REGION_LABEL } from "@/lib/fit/fitSolver";

interface Props {
  solver: SolverResult;
  isBottom?: boolean;
}

export default function FitBreakdown({ solver, isBottom = false }: Props) {
  const r = solver.regions;
  const items = [
    { key: "CHEST",    label: REGION_LABEL.chest[r.chest.fit],       hidden: isBottom },
    { key: "WAIST",    label: REGION_LABEL.waist[r.waist.fit],       hidden: false },
    { key: "SHOULDER", label: REGION_LABEL.shoulder[r.shoulder.fit], hidden: isBottom },
    { key: "LENGTH",   label: REGION_LABEL.length[r.length.fit],     hidden: false },
    { key: "SLEEVE",   label: REGION_LABEL.sleeve[r.sleeve.fit],     hidden: isBottom },
  ].filter((i) => !i.hidden);

  return (
    <div className={`grid gap-2 pt-1 ${items.length === 5 ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-3"}`}>
      {items.map((m) => (
        <div
          key={m.key}
          className="rounded-lg border border-foreground/[0.06] bg-background/40 py-2.5 text-center"
        >
          <p className="text-[9px] font-bold tracking-[0.18em] text-foreground/45">{m.key}</p>
          <p className="mt-1 text-[12px] font-semibold text-foreground">{m.label}</p>
        </div>
      ))}
    </div>
  );
}
