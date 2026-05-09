import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, LogOut, Waves, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fetchWaveFeed, fetchWaveMembers, leaveWave, type Wave, type WaveMember } from "@/hooks/useWaves";
import InviteToWaveSheet from "./InviteToWaveSheet";
import OOTDInfoCard from "./OOTDInfoCard";
import { toast } from "sonner";

interface WaveModalProps {
  open: boolean;
  wave: Wave | null;
  onClose: () => void;
  onLeft?: () => void;
}

export default function WaveModal({ open, wave, onClose, onLeft }: WaveModalProps) {
  const { t } = useI18n();
  const [members, setMembers] = useState<WaveMember[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (!open || !wave) return;
    setLoading(true);
    Promise.all([fetchWaveMembers(wave.id), fetchWaveFeed(wave.id)]).then(([m, p]) => {
      setMembers(m); setPosts(p); setLoading(false);
    });
  }, [open, wave?.id]);

  if (!open || !wave) return null;

  const handleLeave = async () => {
    if (!confirm(t("waveLeaveConfirm"))) return;
    try {
      await leaveWave(wave.id);
      toast.success(t("waveLeftToast"));
      onLeft?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[115] flex items-stretch sm:items-center justify-center bg-black/75 backdrop-blur-md sm:p-4"
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 240 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-hidden rounded-none sm:rounded-3xl bg-background shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="relative">
            {wave.cover_image_url ? (
              <div className="relative h-32 w-full sm:h-40">
                <img src={wave.cover_image_url} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              </div>
            ) : (
              <div className="h-20 w-full bg-gradient-to-r from-[hsl(330_85%_60%/0.2)] to-[hsl(280_70%_55%/0.2)]" />
            )}
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 text-foreground/80 backdrop-blur hover:bg-background"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 -mt-2 pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(330_85%_60%)] to-[hsl(280_70%_55%)]">
                <Waves className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="truncate text-[18px] font-bold text-foreground">{wave.name}</h2>
                <p className="text-[11px] text-foreground/55">
                  {wave.member_count} {t("waveModalMembers")}
                </p>
              </div>
            </div>
            {wave.description && (
              <p className="mt-2 text-[12px] leading-relaxed text-foreground/70">{wave.description}</p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setInviteOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-[hsl(330_85%_60%)] px-3.5 py-1.5 text-[11.5px] font-bold text-white shadow-[0_4px_14px_-4px_hsl(330_85%_60%/0.5)] transition hover:opacity-95"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {t("waveModalInvite")}
              </button>
              <button
                onClick={handleLeave}
                className="flex items-center gap-1.5 rounded-full bg-foreground/[0.08] px-3.5 py-1.5 text-[11.5px] font-semibold text-foreground/70 transition hover:bg-destructive/15 hover:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t("waveModalLeave")}
              </button>
            </div>
          </div>

          {/* Members strip */}
          {members.length > 0 && (
            <div className="scrollbar-hide flex gap-2 overflow-x-auto px-5 pb-3">
              {members.map((m) => (
                <div key={m.user_id} className="flex shrink-0 flex-col items-center gap-1">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-background" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-bold text-foreground/60">
                      {(m.display_name?.[0] || m.username?.[0] || "?").toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[60px] truncate text-[9px] text-foreground/55">
                    {m.display_name || m.username}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Feed */}
          <div className="scrollbar-hide flex-1 overflow-y-auto px-5 pb-6 space-y-3">
            <OOTDInfoCard id="waves-intro" size="sm" />
            {loading ? (
              <div className="py-12 text-center text-foreground/40">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <p className="py-12 text-center text-[12px] text-foreground/45">{t("waveModalEmpty")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {posts.map((p) => (
                  <div key={p.id} className="aspect-[3/4] overflow-hidden rounded-xl bg-foreground/[0.04]">
                    <img src={p.image_url} alt={p.caption || ""} loading="lazy" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        <InviteToWaveSheet
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          waveId={wave.id}
          waveName={wave.name}
        />
      </motion.div>
    </AnimatePresence>
  );
}
