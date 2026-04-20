import { useEffect, useState, useCallback } from "react";
import { Loader2, Bookmark, Camera, ExternalLink, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import PostProductToOOTDSheet from "./PostProductToOOTDSheet";

interface SavedProduct {
  id: string;            // saved_items.id
  productId: string;     // saved_items.product_id (text)
  name: string;
  brand: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
}

/**
 * Saved Products tab — shows items the user has saved from Discover.
 * Each card supports: open source, post to OOTD, remove.
 */
export default function SavedProductsTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [postTarget, setPostTarget] = useState<SavedProduct | null>(null);

  const loadSaved = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: saved } = await supabase
      .from("saved_items")
      .select("id, product_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60);

    const savedRows = saved ?? [];
    if (savedRows.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const productIds = savedRows.map((s) => s.product_id);
    const { data: products } = await supabase
      .from("product_cache")
      .select("id, name, brand, image_url, source_url")
      .in("id", productIds);

    const productById = new Map((products ?? []).map((p) => [p.id, p]));

    const merged: SavedProduct[] = savedRows.map((s) => {
      const p = productById.get(s.product_id);
      return {
        id: s.id,
        productId: s.product_id,
        name: p?.name ?? "Saved item",
        brand: p?.brand ?? null,
        imageUrl: p?.image_url ?? null,
        sourceUrl: p?.source_url ?? null,
      };
    });

    setItems(merged);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const handleRemove = async (item: SavedProduct) => {
    if (!user) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error } = await supabase
      .from("saved_items")
      .delete()
      .eq("id", item.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Couldn't remove item");
      void loadSaved();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-foreground/50">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="text-[11px]">Loading saved items…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-foreground/10 bg-foreground/[0.02] py-10 text-center">
        <Bookmark className="mb-2 h-6 w-6 text-foreground/25" />
        <p className="text-[12px] text-foreground/60">No saved items yet</p>
        <p className="mt-1 text-[10px] text-foreground/40">
          Save products from Discover to post them as your OOTD.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex flex-col overflow-hidden rounded-xl border border-foreground/[0.06] bg-card/40"
          >
            <div className="relative aspect-[3/4] w-full bg-muted/40">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Camera className="h-6 w-6 text-foreground/20" />
                </div>
              )}
              <button
                onClick={() => handleRemove(item)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/70 text-foreground/60 opacity-0 backdrop-blur-md transition-opacity hover:text-destructive group-hover:opacity-100"
                aria-label="Remove from saved"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1.5 p-2.5">
              {item.brand && (
                <p className="text-[9px] font-semibold uppercase tracking-wider text-foreground/55">
                  {item.brand}
                </p>
              )}
              <p className="line-clamp-2 text-[11px] font-medium text-foreground/85">{item.name}</p>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => setPostTarget(item)}
                  disabled={!item.imageUrl}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-accent/15 px-2 py-1.5 text-[10px] font-semibold text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
                >
                  <Camera className="h-3 w-3" /> Post OOTD
                </button>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-foreground/10 text-foreground/60 hover:bg-foreground/5"
                    aria-label="Open source"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <PostProductToOOTDSheet
        open={!!postTarget}
        product={postTarget}
        onClose={() => setPostTarget(null)}
        onPosted={() => {
          setPostTarget(null);
        }}
      />
    </>
  );
}
