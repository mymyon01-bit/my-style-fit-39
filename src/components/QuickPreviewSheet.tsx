import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useStyleBoards } from "@/hooks/useStyleBoards";
import { Bookmark, ExternalLink, Loader2, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import SafeImage from "@/components/SafeImage";

interface QuickPreviewProps {
  open: boolean;
  onClose: () => void;
  product: {
    id?: string;
    product_key?: string;
    name?: string;
    brand?: string;
    image?: string;
    fit?: string;
    fabric?: string;
    silhouette?: string;
    recommended_size?: string;
    source_url?: string;
    price?: string | number;
  } | null;
}

/**
 * V4.3 Quick Preview — light popup for products without leaving the feed.
 * Shows fit summary, silhouette, recommended size, and "Add to Style Board".
 */
export default function QuickPreviewSheet({ open, onClose, product }: QuickPreviewProps) {
  const { boards, addItem, createBoard } = useStyleBoards();
  const [busy, setBusy] = useState<string | null>(null);

  if (!product) return null;

  const handleAdd = async (boardId: string) => {
    setBusy(boardId);
    const item = await addItem(boardId, {
      product_id: product.id || null,
      product_key: product.product_key || null,
      image_url: product.image || null,
      title: product.name || null,
      brand: product.brand || null,
    });
    setBusy(null);
    if (item) {
      toast.success("Added to board");
      onClose();
    }
  };

  const handleQuickBoard = async () => {
    setBusy("__new");
    const b = await createBoard("Save for Later", { board_type: "archive" });
    if (b) await handleAdd(b.id);
    setBusy(null);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <div className="mx-auto max-w-[520px] space-y-4 pb-6">
          <div className="flex gap-3">
            <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-foreground/[0.04]">
              <SafeImage src={product.image || ""} alt={product.name || ""} className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              {product.brand && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/55">{product.brand}</p>
              )}
              <h3 className="mt-0.5 font-display text-[16px] leading-tight tracking-tight text-foreground line-clamp-2">
                {product.name}
              </h3>
              {product.price && (
                <p className="mt-1 text-[12px] text-foreground/70">{product.price}</p>
              )}
              {product.source_url && (
                <a
                  href={product.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary"
                >
                  Open <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>

          {/* Fit summary chips */}
          <div className="flex flex-wrap gap-1.5 border-y border-foreground/10 py-3">
            {product.fit && <Chip label="Fit" value={product.fit} />}
            {product.silhouette && <Chip label="Silhouette" value={product.silhouette} />}
            {product.fabric && <Chip label="Fabric" value={product.fabric} />}
            {product.recommended_size && <Chip label="Suggested size" value={product.recommended_size} accent />}
            {!product.fit && !product.silhouette && !product.fabric && !product.recommended_size && (
              <p className="text-[11px] text-foreground/45">
                <Sparkles className="mr-1 inline h-3 w-3" />
                Open Fit to see size recommendation tailored to your body.
              </p>
            )}
          </div>

          {/* Save to board */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/55">
              Add to Style Board
            </p>
            {boards.length === 0 ? (
              <button
                onClick={handleQuickBoard}
                disabled={!!busy}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-foreground/15 bg-card/30 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/75 hover:border-foreground/40"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Create "Save for Later"
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {boards.slice(0, 6).map(b => (
                  <button
                    key={b.id}
                    onClick={() => handleAdd(b.id)}
                    disabled={!!busy}
                    className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-card/30 px-3 py-2 text-left transition-colors hover:border-foreground/30 disabled:opacity-50"
                  >
                    {busy === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bookmark className="h-3 w-3 text-foreground/55" />}
                    <span className="truncate text-[11px] text-foreground/80">{b.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider ${accent ? "border-primary/40 bg-primary/10 text-primary" : "border-foreground/15 text-foreground/70"}`}>
      <span className="opacity-50">{label}: </span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
