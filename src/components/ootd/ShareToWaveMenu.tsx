import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Waves, Loader2 } from "lucide-react";
import { useMyWaves, shareOOTDToWaveModule } from "@/hooks/useWaves";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  postImageUrl: string;
  caption?: string | null;
}

export default function ShareToWaveMenu({ open, onClose, postImageUrl, caption }: Props) {
  const { waves, loading } = useMyWaves();
  const [busy, setBusy] = useState<string | null>(null);

  if (!open) return null;

  const handleShare = async (waveId: string) => {
    setBusy(waveId);
    try {
      await shareOOTDToWaveModule(waveId, postImageUrl, caption);
      toast.success("Shared to wave");
      onClose();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(null); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur p-4">
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-sm rounded-3xl bg-background p-5 shadow-2xl">
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-foreground/10 p-1.5"><X className="h-3.5 w-3.5" /></button>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)]">
              <Waves className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-[15px] font-bold text-foreground">Share to a wave</h3>
          </div>

          {loading ? (
            <div className="py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-foreground/40" /></div>
          ) : waves.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-foreground/55">You're not in any waves yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto space-y-1.5">
              {waves.map(w => (
                <li key={w.id}>
                  <button onClick={() => handleShare(w.id)} disabled={busy === w.id}
                    className="flex w-full items-center gap-3 rounded-xl bg-foreground/[0.04] p-2.5 hover:bg-foreground/[0.08] disabled:opacity-50">
                    {w.cover_image_url ? (
                      <img src={w.cover_image_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(330_85%_60%/0.3)] to-[hsl(280_70%_55%/0.3)]">
                        <Waves className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[12.5px] font-semibold text-foreground truncate">{w.name}</p>
                      <p className="text-[10px] text-foreground/55">{w.member_count} members</p>
                    </div>
                    {busy === w.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/50" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
