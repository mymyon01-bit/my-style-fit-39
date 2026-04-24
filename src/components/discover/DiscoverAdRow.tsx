/**
 * DiscoverAdRow — single skinny "AI AD" row shown on Discover, just before
 * the Live Results section. Fetches its OWN product set (separate from the
 * Discover live results / DB top grid) so ads never duplicate what the user
 * is already browsing on this page. Includes an ADD YOUR AD CTA opening the
 * CONTACT US dialog.
 */
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Plus } from "lucide-react";
import ContactUsDialog from "@/components/ContactUsDialog";
import ProductDetailSheet from "@/components/ProductDetailSheet";
import { supabase } from "@/integrations/supabase/client";
import type { DiscoverRenderableProduct } from "@/lib/search/discover-feed";
import type { Product } from "@/lib/search/types";

interface AdItem {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  source_url: string | null;
}

interface Props {
  /** Products already visible on the Discover page — used to exclude duplicates. */
  pool: Array<Product | DiscoverRenderableProduct>;
  /** Optional style hints to bias ad selection. */
  styleHints?: string[];
}

export default function DiscoverAdRow({ pool, styleHints }: Props) {
  const [contactOpen, setContactOpen] = useState(false);
  const [activeAd, setActiveAd] = useState<AdItem | null>(null);
  const [items, setItems] = useState<AdItem[]>([]);

  // Build a stable set of ids already shown on the Discover page so we never
  // recommend the exact same product as an "ad".
  const excludeKey = useMemo(
    () => pool.map((p) => p.id).filter(Boolean).slice(0, 200).join(","),
    [pool],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const excludeIds = excludeKey ? excludeKey.split(",") : [];

      // Pull a large pool of validated, image-having products from the DB,
      // then shuffle client-side for a fresh random set every render.
      const { data } = await supabase
        .from("product_cache")
        .select("id, name, brand, image_url, source_url")
        .eq("is_active", true)
        .eq("image_valid", true)
        .not("image_url", "is", null)
        .order("trend_score", { ascending: false })
        .limit(200);

      if (cancelled) return;

      const pool = ((data || []) as AdItem[]).filter(
        (p) => !!p.image_url && !excludeIds.includes(p.id),
      );
      // Fisher-Yates shuffle then take 5
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      setItems(pool.slice(0, 5));
    })();
    return () => {
      cancelled = true;
    };
  }, [excludeKey]);

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
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveAd(p)}
            className="flex flex-col gap-1 text-left"
          >
            <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-foreground/[0.04]">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
            <p className="line-clamp-1 text-[9px] text-foreground/60">
              {p.brand || p.name}
            </p>
          </button>
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
      <ProductDetailSheet
        product={
          activeAd
            ? {
                id: activeAd.id,
                name: activeAd.name,
                brand: activeAd.brand || "",
                price: "",
                category: "",
                reason: "",
                style_tags: [],
                color: "",
                fit: "",
                image_url: activeAd.image_url,
                source_url: activeAd.source_url,
              }
            : null
        }
        open={!!activeAd}
        onClose={() => setActiveAd(null)}
        isSaved={false}
        onSave={() => {}}
      />
    </div>
  );
}
