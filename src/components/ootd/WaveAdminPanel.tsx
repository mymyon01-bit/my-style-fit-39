import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Crown, Loader2, UserMinus } from "lucide-react";
import { fetchWaveMembers, type Wave, type WaveMember } from "@/hooks/useWaves";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  wave: Wave;
  isOwner: boolean;
  isAdmin: boolean;
  onWaveDeleted: () => void;
}

export default function WaveAdminPanel({ open, onClose, wave, isOwner, isAdmin, onWaveDeleted }: Props) {
  const [members, setMembers] = useState<WaveMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchWaveMembers(wave.id).then(m => { setMembers(m); setLoading(false); });
  }, [open, wave.id]);

  if (!open) return null;

  const removeMember = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    try {
      await supabase.from("wave_members").delete().eq("wave_id", wave.id).eq("user_id", userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteWave = async () => {
    if (!confirm(`Delete the wave "${wave.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("waves").delete().eq("id", wave.id);
      if (error) throw error;
      toast.success("Wave deleted");
      onWaveDeleted();
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-[135] flex items-center justify-center bg-black/70 backdrop-blur p-4">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-background p-5 shadow-2xl">
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-foreground/10 p-1.5"><X className="h-3.5 w-3.5" /></button>
          <h3 className="text-[16px] font-bold text-foreground">Admin · {wave.name}</h3>

          <div className="mt-4">
            <p className="text-[10px] font-semibold tracking-wide text-foreground/55 mb-2">MEMBERS</p>
            {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin text-foreground/40" /> : (
              <ul className="space-y-1.5">
                {members.map(m => (
                  <li key={m.user_id} className="flex items-center gap-2 rounded-xl bg-foreground/[0.04] p-2">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-bold text-foreground/60">
                        {(m.display_name?.[0] || m.username?.[0] || "?").toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-foreground truncate">{m.display_name || m.username}</p>
                      <p className="text-[9.5px] text-foreground/55 capitalize flex items-center gap-1">
                        {m.role === "owner" && <Crown className="h-2.5 w-2.5 text-amber-400" />}
                        {m.role}
                      </p>
                    </div>
                    {isAdmin && m.role !== "owner" && (
                      <button onClick={() => removeMember(m.user_id)}
                        className="rounded-full p-1.5 text-foreground/50 hover:bg-destructive/10 hover:text-destructive">
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isOwner && (
            <div className="mt-5 border-t border-border/30 pt-4">
              <p className="text-[10px] font-semibold tracking-wide text-destructive/80 mb-2">DANGER ZONE</p>
              <button onClick={deleteWave} disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-2.5 text-[12px] font-semibold text-destructive hover:bg-destructive/15 disabled:opacity-40">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete this wave
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
