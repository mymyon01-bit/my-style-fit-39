import { Plus, Settings2, Image as ImageIcon, MessageSquare, Shirt, BarChart3, EyeOff, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { WaveModule, WaveModuleKind } from "@/hooks/useWaveModules";
import { renameWaveModule, deleteWaveModule } from "@/hooks/useWaveModules";
import { toast } from "sonner";

const ICONS: Record<WaveModuleKind, any> = {
  photos: ImageIcon, board: MessageSquare, wardrobe: Shirt, poll: BarChart3, anon_board: EyeOff,
};

interface Props {
  modules: WaveModule[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isAdmin: boolean;
  isOwner: boolean;
  onAdd: () => void;
  onAdminPanel: () => void;
  onChanged: () => void;
}

export default function WaveSidebar({
  modules, selectedId, onSelect, isAdmin, isOwner, onAdd, onAdminPanel, onChanged
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const startEdit = (m: WaveModule) => { setEditingId(m.id); setEditVal(m.label); };
  const submitEdit = async () => {
    if (!editingId) return;
    try { await renameWaveModule(editingId, editVal); onChanged(); }
    catch (e: any) { toast.error(e.message); }
    finally { setEditingId(null); }
  };
  const handleDelete = async (m: WaveModule) => {
    if (!confirm(`Delete "${m.label}" and all its posts?`)) return;
    try { await deleteWaveModule(m.id); onChanged(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto sm:flex-col sm:gap-0.5 sm:overflow-visible scrollbar-hide">
      {modules.map(m => {
        const Icon = ICONS[m.kind] ?? ImageIcon;
        const active = m.id === selectedId;
        const editing = editingId === m.id;
        return (
          <div key={m.id} className="group relative shrink-0 sm:shrink">
            <button onClick={() => onSelect(m.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] transition ${
                active
                  ? "bg-[hsl(330_85%_60%/0.15)] text-[hsl(330_85%_60%)] font-semibold"
                  : "text-foreground/65 hover:bg-foreground/[0.06]"
              }`}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {editing ? (
                <input
                  autoFocus value={editVal}
                  onChange={e => setEditVal(e.target.value.slice(0, 24))}
                  onBlur={submitEdit}
                  onKeyDown={e => { if (e.key === "Enter") submitEdit(); if (e.key === "Escape") setEditingId(null); }}
                  className="bg-transparent outline-none text-[11.5px] w-20 sm:w-full"
                />
              ) : (
                <span className="truncate">{m.label}</span>
              )}
            </button>
            {isAdmin && !editing && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden gap-0.5 sm:group-hover:flex">
                <button onClick={() => startEdit(m)} className="rounded p-1 text-foreground/40 hover:bg-foreground/10 hover:text-foreground">
                  <Pencil className="h-2.5 w-2.5" />
                </button>
                {isOwner && (
                  <button onClick={() => handleDelete(m)} className="rounded p-1 text-foreground/40 hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {isAdmin && modules.length < 7 && (
        <button onClick={onAdd}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-dashed border-foreground/20 px-2.5 py-2 text-[11px] text-foreground/55 hover:border-[hsl(330_85%_60%/0.4)] hover:text-[hsl(330_85%_60%)]">
          <Plus className="h-3.5 w-3.5" /> Add menu
        </button>
      )}

      {isAdmin && (
        <button onClick={onAdminPanel}
          className="mt-auto flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] text-foreground/55 hover:bg-foreground/[0.06]">
          <Settings2 className="h-3.5 w-3.5" /> Admin
        </button>
      )}
    </nav>
  );
}
