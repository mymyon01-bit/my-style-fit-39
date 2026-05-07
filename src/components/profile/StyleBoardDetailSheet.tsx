import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useBoardItems, useStyleBoards, type StyleBoard } from "@/hooks/useStyleBoards";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import SafeImage from "@/components/SafeImage";
import { Loader2, Trash2, ExternalLink, Globe, Lock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  boardId: string | null;
  onClose: () => void;
}

/**
 * V4.3 Style Board Detail — opens a board as a bottom sheet showing
 * its saved items in a Pinterest-style masonry-ish grid.
 */
export default function StyleBoardDetailSheet({ boardId, onClose }: Props) {
  const { user } = useAuth();
  const { boards, deleteBoard, reload } = useStyleBoards();
  const board: StyleBoard | undefined = boards.find(b => b.id === boardId);
  const { items, loading, reload: reloadItems } = useBoardItems(boardId);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { if (boardId) reloadItems(); }, [boardId, reloadItems]);

  const removeItem = async (id: string) => {
    if (!user) return;
    setBusy(id);
    const { error } = await supabase
      .from("style_board_items")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    setBusy(null);
    if (error) return toast.error("Could not remove");
    toast.success("Removed");
    reloadItems();
    reload();
  };

  const togglePublic = async () => {
    if (!user || !board) return;
    const { error } = await supabase
      .from("style_boards")
      .update({ is_public: !board.is_public })
      .eq("id", board.id)
      .eq("user_id", user.id);
    if (!error) {
      toast.success(board.is_public ? "Now private" : "Now public");
      reload();
    }
  };

  const handleDelete = async () => {
    if (!board) return;
    if (!confirm(`Delete "${board.title}"? Items will also be removed.`)) return;
    await deleteBoard(board.id);
    toast.success("Board deleted");
    onClose();
  };

  return (
    <Sheet open={!!boardId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl">
        <div className="mx-auto max-w-[680px] space-y-5 pb-8">
          {board && (
            <header className="space-y-2 border-b border-foreground/10 pb-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-foreground/50">
                Style Board · {board.board_type}
              </p>
              <div className="flex items-end justify-between gap-3">
                <h2 className="font-display text-[26px] leading-none tracking-tight text-foreground">
                  {board.title}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePublic}
                    className="inline-flex items-center gap-1 rounded-full border border-foreground/15 px-2.5 py-1 text-[10px] uppercase tracking-wider text-foreground/65 hover:border-foreground/40"
                  >
                    {board.is_public ? <><Globe className="h-2.5 w-2.5" /> Public</> : <><Lock className="h-2.5 w-2.5" /> Private</>}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-foreground/15 text-foreground/55 hover:border-destructive/50 hover:text-destructive"
                    aria-label="Delete board"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-foreground/55">
                {items.length} {items.length === 1 ? "item" : "items"}
                {board.description ? ` · ${board.description}` : ""}
              </p>
            </header>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-foreground/15 bg-card/20 px-4 py-10 text-center">
              <p className="font-display text-[15px] tracking-tight text-foreground/70">
                Nothing saved yet
              </p>
              <p className="mt-1 text-[11px] text-foreground/50">
                Long-press any product card to add it here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {items.map(it => (
                <div
                  key={it.id}
                  className="group relative overflow-hidden rounded-xl border border-foreground/10 bg-card/40"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-foreground/[0.04]">
                    {it.image_url ? (
                      <SafeImage
                        src={it.image_url}
                        alt={it.title || ""}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-foreground/20 text-[10px]">
                        No image
                      </div>
                    )}
                    <button
                      onClick={() => removeItem(it.id)}
                      disabled={busy === it.id}
                      className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-foreground/65 opacity-0 backdrop-blur-sm transition-opacity hover:text-destructive group-hover:opacity-100"
                      aria-label="Remove from board"
                    >
                      {busy === it.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                  <div className="px-2.5 py-2">
                    {it.brand && (
                      <p className="truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/55">
                        {it.brand}
                      </p>
                    )}
                    {it.title && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-foreground/85">{it.title}</p>
                    )}
                    {it.product_id && (
                      <a
                        href={`/fit/${it.product_id}`}
                        className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-primary"
                      >
                        Open <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
