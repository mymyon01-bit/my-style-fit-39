/**
 * ProductIntelligencePanel — Phase 5 of the MYMYON rebrand.
 *
 * Editorial intelligence layer that sits on every product detail sheet:
 *  - Fit Match %  (heuristic from product fit + saved body profile, if any)
 *  - Recommended Size  (rough cross-brand estimate by gender + height)
 *  - Fabric Behavior  (soft / structured / drapey / stretch)
 *  - AI Styling Suggestions  (chip row)
 *  - Similar Alternatives  (placeholder rail)
 *
 * Pure presentation — fed by props. The caller assembles inputs from product
 * + auth/body state.
 */
import { useMemo } from "react";
import { CircleCheck, Ruler, Wind, Sparkles, Shirt } from "lucide-react";

interface ProductIntelligencePanelProps {
  productName: string;
  category?: string | null;
  fit?: string | null;
  brand?: string | null;
  bodyHeightCm?: number | null;
  bodyGender?: string | null;
  styleTags?: string[];
}

// ── Heuristics ────────────────────────────────────────────────────────────
function estimateFitMatch(fit?: string | null, hasBody?: boolean): number {
  const base = (() => {
    switch ((fit || "regular").toLowerCase()) {
      case "slim": return 84;
      case "regular": return 92;
      case "relaxed": return 90;
      case "oversized": return 86;
      default: return 88;
    }
  })();
  return hasBody ? base : Math.max(70, base - 14);
}

function estimateSize(
  heightCm: number | null | undefined,
  gender: string | null | undefined,
): { label: string; sub: string } {
  if (!heightCm) return { label: "M", sub: "Add body for precise size" };
  const g = (gender || "").toLowerCase();
  if (g === "female" || g === "f") {
    if (heightCm < 158) return { label: "XS", sub: "≈ US 0" };
    if (heightCm < 165) return { label: "S",  sub: "≈ US 2" };
    if (heightCm < 172) return { label: "M",  sub: "≈ US 6" };
    if (heightCm < 178) return { label: "L",  sub: "≈ US 10" };
    return { label: "XL", sub: "≈ US 12+" };
  }
  if (heightCm < 168) return { label: "S",  sub: "≈ Chest 92cm" };
  if (heightCm < 176) return { label: "M",  sub: "≈ Chest 98cm" };
  if (heightCm < 184) return { label: "L",  sub: "≈ Chest 104cm" };
  return { label: "XL", sub: "≈ Chest 110cm" };
}

function estimateFabric(category?: string | null, fit?: string | null): string {
  const c = (category || "").toLowerCase();
  const f = (fit || "").toLowerCase();
  if (c.includes("knit") || c.includes("sweater")) return "Soft · Stretchy · Cozy drape";
  if (c.includes("blazer") || c.includes("coat") || c.includes("suit")) return "Soft & Structured · Holds shape";
  if (c.includes("denim") || c.includes("jean")) return "Rigid · Light stretch · Holds silhouette";
  if (c.includes("dress") || c.includes("silk")) return "Fluid drape · Light · Falls clean";
  if (f === "oversized") return "Relaxed drape · Cloud-like flow";
  return "Balanced weave · Comfortable handle";
}

function stylingSuggestions(tags: string[], category?: string | null): string[] {
  const base = ["Tonal layering", "Statement footwear", "Minimal accessories"];
  const c = (category || "").toLowerCase();
  if (c.includes("dress")) return ["Belt at waist", "Knee boots", "Structured outer", "Gold jewelry"];
  if (c.includes("blazer") || c.includes("coat")) return ["Off-white tee", "Straight denim", "Pointed loafers", "Leather tote"];
  if (c.includes("bottom") || c.includes("jean") || c.includes("pant"))
    return ["Knit polo", "Linen shirt", "Loafers", "Mini bag"];
  return tags.length ? [...tags.slice(0, 3).map(t => `Pair with ${t}`), "Tonal layering"] : base;
}

const Row = ({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3 border-t border-foreground/10 px-4 py-3 first:border-t-0">
    <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-foreground/15 bg-background/50">
      <Icon className="h-3.5 w-3.5 text-accent" strokeWidth={1.8} />
    </div>
    <div className="flex-1">
      <span className="block text-[9px] font-medium tracking-[0.22em] text-foreground/55">
        {label.toUpperCase()}
      </span>
      <div className="mt-0.5 text-[12.5px] leading-snug text-foreground/90">
        {children}
      </div>
    </div>
  </div>
);

const ProductIntelligencePanel = ({
  productName, category, fit, brand,
  bodyHeightCm, bodyGender, styleTags = [],
}: ProductIntelligencePanelProps) => {
  const fitMatch = useMemo(() => estimateFitMatch(fit, !!bodyHeightCm), [fit, bodyHeightCm]);
  const size = useMemo(() => estimateSize(bodyHeightCm, bodyGender), [bodyHeightCm, bodyGender]);
  const fabric = useMemo(() => estimateFabric(category, fit), [category, fit]);
  const styling = useMemo(() => stylingSuggestions(styleTags, category), [styleTags, category]);

  return (
    <section className="overflow-hidden rounded-2xl border border-foreground/10 bg-card/50">
      {/* Header — Fit Match hero */}
      <div className="flex items-center justify-between border-b border-foreground/10 bg-gradient-to-br from-accent/15 to-transparent px-4 py-4">
        <div>
          <span className="text-[9px] font-medium tracking-[0.28em] text-foreground/55">
            PRODUCT INTELLIGENCE
          </span>
          <h3 className="mt-1 font-display text-[15px] font-semibold leading-tight text-foreground">
            Match Analysis
          </h3>
        </div>
        <div className="flex items-baseline gap-1">
          <CircleCheck className="mr-1 h-4 w-4 text-accent" strokeWidth={2} />
          <span className="font-display text-[28px] font-semibold leading-none text-foreground">
            {fitMatch}
          </span>
          <span className="text-[11px] text-foreground/60">% match</span>
        </div>
      </div>

      <Row icon={Ruler} label="Recommended Size">
        <span className="font-display text-[16px] font-semibold text-foreground">{size.label}</span>
        <span className="ml-2 text-[11px] text-foreground/55">{size.sub}</span>
      </Row>

      <Row icon={Wind} label="Fabric Behavior">
        {fabric}
      </Row>

      <Row icon={Sparkles} label="AI Styling Suggestions">
        <div className="mt-1 flex flex-wrap gap-1.5">
          {styling.map((s) => (
            <span
              key={s}
              className="rounded-full border border-foreground/15 bg-background/40 px-2.5 py-1 text-[10px] tracking-wide text-foreground/75"
            >
              {s}
            </span>
          ))}
        </div>
      </Row>

      <Row icon={Shirt} label="Similar Alternatives">
        <span className="text-[11px] text-foreground/60">
          Open Discover to browse {brand || "matching"} pieces with the same silhouette.
        </span>
      </Row>
    </section>
  );
};

export default ProductIntelligencePanel;
