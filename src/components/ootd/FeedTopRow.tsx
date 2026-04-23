import { useEffect, useState } from "react";
import { Bookmark, Sparkles, ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import ContactUsDialog from "@/components/ContactUsDialog";
import ProductDetailSheet from "@/components/ProductDetailSheet";

interface MiniProduct {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  source_url: string | null;
}

/**
 * Two skinny rows shown on top of the FEED tab:
 *   1) "Saved" — first 6 of the user's saved items + view-all link.
 *   2) "AI AD" — placeholder personalized recommendations (so we can later
 *      swap in monetized ad inventory). Driven by user's preferred styles.
 *
 * Tapping any product slot opens the in-app ProductDetailSheet instead of
 * jumping out to an external link.
 */
export default function FeedTopRow({ styleHints }: { styleHints?: string[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<MiniProduct[]>([]);
  const [ads, setAds] = useState<MiniProduct[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<MiniProduct | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: rows } = await supabase
        .from("saved_items")
        .select("product_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6);
      const ids = (rows || []).map((r: any) => r.product_id);
      if (ids.length === 0) {
        setSaved([]);
        return;
      }
      const { data: products } = await supabase
        .from("product_cache")
        .select("id, name, brand, image_url, source_url")
        .in("id", ids);
      // Preserve order from saved_items
      const map = new Map((products || []).map((p: any) => [p.id, p]));
      setSaved(ids.map((id) => map.get(id)).filter(Boolean) as MiniProduct[]);
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      const tags = (styleHints || []).filter(Boolean).slice(0, 3);
      let q = supabase
        .from("product_cache")
        .select("id, name, brand, image_url, source_url")
        .not("image_url", "is", null)
        .order("trend_score", { ascending: false })
        .limit(8);
      if (tags.length > 0) q = q.overlaps("style_tags", tags);
      const { data } = await q;
      setAds(((data || []) as any[]).slice(0, 6));
    })();
  }, [styleHints?.join(",")]);

  const Row = ({
    title,
    icon: Icon,
    items,
    cta,
    onCta,
    badge,
  }: {
    title: string;
    icon: any;
    items: MiniProduct[];
    cta?: string;
    onCta?: () => void;
    badge?: string;
  }) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-accent/70" />
          <span className="text-[9px] font-semibold tracking-[0.22em] text-foreground/55">{title}</span>
          {badge && (
            <span className="rounded-full bg-accent/15 px-1.5 py-px text-[8px] font-bold tracking-[0.15em] text-accent">
              {badge}
            </span>
          )}
        </div>
        {cta && onCta && (
          <button
            onClick={onCta}
            className="flex items-center gap-0.5 text-[9px] font-medium tracking-[0.18em] text-accent/70 hover:text-accent"
          >
            {cta} <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActiveProduct(p)}
            className="flex w-20 shrink-0 flex-col gap-1 text-left"
          >
            <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-foreground/[0.04]">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
              ) : null}
            </div>
            <p className="line-clamp-1 text-[9px] text-foreground/60">{p.brand || p.name}</p>
          </button>
        ))}
      </div>
    </div>
  );

  // Cap AI AD items so the row stays visually balanced; reserve last slot
  // for the "ADD YOUR AD" CTA. Total = 6 cells (5 ads + 1 CTA).
  const adItems = ads.slice(0, 5);

  return (
    <div className="space-y-3">
      {user && saved.length > 0 && (
        <Row
          title="MY SAVED"
          icon={Bookmark}
          items={saved}
          cta="VIEW ALL"
          onCta={() => navigate("/profile")}
        />
      )}
      {(adItems.length > 0 || true) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-accent/70" />
              <span className="text-[9px] font-semibold tracking-[0.22em] text-foreground/55">FOR YOU</span>
              <span className="rounded-full bg-accent/15 px-1.5 py-px text-[8px] font-bold tracking-[0.15em] text-accent">
                AI AD
              </span>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {adItems.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveProduct(p)}
                className="flex flex-col gap-1 text-left"
              >
                <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-foreground/[0.04]">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <p className="line-clamp-1 text-[9px] text-foreground/60">{p.brand || p.name}</p>
              </button>
            ))}
            {/* ADD YOUR AD slot — opens CONTACT US dialog (mail to mymyon.01@gmail.com hidden from UI) */}
            {Array.from({ length: Math.max(0, 5 - adItems.length) }).map((_, i) => (
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
              <p className="line-clamp-1 text-[9px] font-semibold tracking-[0.14em] text-accent/75">ADD YOUR AD</p>
            </button>
          </div>
        </div>
      )}
      <ContactUsDialog open={contactOpen} onOpenChange={setContactOpen} topic="Add Your Ad" />
      <ProductDetailSheet
        product={
          activeProduct
            ? {
                id: activeProduct.id,
                name: activeProduct.name,
                brand: activeProduct.brand || "",
                price: "",
                category: "",
                reason: "",
                style_tags: [],
                color: "",
                fit: "",
                image_url: activeProduct.image_url,
                source_url: activeProduct.source_url,
              }
            : null
        }
        open={!!activeProduct}
        onClose={() => setActiveProduct(null)}
        isSaved={false}
        onSave={() => {}}
      />
    </div>
  );
}
