import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Image as ImageIcon, MessageSquare, Shirt, BarChart3, EyeOff, Loader2 } from "lucide-react";
import { createWaveModule, type WaveModuleKind } from "@/hooks/useWaveModules";
import { toast } from "sonner";

const KINDS: { kind: WaveModuleKind; Icon: any; title: string; desc: string; defaultLabel: string }[] = [
  { kind: "photos", Icon: ImageIcon, title: "Photos", desc: "Photo album", defaultLabel: "Photos" },
  { kind: "board", Icon: MessageSquare, title: "Board", desc: "Posts & discussions", defaultLabel: "Board" },
  { kind: "wardrobe", Icon: Shirt, title: "Wardrobe", desc: "Shared finds from Discover", defaultLabel: "Wardrobe" },
  { kind: "poll", Icon: BarChart3, title: "Polls", desc: "Vote on outfits", defaultLabel: "Polls" },
  { kind: "anon_board", Icon: EyeOff, title: "Anonymous", desc: "Anonymous board", defaultLabel: "Anonymous" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  waveId: string;
  nextPosition: number;
  onCreated: () => void;
}

export default function AddModuleSheet({ open, onClose, waveId, nextPosition, onCreated }: Props) {
  const [picked, setPicked] = useState<WaveModuleKind | null>(null);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  const handleCreate = async () => {
    if (!picked) return;
    const finalLabel = label.trim() || KINDS.find(k => k.kind === picked)!.defaultLabel;
    setCreating(true);
    try {
      await createWaveModule(waveId, picked, finalLabel, nextPosition);
      toast.success("Menu added");
      onCreated();
      onClose();
      setPicked(null); setLabel("");
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 backdrop-blur p-4">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-md rounded-3xl bg-background p-5 shadow-2xl">
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-foreground/10 p-1.5"><X className="h-3.5 w-3.5" /></button>
          <h3 className="text-[16px] font-bold text-foreground">Add menu</h3>
          <p className="mt-0.5 text-[11.5px] text-foreground/55">Choose a type, then customize the name.</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {KINDS.map(k => {
              const Icon = k.Icon;
              const active = picked === k.kind;
              return (
                <button key={k.kind} onClick={() => { setPicked(k.kind); if (!label) setLabel(k.defaultLabel); }}
                  className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition ${
                    active ? "border-[hsl(330_85%_60%)] bg-[hsl(330_85%_60%/0.08)]" : "border-border/40 hover:bg-foreground/[0.04]"
                  }`}>
                  <Icon className={`h-4 w-4 ${active ? "text-[hsl(330_85%_60%)]" : "text-foreground/60"}`} />
                  <p className="text-[12px] font-semibold text-foreground">{k.title}</p>
                  <p className="text-[10px] text-foreground/55 leading-snug">{k.desc}</p>
                </button>
              );
            })}
          </div>

          {picked && (
            <div className="mt-4">
              <label className="text-[10px] font-semibold tracking-wide text-foreground/55">NAME</label>
              <input value={label} onChange={e => setLabel(e.target.value.slice(0, 24))} placeholder="Menu name"
                className="mt-1 w-full rounded-xl bg-foreground/[0.06] px-3 py-2 text-[13px] text-foreground outline-none focus:bg-foreground/[0.1]" />
            </div>
          )}

          <button onClick={handleCreate} disabled={!picked || creating}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)] px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40">
            {creating ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Add menu"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
