/**
 * DiscoverAdRow — single skinny "AI AD" row shown on Discover, just before
 * the Live Results section. Mirrors the FEED top row aesthetic (small chip,
 * 3:4 thumbs, ADD YOUR AD slot opening the CONTACT US dialog).
 *
 * It re-uses already-loaded discover products (no extra fetch) so it stays
 * cheap and stylistically aligned with what the user just searched for.
 */
import { useState } from "react";
import { Sparkles, Plus } from "lucide-react";
import ContactUsDialog from "@/components/ContactUsDialog";
import type { DiscoverRenderableProduct } from "@/lib/search/discover-feed";
import type { Product } from "@/lib/search/types";

interface Props {
  pool: Array<Product | DiscoverRenderableProduct>;
}

export default function DiscoverAdRow({ pool }: Props) {
  const [contactOpen, setContactOpen] = useState(false);
  const items = pool.filter((p) => p.imageUrl).slice(0, 5);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-accent/70" />
          <span className="text-[9px] font-semibold tracking-[0.22em] text-foreground/55">
            SPONSORED
          </span>
          <span className="rounded-full bg-accent/15 px-1.5 py-px text-[8px] font-bold tracking-[0.15em] text-accent">
            AI AD
          </span>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {items.map((p) => (
          <a
            key={p.id}
            href={p.externalUrl || "#"}
            target={p.externalUrl ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="flex flex-col gap-1"
          >
            <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-foreground/[0.04]">
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
            <p className="line-clamp-1 text-[9px] text-foreground/60">
              {p.brand || p.title}
            </p>
          </a>
        ))}
        {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => (
          <div key={`spacer-${i}`} className="aspect-[3/4] rounded-lg bg-foreground/[0.02]" />
        ))}
        <button
          onClick={() => setContactOpen(true)}
          className="group flex flex-col gap-1 text-left"
          aria-label="Add your ad — contact us"
        >
          <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-accent/40 bg-accent/[0.04] transition-all group-hover:bg-accent/[0.1] group-hover:border-accent/60">
            <Plus className="h-4 w-4 text-accent/70 transition-transform group-hover:scale-110" />
          </div>
          <p className="line-clamp-1 text-[9px] font-semibold tracking-[0.14em] text-accent/75">
            ADD YOUR AD
          </p>
        </button>
      </div>
      <ContactUsDialog open={contactOpen} onOpenChange={setContactOpen} topic="Add Your Ad" />
    </div>
  );
}
