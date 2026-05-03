import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, LayoutGrid, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserShowrooms } from "@/hooks/useShowrooms";
import SafeImage from "@/components/SafeImage";

interface ProductLite {
  id: string;
  name: string;
  brand?: string | null;
  imageUrl?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  product: ProductLite | null;
}

const SendToShowroomSheet = ({ open, onClose, product }: Props) => {
  const { user } = useAuth();
  const { rooms, loading, reload } = useUserShowrooms(user?.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [creatingDefault, setCreatingDefault] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(null);
      reload();
    }
  }, [open, reload]);

  // Auto-select first room when list loads
  useEffect(() => {
    if (open && !selected && rooms.length > 0) setSelected(rooms[0].id);
  }, [open, rooms, selected]);

  // If user has zero showrooms, auto-create a default "My Showroom" so the
  // "Send to Showroom" action always succeeds without forcing a detour.
  useEffect(() => {
    if (!open || loading || creatingDefault || !user) return;
    if (rooms.length > 0) return;
    let cancelled = false;
    (async () => {
      setCreatingDefault(true);
      const { data, error } = await supabase
        .from("showrooms")
        .insert({
          user_id: user.id,
          title: "My Showroom",
          intro: null,
          visibility: "private",
          hashtags: [],
        })
        .select("id")
        .single();
      if (cancelled) return;
      if (!error && data) {
        await reload();
        setSelected(data.id);
      }
      setCreatingDefault(false);
    })();
    return () => { cancelled = true; };
  }, [open, loading, rooms.length, user, creatingDefault, reload]);

  const handleSend = async () => {
    if (!user || !product || !selected) return;
    setSending(true);
    try {
      // Compute next position_order
      const { count } = await supabase
        .from("showroom_items")
        .select("id", { count: "exact", head: true })
        .eq("showroom_id", selected);

      const { error } = await supabase.from("showroom_items").insert({
        showroom_id: selected,
        source_type: "discover",
        product_id: product.id,
        image_url: product.imageUrl ?? null,
        title: product.name,
        brand: product.brand ?? null,
        position_order: count ?? 0,
      });
      if (error) throw error;
      toast.success("Sent to your Showroom");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't send");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[70vh] rounded-t-3xl border-t border-border/20 bg-background p-0"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-border/30 px-5 pb-3 pt-5">
            <h3 className="font-display text-base text-foreground">Send to my Showroom</h3>
            <p className="mt-0.5 text-[11px] text-foreground/55">Pick which Showroom this lands in.</p>
          </div>

          {/* Product preview */}
          {product && (
            <div className="flex items-center gap-3 border-b border-border/20 px-5 py-3">
              <div className="h-12 w-12 overflow-hidden rounded-lg bg-muted/40">
                <SafeImage src={product.imageUrl || ""} alt={product.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] uppercase tracking-wider text-foreground/55">{product.brand}</p>
                <p className="truncate text-sm text-foreground">{product.name}</p>
              </div>
            </div>
          )}

          {/* Rooms list */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex h-32 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-foreground/50" /></div>
            ) : rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <p className="text-sm text-foreground/65">You don't have any Showrooms yet.</p>
                <Link
                  to="/showroom/new"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[11px] font-bold tracking-wider text-accent-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Showroom
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((r) => {
                  const active = selected === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                        active
                          ? "border-accent/40 bg-accent/10"
                          : "border-border/40 bg-background hover:border-accent/25"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/40 text-foreground/60">
                        <LayoutGrid className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{r.title}</p>
                        <p className="truncate text-[11px] text-foreground/55">{r.intro || `${r.follower_count ?? 0} followers`}</p>
                      </div>
                      {active && <Check className="h-4 w-4 text-accent" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {rooms.length > 0 && (
            <div className="border-t border-border/30 bg-background px-5 py-3">
              <Button
                onClick={handleSend}
                disabled={!selected || sending || !product}
                className="w-full"
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Send to Showroom
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SendToShowroomSheet;
