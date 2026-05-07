import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Folder, Sparkles, Loader2, Lock, Globe } from "lucide-react";
import { useStyleBoards } from "@/hooks/useStyleBoards";
import { toast } from "sonner";

/**
 * V4.3 Smart Archive Boards — Pinterest-style fashion boards.
 * Replaces the plain wishlist feel with named, themed collections
 * (Save for Later, Office Style, Summer Fit Ideas, …).
 */
export default function StyleBoardsPanel() {
  const navigate = useNavigate();
  const { boards, loading, createBoard, SUGGESTED_BOARDS } = useStyleBoards();
  const [creating, setCreating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [title, setTitle] = useState("");

  const handleCreate = async (presetTitle?: string, type?: "archive" | "inspiration" | "look") => {
    const t = (presetTitle || title).trim();
    if (!t) return;
    setCreating(true);
    const board = await createBoard(t, { board_type: type || "archive" });
    setCreating(false);
    setTitle("");
    setShowInput(false);
    if (board) toast.success(`"${board.title}" board created`);
  };

  return (
    <div className="space-y-5">
      <header className="border-b border-foreground/10 pb-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-foreground/50">
          Style Boards
        </p>
        <div className="mt-1.5 flex items-end justify-between gap-3">
          <h2 className="font-display text-[24px] leading-none tracking-tight text-foreground md:text-[30px]">
            Your Inspiration
          </h2>
          <button
            onClick={() => setShowInput(s => !s)}
            className="inline-flex items-center gap-1 pb-1 text-[10px] font-semibold tracking-[0.18em] text-foreground/55 hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> NEW BOARD
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-foreground/55">
          Build mood boards for trips, seasons or outfits — your visual fashion memory.
        </p>
      </header>

      {showInput && (
        <div className="flex items-center gap-2 rounded-xl border border-foreground/15 bg-card/40 p-2">
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Paris trip fits"
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            className="flex-1 bg-transparent px-2 py-1 text-[12px] text-foreground outline-none placeholder:text-foreground/40"
          />
          <button
            onClick={() => handleCreate()}
            disabled={creating || !title.trim()}
            className="rounded-full bg-foreground px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-background disabled:opacity-40"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-foreground/40" /></div>
      ) : boards.length === 0 ? (
        <div className="space-y-3">
          <p className="text-[11px] text-foreground/55">Start with a suggested board:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_BOARDS.map(s => (
              <button
                key={s.title}
                onClick={() => handleCreate(s.title, s.board_type as any)}
                className="rounded-full border border-foreground/15 bg-card/30 px-3 py-1.5 text-[10px] tracking-wide text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                + {s.title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {boards.map(b => (
            <button
              key={b.id}
              onClick={() => navigate(`/profile?board=${b.id}`)}
              className="group relative overflow-hidden rounded-xl border border-foreground/10 bg-card/40 text-left transition-colors hover:border-foreground/30"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-foreground/[0.04]">
                {b.cover_image_url ? (
                  <img src={b.cover_image_url} alt={b.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Sparkles className="h-6 w-6 text-foreground/20" />
                  </div>
                )}
                <div className="absolute right-1.5 top-1.5 rounded-full bg-background/70 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-foreground/70 backdrop-blur-sm">
                  {b.is_public ? <Globe className="inline h-2.5 w-2.5" /> : <Lock className="inline h-2.5 w-2.5" />}
                </div>
              </div>
              <div className="px-2.5 py-2">
                <p className="truncate font-display text-[13px] tracking-tight text-foreground">{b.title}</p>
                <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.18em] text-foreground/50">
                  {b.item_count} {b.item_count === 1 ? "item" : "items"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
