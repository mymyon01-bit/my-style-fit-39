/**
 * RecommendedForShape — Editorial product strip tailored to a user's body shape.
 *
 * Lightweight query against the `products` table with simple shape→tag heuristics
 * (no AI call). Renders a horizontal scroll of cards; each opens the existing
 * ProductDetailSheet flow used elsewhere in the app.
 */
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ShapeKey = "hourglass" | "pear" | "rectangle" | "triangle" | "round" | "—";

interface Item {
  id: string;
  name: string;
  brand: string;
  price: number | null;
  currency: string | null;
  image: string;
  source_url: string | null;
}

interface Props {
  shape: ShapeKey;
  gender?: string | null;
}

/** Tag hints per body shape — kept conservative and editorial. */
const SHAPE_HINTS: Record<Exclude<ShapeKey, "—">, string[]> = {
  hourglass:  ["fitted", "wrap", "belted", "bodycon", "tailored"],
  pear:       ["a-line", "high-waist", "flowy", "structured top", "wide-leg"],
  rectangle:  ["layered", "ruffled", "peplum", "belted", "cropped"],
  triangle:   ["v-neck", "structured shoulder", "wide-leg", "dark top"],
  round:      ["v-neck", "empire", "long line", "monochrome", "flowy"],
};

export default function RecommendedForShape({ shape, gender }: Props) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const hints = shape !== "—" ? SHAPE_HINTS[shape] : ["essential", "tailored", "fitted"];
      let q = supabase
        .from("products")
        .select("id,name,brand,price,currency,images,source_url,style_tags")
        .eq("is_active", true)
        .limit(12);
      // Heuristic: overlap on style_tags when possible.
      if (hints.length) q = q.overlaps("style_tags", hints);
      const { data } = await q;
      let rows = data ?? [];
      if (rows.length < 4) {
        // Fallback — featured products if shape match is too narrow.
        const { data: fb } = await supabase
          .from("products")
          .select("id,name,brand,price,currency,images,source_url,style_tags")
          .eq("is_active", true)
          .eq("is_featured", true)
          .limit(12);
        rows = (fb ?? []);
      }
      if (cancelled) return;
      setItems(
        rows.map((p: any) => ({
          id: p.id,
          name: p.name,
          brand: p.brand,
          price: p.price ?? null,
          currency: p.currency ?? null,
          image: (Array.isArray(p.images) && p.images[0]) || "",
          source_url: p.source_url ?? null,
        })).filter((p) => p.image),
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [shape, gender]);

  if (!loading && (!items || items.length === 0)) return null;

  return (
    <section className="rounded-3xl border border-foreground/[0.06] bg-card/30 p-4 md:p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[9px] font-bold tracking-[0.3em] text-foreground/55 uppercase">
            Recommended for your shape
          </p>
          <h3 className="mt-1 font-display text-lg font-medium text-foreground">
            {shape === "—" ? "Editor's picks for you" : `Best matches for ${shape} silhouettes`}
          </h3>
        </div>
        <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.6} />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-foreground/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 px-1 snap-x">
          {items!.map((p) => (
            <a
              key={p.id}
              href={p.source_url ?? "#"}
              target={p.source_url ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="group flex w-[140px] shrink-0 snap-start flex-col"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-background/40">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <p className="mt-2 line-clamp-1 text-[10px] tracking-[0.2em] text-foreground/50 uppercase">
                {p.brand}
              </p>
              <p className="line-clamp-1 text-[12px] font-medium text-foreground">{p.name}</p>
              {p.price != null && (
                <p className="text-[11px] tabular-nums text-foreground/65">
                  {p.currency === "USD" ? "$" : p.currency === "KRW" ? "₩" : ""}
                  {Math.round(p.price).toLocaleString()}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
